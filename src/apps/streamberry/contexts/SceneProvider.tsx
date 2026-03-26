import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useRef,
    useState,
    type ReactNode
} from 'react';

import { extractDominantColors } from '../utils/colorQuantize';
import {
    AMBIENT_CROSSFADE_DURATION_MS,
    PALETTE_CACHE_MAX,
    SCENE_DEBOUNCE_MS
} from '../utils/constants';
import {
    antiMudRotation,
    formatOklchCss,
    governAccent,
    governAmbient,
    isChromatic,
    OKLCH_SEMANTIC_FALLBACK,
    rgbToOklch,
    type OklchColor
} from '../utils/oklch';

export interface ActiveSceneItem {
    itemId: string;
    primaryImageUrl: string | null;
    backdropImageUrl: string | null;
}

export interface SceneContextValue {
    activeItem: ActiveSceneItem | null;
    setActiveItem: (item: ActiveSceneItem | null) => void;
}

interface GovernedPalette {
    ambientPrimary: OklchColor;
    ambientSecondary: OklchColor;
    ambientAccent: OklchColor;
}

interface CacheEntry {
    palette: GovernedPalette;
    /** Monotonically increasing access counter for LRU eviction. */
    lastAccessedAt: number;
}

const SceneContext = createContext<SceneContextValue>({
    activeItem: null,
    setActiveItem: () => undefined
});

interface SceneProviderProps {
    children: ReactNode;
}

// CSS custom property names applied to document.documentElement
const CSS_PROP_AMBIENT_PRIMARY = '--ambient-primary';
const CSS_PROP_AMBIENT_SECONDARY = '--ambient-secondary';
const CSS_PROP_AMBIENT_ACCENT = '--ambient-accent';

/**
 * Parses a CSS oklch() string back into its three numeric components.
 * Returns null if the property is not set or unparseable.
 */
function parseOklchCssValue(cssValue: string): OklchColor | null {
    // Matches "oklch(0.123 0.0456 123.4)" with optional whitespace
    const match = /oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*\)/.exec(cssValue.trim());
    if (!match) return null;
    return {
        lightness: parseFloat(match[1]),
        chroma: parseFloat(match[2]),
        hue: parseFloat(match[3])
    };
}

/**
 * Reads the three current ambient CSS custom properties from documentElement,
 * returning the fallback for any that are absent or unparseable.
 */
function readCurrentAmbientColors(): GovernedPalette {
    const style = getComputedStyle(document.documentElement);

    const parsedPrimary = parseOklchCssValue(style.getPropertyValue(CSS_PROP_AMBIENT_PRIMARY));
    const parsedSecondary = parseOklchCssValue(style.getPropertyValue(CSS_PROP_AMBIENT_SECONDARY));
    const parsedAccent = parseOklchCssValue(style.getPropertyValue(CSS_PROP_AMBIENT_ACCENT));

    return {
        ambientPrimary: parsedPrimary ?? OKLCH_SEMANTIC_FALLBACK,
        ambientSecondary: parsedSecondary ?? OKLCH_SEMANTIC_FALLBACK,
        ambientAccent: parsedAccent ?? OKLCH_SEMANTIC_FALLBACK
    };
}

/**
 * Linearly interpolates between two OKLch colors at the given progress (0–1).
 * Hue interpolation takes the shortest arc around the 360° circle.
 */
function interpolateOklch(from: OklchColor, to: OklchColor, progress: number): OklchColor {
    let hueDifference = to.hue - from.hue;
    if (hueDifference > 180) hueDifference -= 360;
    if (hueDifference < -180) hueDifference += 360;

    return {
        lightness: from.lightness + (to.lightness - from.lightness) * progress,
        chroma: from.chroma + (to.chroma - from.chroma) * progress,
        hue: (from.hue + hueDifference * progress + 360) % 360
    };
}

/**
 * Applies a smooth ease-in-out cubic curve to a linear progress value.
 */
function easeInOut(linearProgress: number): number {
    return linearProgress < 0.5 ?
        2 * linearProgress * linearProgress :
        1 - Math.pow(-2 * linearProgress + 2, 2) / 2;
}

/**
 * Animates the three ambient CSS custom properties on document.documentElement
 * from their current values to the target palette, interpolating over
 * AMBIENT_CROSSFADE_DURATION_MS using requestAnimationFrame.
 *
 * Returns a cancellation function. Call it to stop the animation mid-flight
 * (e.g. when a newer item arrives before the previous crossfade completes).
 */
