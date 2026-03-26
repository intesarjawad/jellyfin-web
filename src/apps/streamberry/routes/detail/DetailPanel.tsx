import React, { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { GlassPanel } from '../../components/GlassPanel';
import { useItemImageUrl } from '../../hooks/useItemImageUrl';
import { playbackManager } from 'components/playback/playbackmanager';
import type { ItemDto } from 'types/base/models/item-dto';
import type { BaseItemPerson } from '@jellyfin/sdk/lib/generated-client';
import { PersonKind } from '@jellyfin/sdk/lib/generated-client/models/person-kind';

interface DetailPanelProps {
    item: ItemDto;
    onFavoriteToggle: () => void;
    isFavorite: boolean;
}

const MAX_CAST_VISIBLE = 6;
const OVERVIEW_COLLAPSE_LENGTH = 300;
const RUNTIME_MINUTES_DIVISOR = 60;

/**
 * Glass metadata panel overlaid on the detail backdrop.
 *
 * Left column: poster artwork.
 * Right column: title, year, runtime, rating, genres, overview, cast.
 * Bottom: Play and Favourite action buttons.
 *
 * playbackManager.play() is the canonical Jellyfin playback entry point —
 * it handles source selection, transcoding negotiation, and queue setup
 * without the caller needing to know about media sources.
 */
export function DetailPanel({ item, onFavoriteToggle, isFavorite }: DetailPanelProps) {
    const navigate = useNavigate();
    const [overviewExpanded, setOverviewExpanded] = useState(false);

    const itemId = item.Id ?? '';
    const itemName = item.Name ?? 'Unknown';
    const releaseYear = item.ProductionYear ?? null;
    const officialRating = item.OfficialRating ?? null;
    const genres = item.Genres?.slice(0, 4) ?? [];
    const overview = item.Overview ?? null;
    const people = (item.People ?? []) as BaseItemPerson[];
    const castMembers = people
        .filter(person => person.Type === PersonKind.Actor)
        .slice(0, MAX_CAST_VISIBLE);

    const runtimeMinutes = item.RunTimeTicks != null
        ? Math.round(item.RunTimeTicks / 10_000_000 / RUNTIME_MINUTES_DIVISOR)
        : null;

    const overviewIsTruncatable =
        overview != null && overview.length > OVERVIEW_COLLAPSE_LENGTH;
    const displayedOverview =
        overview == null ? null :
        overviewIsTruncatable && !overviewExpanded
            ? `${overview.slice(0, OVERVIEW_COLLAPSE_LENGTH).trimEnd()}…`
            : overview;

    const posterUrl = useItemImageUrl(itemId, 'Primary', { maxWidth: 400 });

    const handlePlayClick = useCallback(() => {
        playbackManager.play({ items: [item] });
    }, [item]);

    const handleTrailerClick = useCallback(() => {
        if (itemId) {
            navigate(`/video?id=${itemId}`);
        }
    }, [itemId, navigate]);

    return (
        <GlassPanel
            as='section'
            elevation='low'
            className='sb-detail__panel'
            aria-label={`Details for ${itemName}`}
        >
            <div className='sb-detail__panel-inner'>
                <DetailPoster posterUrl={posterUrl} itemName={itemName} />

                <div className='sb-detail__meta'>
                    <h1 className='sb-detail__title type-page-title'>{itemName}</h1>

                    <DetailMetaRow
                        releaseYear={releaseYear}
                        runtimeMinutes={runtimeMinutes}
                        officialRating={officialRating}
                    />

                    {genres.length > 0 && (
                        <ul className='sb-detail__genres' aria-label='Genres'>
                            {genres.map(genre => (
                                <li key={genre} className='sb-detail__genre-tag type-tag'>
                                    {genre}
                                </li>
                            ))}
                        </ul>
                    )}

                    {displayedOverview != null && (
                        <div className='sb-detail__overview-wrap'>
                            <p className='sb-detail__overview type-synopsis'>
                                {displayedOverview}
                            </p>
                            {overviewIsTruncatable && (
                                <button
                                    className='sb-detail__overview-toggle type-tag'
                                    onClick={() => setOverviewExpanded(prev => !prev)}
                                    aria-expanded={overviewExpanded}
                                >
                                    {overviewExpanded ? 'Show less' : 'Show more'}
                                </button>
                            )}
                        </div>
                    )}

                    {castMembers.length > 0 && (
                        <CastRow castMembers={castMembers} />
                    )}

                    <div className='sb-detail__actions'>
                        <button
                            className='sb-btn sb-btn--primary sb-detail__play-btn'
                            onClick={handlePlayClick}
                            aria-label={`Play ${itemName}`}
                        >
                            <span className='sb-detail__play-icon' aria-hidden='true'>▶</span>
                            Play
                        </button>
                        <button
                            className='sb-btn sb-btn--ghost sb-detail__trailer-btn'
                            onClick={handleTrailerClick}
                            aria-label={`Watch trailer for ${itemName}`}
                        >
                            Trailer
                        </button>
                        <button
                            className={`sb-btn sb-btn--ghost sb-detail__fav-btn${isFavorite ? ' sb-detail__fav-btn--active' : ''}`}
                            onClick={onFavoriteToggle}
                            aria-label={isFavorite ? `Remove ${itemName} from favourites` : `Add ${itemName} to favourites`}
                            aria-pressed={isFavorite}
                        >
                            {isFavorite ? '♥' : '♡'}
                        </button>
                    </div>
                </div>
            </div>
        </GlassPanel>
    );
}

// ---------------------------------------------------------------------------
// DetailPoster
// ---------------------------------------------------------------------------

interface DetailPosterProps {
    posterUrl: string | null;
    itemName: string;
}

function DetailPoster({ posterUrl, itemName }: DetailPosterProps) {
    return (
        <div className='sb-detail__poster-wrap'>
            {posterUrl != null ? (
                <img
                    className='sb-detail__poster'
                    src={posterUrl}
                    alt={`${itemName} poster`}
                    loading='lazy'
                />
            ) : (
                <div className='sb-detail__poster sb-detail__poster--fallback' aria-hidden='true' />
            )}
        </div>
    );
}

// ---------------------------------------------------------------------------
// DetailMetaRow — year · runtime · rating chips
// ---------------------------------------------------------------------------

interface DetailMetaRowProps {
    releaseYear: number | null;
    runtimeMinutes: number | null;
    officialRating: string | null;
}

function DetailMetaRow({ releaseYear, runtimeMinutes, officialRating }: DetailMetaRowProps) {
    if (releaseYear == null && runtimeMinutes == null && officialRating == null) {
        return null;
    }

    return (
        <div className='sb-detail__meta-row type-metadata' aria-label='Item details'>
            {releaseYear != null && (
                <span className='sb-detail__year'>{releaseYear}</span>
            )}
            {runtimeMinutes != null && (
                <span className='sb-detail__runtime'>{runtimeMinutes}m</span>
            )}
            {officialRating != null && (
                <span className='sb-detail__rating'>{officialRating}</span>
            )}
        </div>
    );
}

// ---------------------------------------------------------------------------
// CastRow — actor names in a wrapping pill list
// ---------------------------------------------------------------------------

interface CastRowProps {
    castMembers: BaseItemPerson[];
}

function CastRow({ castMembers }: CastRowProps) {
    return (
        <div className='sb-detail__cast'>
            <span className='sb-detail__cast-label type-label'>Cast</span>
            <ul className='sb-detail__cast-list' aria-label='Cast members'>
                {castMembers.map(person => (
                    <li key={person.Id ?? person.Name} className='sb-detail__cast-name type-metadata'>
                        {person.Name}
                    </li>
                ))}
            </ul>
        </div>
    );
}
