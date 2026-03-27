import { useRef } from 'react';

import {
    CARD_MORPH_DURATION_MS,
    CARD_STAGGER_DELAY_MS,
    HERO_CROSSFADE_DURATION_MS,
    MAX_STAGGER_CARDS,
    TAB_TRANSITION_DURATION_MS
} from '../utils/constants';

const DEFAULT_EASING = 'cubic-bezier(0.16, 1, 0.3, 1)';

interface FlipOptions {
    durationMs: number;
    easing?: string;
}

interface CapturedSnapshot {
    rect: DOMRect;
    opacity: number;
}

/**
 * Returns the computed opacity of an element as a number in [0, 1].
 * Falls back to 1.0 when the style is not a parseable float.
 */
function readComputedOpacity(element: HTMLElement): number {
    const raw = window.getComputedStyle(element).opacity;
    const parsed = parseFloat(raw);
    return Number.isFinite(parsed) ? parsed : 1;
}

/**
 * useFlipTransition
 *
 * Provides FLIP (First, Last, Invert, Play) animation utilities using the
 * Web Animations API. Call captureFirst before a layout change, then
 * animateToLast after React has committed the new layout.
 *
 * Also exposes crossfade for hero transitions and staggerCards for grid
 * reveal animations.
 *
 * Timing constants are pre-wired from ../utils/constants so call sites only
 * need to override when intentionally deviating from the design system.
 */
export function useFlipTransition() {
    const snapshotRef = useRef<CapturedSnapshot | null>(null);

    /**
     * Captures the element's current bounding rect and opacity.
     * Must be called before the DOM mutation that changes the layout.
     */
    function captureFirst(element: HTMLElement): void {
        snapshotRef.current = {
            rect: element.getBoundingClientRect(),
            opacity: readComputedOpacity(element)
        };
    }

    /**
     * Calculates the delta between the snapshot and the element's current
     * (post-mutation) position, then runs a FLIP animation to invert and
     * play the element into place.
     *
     * No-ops when captureFirst was not called beforehand.
     */
    function animateToLast(element: HTMLElement, options: FlipOptions): void {
        const snapshot = snapshotRef.current;
        if (snapshot === null) return;

        const lastRect = element.getBoundingClientRect();
        const easing = options.easing ?? DEFAULT_EASING;

        const deltaX = snapshot.rect.left - lastRect.left;
        const deltaY = snapshot.rect.top - lastRect.top;
        const scaleX = snapshot.rect.width / lastRect.width;
        const scaleY = snapshot.rect.height / lastRect.height;

        element.animate(
            [
                {
                    transform: `translate(${deltaX}px, ${deltaY}px) scale(${scaleX}, ${scaleY})`,
                    opacity: snapshot.opacity
                },
                {
                    transform: 'translate(0, 0) scale(1, 1)',
                    opacity: readComputedOpacity(element)
                }
            ],
            {
                duration: options.durationMs,
                easing,
                fill: 'none'
            }
        );

        snapshotRef.current = null;
    }

    /**
     * Simultaneously fades out one element and fades in another.
     * Used for hero crossfades and tab content transitions.
     */
    function crossfade(
        outElement: HTMLElement,
        inElement: HTMLElement,
        durationMs: number = HERO_CROSSFADE_DURATION_MS
    ): void {
        const easing = DEFAULT_EASING;

        outElement.animate([{ opacity: 1 }, { opacity: 0 }], {
            duration: durationMs,
            easing,
            fill: 'forwards'
        });

        inElement.animate([{ opacity: 0 }, { opacity: 1 }], {
            duration: durationMs,
            easing,
            fill: 'forwards'
        });
    }

    /**
     * Staggers a fade-in + scale-up reveal across a list of card elements.
     * Caps at maxCards to avoid runaway delays on large grids.
     */
    function staggerCards(
        elements: HTMLElement[],
        delayPerCardMs: number = CARD_STAGGER_DELAY_MS,
        maxCards: number = MAX_STAGGER_CARDS
    ): void {
        const visibleElements = elements.slice(0, maxCards);

        visibleElements.forEach((card, cardIndex) => {
            card.animate(
                [
                    { opacity: 0, transform: 'scale(0.95)' },
                    { opacity: 1, transform: 'scale(1)' }
                ],
                {
                    duration: TAB_TRANSITION_DURATION_MS,
                    easing: DEFAULT_EASING,
                    delay: cardIndex * delayPerCardMs,
                    fill: 'both'
                }
            );
        });
    }

    return {
        captureFirst,
        animateToLast,
        crossfade,
        staggerCards,
        /** Pre-wired durations from the design system, exported for convenience */
        durations: {
            cardMorph: CARD_MORPH_DURATION_MS,
            heroCrossfade: HERO_CROSSFADE_DURATION_MS,
            tabTransition: TAB_TRANSITION_DURATION_MS
        }
    };
}
