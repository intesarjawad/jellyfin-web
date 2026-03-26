import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { useItemImageUrl } from '../../hooks/useItemImageUrl';
import { useSceneColors } from '../../hooks/useSceneColors';
import {
    HERO_CROSSFADE_DURATION_MS,
    HERO_CYCLE_INTERVAL_MS
} from '../../utils/constants';
import type { ItemDto } from 'types/base/models/item-dto';

const OVERVIEW_VISIBLE_LENGTH = 160;

interface HeroProps {
    items: ItemDto[];
}

/**
 * Full-bleed cycling banner at the top of the home page.
 *
 * Rotates through items every HERO_CYCLE_INTERVAL_MS. The ambient scene color
 * is driven from here — one scene controller for the whole hero — not from
 * individual slides, which would otherwise fight each other over the active scene.
 *
 * Crossfade is handled by CSS opacity transitions on absolute-positioned slides.
 */
export function Hero({ items }: Readonly<HeroProps>) {
    const [activeIndex, setActiveIndex] = useState(0);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const navigate = useNavigate();

    const activeItem = items[activeIndex] ?? null;
    const activeItemId = activeItem?.Id ?? '';

    // Scene colors are driven by the active item's backdrop image.
    // Hooks must be called unconditionally; we pass the empty string when there's
    // no active item and gate the scene update by passing null as the imageUrl.
    const activeBackdropUrl = useItemImageUrl(activeItemId, 'Backdrop');
    const activePrimaryUrl = useItemImageUrl(activeItemId, 'Primary');

    // When activeItemId is empty (no items yet), both URL hooks return a
    // technically valid but meaningless URL. Passing null keeps the scene system
    // in its fallback state rather than triggering a failed extraction.
    const sceneImageUrl = activeItemId ? (activeBackdropUrl ?? activePrimaryUrl) : null;

    // Single scene controller for the entire hero — no risk of slide conflicts.
    useSceneColors(sceneImageUrl, activeItemId);

    const clearCycleInterval = useCallback(() => {
        if (intervalRef.current !== null) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
        }
    }, []);

    const advanceToNextItem = useCallback(() => {
        setActiveIndex(prev => (prev + 1) % items.length);
    }, [items.length]);

    // Start cycling. Restart the interval when items change (new data loaded).
    useEffect(() => {
        if (items.length <= 1) return;

        clearCycleInterval();
        intervalRef.current = setInterval(advanceToNextItem, HERO_CYCLE_INTERVAL_MS);

        return clearCycleInterval;
    }, [items.length, advanceToNextItem, clearCycleInterval]);

    const handleDotClick = useCallback(
        (targetIndex: number) => {
            setActiveIndex(targetIndex);
            // Give the newly chosen item a full cycle before advancing again
            clearCycleInterval();
            if (items.length > 1) {
                intervalRef.current = setInterval(advanceToNextItem, HERO_CYCLE_INTERVAL_MS);
            }
        },
        [clearCycleInterval, advanceToNextItem, items.length]
    );

    const handlePlayClick = useCallback(() => {
        if (activeItemId) {
            navigate(`/video?id=${activeItemId}`);
        }
    }, [activeItemId, navigate]);

    const handleMoreInfoClick = useCallback(() => {
        if (activeItemId) {
            navigate(`/details?id=${activeItemId}`);
        }
    }, [activeItemId, navigate]);

    if (items.length === 0) {
        return <HeroSkeleton />;
    }

    return (
        <section className='sb-hero' aria-label='Featured content'>
            {items.map((item, index) => (
                <HeroSlide
                    key={item.Id ?? index}
                    item={item}
                    isActive={index === activeIndex}
                    crossfadeDurationMs={HERO_CROSSFADE_DURATION_MS}
                    onPlay={handlePlayClick}
                    onMoreInfo={handleMoreInfoClick}
                />
            ))}

            {items.length > 1 && (
                <HeroDotRow
                    totalItems={items.length}
                    activeIndex={activeIndex}
                    onDotClick={handleDotClick}
                />
            )}
        </section>
    );
}

// ---------------------------------------------------------------------------
// HeroSlide — one backdrop + metadata panel per featured item
// ---------------------------------------------------------------------------

interface HeroSlideProps {
    item: ItemDto;
    isActive: boolean;
    crossfadeDurationMs: number;
    onPlay: () => void;
    onMoreInfo: () => void;
}

/**
 * Renders the backdrop image and metadata overlay for a single hero item.
 *
 * Scene colors are NOT managed here — Hero drives that at the parent level
 * to avoid multiple hooks fighting over the active item.
 */
