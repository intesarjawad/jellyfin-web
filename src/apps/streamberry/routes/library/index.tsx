import React, { useCallback, useMemo } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';

import { BaseItemKind } from '@jellyfin/sdk/lib/generated-client/models/base-item-kind';
import { ImageType } from '@jellyfin/sdk/lib/generated-client/models/image-type';
import { ItemSortBy } from '@jellyfin/sdk/lib/generated-client/models/item-sort-by';
import { SortOrder } from '@jellyfin/sdk/lib/generated-client/models/sort-order';
import { ViewMode } from 'types/library';
import type { LibraryViewSettings } from 'types/library';
import { LibraryTab } from 'types/libraryTab';

import { useGetItemsViewByType } from 'hooks/useFetchItems';
import type { BaseItemDto } from '@jellyfin/sdk/lib/generated-client';

import { FilterBar } from './FilterBar';
import { LibraryGrid } from './LibraryGrid';
import type { LibraryViewType } from './FilterBar';
import type { CardVariant } from './LibraryGrid';

// ---------------------------------------------------------------------------
// Route path → LibraryTab mapping
//
// Each Streamberry library route path maps to the Jellyfin LibraryTab that
// represents the primary items view for that collection type. When the user
// navigates to /movies the tab is LibraryTab.Movies; /tv maps to Series, etc.
// ---------------------------------------------------------------------------

type LibraryRoutePath =
    | 'movies'
    | 'tv'
    | 'music'
    | 'livetv'
    | 'homevideos'
    | 'books'
    | 'musicvideos';

interface LibraryRouteConfig {
    viewType: LibraryTab;
    itemTypes: BaseItemKind[];
    defaultVariant: CardVariant;
    pageTitle: string;
}

const LIBRARY_ROUTE_CONFIG: Record<LibraryRoutePath, LibraryRouteConfig> = {
    movies: {
        viewType: LibraryTab.Movies,
        itemTypes: [BaseItemKind.Movie],
        defaultVariant: 'poster',
        pageTitle: 'Movies'
    },
    tv: {
        viewType: LibraryTab.Series,
        itemTypes: [BaseItemKind.Series],
        defaultVariant: 'poster',
        pageTitle: 'TV Shows'
    },
    music: {
        viewType: LibraryTab.Albums,
        itemTypes: [BaseItemKind.MusicAlbum],
        defaultVariant: 'poster',
        pageTitle: 'Music'
    },
    livetv: {
        viewType: LibraryTab.Channels,
        itemTypes: [BaseItemKind.TvChannel],
        defaultVariant: 'landscape',
        pageTitle: 'Live TV'
    },
    homevideos: {
        viewType: LibraryTab.Videos,
        itemTypes: [BaseItemKind.Video],
        defaultVariant: 'landscape',
        pageTitle: 'Home Videos'
    },
    books: {
        viewType: LibraryTab.Books,
        itemTypes: [BaseItemKind.Book],
        defaultVariant: 'poster',
        pageTitle: 'Books'
    },
    musicvideos: {
        viewType: LibraryTab.MusicVideos,
        itemTypes: [BaseItemKind.MusicVideo],
        defaultVariant: 'landscape',
        pageTitle: 'Music Videos'
    }
};

const KNOWN_ROUTE_PATHS = new Set<string>(Object.keys(LIBRARY_ROUTE_CONFIG));

function isLibraryRoutePath(path: string): path is LibraryRoutePath {
    return KNOWN_ROUTE_PATHS.has(path);
}

// URL search param key names — centralised so a typo can't silently break
// persistence across the page components.
const PARAM_SORT_BY    = 'sortBy';
const PARAM_SORT_ORDER = 'sortOrder';
const PARAM_VIEW_TYPE  = 'viewType';

/**
 * Streamberry library page — renders movies, TV shows, music, and other
 * collection types using the same component with different config.
 *
 * The route path determines which Jellyfin LibraryTab and item types to query.
 * Sort state and view type are stored in URL search params so back-navigation
 * restores the user's last selection.
 *
 * Pagination: the underlying useGetItemsViewByType hook fetches a single page.
 * LibraryViewSettings.StartIndex is left at 0 (first page) because infinite
 * scroll / load-more is a Wave 4 concern — the spec asks for the grid first.
 */
