import { ThemeProvider } from '@mui/material/styles';
import React from 'react';
import {
    RouterProvider,
    createHashRouter,
    Outlet,
    useLocation
} from 'react-router-dom';

import { DASHBOARD_APP_PATHS, DASHBOARD_APP_ROUTES } from 'apps/dashboard/routes/routes';
import { EXPERIMENTAL_APP_ROUTES } from 'apps/experimental/routes/routes';
import { STABLE_APP_ROUTES } from 'apps/stable/routes/routes';
import { STREAMBERRY_APP_ROUTES } from 'apps/streamberry/routes';
import { WIZARD_APP_ROUTES } from 'apps/wizard/routes/routes';
import AppHeader from 'components/AppHeader';
import Backdrop from 'components/Backdrop';
import { SETTING_KEY as LAYOUT_SETTING_KEY } from 'components/layoutManager';
import BangRedirect from 'components/router/BangRedirect';
import { createRouterHistory } from 'components/router/routerHistory';
import { LayoutMode } from 'constants/layoutMode';
import browser from 'scripts/browser';
import appTheme from 'themes';
import { ThemeStorageManager } from 'themes/themeStorageManager';

const layoutMode = browser.tv ? LayoutMode.Tv : localStorage.getItem(LAYOUT_SETTING_KEY);
const isStreamberryLayout = !layoutMode || layoutMode === LayoutMode.Streamberry;
const isExperimentalLayout = layoutMode === LayoutMode.Experimental;

function selectPrimaryAppRoutes() {
    if (isStreamberryLayout) return STREAMBERRY_APP_ROUTES;
    if (isExperimentalLayout) return EXPERIMENTAL_APP_ROUTES;
    return STABLE_APP_ROUTES;
}

const router = createHashRouter([
    {
        element: <RootAppLayout />,
        children: [
            ...selectPrimaryAppRoutes(),
            ...DASHBOARD_APP_ROUTES,
            ...WIZARD_APP_ROUTES,
            {
                path: '!/*',
                Component: BangRedirect
            }
        ]
    }
]);

export const history = createRouterHistory(router);

export default function RootAppRouter() {
    return <RouterProvider router={router} />;
}

/**
 * Layout component that renders legacy components required on all pages.
 * NOTE: The app will crash if these get removed from the DOM.
 */
function RootAppLayout() {
    const location = useLocation();
    const isNewLayoutPath = Object.values(DASHBOARD_APP_PATHS)
        .some(path => location.pathname.startsWith(`/${path}`));

    return (
        <ThemeProvider
            theme={appTheme}
            defaultMode='dark'
            storageManager={ThemeStorageManager}
        >
            <Backdrop />
            <AppHeader isHidden={isExperimentalLayout || isStreamberryLayout || isNewLayoutPath} />

            <Outlet />
        </ThemeProvider>
    );
}
