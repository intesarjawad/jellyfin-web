import React, { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

import { useItemImageUrl } from '../../hooks/useItemImageUrl';
import type { ItemDto } from 'types/base/models/item-dto';

const SPOTLIGHT_ITEM_COUNT = 3;

interface SpotlightProps {
    items: ItemDto[];
}

/**
 * Curated spotlight section showing 2–3 items in a wider landscape card format.
 *
 * Positioned between the hero and the content rows. Renders nothing when items
 * is empty so the caller does not need to guard against it.
 */
export function Spotlight({ items }: SpotlightProps) {
    const spotlightItems = items.slice(0, SPOTLIGHT_ITEM_COUNT);

    if (spotlightItems.length === 0) return null;

    return (
        <section className='sb-spotlight' aria-label='Spotlight'>
            <div className='sb-spotlight__grid'>
                {spotlightItems.map((item, index) => (
                    <SpotlightCard key={item.Id ?? index} item={item} />
                ))}
            </div>
        </section>
    );
}

// ---------------------------------------------------------------------------
// SpotlightCard — wider landscape card with title and year overlay
// ---------------------------------------------------------------------------

interface SpotlightCardProps {
    item: ItemDto;
}

function SpotlightCard({ item }: SpotlightCardProps) {
    const navigate = useNavigate();

    const itemId = item.Id ?? '';
    const itemName = item.Name ?? 'Unknown';
    const releaseYear = item.ProductionYear ?? null;
    const contentRating = item.OfficialRating ?? null;

    const backdropUrl = useItemImageUrl(itemId, 'Backdrop', { maxWidth: 600 });
    const primaryUrl = useItemImageUrl(itemId, 'Primary', { maxWidth: 600 });
    const displayImageUrl = backdropUrl ?? primaryUrl;

    const handleClick = useCallback(() => {
        if (itemId) {
            navigate(`/details?id=${itemId}`);
        }
    }, [itemId, navigate]);

    const handleKeyDown = useCallback(
        (event: React.KeyboardEvent<HTMLDivElement>) => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                handleClick();
            }
        },
        [handleClick]
    );

    return (
        <div
            className='sb-spotlight__card'
            role='button'
            tabIndex={0}
            aria-label={itemName}
            onClick={handleClick}
            onKeyDown={handleKeyDown}
        >
            <div className='sb-spotlight__image-wrap'>
                {displayImageUrl != null ? (
                    <img
                        className='sb-spotlight__image'
                        src={displayImageUrl}
                        alt={itemName}
                        loading='lazy'
                    />
                ) : (
                    <SpotlightImageFallback itemName={itemName} />
                )}
                <div className='sb-spotlight__overlay' aria-hidden='true' />
            </div>

            <div className='sb-spotlight__info'>
                <div className='sb-spotlight__title type-spotlight-title'>{itemName}</div>
                {(releaseYear != null || contentRating != null) && (
                    <div className='sb-spotlight__meta type-metadata'>
                        {releaseYear != null && (
                            <span className='sb-spotlight__year'>{releaseYear}</span>
                        )}
                        {contentRating != null && (
                            <span className='sb-spotlight__rating'>{contentRating}</span>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

// ---------------------------------------------------------------------------
// SpotlightImageFallback — gradient placeholder when artwork is absent
// ---------------------------------------------------------------------------

interface SpotlightImageFallbackProps {
    itemName: string;
}

function SpotlightImageFallback({ itemName }: SpotlightImageFallbackProps) {
    return (
        <div
            className='sb-spotlight__image sb-spotlight__image--fallback'
            aria-hidden='true'
            style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'linear-gradient(135deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.01) 100%)',
                color: 'var(--text-tertiary)',
                fontSize: '13px',
                fontWeight: 600,
                textAlign: 'center',
                padding: '12px'
            }}
        >
            {itemName}
        </div>
    );
}
