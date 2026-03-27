import React, { useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

import type { BaseItemDto } from '@jellyfin/sdk/lib/generated-client';

import { Card } from '../../components/Card';
import { useItemImageUrl } from '../../hooks/useItemImageUrl';
import { useInteractionAura } from '../../hooks/useInteractionAura';

export type CardVariant = 'poster' | 'landscape';

export interface LibraryGridProps {
    items: BaseItemDto[];
    variant?: CardVariant;
    isLoading?: boolean;
}

// How many skeleton cards to show while loading. Enough to fill two rows on
// a wide screen without causing layout jank from an oddly tall skeleton block.
const SKELETON_CARD_COUNT = 20;

/**
 * Responsive grid of Card components for a Streamberry library page.
 *
 * Passes the grid container ref to useInteractionAura so the pointer-magnetism
 * system tracks all cards within a single RAF loop rather than per-card.
 *
 * When isLoading is true, renders skeleton cards at the correct aspect ratio
 * so the grid height matches the real content and the page doesn't reflow.
 *
 * Card clicks navigate to /details?id={itemId}. Navigation is handled here
 * rather than inside Card.tsx because the detail route is app-surface-specific
 * (Streamberry uses /details, experimental uses /item).
 */
export function LibraryGrid({ items, variant = 'poster', isLoading = false }: Readonly<LibraryGridProps>) {
    const containerRef = useRef<HTMLDivElement>(null);
    useInteractionAura(containerRef);

    const gridModifier = variant === 'poster' ? 'sb-row__grid--poster' : 'sb-row__grid--landscape';

    if (isLoading) {
        return (
            <div ref={containerRef} className={`sb-row__grid ${gridModifier}`} aria-busy='true' aria-label='Loading library items'>
                {Array.from({ length: SKELETON_CARD_COUNT }, (_, skeletonIndex) => (
                    <SkeletonCard key={skeletonIndex} variant={variant} />
                ))}
            </div>
        );
    }

    if (items.length === 0) {
        return (
            <div className='sb-library-grid__empty'>
                <p className='type-synopsis'>No items found.</p>
            </div>
        );
    }

    return (
        <div ref={containerRef} className={`sb-row__grid ${gridModifier}`}>
            {items.map(item => (
                <LibraryCard key={item.Id} item={item} variant={variant} />
            ))}
        </div>
    );
}

// ---------------------------------------------------------------------------
// Per-item wrapper — keeps the image URL hook at the item level so each card
// independently resolves its image without re-rendering siblings.
// ---------------------------------------------------------------------------

interface LibraryCardProps {
    item: BaseItemDto;
    variant: CardVariant;
}

function LibraryCard({ item, variant }: Readonly<LibraryCardProps>) {
    const navigate = useNavigate();

    const imageType = variant === 'poster' ? 'Primary' : 'Thumb';
    const imageUrl = useItemImageUrl(item, imageType);

    const watchProgress =
        item.UserData?.PlayedPercentage != null ?
            item.UserData.PlayedPercentage / 100 :
            undefined;

    const releaseYear =
        item.ProductionYear != null ? item.ProductionYear : undefined;

    const handleClick = useCallback(() => {
        navigate(`/details?id=${item.Id}`);
    }, [navigate, item.Id]);

    return (
        <Card
            itemId={item.Id ?? ''}
            itemName={item.Name ?? ''}
            imageUrl={imageUrl}
            variant={variant}
            progress={watchProgress}
            rating={item.OfficialRating ?? undefined}
            year={releaseYear}
            onClick={handleClick}
        />
    );
}

// ---------------------------------------------------------------------------
// Skeleton card — same class structure as a real card so CSS grid treats them
// identically. The shimmer animation is driven by tokens.css.
// ---------------------------------------------------------------------------

interface SkeletonCardProps {
    variant: CardVariant;
}

function SkeletonCard({ variant }: Readonly<SkeletonCardProps>) {
    return (
        <div className={`sb-card sb-card--${variant}`} aria-hidden='true'>
            <div className='sb-card__image-wrap sb-card__image-wrap--skeleton' />
        </div>
    );
}
