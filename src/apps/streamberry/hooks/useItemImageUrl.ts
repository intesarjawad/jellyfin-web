import { ImageType } from '@jellyfin/sdk/lib/generated-client/models/image-type';
import { getImageApi } from '@jellyfin/sdk/lib/utils/api/image-api';
import { useMemo } from 'react';

import { useApi } from 'hooks/useApi';
import type { ItemDto } from 'types/base/models/item-dto';

type RequestedImageType = 'Primary' | 'Backdrop' | 'Thumb';

interface ImageUrlOptions {
    maxWidth?: number;
    quality?: number;
}

const DEFAULT_MAX_WIDTH: Record<RequestedImageType, number> = {
    Primary: 400,
    Backdrop: 800,
    Thumb: 800
};

const DEFAULT_QUALITY = 96;

/**
 * Resolves the correct item ID and image tag for the requested image type.
 * Jellyfin items store image tags as proof that an image exists — if there's
 * no tag, the item doesn't have that image type and requesting it will 404.
 *
 * Falls back through parent items (e.g. a Season's series backdrop) when
 * the item itself doesn't have the requested image.
 */
interface ResolvedImage {
    itemId: string;
    imageTag: string;
    imageType: ImageType;
}

function resolvePrimaryImage(item: ItemDto): ResolvedImage | null {
    const primaryTag = item.ImageTags?.Primary;
    if (primaryTag) {
        return { itemId: item.Id!, imageTag: primaryTag, imageType: ImageType.Primary };
    }
    if (item.ParentPrimaryImageItemId && item.ParentPrimaryImageTag) {
        return {
            itemId: item.ParentPrimaryImageItemId,
            imageTag: item.ParentPrimaryImageTag,
            imageType: ImageType.Primary
        };
    }
    return null;
}

function resolveBackdropImage(item: ItemDto): ResolvedImage | null {
    const backdropTags = item.BackdropImageTags;
    if (backdropTags && backdropTags.length > 0) {
        return { itemId: item.Id!, imageTag: backdropTags[0], imageType: ImageType.Backdrop };
    }
    if (item.ParentBackdropImageTags && item.ParentBackdropImageTags.length > 0
        && item.ParentBackdropItemId) {
        return {
            itemId: item.ParentBackdropItemId,
            imageTag: item.ParentBackdropImageTags[0],
            imageType: ImageType.Backdrop
        };
    }
    return null;
}

function resolveThumbImage(item: ItemDto): ResolvedImage | null {
    const thumbTag = item.ImageTags?.Thumb;
    if (thumbTag) {
        return { itemId: item.Id!, imageTag: thumbTag, imageType: ImageType.Thumb };
    }
    if (item.ParentThumbItemId && item.ParentThumbImageTag) {
        return {
            itemId: item.ParentThumbItemId,
            imageTag: item.ParentThumbImageTag,
            imageType: ImageType.Thumb
        };
    }
    return null;
}

const IMAGE_RESOLVERS: Record<RequestedImageType, (item: ItemDto) => ResolvedImage | null> = {
    Primary: resolvePrimaryImage,
    Backdrop: resolveBackdropImage,
    Thumb: resolveThumbImage
};

function resolveImageSource(
    item: ItemDto | null | undefined,
    requestedType: RequestedImageType
): ResolvedImage | null {
    if (!item?.Id) return null;
    return IMAGE_RESOLVERS[requestedType](item);
}

/**
 * Constructs a Jellyfin image URL for the given item and image type using
 * the SDK's image API. Returns null when the item doesn't have the
 * requested image type (no tag = no image = no URL).
 *
 * @param item      - The full item DTO (needs ImageTags, BackdropImageTags, etc.)
 * @param imageType - Which image slot to request
 * @param options   - Optional width and quality overrides
 */
export function useItemImageUrl(
    item: ItemDto | null | undefined,
    imageType: RequestedImageType,
    options?: ImageUrlOptions
): string | null {
    const { api } = useApi();

    const source = resolveImageSource(item, imageType);

    return useMemo(() => {
        if (!api || !source) return null;

        const maxWidth = options?.maxWidth ?? DEFAULT_MAX_WIDTH[imageType];
        const quality = options?.quality ?? DEFAULT_QUALITY;

        return getImageApi(api).getItemImageUrlById(
            source.itemId,
            source.imageType,
            {
                fillWidth: maxWidth,
                quality,
                tag: source.imageTag
            }
        );
    }, [api, source?.itemId, source?.imageTag, source?.imageType, imageType, options?.maxWidth, options?.quality]);
}
