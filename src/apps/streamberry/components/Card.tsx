import React, { useCallback, type KeyboardEvent } from 'react';

interface CardProps {
    itemId: string;
    itemName: string;
    imageUrl: string | null;
    variant: 'poster' | 'landscape';
    progress?: number; // 0–1, watch progress
    rating?: string; // e.g. "TV-MA", "PG-13"
    year?: number;
    episodeInfo?: string; // e.g. "S2:E5"
    showTitle?: boolean; // defaults to true
    onClick?: () => void;
}

/**
 * Base card component for poster and landscape variants.
 *
 * Used in home rows, library grids, and search results. The image
 * aspect ratio (2:3 or 16:9) is enforced by CSS via `.sb-card--poster`
 * and `.sb-card--landscape`.
 *
 * When imageUrl is null a gradient fallback renders the item name so
 * the grid layout never collapses.
 *
 * The `data-item-id` attribute is required by the interaction aura
 * system to identify the hovered card without DOM traversal.
 */
export function Card({
    itemId,
    itemName,
    imageUrl,
    variant,
    progress,
    rating,
    year,
    episodeInfo,
    showTitle = true,
    onClick
}: Readonly<CardProps>) {
    const cardClass = `sb-card sb-card--${variant}`;
    const badgeText = episodeInfo ?? rating ?? null;
    const progressPercent = progress != null ? Math.min(1, Math.max(0, progress)) * 100 : null;

    const handleKeyDown = useCallback(
        (event: KeyboardEvent<HTMLDivElement>) => {
            if (onClick && (event.key === 'Enter' || event.key === ' ')) {
                event.preventDefault();
                onClick();
            }
        },
        [onClick]
    );

    return (
        <div
            className={cardClass}
            data-item-id={itemId}
            role='button'
            tabIndex={0}
            aria-label={itemName}
            onClick={onClick}
            onKeyDown={handleKeyDown}
        >
            <div className='sb-card__image-wrap'>
                {imageUrl != null ? (
                    <img
                        className='sb-card__image'
                        src={imageUrl}
                        alt={itemName}
                        loading='lazy'
                    />
                ) : (
                    <FallbackImagePlaceholder itemName={itemName} />
                )}

                {badgeText != null && (
                    <span className='sb-card__badge' aria-label={badgeText}>
                        {badgeText}
                    </span>
                )}

                {progressPercent != null && progressPercent > 0 && (
                    <div
                        className='sb-card__progress'
                        role='progressbar'
                        aria-valuenow={Math.round(progressPercent)}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-label={`${Math.round(progressPercent)}% watched`}
                    >
                        <div
                            className='sb-card__progress-fill'
                            style={{ width: `${progressPercent}%` }}
                        />
                    </div>
                )}
            </div>

            {showTitle && (
                <div className='sb-card__info'>
                    <div className='sb-card__title'>{itemName}</div>
                    {year != null && (
                        <div className='sb-card__year'>{year}</div>
                    )}
                </div>
            )}
        </div>
    );
}

// ---------------------------------------------------------------------------
// Internal sub-component
// ---------------------------------------------------------------------------

interface FallbackImagePlaceholderProps {
    itemName: string;
}

/**
 * Renders when no image URL is available.
 * Uses a CSS-variable gradient so it inherits the ambient accent color.
 * The item name gives the user context when artwork fails to load.
 */
function FallbackImagePlaceholder({ itemName }: Readonly<FallbackImagePlaceholderProps>) {
    return (
        <div
            className='sb-card__image sb-card__image--fallback'
            aria-hidden='true'
            style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'linear-gradient(135deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.01) 100%)',
                color: 'var(--text-tertiary)',
                fontSize: '12px',
                fontWeight: 600,
                textAlign: 'center',
                padding: '8px',
                overflow: 'hidden'
            }}
        >
            {itemName}
        </div>
    );
}
