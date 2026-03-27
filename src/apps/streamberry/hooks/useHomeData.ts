import { getItemsApi } from '@jellyfin/sdk/lib/utils/api/items-api';
import { getUserLibraryApi } from '@jellyfin/sdk/lib/utils/api/user-library-api';
import { ItemFields } from '@jellyfin/sdk/lib/generated-client/models/item-fields';
import { ImageType } from '@jellyfin/sdk/lib/generated-client/models/image-type';
import { ItemSortBy } from '@jellyfin/sdk/lib/generated-client/models/item-sort-by';
import { SortOrder } from '@jellyfin/sdk/lib/generated-client/models/sort-order';
import { useQueries, useQuery } from '@tanstack/react-query';

import { useApi } from 'hooks/useApi';
import { useUserViews } from 'hooks/useUserViews';
import type { ItemDto } from 'types/base/models/item-dto';

const HERO_ITEM_LIMIT = 8;
const CONTINUE_WATCHING_LIMIT = 20;
const RECENTLY_ADDED_PER_LIBRARY_LIMIT = 12;

const MEDIA_ITEM_FIELDS = [
    ItemFields.Overview,
    ItemFields.Genres,
    ItemFields.PrimaryImageAspectRatio,
    ItemFields.MediaSourceCount
];

const IMAGE_TYPES_REQUIRED = [
    ImageType.Primary,
    ImageType.Backdrop,
    ImageType.Thumb
];

export interface RecentLibraryGroup {
    libraryName: string;
    libraryId: string;
    items: ItemDto[];
}

export interface HomeData {
    heroItems: ItemDto[];
    continueWatching: ItemDto[];
    recentByLibrary: RecentLibraryGroup[];
    isLoading: boolean;
}

/**
 * Aggregates all data needed for the Streamberry home page in a single hook.
 *
 * Hero items come from the server's latest media sorted by date added.
 * Continue Watching uses the server's resumable items endpoint.
 * Recently Added is fetched per library so each section has its own label.
 *
 * All fetches use TanStack Query for caching and background refetch.
 * The hook returns isLoading: true until every query has settled.
 */
export function useHomeData(): HomeData {
    const { api, user } = useApi();
    const userId = user?.Id;
    const isApiReady = !!api && !!userId;

    // -----------------------------------------------------------------------
    // User's library views — drives the "recently added per library" queries
    // -----------------------------------------------------------------------
    const { data: userViewsResponse, isLoading: isLoadingViews } = useUserViews(userId);

    const mediaLibraries = (userViewsResponse?.Items ?? []).filter(
        library =>
            library.Id != null
            && library.Name != null
            // Exclude channel-type folders (LiveTV, Channels) from the recent rows
            && library.CollectionType !== 'livetv'
            && library.CollectionType !== 'boxsets'
    );

    // -----------------------------------------------------------------------
    // Hero items — latest media across all libraries, for the featured banner
    // -----------------------------------------------------------------------
    const { data: heroQueryData, isLoading: isLoadingHero } = useQuery({
        queryKey: ['Streamberry', 'HomeHeroItems'],
        queryFn: async ({ signal }) => {
            const response = await getItemsApi(api!).getItems(
                {
                    userId,
                    recursive: true,
                    sortBy: [ItemSortBy.DateCreated],
                    sortOrder: [SortOrder.Descending],
                    imageTypeLimit: 1,
                    enableImageTypes: IMAGE_TYPES_REQUIRED,
                    fields: MEDIA_ITEM_FIELDS,
                    hasOverview: true,
                    limit: HERO_ITEM_LIMIT,
                    enableTotalRecordCount: false
                },
                { signal }
            );
            return (response.data.Items ?? []) as ItemDto[];
        },
        enabled: isApiReady,
        staleTime: 5 * 60 * 1000
    });

    // -----------------------------------------------------------------------
    // Continue Watching — items with partial playback progress
    // -----------------------------------------------------------------------
    const { data: continueWatchingData, isLoading: isLoadingContinueWatching } = useQuery({
        queryKey: ['Streamberry', 'ContinueWatching'],
        queryFn: async ({ signal }) => {
            const response = await getItemsApi(api!).getResumeItems(
                {
                    userId: userId!,
                    fields: MEDIA_ITEM_FIELDS,
                    imageTypeLimit: 1,
                    enableImageTypes: IMAGE_TYPES_REQUIRED,
                    limit: CONTINUE_WATCHING_LIMIT,
                    enableTotalRecordCount: false,
                    mediaTypes: ['Video']
                },
                { signal }
            );
            return (response.data.Items ?? []) as ItemDto[];
        },
        enabled: isApiReady,
        staleTime: 2 * 60 * 1000
    });

    // -----------------------------------------------------------------------
    // Recently Added — one query per content library, fired in parallel
    // -----------------------------------------------------------------------
    const recentlyAddedQueries = useQueries({
        queries: mediaLibraries.map(library => ({
            queryKey: ['Streamberry', 'RecentlyAdded', library.Id],
            queryFn: async ({ signal }: { signal?: AbortSignal }) => {
                const response = await getUserLibraryApi(api!).getLatestMedia(
                    {
                        userId: userId!,
                        parentId: library.Id!,
                        fields: MEDIA_ITEM_FIELDS,
                        imageTypeLimit: 1,
                        enableImageTypes: IMAGE_TYPES_REQUIRED,
                        limit: RECENTLY_ADDED_PER_LIBRARY_LIMIT
                    },
                    { signal }
                );
                const items = (response.data ?? []) as ItemDto[];
                return {
                    libraryName: library.Name!,
                    libraryId: library.Id!,
                    items
                };
            },
            enabled: isApiReady,
            staleTime: 5 * 60 * 1000
        }))
    });

    const isLoadingRecentlyAdded = recentlyAddedQueries.some(q => q.isLoading);

    const recentByLibrary: RecentLibraryGroup[] = recentlyAddedQueries
        .map(q => q.data)
        .filter((group): group is RecentLibraryGroup => group != null && group.items.length > 0);

    const isLoading =
        isLoadingViews
        || isLoadingHero
        || isLoadingContinueWatching
        || isLoadingRecentlyAdded;

    return {
        heroItems: heroQueryData ?? [],
        continueWatching: continueWatchingData ?? [],
        recentByLibrary,
        isLoading
    };
}
