import React, { StrictMode, useEffect } from 'react';
import { Outlet } from 'react-router-dom';

import CustomCss from 'components/CustomCss';
import ThemeCss from 'components/ThemeCss';

import { BrandProvider } from './contexts/BrandProvider';
import { SceneProvider } from './contexts/SceneProvider';
import { SearchProvider, useSearchPalette } from './contexts/SearchContext';
import Backdrop from './components/Backdrop';
import { CommandPalette } from './components/CommandPalette';
import NavBar from './components/NavBar';

import './styles/tokens.css';
import './styles/overrides.css';

/**
 * Root layout for the Streamberry app surface.
 *
 * Structure:
 *   BrandProvider  — fetches brand.json, sets document.documentElement.dataset.brandPrefix
 *   SceneProvider  — drives ambient color pipeline from active item artwork
 *   SearchProvider — manages command palette open/closed state
 *     Backdrop     — full-viewport ambient gradient at z-index 0
 *     CommandPalette — global overlay search, triggered by Ctrl+K / Cmd+K
 *     NavBar       — glass navigation bar, auto-hides on scroll down
 *     <main>       — page content rendered by React Router
 *   ThemeCss       — jellyfin server theme injection
 *   CustomCss      — admin-configured custom CSS injection
 */

/**
 * Inner layout that can consume SearchProvider context.
 * Separated from the Component wrapper so hooks fire inside the provider tree.
 */
function AppLayoutInner() {
    const { togglePalette } = useSearchPalette();

    useEffect(() => {
        const handleGlobalKeyDown = (event: KeyboardEvent) => {
            const isCtrlOrCmd = event.ctrlKey || event.metaKey;
            if (isCtrlOrCmd && event.key === 'k') {
                event.preventDefault();
                togglePalette();
            }
        };

        window.addEventListener('keydown', handleGlobalKeyDown);
        return () => window.removeEventListener('keydown', handleGlobalKeyDown);
    }, [togglePalette]);

    return (
        <>
            <Backdrop />
            <CommandPalette />

            <div className='sb-root streamberry-scrollbar'>
                <NavBar />

                <main>
                    <Outlet />
                </main>
            </div>

            <ThemeCss />
            <CustomCss />
        </>
    );
}

export const Component = () => {
    return (
        <StrictMode>
            <BrandProvider>
                <SceneProvider>
                    <SearchProvider>
                        <AppLayoutInner />
                    </SearchProvider>
                </SceneProvider>
            </BrandProvider>
        </StrictMode>
    );
};