function animateAmbientColors(targetPalette: GovernedPalette): () => void {
    const fromPalette = readCurrentAmbientColors();
    const animationStartTime = performance.now();
    let activeFrameId: number | null = null;
    let isCancelled = false;

    function applyFrame(currentTime: number): void {
        if (isCancelled) return;

        const elapsed = currentTime - animationStartTime;
        const linearProgress = Math.min(elapsed / AMBIENT_CROSSFADE_DURATION_MS, 1);
        const easedProgress = easeInOut(linearProgress);

        const currentPrimary = interpolateOklch(fromPalette.ambientPrimary, targetPalette.ambientPrimary, easedProgress);
        const currentSecondary = interpolateOklch(fromPalette.ambientSecondary, targetPalette.ambientSecondary, easedProgress);
        const currentAccent = interpolateOklch(fromPalette.ambientAccent, targetPalette.ambientAccent, easedProgress);

        const rootStyle = document.documentElement.style;
        rootStyle.setProperty(CSS_PROP_AMBIENT_PRIMARY, formatOklchCss(currentPrimary.lightness, currentPrimary.chroma, currentPrimary.hue));
        rootStyle.setProperty(CSS_PROP_AMBIENT_SECONDARY, formatOklchCss(currentSecondary.lightness, currentSecondary.chroma, currentSecondary.hue));
        rootStyle.setProperty(CSS_PROP_AMBIENT_ACCENT, formatOklchCss(currentAccent.lightness, currentAccent.chroma, currentAccent.hue));

        if (linearProgress < 1) {
            activeFrameId = requestAnimationFrame(applyFrame);
        }
    }

    activeFrameId = requestAnimationFrame(applyFrame);

    return () => {
        isCancelled = true;
        if (activeFrameId !== null) {
            cancelAnimationFrame(activeFrameId);
        }
    };
}

/**
 * Derives a governed palette from the dominant colors extracted from artwork.
 * Falls back to OKLCH_SEMANTIC_FALLBACK when no chromatic colors are present.
 *
 * Pipeline:
 *   1. Pick the most dominant chromatic color as the primary ambient.
 *   2. Pick the second-most dominant chromatic color as the secondary ambient.
 *   3. Pick the most saturated chromatic color as the accent.
 *   4. Apply antiMudRotation() between primary and secondary hue.
 *   5. Apply governAmbient() to primary and secondary.
 *   6. Apply governAccent() to accent.
 */
function buildGovernedPalette(
    extractedColors: Array<{ r: number; g: number; b: number }>
): GovernedPalette {
    const chromaticColors = extractedColors
        .map(({ r, g, b }) => rgbToOklch(r, g, b))
        .filter(color => color.chroma >= 0.02); // same threshold as isChromatic()

    if (chromaticColors.length === 0) {
        return {
            ambientPrimary: OKLCH_SEMANTIC_FALLBACK,
            ambientSecondary: OKLCH_SEMANTIC_FALLBACK,
            ambientAccent: OKLCH_SEMANTIC_FALLBACK
        };
    }

    const dominantColor = chromaticColors[0];
    const secondaryColor = chromaticColors.length > 1 ? chromaticColors[1] : chromaticColors[0];

    // Most saturated color for the accent (highest chroma wins)
    const accentColor = chromaticColors.reduce(
        (mostSaturated, candidate) => candidate.chroma > mostSaturated.chroma ? candidate : mostSaturated,
        chromaticColors[0]
    );

    const [adjustedPrimaryHue, adjustedSecondaryHue] = antiMudRotation(dominantColor.hue, secondaryColor.hue);

    const governedPrimary = governAmbient(dominantColor.lightness, dominantColor.chroma, adjustedPrimaryHue);
    const governedSecondary = governAmbient(secondaryColor.lightness, secondaryColor.chroma, adjustedSecondaryHue);
    const governedAccent = governAccent(accentColor.lightness, accentColor.chroma, accentColor.hue);

    return {
        ambientPrimary: governedPrimary,
        ambientSecondary: governedSecondary,
        ambientAccent: governedAccent
    };
}

/**
 * Drives the ambient color pipeline: watches the active item, debounces
 * changes, extracts dominant colors from artwork, governs the palette, and
 * animates the CSS custom properties on document.documentElement.
 *
 * Caches up to PALETTE_CACHE_MAX palettes by item ID using LRU eviction.
 */
