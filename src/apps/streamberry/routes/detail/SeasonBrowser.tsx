import React, { useCallback, useState } from 'react';

import { useApi } from 'hooks/useApi';
import { useQuery } from '@tanstack/react-query';
import { getTvShowsApi } from '@jellyfin/sdk/lib/utils/api/tv-shows-api';
import { ItemFields } from '@jellyfin/sdk/lib/generated-client/models/item-fields';
import { GlassPanel } from '../../components/GlassPanel';
import { useItemImageUrl } from '../../hooks/useItemImageUrl';
import type { ItemDto } from 'types/base/models/item-dto';
import type { JellyfinApiContext } from 'hooks/useApi';
import type { AxiosRequestConfig } from 'axios';

interface SeasonBrowserProps {
    seriesId: string;
}

const EPISODE_OVERVIEW_LENGTH = 120;

// ---------------------------------------------------------------------------
// Data fetching
// ---------------------------------------------------------------------------

const fetchSeasons = async (
    apiContext: JellyfinApiContext,
    seriesId: string,
    options?: AxiosRequestConfig
) => {
    const { api, user } = apiContext;
    if (!api || !user?.Id) return [];

    const response = await getTvShowsApi(api).getSeasons(
        {
            seriesId,
            userId: user.Id,
            fields: [ItemFields.Overview]
        },
        options
    );
    return (response.data.Items ?? []) as ItemDto[];
};

const fetchEpisodes = async (
    apiContext: JellyfinApiContext,
    seriesId: string,
    seasonId: string,
    options?: AxiosRequestConfig
) => {
    const { api, user } = apiContext;
    if (!api || !user?.Id) return [];

    const response = await getTvShowsApi(api).getEpisodes(
        {
            seriesId,
            userId: user.Id,
            seasonId,
            fields: [ItemFields.Overview]
        },
        options
    );
    return (response.data.Items ?? []) as ItemDto[];
};

function useSeasons(seriesId: string) {
    const apiContext = useApi();
    return useQuery({
        queryKey: ['Series', seriesId, 'Seasons'],
        queryFn: ({ signal }) => fetchSeasons(apiContext, seriesId, { signal }),
        enabled: !!apiContext.api && !!apiContext.user?.Id && !!seriesId
    });
}

function useEpisodes(seriesId: string, seasonId: string | null) {
    const apiContext = useApi();
    return useQuery({
        queryKey: ['Series', seriesId, 'Season', seasonId, 'Episodes'],
        queryFn: ({ signal }) => fetchEpisodes(apiContext, seriesId, seasonId!, { signal }),
        enabled: !!apiContext.api && !!apiContext.user?.Id && !!seriesId && seasonId != null
    });
}

// ---------------------------------------------------------------------------
// SeasonBrowser
// ---------------------------------------------------------------------------

/**
 * Season and episode browser for Series items.
 *
 * Fetches all seasons, then fetches episodes for the selected season.
 * Season selector renders as a row of tab buttons — easy to scan, no dropdown
 * needed for the typical 1–5 season range.
 */
export function SeasonBrowser({ seriesId }: Readonly<SeasonBrowserProps>) {
    const { data: seasons = [], isLoading: seasonsLoading } = useSeasons(seriesId);

    const [selectedSeasonId, setSelectedSeasonId] = useState<string | null>(null);

    // Default to the first season once seasons load, unless the user has
    // already made a selection (selectedSeasonId is non-null).
    const resolvedSeasonId = selectedSeasonId ?? seasons[0]?.Id ?? null;

    const { data: episodes = [], isLoading: episodesLoading } = useEpisodes(
        seriesId,
        resolvedSeasonId
    );

    const handleSeasonSelect = useCallback((seasonId: string) => {
        setSelectedSeasonId(seasonId);
    }, []);

    if (seasonsLoading) {
        return <SeasonBrowserSkeleton />;
    }

    if (seasons.length === 0) {
        return null;
    }

    return (
        <section className='sb-season-browser' aria-label='Season browser'>
            <SeasonTabs
                seasons={seasons}
                activeSeasonId={resolvedSeasonId}
                onSeasonSelect={handleSeasonSelect}
            />

            {episodesLoading ? (
                <EpisodeListSkeleton />
            ) : (
                <EpisodeList episodes={episodes} />
            )}
        </section>
    );
}

// ---------------------------------------------------------------------------
// SeasonTabs
// ---------------------------------------------------------------------------

interface SeasonTabsProps {
    seasons: ItemDto[];
    activeSeasonId: string | null;
    onSeasonSelect: (seasonId: string) => void;
}

function SeasonTabs({ seasons, activeSeasonId, onSeasonSelect }: Readonly<SeasonTabsProps>) {
    const handleSeasonTabClick = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
        const seasonId = e.currentTarget.dataset.seasonId ?? '';
        onSeasonSelect(seasonId);
    }, [ onSeasonSelect ]);

    return (
        <div className='sb-season-browser__tabs' role='tablist' aria-label='Seasons'>
            {seasons.map(season => {
                const seasonId = season.Id ?? '';
                const isActive = seasonId === activeSeasonId;
                return (
                    <button
                        key={seasonId}
                        className={`sb-season-browser__tab type-row-title${isActive ? ' sb-season-browser__tab--active' : ''}`}
                        data-season-id={seasonId}
                        role='tab'
                        aria-selected={isActive}
                        onClick={handleSeasonTabClick}
                    >
                        {season.Name ?? `Season ${season.IndexNumber ?? ''}`}
                    </button>
                );
            })}
        </div>
    );
}

