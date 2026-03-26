import type { BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models/base-item-dto';
import React, {
    useCallback,
    useEffect,
    useRef,
    useState,
    type KeyboardEvent
} from 'react';
import { useNavigate } from 'react-router-dom';

import { useItemImageUrl } from '../hooks/useItemImageUrl';
import { useSearch } from '../hooks/useSearch';
import { useSearchPalette } from '../contexts/SearchContext';

// Section display labels and ordering mirror the search page
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

const SECTION_SORT_ORDER: string[] = [
    'Movie', 'Series', 'Episode', 'MusicAlbum',
    'MusicArtist', 'Audio', 'MusicVideo', 'BoxSet', 'Person'
];

// Maximum items shown per type group in the compact palette view
const MAX_ITEMS_PER_GROUP_IN_PALETTE = 4;

function sortedTypeKeys(resultGroups: Map<string, BaseItemDto[]>): string[] {
    const knownKeys = SECTION_SORT_ORDER.filter(key => resultGroups.has(key));
    const unknownKeys = Array.from(resultGroups.keys()).filter(
        key => !SECTION_SORT_ORDER.includes(key)
    );
    return [...knownKeys, ...unknownKeys];
}

function flattenResultsInOrder(
    resultGroups: Map<string, BaseItemDto[]>,
    orderedKeys: string[]
): BaseItemDto[] {
    const allItems: BaseItemDto[] = [];
    for (const key of orderedKeys) {
        const group = resultGroups.get(key);
        if (group == null) continue;
        allItems.push(...group.slice(0, MAX_ITEMS_PER_GROUP_IN_PALETTE));
    }
    return allItems;
}

// ---------------------------------------------------------------------------
// Palette result row
// ---------------------------------------------------------------------------

interface PaletteResultRowProps {
    item: BaseItemDto;
    isHighlighted: boolean;
    onSelect: (item: BaseItemDto) => void;
}

function PaletteResultRow({ item, isHighlighted, onSelect }: Readonly<PaletteResultRowProps>) {
    const itemId = item.Id ?? '';
    const itemName = item.Name ?? 'Unknown';
    const typeName = item.Type ?? '';
    const typeLabel = TYPE_DISPLAY_LABELS[typeName] ?? typeName;
    const releaseYear = item.ProductionYear;

    const imageUrl = useItemImageUrl(itemId, 'Primary', { maxWidth: 60 });

    const handleClick = useCallback(() => onSelect(item), [item, onSelect]);

    const handleKeyDown = useCallback(
        (event: KeyboardEvent<HTMLButtonElement>) => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                onSelect(item);
            }
        },
        [item, onSelect]
    );

    return (
        <button
            className={`sb-command__result-row${isHighlighted ? ' sb-command__result-row--highlighted' : ''}`}
            onClick={handleClick}
            onKeyDown={handleKeyDown}
            data-item-id={itemId}
        >
            <div className='sb-command__result-thumb'>
                {imageUrl != null ? (
                    <img
                        src={imageUrl}
                        alt={itemName}
                        className='sb-command__result-thumb-img'
                        loading='eager'
                    />
                ) : (
                    <div className='sb-command__result-thumb-fallback' aria-hidden='true'>
                        {itemName.charAt(0).toUpperCase()}
                    </div>
                )}
            </div>
            <div className='sb-command__result-meta'>
                <span className='sb-command__result-name'>{itemName}</span>
                <span className='sb-command__result-type'>
                    {typeLabel}{releaseYear != null ? ` · ${releaseYear}` : ''}
                </span>
            </div>
        </button>
    );
}

// ---------------------------------------------------------------------------
// Section header within palette results
// ---------------------------------------------------------------------------

interface PaletteSectionHeaderProps {
    label: string;
}

function PaletteSectionHeader({ label }: Readonly<PaletteSectionHeaderProps>) {
    return (
        <div className='sb-command__section-header' role='presentation'>
            {label}
        </div>
    );
}

// ---------------------------------------------------------------------------
// Main CommandPalette component
// ---------------------------------------------------------------------------

/**
 * Full-viewport overlay command palette.
 *
 * Rendered at AppLayout level so it sits above all page content. Visibility
 * is controlled by SearchContext. The input auto-focuses when the palette
 * opens. Arrow keys navigate the flat result list; Enter selects and navigates.
 * Clicking the backdrop or pressing Escape closes without navigating.
 */
