import type { BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models/base-item-dto';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { Card } from '../../components/Card';
import { GlassPanel } from '../../components/GlassPanel';
import { useItemImageUrl } from '../../hooks/useItemImageUrl';
import { useSearch } from '../../hooks/useSearch';

// Human-readable labels for Jellyfin item type strings
const TYPE_DISPLAY_LABELS: Record<string, string> = {
    Movie: 'Movies',
    Series: 'TV Shows',
    Episode: 'Episodes',
    MusicAlbum: 'Albums',
    MusicArtist: 'Artists',
    Audio: 'Songs',
    MusicVideo: 'Music Videos',
    BoxSet: 'Collections',
    Person: 'People'
};

// Order in which type sections appear in the results
const SECTION_SORT_ORDER: string[] = [
    'Movie',
    'Series',
    'Episode',
    'MusicAlbum',
    'MusicArtist',
    'Audio',
    'MusicVideo',
    'BoxSet',
    'Person'
];

function resolveTypeLabel(typeName: string): string {
    return TYPE_DISPLAY_LABELS[typeName] ?? typeName;
}

function sortedTypeKeys(resultGroups: Map<string, BaseItemDto[]>): string[] {
    const knownKeys = SECTION_SORT_ORDER.filter(key => resultGroups.has(key));
    const unknownKeys = Array.from(resultGroups.keys()).filter(
        key => !SECTION_SORT_ORDER.includes(key)
    );
    return [...knownKeys, ...unknownKeys];
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface SearchCardProps {
    item: BaseItemDto;
}

function SearchCard({ item }: Readonly<SearchCardProps>) {
    const navigate = useNavigate();
    const itemId = item.Id ?? '';
    const itemName = item.Name ?? 'Unknown';

    const isPosterType = item.Type === 'Movie' || item.Type === 'Series' || item.Type === 'Person' || item.Type === 'BoxSet';
    const imageType = isPosterType ? 'Primary' : 'Backdrop';
    const cardVariant = isPosterType ? 'poster' : 'landscape';

    const imageUrl = useItemImageUrl(item, imageType, { maxWidth: 300 });

    const releaseYear = item.ProductionYear ?? undefined;
    const contentRating = item.OfficialRating ?? undefined;

    const handleClick = useCallback(() => {
        if (itemId) {
            navigate(`/details?id=${itemId}`);
        }
    }, [itemId, navigate]);

    return (
        <Card
            itemId={itemId}
            itemName={itemName}
            imageUrl={imageUrl}
            variant={cardVariant}
            year={releaseYear}
            rating={contentRating}
            onClick={handleClick}
        />
    );
}

interface SearchResultGroupProps {
    typeName: string;
    items: BaseItemDto[];
}

function SearchResultGroup({ typeName, items }: Readonly<SearchResultGroupProps>) {
    const sectionLabel = resolveTypeLabel(typeName);
    const isPosterRow = typeName === 'Movie' || typeName === 'Series' || typeName === 'Person' || typeName === 'BoxSet';
    const gridClass = `sb-row__grid sb-row__grid--${isPosterRow ? 'poster' : 'landscape'}`;

    return (
        <section className='sb-row sb-search__result-section' aria-label={sectionLabel}>
            <h2 className='sb-row__title sb-search__section-title'>{sectionLabel}</h2>
            <div className={gridClass} role='list' aria-label={sectionLabel}>
                {items.map((item, index) => (
                    <div key={item.Id ?? index} role='listitem'>
                        <SearchCard item={item} />
                    </div>
                ))}
            </div>
        </section>
    );
}

// ---------------------------------------------------------------------------
// Main search page component
// ---------------------------------------------------------------------------

/**
 * Full-page search route for the Streamberry surface.
 *
 * The input auto-focuses on mount. Results stream in as the user types,
 * debounced at 300ms inside useSearch(). Results are grouped by media type,
 * each rendered as a horizontal card row matching home-page styling.
 *
 * Escape clears the current query; if the query is already empty, navigates
 * back to the previous page.
 */
export function Component() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const inputRef = useRef<HTMLInputElement>(null);
    const [queryText, setQueryText] = useState(searchParams.get('q') ?? '');

    const { resultGroups, isSearching, totalResults } = useSearch(queryText);
    const hasQuery = queryText.trim().length >= 2;
    const hasResults = totalResults > 0;
    const sortedGroupKeys = sortedTypeKeys(resultGroups);

    // Auto-focus the input when the page mounts
    useEffect(() => {
        inputRef.current?.focus();
    }, []);

    // Escape: clear query first, then navigate back if already empty
    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                if (queryText.length > 0) {
                    setQueryText('');
                    inputRef.current?.focus();
                } else {
                    navigate(-1);
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [queryText, navigate]);

    const handleInputChange = useCallback(
        (event: React.ChangeEvent<HTMLInputElement>) => {
            setQueryText(event.target.value);
        },
        []
    );

    const handleClearQuery = useCallback(() => {
        setQueryText('');
        inputRef.current?.focus();
    }, []);

    return (
        <div className='sb-search'>
            {/* Search input bar */}
            <div className='sb-search__header'>
                <GlassPanel elevation='medium' className='sb-search__input-wrap'>
                    <SearchIcon />
                    <input
                        ref={inputRef}
                        className='sb-search__input'
                        type='search'
                        value={queryText}
                        onChange={handleInputChange}
                        placeholder='Search movies, shows, music, people…'
                        aria-label='Search'
                        autoComplete='off'
                        spellCheck={false}
                    />
                    {queryText.length > 0 && (
                        <button
                            className='sb-search__clear-btn'
                            onClick={handleClearQuery}
                            aria-label='Clear search'
                        >
                            <ClearIcon />
                        </button>
                    )}
                    {isSearching && (
                        <span className='sb-search__spinner' aria-label='Searching' />
                    )}
                    <kbd className='sb-search__esc-hint' aria-label='Press Escape to go back'>Esc</kbd>
                </GlassPanel>
            </div>

            {/* Results area */}
            <div className='sb-search__body'>
                {!hasQuery && (
                    <EmptyQueryState />
                )}

                {hasQuery && !isSearching && !hasResults && (
                    <NoResultsState queryText={queryText} />
                )}

                {hasQuery && hasResults && (
                    <div className='sb-search__results' aria-label={`${totalResults} search results`}>
                        {sortedGroupKeys.map(typeName => {
                            const groupItems = resultGroups.get(typeName);
                            if (groupItems == null || groupItems.length === 0) return null;
                            return (
                                <SearchResultGroup
                                    key={typeName}
                                    typeName={typeName}
                                    items={groupItems}
                                />
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}

// ---------------------------------------------------------------------------
// Empty states
// ---------------------------------------------------------------------------

function EmptyQueryState() {
    return (
        <div className='sb-search__empty-state'>
            <p className='sb-search__empty-title'>Start typing to search</p>
            <p className='sb-search__empty-hint'>
                Find movies, TV shows, albums, artists, and people
            </p>
        </div>
    );
}

interface NoResultsStateProps {
    queryText: string;
}

function NoResultsState({ queryText }: Readonly<NoResultsStateProps>) {
    return (
        <div className='sb-search__empty-state'>
            <p className='sb-search__empty-title'>No results for &ldquo;{queryText}&rdquo;</p>
            <p className='sb-search__empty-hint'>Try a different title, name, or keyword</p>
        </div>
    );
}

// ---------------------------------------------------------------------------
// Icons
// ---------------------------------------------------------------------------

function SearchIcon() {
    return (
        <svg
            className='sb-search__icon'
            width='18'
            height='18'
            viewBox='0 0 16 16'
            fill='none'
            aria-hidden='true'
        >
            <circle cx='6.5' cy='6.5' r='5' stroke='currentColor' strokeWidth='1.5' />
            <path d='M10.5 10.5L14 14' stroke='currentColor' strokeWidth='1.5' strokeLinecap='round' />
        </svg>
    );
}

function ClearIcon() {
    return (
        <svg
            width='14'
            height='14'
            viewBox='0 0 14 14'
            fill='none'
            aria-hidden='true'
        >
            <path d='M2 2L12 12M12 2L2 12' stroke='currentColor' strokeWidth='1.5' strokeLinecap='round' />
        </svg>
    );
}
