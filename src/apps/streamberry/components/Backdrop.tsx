import React from 'react';

/**
 * Full-viewport ambient gradient backdrop.
 *
 * Renders entirely at z-index 0 (--z-ambient) behind all page content.
 * The scene system drives the visual by updating --ambient-primary and
 * --ambient-secondary on the document root; this component just holds
 * the DOM node that makes those CSS vars visible.
 *
 * No JS logic lives here — keeping it as a pure CSS target means the
 * scene transitions are governed entirely by the token system.
 */
const Backdrop = () => {
    return (
        <div className='scene' aria-hidden='true'>
            <div className='scene-glow' />
            <div className='scene-haze' />
            <div className='scene-grain' />
        </div>
    );
};

export default Backdrop;
