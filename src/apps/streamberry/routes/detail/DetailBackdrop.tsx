import React from 'react';

import { useItemImageUrl } from '../../hooks/useItemImageUrl';

interface DetailBackdropProps {
    itemId: string;
}

/**
 * Full-viewport backdrop artwork for the detail page.
 *
 * Requests the widest available backdrop image so the gradient overlay
 * always has something sharp to fade. When no backdrop exists the server
 * returns a 404 and the browser shows nothing — the gradient overlay still
 * renders, giving the glass panel something to sit against.
 */
export function DetailBackdrop({ itemId }: Readonly<DetailBackdropProps>) {
    const backdropUrl = useItemImageUrl(itemId, 'Backdrop', { maxWidth: 1920 });

    return (
        <div className='sb-detail__backdrop' aria-hidden='true'>
            {backdropUrl != null && (
                <img
                    className='sb-detail__backdrop-image'
                    src={backdropUrl}
                    alt=''
                    loading='lazy'
                />
            )}
            <div className='sb-detail__backdrop-gradient' />
        </div>
    );
}
