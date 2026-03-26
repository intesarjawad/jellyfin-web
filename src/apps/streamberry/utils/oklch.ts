/**
 * OKLch color space conversion and governance utilities.
 *
 * All Streamberry ambient/accent colors pass through these governance gates
 * before reaching the UI. Raw extracted colors never bypass governance.
 *
 * Color pipeline: RGB (0-255) → Linear RGB → OKLab → OKLch → governed OKLch → CSS oklch()
 *
 * Conversion algorithm: Björn Ottosson's method (https://bottosson.github.io/posts/oklab/)
 */

import {
    AMBIENT_CHROMA_MAX,
    AMBIENT_LUMINANCE_MAX,
    AMBIENT_LUMINANCE_MIN,
    ACCENT_CHROMA_MAX,
    ACCENT_LUMINANCE_MAX,
    ACCENT_LUMINANCE_MIN,
    ANTI_MUD_THRESHOLD_DEG,
    ANTI_MUD_ROTATION_DEG,
    CONTRAST_ADJUSTMENT_MAX_STEPS,
    CONTRAST_ADJUSTMENT_STEP,
    GRAYSCALE_CHROMA_THRESHOLD,
    SEMANTIC_FALLBACK_CHROMA,
    SEMANTIC_FALLBACK_HUE,
    SEMANTIC_FALLBACK_LIGHTNESS,
    WCAG_AA_BODY_CONTRAST_RATIO
} from './constants';

export interface OklchColor {
    lightness: number;
    chroma: number;
    hue: number;
}

export interface RgbColor {
    r: number;
    g: number;
    b: number;
}

interface OklabColor {
    labLightness: number;
    labA: number;
    labB: number;
}

// The warm charcoal fallback used whenever artwork is grayscale or extraction fails.
export const OKLCH_SEMANTIC_FALLBACK: OklchColor = {
    lightness: SEMANTIC_FALLBACK_LIGHTNESS,
    chroma: SEMANTIC_FALLBACK_CHROMA,
    hue: SEMANTIC_FALLBACK_HUE
};

// -- sRGB gamma encoding / decoding ------------------------------------------

function linearizeChannel(channelValue: number): number {
    // Decode sRGB gamma: converts 0–1 sRGB to linear light
    return channelValue <= 0.04045
        ? channelValue / 12.92
        : Math.pow((channelValue + 0.055) / 1.055, 2.4);
}

function gammaEncodeChannel(linearValue: number): number {
    // Encode sRGB gamma: converts linear light to 0–1 sRGB
    return linearValue <= 0.0031308
        ? linearValue * 12.92
        : 1.055 * Math.pow(linearValue, 1.0 / 2.4) - 0.055;
}

// -- RGB ↔ OKLab (Björn Ottosson matrices) ------------------------------------

function rgbToOklab(red: number, green: number, blue: number): OklabColor {
    const linearRed = linearizeChannel(red / 255);
    const linearGreen = linearizeChannel(green / 255);
    const linearBlue = linearizeChannel(blue / 255);

    const longCone = 0.4122214708 * linearRed + 0.5363325363 * linearGreen + 0.0514459929 * linearBlue;
    const mediumCone = 0.2119034982 * linearRed + 0.6806995451 * linearGreen + 0.1073969566 * linearBlue;
    const shortCone = 0.0883024619 * linearRed + 0.2817188376 * linearGreen + 0.6299787005 * linearBlue;

    const longRoot = Math.cbrt(longCone);
    const mediumRoot = Math.cbrt(mediumCone);
    const shortRoot = Math.cbrt(shortCone);

    return {
        labLightness: 0.2104542553 * longRoot + 0.7936177850 * mediumRoot - 0.0040720468 * shortRoot,
        labA: 1.9779984951 * longRoot - 2.4285922050 * mediumRoot + 0.4505937099 * shortRoot,
        labB: 0.0259040371 * longRoot + 0.7827717662 * mediumRoot - 0.8086757660 * shortRoot
    };
}

