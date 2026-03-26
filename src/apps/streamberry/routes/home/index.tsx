import React from 'react';

import { useHomeData } from '../../hooks/useHomeData';
import { ContentRow } from './ContentRow';
import { Hero } from './Hero';
import { Spotlight } from './Spotlight';

/**
 * Home page for the Streamberry surface.
 *
 * Orchestrates the hero, spotlight, continue-watching row, and one
 * recently-added row per media library. All data comes from useHomeData()
 * and every sub-component handles its own empty/loading states gracefully,
 * so this component stays clean of conditional rendering noise.
 *
 * The Hero drives scene color extraction; no other component needs to call
 * useSceneColors() since only one item is visually dominant at a time.
 */
export default function HomePage() {
    const { heroItems, continueWatching, recentByLibrary, isLoading } = useHomeData();

    if (isLoading && heroItems.length === 0) {
        return <HomePageSkeleton />;
    }

    // Items past the hero (index 2 onward) make good spotlight candidates —
    // they have been flagged as recent/notable but aren't in the primary slot.
    const spotlightCandidates = heroItems.slice(2, 5);

    return (
        <div className='sb-home'>
            <Hero items={heroItems} />

            <div className='sb-home__content'>
                <Spotlight items={spotlightCandidates} />

                {continueWatching.length > 0 && (
                    <ContentRow
                        title='Continue Watching'
                        items={continueWatching}
                        variant='landscape'
                    />
                )}

                {recentByLibrary.map(libraryGroup => (
                    <ContentRow
                        key={libraryGroup.libraryId}
                        title={`Recently Added in ${libraryGroup.libraryName}`}
                        items={libraryGroup.items}
                        variant='poster'
                    />
                ))}
            </div>
        </div>
    );
}

// ---------------------------------------------------------------------------
// HomePageSkeleton — token-based loading placeholder
// ---------------------------------------------------------------------------

/**
 * Shown only on the very first load before any data has resolved.
 * Uses token CSS classes so skeleton proportions match the real layout.
 */
function HomePageSkeleton() {
    return (
        <div className='sb-home sb-home--loading' aria-busy='true' aria-label='Loading home page'>
            <div className='sb-home__skeleton-hero' />
            <div className='sb-home__content'>
                <div className='sb-home__skeleton-row' />
                <div className='sb-home__skeleton-row' />
            </div>
        </div>
    );
}