export function LibraryPage() {
    const location = useLocation();
    const [searchParams, setSearchParams] = useSearchParams();

    // Derive route path from the last segment of the pathname.
    // location.pathname may be "/movies" or "/streamberry/movies" depending on
    // how the router nests the surface — take the final segment to be safe.
    const routeSegment = location.pathname.split('/').filter(Boolean).pop() ?? '';
    const routeConfig = isLibraryRoutePath(routeSegment)
        ? LIBRARY_ROUTE_CONFIG[routeSegment]
        : LIBRARY_ROUTE_CONFIG.movies; // safe fallback

    // The library parent folder ID comes from topParentId, matching the
    // experimental surface and useCurrentTab conventions.
    const topParentId = searchParams.get('topParentId');

    // Sort state — read from URL params, fall back to sensible defaults.
    const activeSortBy = (searchParams.get(PARAM_SORT_BY) as ItemSortBy | null)
        ?? ItemSortBy.SortName;
    const activeSortOrder = (searchParams.get(PARAM_SORT_ORDER) as SortOrder | null)
        ?? SortOrder.Ascending;
    const activeViewType = (searchParams.get(PARAM_VIEW_TYPE) as LibraryViewType | null)
        ?? 'grid';

    // The variant follows the view type when the user switches to list, otherwise
    // it uses the default variant for the collection type (poster vs. landscape).
    const cardVariant: CardVariant =
        activeViewType === 'list' ? 'landscape' : routeConfig.defaultVariant;

    // Build the LibraryViewSettings object that useGetItemsViewByType expects.
    // ImageType is chosen to match the card variant — Primary for poster (2:3),
    // Thumb for landscape (16:9).
    const libraryViewSettings = useMemo<LibraryViewSettings>(
        () => ({
            SortBy: activeSortBy,
            SortOrder: activeSortOrder,
            StartIndex: 0,
            CardLayout: false,
            ImageType: cardVariant === 'poster' ? ImageType.Primary : ImageType.Thumb,
            ViewMode: activeViewType === 'grid' ? ViewMode.GridView : ViewMode.ListView,
            ShowTitle: true,
            ShowYear: true
        }),
        [activeSortBy, activeSortOrder, cardVariant, activeViewType]
    );

    const { data: queryResult, isLoading } = useGetItemsViewByType(
        routeConfig.viewType,
        topParentId,
        routeConfig.itemTypes,
        libraryViewSettings
    );

    const items: BaseItemDto[] = useMemo(
        () => (queryResult?.Items ?? []) as BaseItemDto[],
        [queryResult]
    );

    const handleSortChange = useCallback(
        (nextSortBy: ItemSortBy, nextSortOrder: SortOrder) => {
            setSearchParams(current => {
                const updated = new URLSearchParams(current);
                updated.set(PARAM_SORT_BY, nextSortBy);
                updated.set(PARAM_SORT_ORDER, nextSortOrder);
                return updated;
            });
        },
        [setSearchParams]
    );

    const handleViewTypeChange = useCallback(
        (nextViewType: LibraryViewType) => {
            setSearchParams(current => {
                const updated = new URLSearchParams(current);
                updated.set(PARAM_VIEW_TYPE, nextViewType);
                return updated;
            });
        },
        [setSearchParams]
    );

    // Show skeleton cards during the initial fetch. Background refetches
    // (triggered by sort changes) arrive fast enough that keeping the previous
    // cards visible avoids a jarring blank → populated flash.
    const showSkeletons = isLoading;

    return (
        <div className='sb-library-page'>
            <header className='sb-library-page__header'>
                <h1 className='sb-library-page__title type-page-title'>
                    {routeConfig.pageTitle}
                </h1>
            </header>

            <FilterBar
                sortBy={activeSortBy}
                sortOrder={activeSortOrder}
                onSortChange={handleSortChange}
                viewType={activeViewType}
                onViewTypeChange={handleViewTypeChange}
            />

            <LibraryGrid
                items={items}
                variant={cardVariant}
                isLoading={showSkeletons}
            />
        </div>
    );
}