function HeroSlide({ item, isActive, crossfadeDurationMs, onPlay, onMoreInfo }: Readonly<HeroSlideProps>) {
    const itemId = item.Id ?? '';
    const itemName = item.Name ?? 'Unknown';
    const releaseYear = item.ProductionYear ?? null;
    const overview = item.Overview ?? null;
    const genres = item.Genres?.slice(0, 3) ?? [];
    const officialRating = item.OfficialRating ?? null;

    const backdropUrl = useItemImageUrl(itemId, 'Backdrop', { maxWidth: 1440 });
    const primaryUrl = useItemImageUrl(itemId, 'Primary');
    const displayImageUrl = backdropUrl ?? primaryUrl;

    const truncatedOverview =
        overview != null && overview.length > OVERVIEW_VISIBLE_LENGTH ?
            `${overview.slice(0, OVERVIEW_VISIBLE_LENGTH).trimEnd()}…` :
            overview;

    const slideStyle: React.CSSProperties = {
        opacity: isActive ? 1 : 0,
        transition: `opacity ${crossfadeDurationMs}ms cubic-bezier(0.16, 1, 0.3, 1)`,
        position: 'absolute',
        inset: 0,
        pointerEvents: isActive ? 'auto' : 'none'
    };

    return (
        <div
            className='sb-hero__slide'
            style={slideStyle}
            aria-hidden={!isActive}
        >
            <div className='sb-hero__backdrop'>
                {displayImageUrl != null ? (
                    <img
                        className={`sb-hero__backdrop-image${backdropUrl == null ? ' sb-hero__backdrop-image--primary-fallback' : ''}`}
                        src={displayImageUrl}
                        alt=''
                        loading='lazy'
                        aria-hidden='true'
                    />
                ) : null}
                <div className='sb-hero__backdrop-vignette' aria-hidden='true' />
            </div>

            <div className='sb-hero__content'>
                {genres.length > 0 && (
                    <ul className='sb-hero__genre-tags' aria-label='Genres'>
                        {genres.map(genre => (
                            <li key={genre} className='sb-hero__genre-tag type-tag'>
                                {genre}
                            </li>
                        ))}
                    </ul>
                )}

                <h1 className='sb-hero__title type-hero-title'>{itemName}</h1>

                <div className='sb-hero__meta type-metadata'>
                    {releaseYear != null && (
                        <span className='sb-hero__year'>{releaseYear}</span>
                    )}
                    {officialRating != null && (
                        <span className='sb-hero__rating'>{officialRating}</span>
                    )}
                </div>

                {truncatedOverview != null && (
                    <p className='sb-hero__overview type-synopsis'>{truncatedOverview}</p>
                )}

                <div className='sb-hero__actions'>
                    <button
                        className='sb-btn sb-btn--primary sb-hero__play-btn'
                        onClick={onPlay}
                        aria-label={`Play ${itemName}`}
                    >
                        <span className='sb-hero__play-icon' aria-hidden='true'>▶</span>
                        Play
                    </button>
                    <button
                        className='sb-btn sb-btn--ghost sb-hero__info-btn'
                        onClick={onMoreInfo}
                        aria-label={`More information about ${itemName}`}
                    >
                        More Info
                    </button>
                </div>
            </div>
        </div>
    );
}

// ---------------------------------------------------------------------------
// HeroDotRow — navigation dots at the bottom of the hero
// ---------------------------------------------------------------------------

interface HeroDotRowProps {
    totalItems: number;
    activeIndex: number;
    onDotClick: (index: number) => void;
}

function HeroDotRow({ totalItems, activeIndex, onDotClick }: Readonly<HeroDotRowProps>) {
    return (
        <div className='sb-hero__dots' role='tablist' aria-label='Featured items'>
            {Array.from({ length: totalItems }, (_, index) => {
                const isActive = index === activeIndex;
                return (
                    <button
                        key={index}
                        className={`sb-hero__dot${isActive ? ' sb-hero__dot--active' : ''}`}
                        role='tab'
                        aria-selected={isActive}
                        aria-label={`Featured item ${index + 1}`}
                        onClick={() => onDotClick(index)}
                    />
                );
            })}
        </div>
    );
}

// ---------------------------------------------------------------------------
// HeroSkeleton — shown while items array is empty (first load)
// ---------------------------------------------------------------------------

function HeroSkeleton() {
    return (
        <section className='sb-hero sb-hero--skeleton' aria-busy='true' aria-label='Loading featured content'>
            <div className='sb-hero__skeleton-backdrop' />
            <div className='sb-hero__content'>
                <div className='sb-hero__skeleton-title' />
                <div className='sb-hero__skeleton-meta' />
                <div className='sb-hero__skeleton-overview' />
                <div className='sb-hero__skeleton-actions' />
            </div>
        </section>
    );
}
