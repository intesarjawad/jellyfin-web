import { useMemo } from 'react';

import { useApi } from 'hooks/useApi';

type ImageType = 'Primary' | 'Backdrop' | 'Thumb';

interface ImageUrlOptions {
    maxWidth?: number;
    quality?: number;
}

/**
 * Width in pixels to request when no explicit maxWidth is provided.
 * Primary images (poster art) are narrower than backdrop/thumb images.
 */
const DEFAULT_MAX_WIDTH: Record<ImageType, number> = {
    Primary: 400,
    Backdrop: 800,
    Thumb: 800
};

const DEFAULT_QUALITY = 90;

/**
 * Constructs a Jellyfin image URL for the given item and image type.
 *
 * Reads the server base URL from the ApiContext so callers never need to
 * hard-code or pass the server address. Returns null when no API context
 * is available (e.g. during SSR or before authentication completes), so
 * callers can render a fallback without crashing.
 *
 * @param itemId    - Jellyfin item ID (UUID string)
 * @param imageType - Which image slot to request from the server
 * @param options   - Optional width and quality overrides
 *
 * @example
 * const posterUrl = useItemImageUrl(item.Id, 'Primary', { maxWidth: 300 });
 * const backdropUrl = useItemImageUrl(item.Id, 'Backdrop');
 */
export function useItemImageUrl(
    itemId: string,
    imageType: ImageType,
    options?: ImageUrlOptions
): string | null {
    const { api } = useApi();

    const serverUrl = api?.basePath ?? null;

    return useMemo(() => {
        if (serverUrl == null) return null;

        const maxWidth = options?.maxWidth ?? DEFAULT_MAX_WIDTH[imageType];
        const quality = options?.quality ?? DEFAULT_QUALITY;

        return `${serverUrl}/Items/${itemId}/Images/${imageType}?maxWidth=${maxWidth}&quality=${quality}`;
    }, [serverUrl, itemId, imageType, options?.maxWidth, options?.quality]);
}
