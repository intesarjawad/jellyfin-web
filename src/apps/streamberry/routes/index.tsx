import React from 'react';
import { Navigate, type RouteObject } from 'react-router-dom';

import ConnectionRequired from 'components/ConnectionRequired';
import ErrorBoundary from 'components/router/ErrorBoundary';
import FallbackRoute from 'components/router/FallbackRoute';
import { toViewManagerPageRoute } from 'components/router/LegacyRoute';

import { LEGACY_USER_ROUTES } from './legacyRoutes';

// All seven library routes share the same LibraryPage component. The component
// reads the route path from location.pathname to determine which collection
// type to display, so a single lazy import covers all of them.
const lazyLibraryPage = () =>
    import('./library/index').then(mod => ({ Component: mod.LibraryPage }));

const lazySearchPage = () => import('./search/index');
const lazyVideoPage = () => import('./video');

const LIBRARY_ROUTES: RouteObject[] = [
    { path: 'movies',      lazy: lazyLibraryPage },
    { path: 'tv',          lazy: lazyLibraryPage },
    { path: 'music',       lazy: lazyLibraryPage },
    { path: 'livetv',      lazy: lazyLibraryPage },
    { path: 'homevideos',  lazy: lazyLibraryPage },
    { path: 'books',       lazy: lazyLibraryPage },
    { path: 'musicvideos', lazy: lazyLibraryPage }
];

/**
 * Route definitions for the Streamberry app surface.
 *
 * Lazy-loads AppLayout so the bundle for this surface is only fetched when
 * the Streamberry layout mode is active.
 *
 * Route structure mirrors the experimental surface:
 *   - ConnectionRequired wraps all authenticated routes
 *   - Home page is a real implementation, lazy-loaded for code splitting
 *   - Library routes (movies, tv, music, livetv, homevideos, books, musicvideos)
 *     all resolve to LibraryPage — the route path drives collection type selection
 *   - Video player is a real implementation layering the Streamberry OSD
 *   - Legacy routes (ViewManagerPage) handle the remaining Jellyfin views
 *   - FallbackRoute handles unrecognized paths
 */
export const STREAMBERRY_APP_ROUTES: RouteObject[] = [
    {
        path: '/*',
        lazy: () => import('../AppLayout'),
        children: [
            { index: true, element: <Navigate replace to='/home' /> },

            {
                Component: ConnectionRequired,
                children: [
                    // Home — real implementation, code-split via lazy import
                    {
                        path: 'home',
                        lazy: () =>
                            import('./home/index').then(mod => ({
                                Component: mod.default
                            }))
                    },
                    // Library pages — real implementation
                    ...LIBRARY_ROUTES,
                    // Search page — real implementation
                    { path: 'search', lazy: lazySearchPage },
                    // Detail page — real implementation
                    {
                        path: 'details',
                        lazy: () =>
                            import('./detail/index').then(mod => ({
                                Component: mod.default
                            }))
                    },
                    // Video player — real implementation
                    { path: 'video', lazy: lazyVideoPage },
                    ...LEGACY_USER_ROUTES.map(toViewManagerPageRoute)
                ],
                ErrorBoundary
            },

            {
                element: <ConnectionRequired level='public' />,
                children: [
                    { path: '*', Component: FallbackRoute }
                ]
            }
        ]
    }
];
