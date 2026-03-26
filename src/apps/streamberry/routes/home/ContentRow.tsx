import React, { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

import { Card } from '../../components/Card';
import { useItemImageUrl } from '../../hooks/useItemImageUrl';
import type { ItemDto } from 'types/base/models/item-dto';

interface ContentRowProps {
    title: string;
    items: ItemDto[];
    variant?: 'poster' | 'landscape';
}

/**
 * Horizontally scrolling row of cards for the home page.
 *
 * Each item in the row gets a Card component with the image type matching
 * the variant: poster cards get Primary images, landscape cards get Backdrop
 * or Thumb images. The row is hidden entirely when items is empty so the
 * home layout doesn't leave orphaned section headers.
 */
export function ContentRow({ title, items, variant = 'poster' }: Readonly<ContentRowProps>) {
    if (items.length === 0) return null;

    const gridClass = `sb-row__grid sb-row__grid--${variant}`;

    return (
        <section className='sb-row'>
            <h2 className='sb-row__title'>{title}</h2>
            <div className={gridClass} role='list' aria-label={title}>
                {items.map((item, index) => (
                    <div key={item.Id ?? index} role='listitem'>
                        <ContentRowCard item={item} variant={variant} />
                    </div>
                ))}
            </div>
        </section>
    );
}

// ---------------------------------------------------------------------------
// ContentRowCard — bridges ItemDto → Card props
// ---------------------------------------------------------------------------

interface ContentRowCardProps {
    item: ItemDto;
    variant: 'poster' | 'landscape';
}

function ContentRowCard({ item, variant }: Readonly<ContentRowCardProps>) {
    const navigate = useNavigate();

    const itemId = item.Id ?? '';
    const itemName = item.Name ?? 'Unknown';

    // Landscape cards prefer Backdrop → fall back to Thumb; poster cards use Primary
    const imageType = variant === 'landscape' ? 'Backdrop' : 'Primary';
    const imageUrl = useItemImageUrl(itemId, imageType);

    const watchProgress = resolveWatchProgress(item);
    const releaseYear = item.ProductionYear ?? undefined;
    const contentRating = item.OfficialRating ?? undefined;
    const episodeLabel = resolveEpisodeLabel(item);

    const handleClick = useCallback(() => {
        if (itemId) {
            navigate(`/details?id=${itemId}`);
        }
    }, [itemId, navigate]);

    return (
        <Card
            itemId={itemId}
            itemName={itemName}
            imageUrl={imageUrl}
            variant={variant}
            progress={watchProgress}
            rating={episodeLabel ?? contentRating}
            year={releaseYear}
            onClick={handleClick}
        />
    );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Derives a 0–1 watch progress ratio from UserData if available.
 * Returns undefined when there is no meaningful progress to show.
 */
function resolveWatchProgress(item: ItemDto): number | undefined {
    const playbackPositionTicks = item.UserData?.PlaybackPositionTicks;
    const runtimeTicks = item.RunTimeTicks;

    if (
        playbackPositionTicks == null ||
        runtimeTicks == null ||
        runtimeTicks === 0 ||
        playbackPositionTicks === 0
    ) {
        return undefined;
    }

    return Math.min(1, playbackPositionTicks / runtimeTicks);
}

/**
 * Builds an episode label (e.g. "S2:E5") for TV episode items.
 * Returns null for movies and series-level items.
 */
function resolveEpisodeLabel(item: ItemDto): string | null {
    const seasonNumber = item.ParentIndexNumber;
    const episodeNumber = item.IndexNumber;

    if (seasonNumber == null || episodeNumber == null) return null;

    return `S${seasonNumber}:E${episodeNumber}`;
}
