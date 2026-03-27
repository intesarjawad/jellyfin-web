import type { LegacyRoute } from 'components/router/LegacyRoute';

/**
 * Legacy Jellyfin routes rendered via ViewManagerPage within the Streamberry layout.
 *
 * These are the views that Streamberry does not yet own with its own React components.
 * They render the existing Jellyfin HTML/controller views, which are styled by
 * overrides.css mapping Streamberry tokens onto Jellyfin's DOM selectors.
 *
 * TODO(wave-3): Migrate each of these to native Streamberry React components
 * and remove the corresponding entry here.
 */
export const LEGACY_PUBLIC_ROUTES: LegacyRoute[] = [
    {
        path: 'addserver',
        pageProps: {
            controller: 'session/addServer/index',
            view: 'session/addServer/index.html'
        }
    },
    {
        path: 'selectserver',
        pageProps: {
            controller: 'session/selectServer/index',
            view: 'session/selectServer/index.html'
        }
    },
    {
        path: 'login',
        pageProps: {
            controller: 'session/login/index',
            view: 'session/login/index.html'
        }
    },
    {
        path: 'forgotpassword',
        pageProps: {
            controller: 'session/forgotPassword/index',
            view: 'session/forgotPassword/index.html'
        }
    },
    {
        path: 'forgotpasswordpin',
        pageProps: {
            controller: 'session/resetPassword/index',
            view: 'session/resetPassword/index.html'
        }
    }
];

export const LEGACY_USER_ROUTES: LegacyRoute[] = [
    {
        path: 'list',
        pageProps: {
            controller: 'list',
            view: 'list.html'
        }
    },
    {
        path: 'lyrics',
        pageProps: {
            controller: 'lyrics',
            view: 'lyrics.html'
        }
    },
    {
        path: 'mypreferencescontrols',
        pageProps: {
            controller: 'user/controls/index',
            view: 'user/controls/index.html'
        }
    },
    {
        path: 'mypreferenceshome',
        pageProps: {
            controller: 'user/home/index',
            view: 'user/home/index.html'
        }
    },
    {
        path: 'mypreferencesplayback',
        pageProps: {
            controller: 'user/playback/index',
            view: 'user/playback/index.html'
        }
    },
    {
        path: 'mypreferencessubtitles',
        pageProps: {
            controller: 'user/subtitles/index',
            view: 'user/subtitles/index.html'
        }
    },
    {
        path: 'mypreferencesdisplay',
        pageProps: {
            controller: 'user/display/index',
            view: 'user/display/index.html'
        }
    },
    {
        path: 'queue',
        pageProps: {
            controller: 'playback/queue/index',
            view: 'playback/queue/index.html',
            isFullscreen: true,
            isNowPlayingBarEnabled: false,
            isThemeMediaSupported: true
        }
    },
    {
        path: 'userprofile',
        pageProps: {
            controller: 'user/userprofile',
            view: 'user/userprofile.html'
        }
    }
];