export function CommandPalette() {
    const { isOpen, closePalette } = useSearchPalette();
    const navigate = useNavigate();
    const inputRef = useRef<HTMLInputElement>(null);
    const listRef = useRef<HTMLDivElement>(null);

    const [queryText, setQueryText] = useState('');
    const [highlightedIndex, setHighlightedIndex] = useState(0);

    const { resultGroups, isSearching, totalResults } = useSearch(queryText);
    const hasQuery = queryText.trim().length >= 2;
    const orderedKeys = sortedTypeKeys(resultGroups);
    const flatResults = hasQuery ? flattenResultsInOrder(resultGroups, orderedKeys) : [];

    // Reset state when the palette opens
    useEffect(() => {
        if (isOpen) {
            setQueryText('');
            setHighlightedIndex(0);
            // Defer focus slightly to let the CSS transition complete
            const focusTimer = setTimeout(() => inputRef.current?.focus(), 50);
            return () => clearTimeout(focusTimer);
        }
    }, [isOpen]);

    // Reset highlight when results change
    useEffect(() => {
        setHighlightedIndex(0);
    }, [totalResults]);

    const selectItem = useCallback(
        (item: BaseItemDto) => {
            if (item.Id) {
                navigate(`/details?id=${item.Id}`);
                closePalette();
            }
        },
        [navigate, closePalette]
    );

    const handleInputChange = useCallback(
        (event: React.ChangeEvent<HTMLInputElement>) => {
            setQueryText(event.target.value);
        },
        []
    );

    const handleKeyDown = useCallback(
        (event: React.KeyboardEvent<HTMLInputElement>) => {
            if (event.key === 'Escape') {
                closePalette();
                return;
            }

            if (event.key === 'ArrowDown') {
                event.preventDefault();
                setHighlightedIndex(prev =>
                    flatResults.length > 0 ? (prev + 1) % flatResults.length : 0
                );
                return;
            }

            if (event.key === 'ArrowUp') {
                event.preventDefault();
                setHighlightedIndex(prev =>
                    flatResults.length > 0 ?
                        (prev - 1 + flatResults.length) % flatResults.length :
                        0
                );
                return;
            }

            if (event.key === 'Enter') {
                event.preventDefault();
                const highlightedItem = flatResults[highlightedIndex];
                if (highlightedItem != null) {
                    selectItem(highlightedItem);
                } else if (queryText.trim().length > 0) {
                    // Fall through to full search page
                    navigate(`/search?q=${encodeURIComponent(queryText.trim())}`);
                    closePalette();
                }
            }
        },
        [flatResults, highlightedIndex, queryText, selectItem, navigate, closePalette]
    );

    const handleBackdropClick = useCallback(
        (event: React.MouseEvent<HTMLDivElement>) => {
            if (event.target === event.currentTarget) {
                closePalette();
            }
        },
        [closePalette]
    );

    const handleSeeAllClick = useCallback(() => {
        navigate(`/search?q=${encodeURIComponent(queryText.trim())}`);
        closePalette();
    }, [navigate, queryText, closePalette]);

    if (!isOpen) return null;

    return (
        {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions, jsx-a11y/click-events-have-key-events */}
        <div
            className='sb-command__backdrop'
            onClick={handleBackdropClick}
            onKeyDown={handleKeyDown}
            aria-modal='true'
            role='dialog'
            aria-label='Search'
        >
            <div className='sb-command__panel glass-panel' role='search'>
                {/* Input */}
                <div className='sb-command__input-row'>
                    <SearchIcon />
                    <input
                        ref={inputRef}
                        className='sb-command__input'
                        type='search'
                        value={queryText}
                        onChange={handleInputChange}
                        onKeyDown={handleKeyDown}
                        placeholder='Search anything…'
                        aria-label='Search command palette'
                        autoComplete='off'
                        spellCheck={false}
                    />
                    {isSearching && (
                        <span className='sb-command__spinner' aria-label='Searching' />
                    )}
                    <kbd className='sb-command__esc-hint' aria-label='Press Escape to close'>Esc</kbd>
                </div>

                {/* Results */}
                {hasQuery && (
                    <div
                        ref={listRef}
                        className='sb-command__results'
                        role='listbox'
                        aria-label='Search results'
                    >
                        {flatResults.length === 0 && !isSearching && (
                            <div className='sb-command__no-results'>
                                No results for &ldquo;{queryText}&rdquo;
                            </div>
                        )}

                        {flatResults.length > 0 && renderPaletteResultsWithHeaders(
                            resultGroups,
                            orderedKeys,
                            flatResults,
                            highlightedIndex,
                            selectItem
                        )}

                        {flatResults.length > 0 && totalResults > flatResults.length && (
                            <button
                                className='sb-command__see-all'
                                onClick={handleSeeAllClick}
                            >
                                See all {totalResults} results for &ldquo;{queryText}&rdquo;
                            </button>
                        )}
                    </div>
                )}

                {!hasQuery && (
                    <div className='sb-command__hint'>
                        Type at least 2 characters to search
                    </div>
                )}
            </div>
        </div>
    );
}

// ---------------------------------------------------------------------------
// Render helper — palette results with section headers interspersed
// ---------------------------------------------------------------------------

function renderPaletteResultsWithHeaders(
    resultGroups: Map<string, BaseItemDto[]>,
    orderedKeys: string[],
    _flatResults: BaseItemDto[],
    highlightedIndex: number,
    selectItem: (item: BaseItemDto) => void
): React.ReactNode[] {
    const nodes: React.ReactNode[] = [];
    let flatIndex = 0;

    for (const typeName of orderedKeys) {
        const group = resultGroups.get(typeName);
        if (group == null || group.length === 0) continue;

        const visibleItems = group.slice(0, MAX_ITEMS_PER_GROUP_IN_PALETTE);
        const sectionLabel = TYPE_DISPLAY_LABELS[typeName] ?? typeName;

        nodes.push(
            <PaletteSectionHeader key={`header-${typeName}`} label={sectionLabel} />
        );

        for (const item of visibleItems) {
            const currentFlatIndex = flatIndex;
            nodes.push(
                <PaletteResultRow
                    key={item.Id ?? currentFlatIndex}
                    item={item}
                    isHighlighted={currentFlatIndex === highlightedIndex}
                    onSelect={selectItem}
                />
            );
            flatIndex++;
        }
    }

    return nodes;
}

// ---------------------------------------------------------------------------
// Icons
// ---------------------------------------------------------------------------

function SearchIcon() {
    return (
        <svg
            className='sb-command__search-icon'
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