function oklabToRgb(labLightness: number, labA: number, labB: number): RgbColor {
    const longRoot = labLightness + 0.3963377774 * labA + 0.2158037573 * labB;
    const mediumRoot = labLightness - 0.1055613458 * labA - 0.0638541728 * labB;
    const shortRoot = labLightness - 0.0894841775 * labA - 1.2914855480 * labB;

    const longCone = longRoot * longRoot * longRoot;
    const mediumCone = mediumRoot * mediumRoot * mediumRoot;
    const shortCone = shortRoot * shortRoot * shortRoot;

    const linearRed = 4.0767416621 * longCone - 3.3077115913 * mediumCone + 0.2309699292 * shortCone;
    const linearGreen = -1.2684380046 * longCone + 2.6097574011 * mediumCone - 0.3413193965 * shortCone;
    const linearBlue = -0.0041960863 * longCone - 0.7034186147 * mediumCone + 1.7076147010 * shortCone;

    return {
        r: Math.round(Math.max(0, Math.min(1, gammaEncodeChannel(linearRed))) * 255),
        g: Math.round(Math.max(0, Math.min(1, gammaEncodeChannel(linearGreen))) * 255),
        b: Math.round(Math.max(0, Math.min(1, gammaEncodeChannel(linearBlue))) * 255)
    };
}

// -- OKLab ↔ OKLch ------------------------------------------------------------

function oklabToOklch(lab: OklabColor): OklchColor {
    const chroma = Math.sqrt(lab.labA * lab.labA + lab.labB * lab.labB);
    let hueDegrees = Math.atan2(lab.labB, lab.labA) * (180 / Math.PI);
    if (hueDegrees < 0) hueDegrees += 360;

    return { lightness: lab.labLightness, chroma, hue: hueDegrees };
}

function oklchToOklab(lightness: number, chroma: number, hueDegrees: number): OklabColor {
    const hueRadians = hueDegrees * (Math.PI / 180);
    return {
        labLightness: lightness,
        labA: chroma * Math.cos(hueRadians),
        labB: chroma * Math.sin(hueRadians)
    };
}

// -- Public conversion functions ----------------------------------------------

/**
 * Converts sRGB (0–255 per channel) to OKLch.
 */
export function rgbToOklch(r: number, g: number, b: number): OklchColor {
    const lab = rgbToOklab(r, g, b);
    return oklabToOklch(lab);
}

/**
 * Converts OKLch back to sRGB (0–255 per channel).
 */
export function oklchToRgb(lightness: number, chroma: number, hue: number): RgbColor {
    const lab = oklchToOklab(lightness, chroma, hue);
    return oklabToRgb(lab.labLightness, lab.labA, lab.labB);
}

/**
 * Formats an OKLch color as a CSS `oklch()` string.
 */
export function formatOklchCss(lightness: number, chroma: number, hue: number): string {
    return `oklch(${lightness.toFixed(3)} ${chroma.toFixed(4)} ${hue.toFixed(1)})`;
}

// -- Governance functions -----------------------------------------------------

/**
 * Clamps the ambient color (background glow) to its governance bounds:
 * L 0.08–0.35, C max 0.12. Prevents black holes and washed-out pastels.
 */
export function governAmbient(lightness: number, chroma: number, hue: number): OklchColor {
    return {
        lightness: Math.max(AMBIENT_LUMINANCE_MIN, Math.min(AMBIENT_LUMINANCE_MAX, lightness)),
        chroma: Math.min(AMBIENT_CHROMA_MAX, chroma),
        hue
    };
}

/**
 * Clamps the accent color (interactive highlights) to its governance bounds:
 * L 0.40–0.75, C max 0.15. Prevents neon soup and inaccessible dim accents.
 */
export function governAccent(lightness: number, chroma: number, hue: number): OklchColor {
    return {
        lightness: Math.max(ACCENT_LUMINANCE_MIN, Math.min(ACCENT_LUMINANCE_MAX, lightness)),
        chroma: Math.min(ACCENT_CHROMA_MAX, chroma),
        hue
    };
}

