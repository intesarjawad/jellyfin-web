import React, { forwardRef, type ElementType, type ReactNode } from 'react';

type GlassElevation = 'low' | 'medium' | 'high';

/**
 * Maps the semantic elevation prop to the glass utility class defined in tokens.css.
 *
 * low    → glass-panel      (lightest blur, thinnest border — floating panels, dialogs)
 * medium → glass-interactive (mid-weight — interactive surfaces, popovers)
 * high   → glass-chrome     (heaviest blur — top-chrome, persistent nav surfaces)
 */
const ELEVATION_CLASS: Record<GlassElevation, string> = {
    low: 'glass-panel',
    medium: 'glass-interactive',
    high: 'glass-chrome'
};

interface GlassPanelProps {
    children: ReactNode;
    className?: string;
    elevation?: GlassElevation;
    as?: keyof JSX.IntrinsicElements;
}

/**
 * Reusable glass surface container.
 *
 * Applies the correct glass token class for the requested elevation level.
 * All backdrop-filter, background, and border values come from tokens.css —
 * this component adds no inline styles.
 *
 * Use `as` to render as any HTML element (e.g. `section`, `aside`, `dialog`).
 * Defaults to `div`.
 *
 * @example
 * <GlassPanel elevation="low" className="my-detail-panel">
 *   <DetailContent />
 * </GlassPanel>
 */
export const GlassPanel = forwardRef<HTMLElement, GlassPanelProps>(
    ({ children, className, elevation = 'medium', as: Tag = 'div' }, ref) => {
        const elevationClass = ELEVATION_CLASS[elevation];
        const resolvedClassName = className
            ? `${elevationClass} ${className}`
            : elevationClass;

        const AnyTag = Tag as ElementType;

        return (
            <AnyTag ref={ref} className={resolvedClassName}>
                {children}
            </AnyTag>
        );
    }
);

GlassPanel.displayName = 'GlassPanel';
