import { type RefObject, useEffect } from 'react';

import {
    AURA_ACTIVATION_DISTANCE_PX,
    AURA_FRICTION,
    AURA_GLOW_OPACITY_MAX,
    AURA_MAX_DISPLACEMENT_PX
} from '../utils/constants';

/**
 * Per-card runtime state tracked between animation frames.
 * Kept outside React state to avoid re-renders — these are purely visual.
 */
interface CardAuraState {
    currentDisplacementX: number;
    currentDisplacementY: number;
    currentGlowOpacity: number;
}

const cardAuraStates = new WeakMap<HTMLElement, CardAuraState>();

function getOrCreateAuraState(card: HTMLElement): CardAuraState {
    let state = cardAuraStates.get(card);
    if (state === undefined) {
        state = {
            currentDisplacementX: 0,
            currentDisplacementY: 0,
            currentGlowOpacity: 0
        };
        cardAuraStates.set(card, state);
    }
    return state;
}

/**
 * useInteractionAura
 *
 * Attaches a single mousemove listener to a container element and applies
 * pointer-magnetism displacement plus a glow intensity to every .sb-card
 * child within activation range.
 *
 * All visual updates run inside requestAnimationFrame to avoid layout
 * thrashing. Friction is applied when the pointer moves out of range so
 * cards ease back to rest rather than snapping.
 *
 * CSS variable --sb-aura-opacity on each card drives a ::after pseudo-element
 * glow defined in the design token stylesheet. The hook owns only the
 * computed value — the visual rendering stays in CSS.
 */
export function useInteractionAura(
    containerRef: RefObject<HTMLElement | null>
): void {
    useEffect(() => {
        const container = containerRef.current;
        if (container === null) return;

        let rafHandle: number | null = null;
        let pendingPointerX = 0;
        let pendingPointerY = 0;
        let hasNewFrame = false;

        function applyAuraFrame(): void {
            rafHandle = null;

            const cards = container!.querySelectorAll<HTMLElement>('.sb-card');

            cards.forEach((card) => {
                const cardRect = card.getBoundingClientRect();
                const cardCenterX = cardRect.left + cardRect.width / 2;
                const cardCenterY = cardRect.top + cardRect.height / 2;

                const rawDeltaX = pendingPointerX - cardCenterX;
                const rawDeltaY = pendingPointerY - cardCenterY;
                const distanceFromCenter = Math.hypot(rawDeltaX, rawDeltaY);

                const state = getOrCreateAuraState(card);

                if (distanceFromCenter <= AURA_ACTIVATION_DISTANCE_PX) {
                    // Normalise delta into [0, 1] range within the activation radius,
                    // then scale to the maximum allowed displacement.
                    const influence =
                        1 - distanceFromCenter / AURA_ACTIVATION_DISTANCE_PX;

                    const targetDisplacementX =
                        (rawDeltaX / AURA_ACTIVATION_DISTANCE_PX)
                        * AURA_MAX_DISPLACEMENT_PX;
                    const targetDisplacementY =
                        (rawDeltaY / AURA_ACTIVATION_DISTANCE_PX)
                        * AURA_MAX_DISPLACEMENT_PX;
                    const targetGlowOpacity =
                        influence * AURA_GLOW_OPACITY_MAX;

                    // Lerp toward target rather than snapping — smoother entry.
                    state.currentDisplacementX
                        += (targetDisplacementX - state.currentDisplacementX)
                        * (1 - AURA_FRICTION);
                    state.currentDisplacementY +=
                        (targetDisplacementY - state.currentDisplacementY) *
                        (1 - AURA_FRICTION);
                    state.currentGlowOpacity +=
                        (targetGlowOpacity - state.currentGlowOpacity) *
                        (1 - AURA_FRICTION);
                } else {
                    // Outside activation range — friction-decay back to rest.
                    state.currentDisplacementX *= AURA_FRICTION;
                    state.currentDisplacementY *= AURA_FRICTION;
                    state.currentGlowOpacity *= AURA_FRICTION;
                }

                // Write all style mutations together after reading all rects
                // (querySelectorAll + getBoundingClientRect above) to avoid
                // interleaved read/write layout thrashing.
                card.style.transform = `translate(${state.currentDisplacementX.toFixed(2)}px, ${state.currentDisplacementY.toFixed(2)}px)`;
                card.style.setProperty(
                    '--sb-aura-opacity',
                    state.currentGlowOpacity.toFixed(4)
                );
            });

            // Keep the RAF loop alive while there are pending frames.
            if (hasNewFrame) {
                hasNewFrame = false;
                rafHandle = requestAnimationFrame(applyAuraFrame);
            }
        }

        function onMouseMove(event: MouseEvent): void {
            pendingPointerX = event.clientX;
            pendingPointerY = event.clientY;
            hasNewFrame = true;

            // Schedule a frame only when one isn't already queued.
            if (rafHandle === null) {
                rafHandle = requestAnimationFrame(applyAuraFrame);
            }
        }

        function onMouseLeave(): void {
            // Trigger a decay frame when the pointer leaves the container.
            pendingPointerX = -9999;
            pendingPointerY = -9999;
            hasNewFrame = true;

            if (rafHandle === null) {
                rafHandle = requestAnimationFrame(applyAuraFrame);
            }
        }

        container.addEventListener('mousemove', onMouseMove);
        container.addEventListener('mouseleave', onMouseLeave);

        return () => {
            container.removeEventListener('mousemove', onMouseMove);
            container.removeEventListener('mouseleave', onMouseLeave);

            if (rafHandle !== null) {
                cancelAnimationFrame(rafHandle);
            }
        };
    }, [containerRef]);
}