/**
 * Anti-mud rule: when two hues are within 30° of each other, they produce
 * muddy composites. Rotate the secondary hue by 60° to create complementary
 * tension instead.
 *
 * @returns The potentially-adjusted pair of hues [hue1, adjustedHue2].
 */
export function antiMudRotation(hue1: number, hue2: number): [number, number] {
    const rawDifference = Math.abs(hue1 - hue2);
    const wrappedDifference = Math.min(rawDifference, 360 - rawDifference);

    if (wrappedDifference < ANTI_MUD_THRESHOLD_DEG) {
        return [hue1, (hue2 + ANTI_MUD_ROTATION_DEG) % 360];
    }

    return [hue1, hue2];
}

/**
 * Computes WCAG relative luminance for an sRGB color (0–255 per channel).
 * Uses the IEC 61966-2-1 sRGB linearization.
 */
export function computeRelativeLuminance(r: number, g: number, b: number): number {
    const linearRed = linearizeChannel(r / 255);
    const linearGreen = linearizeChannel(g / 255);
    const linearBlue = linearizeChannel(b / 255);
    return 0.2126 * linearRed + 0.7152 * linearGreen + 0.0722 * linearBlue;
}

/**
 * Computes the WCAG contrast ratio between two relative luminance values.
 */
export function computeContrastRatio(luminanceA: number, luminanceB: number): number {
    const lighter = Math.max(luminanceA, luminanceB);
    const darker = Math.min(luminanceA, luminanceB);
    return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Returns whether the foreground and background colors meet WCAG AA contrast
 * for body text (4.5:1 ratio). Accepts sRGB objects for both colors.
 */
export function meetsContrastAA(foreground: RgbColor, background: RgbColor): boolean {
    const foregroundLuminance = computeRelativeLuminance(foreground.r, foreground.g, foreground.b);
    const backgroundLuminance = computeRelativeLuminance(background.r, background.g, background.b);
    return computeContrastRatio(foregroundLuminance, backgroundLuminance) >= WCAG_AA_BODY_CONTRAST_RATIO;
}

/**
 * Iteratively increases foreground lightness until it meets the given contrast
 * ratio against the background. Used to keep text legible over ambient colors.
 *
 * Returns the adjusted foreground OKLch. Caller is responsible for converting
 * back to RGB if needed.
 */
export function enforceContrastByLightnessBoost(
    foregroundOklch: OklchColor,
    backgroundOklch: OklchColor,
    targetContrastRatio: number
): OklchColor {
    const backgroundRgb = oklchToRgb(
        backgroundOklch.lightness,
        backgroundOklch.chroma,
        backgroundOklch.hue
    );
    const backgroundLuminance = computeRelativeLuminance(
        backgroundRgb.r, backgroundRgb.g, backgroundRgb.b
    );

    let adjustedForeground: OklchColor = { ...foregroundOklch };

    for (let step = 0; step < CONTRAST_ADJUSTMENT_MAX_STEPS; step++) {
        const foregroundRgb = oklchToRgb(
            adjustedForeground.lightness,
            adjustedForeground.chroma,
            adjustedForeground.hue
        );
        const foregroundLuminance = computeRelativeLuminance(
            foregroundRgb.r, foregroundRgb.g, foregroundRgb.b
        );

        if (computeContrastRatio(foregroundLuminance, backgroundLuminance) >= targetContrastRatio) {
            return adjustedForeground;
        }

        adjustedForeground = {
            ...adjustedForeground,
            lightness: Math.min(1.0, adjustedForeground.lightness + CONTRAST_ADJUSTMENT_STEP)
        };
    }

    return adjustedForeground;
}

/**
 * Returns whether a color is chromatic enough to be useful.
 * Grayscale artwork should trigger the semantic fallback in the scene system.
 */
export function isChromatic(r: number, g: number, b: number): boolean {
    return rgbToOklch(r, g, b).chroma >= GRAYSCALE_CHROMA_THRESHOLD;
}
