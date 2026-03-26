import { useEffect } from 'react';

import { useScene } from '../contexts/SceneProvider';

/**
 * Convenience hook for page components that want to drive the ambient color
 * scene. Accepts an image URL and item ID, and calls setActiveItem() whenever
 * either value changes. Cleans up on unmount by setting the active item to null.
 *
 * Page components use this hook directly — they do not interact with
 * SceneProvider or SceneContext.
 *
 * @param imageUrl - The primary or backdrop image URL for the current item.
 *                   Passing null or undefined clears the active scene.
 * @param itemId   - Stable identifier for the current item. Used for palette
 *                   caching — must be consistent across renders for the same item.
 */
export function useSceneColors(
    imageUrl: string | null | undefined,
    itemId: string
): void {
    const { setActiveItem } = useScene();

    useEffect(() => {
        if (!imageUrl) {
            setActiveItem(null);
            return;
        }

        setActiveItem({
            itemId,
            primaryImageUrl: imageUrl,
            backdropImageUrl: null
        });

        return () => {
            setActiveItem(null);
        };
    }, [imageUrl, itemId, setActiveItem]);
}
