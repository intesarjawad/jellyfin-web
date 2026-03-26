import type { BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models/base-item-dto';
import { BaseItemKind } from '@jellyfin/sdk/lib/generated-client/models/base-item-kind';
import { ItemFields } from '@jellyfin/sdk/lib/generated-client/models/item-fields';
import { getItemsApi } from '@jellyfin/sdk/lib/utils/api/items-api';
import { getPersonsApi } from '@jellyfin/sdk/lib/utils/api/persons-api';
import { useQuery } from '@tanstack/react-query';
import { useDebounceValue } from 'usehooks-ts';

import { useApi } from 'hooks/useApi';

// Item types included in generic search — People are fetched separately
const SEARCHABLE_ITEM_TYPES: BaseItemKind[] = [
    BaseItemKind.Movie,
    BaseItemKind.Series,
    BaseItemKind.Episode,
    BaseItemKind.MusicAlbum,
    BaseItemKind.MusicArtist,
    BaseItemKind.Audio,
    BaseItemKind.MusicVideo,
    BaseItemKind.BoxSet
];

const SEARCH_FIELDS = [
    ItemFields.PrimaryImageAspectRatio,
    ItemFields.Overview,
    ItemFields.Genres
];

const SEARCH_RESULT_LIMIT = 200;
const PEOPLE_RESULT_LIMIT = 20;
const DEBOUNCE_DELAY_MS = 300;
const MIN_QUERY_LENGTH = 2;

export interface SearchResultGroups {
    resultGroups: Map<string, BaseItemDto[]>;
    isSearching: boolean;
    totalResults: number;
}

function groupItemsByType(items: BaseItemDto[]): Map<string, BaseItemDto[]> {
    const groups = new Map<string, BaseItemDto[]>();

    for (const item of items) {
        const typeName = item.Type ?? 'Unknown';
        const existingGroup = groups.get(typeName);

        if (existingGroup != null) {
            existingGroup.push(item);
        } else {
            groups.set(typeName, [item]);
        }
    }

    return groups;
}

/**
 * Debounced search hook that queries both items and people endpoints.
 *
 * Results are grouped by item type (Movie, Series, Episode, Person, etc.)
 * so the search page and command palette can render typed sections.
 *
 * The query is disabled until the debounced term reaches MIN_QUERY_LENGTH
 * to avoid hammering the server on single-keystroke input.
 */
export function useSearch(searchTerm: string): SearchResultGroups {
    const { api, user } = useApi();
    const userId = user?.Id;
    const isApiReady = api != null && userId != null;

    const [debouncedSearchTerm] = useDebounceValue(searchTerm, DEBOUNCE_DELAY_MS);
    const isQueryEnabled = isApiReady && debouncedSearchTerm.length >= MIN_QUERY_LENGTH;

    const { data, isFetching } = useQuery({
        queryKey: ['Streamberry', 'Search', debouncedSearchTerm],
        queryFn: async ({ signal }) => {
            const [itemsResponse, peopleResponse] = await Promise.all([
                getItemsApi(api!).getItems(
                    {
                        userId,
                        searchTerm: debouncedSearchTerm,
                        recursive: true,
                        includeItemTypes: SEARCHABLE_ITEM_TYPES,
                        fields: SEARCH_FIELDS,
                        imageTypeLimit: 1,
                        enableTotalRecordCount: false,
                        limit: SEARCH_RESULT_LIMIT
                    },
                    { signal }
                ),
                getPersonsApi(api!).getPersons(
                    {
                        userId,
                        searchTerm: debouncedSearchTerm,
                        fields: SEARCH_FIELDS,
                        imageTypeLimit: 1,
                        enableTotalRecordCount: false,
                        limit: PEOPLE_RESULT_LIMIT
                    },
                    { signal }
                )
            ]);

            const allItems = [
                ...(itemsResponse.data.Items ?? []),
                ...(peopleResponse.data.Items ?? [])
            ];

            return groupItemsByType(allItems);
        },
        enabled: isQueryEnabled,
        staleTime: 30 * 1000
    });

    const resultGroups = data ?? new Map<string, BaseItemDto[]>();
    const totalResults = Array.from(resultGroups.values()).reduce(
        (sum, group) => sum + group.length,
        0
    );

    return {
        resultGroups,
        isSearching: isFetching,
        totalResults
    };
}
