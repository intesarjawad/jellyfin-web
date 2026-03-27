import React, { useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { useQuery } from '@tanstack/react-query';
import { getLibraryApi } from '@jellyfin/sdk/lib/utils/api/library-api';
import { getUserLibraryApi } from '@jellyfin/sdk/lib/utils/api/user-library-api';
import { ItemFields } from '@jellyfin/sdk/lib/generated-client/models/item-fields';

import { useApi, type JellyfinApiContext } from 'hooks/useApi';
import { useToggleFavoriteMutation } from 'hooks/useFetchItems';
import { useSceneColors } from '../../hooks/useSceneColors';
import { useItemImageUrl } from '../../hooks/useItemImageUrl';
import { Card } from '../../components/Card';
import { DetailBackdrop } from './DetailBackdrop';
import { DetailPanel } from './DetailPanel';
import { SeasonBrowser } from './SeasonBrowser';
import type { ItemDto } from 'types/base/models/item-dto';
import type { AxiosRequestConfig } from 'axios';

const SIMILAR_ITEMS_LIMIT = 12;

// ---------------------------------------------------------------------------
// Data fetching
// ---------------------------------------------------------------------------

const fetchItemDetail = async (
    apiContext: JellyfinApiContext,
    itemId: string,
    options?: AxiosRequestConfig
): Promise<ItemDto> => {
    const { api, user } = apiContext;
    if (!api || !user?.Id) throw new Error('Not authenticated');

    const response = await getUserLibraryApi(api).getItem(
        {
            userId: user.Id,
            itemId
        },
        options
    );
    return response.data as ItemDto;
};

const fetchSimilarItems = async (
    apiContext: JellyfinApiContext,
    itemId: string,
    options?: AxiosRequestConfig
): Promise<ItemDto[]> => {
    const { api, user } = apiContext;
    if (!api || !user?.Id) return [];

    const response = await getLibraryApi(api).getSimilarItems(
        {
            itemId,
            userId: user.Id,
            limit: SIMILAR_ITEMS_LIMIT,
            fields: [ItemFields.PrimaryImageAspectRatio]
        },
        options
    );
    return (response.data.Items ?? []) as ItemDto[];
};

function useItemDetail(itemId: string | null) {
    const apiContext = useApi();
    return useQuery({
        queryKey: ['ItemDetail', itemId],
        queryFn: ({ signal }) => fetchItemDetail(apiContext, itemId!, { signal }),
        enabled: !!apiContext.api && !!apiContext.user?.Id && itemId != null
    });
}

function useSimilarItems(itemId: string | null) {
    const apiContext = useApi();
    return useQuery({
        queryKey: ['ItemDetail', itemId, 'Similar'],
        queryFn: ({ signal }) => fetchSimilarItems(apiContext, itemId!, { signal }),
        enabled: !!apiContext.api && !!apiContext.user?.Id && itemId != null
    });
}

// ---------------------------------------------------------------------------
// DetailPage — orchestrator
// ---------------------------------------------------------------------------

/**
 * Detail page for a single media item.
 *
 * The item ID comes from the `id` URL search param, matching the pattern
 * established by the Hero and ContentRow components that navigate to
 * `/details?id=...`.
 *
 * Scene colors are driven by the backdrop image. The Series season browser
 * only mounts when the item's Type is 'Series'.
 */
export default function DetailPage() {
    const [searchParams] = useSearchParams();
    const itemId = searchParams.get('id');

    const { data: item, isLoading, isError } = useItemDetail(itemId);
    const { data: similarItems = [] } = useSimilarItems(itemId);
    const { mutate: toggleFavorite } = useToggleFavoriteMutation();

    const resolvedItemId = item?.Id ?? itemId ?? '';
    const backdropUrl = useItemImageUrl(item, 'Backdrop');
    useSceneColors(backdropUrl, resolvedItemId);

    const handleFavoriteToggle = useCallback(() => {
        if (!item?.Id) return;
        toggleFavorite({
            itemId: item.Id,
            isFavorite: item.UserData?.IsFavorite ?? false
        });
    }, [item, toggleFavorite]);

    if (itemId == null) {
        return <DetailErrorState message='No item ID provided.' />;
    }

    if (isLoading) {
        return <DetailPageSkeleton />;
    }

    if (isError || item == null) {
        return <DetailErrorState message='Could not load item details.' />;
    }

    const isSeries = item.Type === 'Series';
    const isFavorite = item.UserData?.IsFavorite ?? false;

    return (
        <div className='sb-detail'>
            <DetailBackdrop item={item} />

            <div className='sb-detail__content'>
                <DetailPanel
                    item={item}
                    isFavorite={isFavorite}
                    onFavoriteToggle={handleFavoriteToggle}
                />

                {isSeries && item.Id != null && (
                    <SeasonBrowser seriesId={item.Id} />
                )}

                {similarItems.length > 0 && (
                    <SimilarItemsRow items={similarItems} />
                )}
            </div>
        </div>
    );
}

// ---------------------------------------------------------------------------
// SimilarItemsRow
// ---------------------------------------------------------------------------

interface SimilarItemsRowProps {
    items: ItemDto[];
}

function SimilarItemsRow({ items }: Readonly<SimilarItemsRowProps>) {
    return (
        <section className='sb-detail__similar sb-row' aria-label='More like this'>
            <h2 className='sb-row__title'>More Like This</h2>
            <div
                className='sb-row__grid sb-row__grid--poster'
                role='list'
                aria-label='Similar items'
            >
                {items.map((item, index) => (
                    <div key={item.Id ?? index} role='listitem'>
                        <SimilarItemCard item={item} />
                    </div>
                ))}
            </div>
        </section>
    );
}

// ---------------------------------------------------------------------------
// SimilarItemCard — bridges ItemDto → Card with navigation
// ---------------------------------------------------------------------------

interface SimilarItemCardProps {
    item: ItemDto;
}

function SimilarItemCard({ item }: Readonly<SimilarItemCardProps>) {
    const navigate = useNavigate();
    const itemId = item.Id ?? '';
    const itemName = item.Name ?? 'Unknown';
    const imageUrl = useItemImageUrl(item, 'Primary');

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
            variant='poster'
            year={item.ProductionYear ?? undefined}
            rating={item.OfficialRating ?? undefined}
            onClick={handleClick}
        />
    );
}

// ---------------------------------------------------------------------------
// Loading / error states
// ---------------------------------------------------------------------------

function DetailPageSkeleton() {
    return (
        <div className='sb-detail sb-detail--loading' aria-busy='true' aria-label='Loading item details'>
            <div className='sb-detail__skeleton-backdrop' />
            <div className='sb-detail__content'>
                <div className='sb-detail__skeleton-panel' />
            </div>
        </div>
    );
}

interface DetailErrorStateProps {
    message: string;
}

function DetailErrorState({ message }: Readonly<DetailErrorStateProps>) {
    return (
        <div className='sb-detail sb-detail--error'>
            <div className='sb-detail__content'>
                <p className='type-synopsis'>{message}</p>
            </div>
        </div>
    );
}