// ---------------------------------------------------------------------------
// EpisodeList
// ---------------------------------------------------------------------------

interface EpisodeListProps {
    episodes: ItemDto[];
}

function EpisodeList({ episodes }: Readonly<EpisodeListProps>) {
    if (episodes.length === 0) {
        return (
            <p className='sb-season-browser__empty type-synopsis'>
                No episodes available.
            </p>
        );
    }

    return (
        <ul className='sb-season-browser__episode-list' aria-label='Episodes'>
            {episodes.map((episode, index) => (
                <li key={episode.Id ?? index}>
                    <EpisodeCard episode={episode} />
                </li>
            ))}
        </ul>
    );
}

// ---------------------------------------------------------------------------
// EpisodeCard
// ---------------------------------------------------------------------------

interface EpisodeCardProps {
    episode: ItemDto;
}

function EpisodeCard({ episode }: Readonly<EpisodeCardProps>) {
    const episodeId = episode.Id ?? '';
    const episodeName = episode.Name ?? 'Untitled';
    const episodeNumber = episode.IndexNumber ?? null;
    const seasonNumber = episode.ParentIndexNumber ?? null;
    const overview = episode.Overview ?? null;
    const runtimeMinutes = episode.RunTimeTicks != null ?
        Math.round(episode.RunTimeTicks / 10_000_000 / 60) :
        null;

    const watchProgress = resolveWatchProgress(episode);
    const thumbnailUrl = useItemImageUrl(episodeId, 'Thumb', { maxWidth: 400 });

    const episodeLabel =
        seasonNumber != null && episodeNumber != null ?
            `S${seasonNumber} E${episodeNumber}` :
            episodeNumber != null ?
            `E${episodeNumber}` :
            null;

    const truncatedOverview =
        overview != null && overview.length > EPISODE_OVERVIEW_LENGTH ?
            `${overview.slice(0, EPISODE_OVERVIEW_LENGTH).trimEnd()}…` :
            overview;

    return (
        <GlassPanel
            as='article'
            elevation='medium'
            className='sb-episode-card'
            aria-label={episodeName}
        >
            <div className='sb-episode-card__thumb-wrap'>
                {thumbnailUrl != null ? (
                    <img
                        className='sb-episode-card__thumb'
                        src={thumbnailUrl}
                        alt=''
                        loading='lazy'
                        aria-hidden='true'
                    />
                ) : (
                    <div className='sb-episode-card__thumb sb-episode-card__thumb--fallback' aria-hidden='true' />
                )}
                {watchProgress != null && watchProgress > 0 && (
                    <div
                        className='sb-episode-card__progress'
                        role='progressbar'
                        aria-valuenow={Math.round(watchProgress * 100)}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-label={`${Math.round(watchProgress * 100)}% watched`}
                    >
                        <div
                            className='sb-episode-card__progress-fill'
                            style={{ width: `${watchProgress * 100}%` }}
                        />
                    </div>
                )}
            </div>

            <div className='sb-episode-card__info'>
                <div className='sb-episode-card__header'>
                    {episodeLabel != null && (
                        <span className='sb-episode-card__label type-tag'>{episodeLabel}</span>
                    )}
                    <h3 className='sb-episode-card__title type-row-title'>{episodeName}</h3>
                    {runtimeMinutes != null && (
                        <span className='sb-episode-card__runtime type-metadata'>{runtimeMinutes}m</span>
                    )}
                </div>
                {truncatedOverview != null && (
                    <p className='sb-episode-card__overview type-synopsis'>{truncatedOverview}</p>
                )}
            </div>
        </GlassPanel>
    );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function resolveWatchProgress(episode: ItemDto): number | null {
    const playbackPositionTicks = episode.UserData?.PlaybackPositionTicks;
    const runtimeTicks = episode.RunTimeTicks;

    if (
        playbackPositionTicks == null ||
        runtimeTicks == null ||
        runtimeTicks === 0 ||
        playbackPositionTicks === 0
    ) {
        return null;
    }

    return Math.min(1, playbackPositionTicks / runtimeTicks);
}

// ---------------------------------------------------------------------------
// Skeletons
// ---------------------------------------------------------------------------

function SeasonBrowserSkeleton() {
    return (
        <div className='sb-season-browser sb-season-browser--loading' aria-busy='true'>
            <div className='sb-season-browser__skeleton-tabs' />
            <EpisodeListSkeleton />
        </div>
    );
}

function EpisodeListSkeleton() {
    return (
        <ul className='sb-season-browser__episode-list' aria-busy='true'>
            {Array.from({ length: 4 }, (_, index) => (
                <li key={index} className='sb-episode-card sb-episode-card--skeleton' />
            ))}
        </ul>
    );
}