export function SceneProvider({ children }: Readonly<SceneProviderProps>) {
    const [activeItem, setActiveItem] = useState<ActiveSceneItem | null>(null);

    // Palette cache keyed by itemId. Stored in a ref to avoid causing re-renders.
    const paletteCache = useRef<Map<string, CacheEntry>>(new Map());
    // Monotonic counter for tracking LRU order without timestamps
    const accessCounter = useRef(0);

    // Cancellation function for the currently running rAF animation
    const cancelCurrentAnimation = useRef<(() => void) | null>(null);

    const applyPalette = useCallback((palette: GovernedPalette) => {
        if (cancelCurrentAnimation.current) {
            cancelCurrentAnimation.current();
        }
        cancelCurrentAnimation.current = animateAmbientColors(palette);
    }, []);

    const evictLruEntryIfNeeded = useCallback(() => {
        const cache = paletteCache.current;
        if (cache.size < PALETTE_CACHE_MAX) return;

        let oldestKey: string | null = null;
        let oldestAccessTime = Infinity;

        for (const [key, entry] of cache.entries()) {
            if (entry.lastAccessedAt < oldestAccessTime) {
                oldestAccessTime = entry.lastAccessedAt;
                oldestKey = key;
            }
        }

        if (oldestKey !== null) {
            cache.delete(oldestKey);
        }
    }, []);

    useEffect(() => {
        if (activeItem === null) {
            applyPalette({
                ambientPrimary: OKLCH_SEMANTIC_FALLBACK,
                ambientSecondary: OKLCH_SEMANTIC_FALLBACK,
                ambientAccent: OKLCH_SEMANTIC_FALLBACK
            });
            return;
        }

        const { itemId, backdropImageUrl, primaryImageUrl } = activeItem;
        const imageUrl = backdropImageUrl ?? primaryImageUrl;

        const cachedEntry = paletteCache.current.get(itemId);
        if (cachedEntry) {
            accessCounter.current += 1;
            cachedEntry.lastAccessedAt = accessCounter.current;
            applyPalette(cachedEntry.palette);
            return;
        }

        if (!imageUrl) {
            applyPalette({
                ambientPrimary: OKLCH_SEMANTIC_FALLBACK,
                ambientSecondary: OKLCH_SEMANTIC_FALLBACK,
                ambientAccent: OKLCH_SEMANTIC_FALLBACK
            });
            return;
        }

        let isCancelledByDebounce = false;

        const debounceTimer = setTimeout(async () => {
            if (isCancelledByDebounce) return;

            try {
                const extractedColors = await extractDominantColors(imageUrl);

                if (isCancelledByDebounce) return;

                const dominantColor = extractedColors[0];
                const paletteIsGrayscale = !dominantColor || !isChromatic(dominantColor.r, dominantColor.g, dominantColor.b);

                const palette = paletteIsGrayscale ?
                    {
                        ambientPrimary: OKLCH_SEMANTIC_FALLBACK,
                        ambientSecondary: OKLCH_SEMANTIC_FALLBACK,
                        ambientAccent: OKLCH_SEMANTIC_FALLBACK
                    } :
                    buildGovernedPalette(extractedColors);

                evictLruEntryIfNeeded();
                accessCounter.current += 1;
                paletteCache.current.set(itemId, {
                    palette,
                    lastAccessedAt: accessCounter.current
                });

                applyPalette(palette);
            } catch {
                // Image load failed or extraction threw — fall back gracefully
                if (!isCancelledByDebounce) {
                    applyPalette({
                        ambientPrimary: OKLCH_SEMANTIC_FALLBACK,
                        ambientSecondary: OKLCH_SEMANTIC_FALLBACK,
                        ambientAccent: OKLCH_SEMANTIC_FALLBACK
                    });
                }
            }
        }, SCENE_DEBOUNCE_MS);

        return () => {
            isCancelledByDebounce = true;
            clearTimeout(debounceTimer);
        };
    }, [activeItem, applyPalette, evictLruEntryIfNeeded]);

    // Cancel any in-flight animation when the provider unmounts
    useEffect(() => {
        return () => {
            if (cancelCurrentAnimation.current) {
                cancelCurrentAnimation.current();
            }
        };
    }, []);

    return (
        <SceneContext.Provider value={{ activeItem, setActiveItem }}>
            {children}
        </SceneContext.Provider>
    );
}

/**
 * Returns the current scene state and a setter for updating the active item.
 * Must be used inside a SceneProvider.
 */
export function useScene(): SceneContextValue {
    return useContext(SceneContext);
}
