import type { BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models/base-item-dto';
import React, { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import { appRouter } from 'components/router/appRouter';
import { useApi } from 'hooks/useApi';
import { useUserViews } from 'hooks/useUserViews';

import { useBrand } from '../contexts/BrandProvider';
import { useSearchPalette } from '../contexts/SearchContext';

const SCROLL_HIDE_THRESHOLD_PX = 80;

function buildUserAvatarUrl(basePath: string, userId: string, imageTag: string): string {
    return `${basePath}/Users/${userId}/Images/Primary?tag=${imageTag}`;
}

function buildLibraryPath(view: BaseItemDto): string {
    return appRouter.getRouteUrl(view, { context: view.CollectionType }).substring(1);
}

const NavBar = () => {
    const { name: brandName, logoUrl } = useBrand();
    const { user, api } = useApi();
    const location = useLocation();
    const navigate = useNavigate();
    const { openPalette } = useSearchPalette();

    const { data: userViewsData } = useUserViews(user?.Id);
    const libraryViews = userViewsData?.Items ?? [];

    const [isNavVisible, setIsNavVisible] = useState(true);
    const lastScrollPositionRef = useRef(0);

    useEffect(() => {
        const onScroll = () => {
            const currentScrollY = window.scrollY;
            const scrolledDown = currentScrollY > lastScrollPositionRef.current;
            const scrolledPastThreshold = currentScrollY > SCROLL_HIDE_THRESHOLD_PX;

            if (scrolledDown && scrolledPastThreshold) {
                setIsNavVisible(false);
            } else {
                setIsNavVisible(true);
            }

            lastScrollPositionRef.current = currentScrollY;
        };

        window.addEventListener('scroll', onScroll, { passive: true });
        return () => window.removeEventListener('scroll', onScroll);
    }, []);

    const isHomePath = location.pathname === '/home' || location.pathname === '/';

    const userAvatarSrc =
        api && user?.Id && user?.PrimaryImageTag
            ? buildUserAvatarUrl(api.basePath, user.Id, user.PrimaryImageTag)
            : null;

    const userInitial = user?.Name ? user.Name.charAt(0).toUpperCase() : '?';

    return (
        <nav
            className='sb-topbar'
            aria-label='Main navigation'
            style={{
                transform: isNavVisible ? 'translateY(0)' : 'translateY(-110%)',
                transition: 'transform var(--duration-meso) var(--ease-meso)',
            }}
        >
            {/* Brand */}
            <div className='sb-topbar__brand'>
                <button
                    className='sb-topbar__brand'
                    onClick={() => navigate('/home')}
                    aria-label={`${brandName} — go to home`}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                >
                    {logoUrl ? (
                        <img
                            src={logoUrl}
                            alt={brandName}
                            className='sb-topbar__brand-mark'
                            style={{ objectFit: 'contain' }}
                        />
                    ) : (
                        <span className='sb-topbar__brand-mark' aria-hidden='true'>
                            {brandName.charAt(0).toUpperCase()}
                        </span>
                    )}
                    <span className='sb-topbar__brand-text'>{brandName}</span>
                </button>
            </div>

            {/* Library navigation */}
            <div className='sb-topbar__nav' role='list'>
                <a
                    role='listitem'
                    href='/home'
                    className={`sb-topbar__link${isHomePath ? ' sb-topbar__link--active' : ''}`}
                    aria-current={isHomePath ? 'page' : undefined}
                    onClick={(e) => {
                        e.preventDefault();
                        navigate('/home');
                    }}
                >
                    Home
                </a>

                {libraryViews.map((view) => {
                    const libraryPath = buildLibraryPath(view);
                    const isActive = location.pathname.startsWith(`/${libraryPath.split('?')[0]}`);

                    return (
                        <a
                            key={view.Id}
                            role='listitem'
                            href={`/${libraryPath}`}
                            className={`sb-topbar__link${isActive ? ' sb-topbar__link--active' : ''}`}
                            aria-current={isActive ? 'page' : undefined}
                            onClick={(e) => {
                                e.preventDefault();
                                navigate(`/${libraryPath}`);
                            }}
                        >
                            {view.Name}
                        </a>
                    );
                })}
            </div>

            {/* Actions */}
            <div className='sb-topbar__right'>
                <button
                    className='sb-topbar__search'
                    onClick={openPalette}
                    aria-label='Search (Ctrl+K)'
                >
                    <svg
                        width='16'
                        height='16'
                        viewBox='0 0 16 16'
                        fill='none'
                        aria-hidden='true'
                        style={{ flexShrink: 0 }}
                    >
                        <circle cx='6.5' cy='6.5' r='5' stroke='currentColor' strokeWidth='1.5' />
                        <path d='M10.5 10.5L14 14' stroke='currentColor' strokeWidth='1.5' strokeLinecap='round' />
                    </svg>
                    <span className='sb-topbar__search-text'>Search</span>
                    <kbd className='sb-topbar__search-kbd'>⌘K</kbd>
                </button>

                <button
                    className='sb-topbar__profile'
                    onClick={() => navigate('/mypreferencesmenu.html')}
                    aria-label={user?.Name ? `Profile: ${user.Name}` : 'Profile'}
                >
                    {userAvatarSrc ? (
                        <img
                            src={userAvatarSrc}
                            alt={user?.Name ?? 'User avatar'}
                            style={{
                                width: 28,
                                height: 28,
                                borderRadius: '50%',
                                objectFit: 'cover',
                            }}
                        />
                    ) : (
                        <span
                            aria-hidden='true'
                            style={{
                                width: 28,
                                height: 28,
                                borderRadius: '50%',
                                display: 'inline-grid',
                                placeItems: 'center',
                                background: 'var(--ambient-accent)',
                                fontSize: 13,
                                fontWeight: 600,
                                color: 'white',
                                flexShrink: 0,
                            }}
                        >
                            {userInitial}
                        </span>
                    )}
                    {user?.Name && (
                        <span style={{ fontSize: 'var(--type-nav-link)' }}>{user.Name}</span>
                    )}
                </button>
            </div>
        </nav>
    );
};

export default NavBar;
