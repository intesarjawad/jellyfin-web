import React, { useRef, useEffect, type FC } from 'react';
import { useNavigate } from 'react-router-dom';

import ViewManagerPage from 'components/viewManager/ViewManagerPage';
import Events, { type Event } from 'utils/events';
import { EventType } from 'constants/eventType';

import PlayerOSD from '../components/PlayerOSD';

/**
 * Streamberry video player page.
 *
 * Mirrors the experimental VideoPage pattern exactly:
 *   - ViewManagerPage renders the native video player via the legacy controller
 *   - PlayerOSD is overlaid on top as an absolutely-positioned sibling
 *   - SHOW_VIDEO_OSD events from the legacy controller are wired but do not
 *     hide our OSD — the OSD manages its own visibility via auto-hide logic
 *
 * The container is `position: relative` so the OSD's `position: fixed`
 * inset-0 naturally covers the full viewport as intended.
 */
const StreamberryVideoPage: FC = () => {
    const navigate = useNavigate();
    const documentRef = useRef<Document>(document);

    useEffect(() => {
        const doc = documentRef.current;
        if (!doc) return;

        // The legacy controller fires SHOW_VIDEO_OSD(true/false) when it wants
        // to surface or suppress its own OSD chrome. We subscribe but don't
        // act on it — the Streamberry OSD is self-managing.
        const onLegacyOsdVisibilityChange = (_e: Event, _isShowing: boolean) => {
            // Intentionally empty: Streamberry OSD owns visibility decisions.
        };

        Events.on(doc, EventType.SHOW_VIDEO_OSD, onLegacyOsdVisibilityChange);

        return () => {
            Events.off(doc, EventType.SHOW_VIDEO_OSD, onLegacyOsdVisibilityChange);
        };
    }, []);

    function handleBack() {
        navigate(-1);
    }

    return (
        <>
            {/* Legacy player renders the actual <video> element and manages
                playback state. isNowPlayingBarEnabled=false suppresses the
                Jellyfin footer mini-player. isFullscreen ensures no chrome
                is injected around the video. */}
            <ViewManagerPage
                controller='playback/video/index'
                view='playback/video/index.html'
                type='video-osd'
                isFullscreen
                isNowPlayingBarEnabled={false}
                isThemeMediaSupported
            />

            {/* Streamberry glass OSD — overlaid above the video */}
            <PlayerOSD onBack={handleBack} />
        </>
    );
};

/**
 * Named export required by react-router's lazy() / `lazy` property pattern.
 * The router expects `{ Component }` from the module.
 */
export function Component() {
    return <StreamberryVideoPage />;
}

export default StreamberryVideoPage;
