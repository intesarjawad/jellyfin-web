import React, { useCallback, useId } from 'react';

import { ItemSortBy } from '@jellyfin/sdk/lib/generated-client/models/item-sort-by';
import { SortOrder } from '@jellyfin/sdk/lib/generated-client/models/sort-order';

export type LibraryViewType = 'grid' | 'list';

export interface FilterBarProps {
    sortBy: ItemSortBy;
    sortOrder: SortOrder;
    onSortChange: (sortBy: ItemSortBy, sortOrder: SortOrder) => void;
    viewType?: LibraryViewType;
    onViewTypeChange?: (viewType: LibraryViewType) => void;
}

interface SortOption {
    label: string;
    value: ItemSortBy;
}

/**
 * Sort options exposed in the Streamberry library filter bar.
 *
 * These map directly to Jellyfin's ItemSortBy enum. The order here is the
 * order they appear in the dropdown — most commonly used first.
 */
const SORT_OPTIONS: SortOption[] = [
    { label: 'Name',         value: ItemSortBy.SortName },
    { label: 'Date Added',   value: ItemSortBy.DateCreated },
    { label: 'Release Date', value: ItemSortBy.PremiereDate },
    { label: 'Rating',       value: ItemSortBy.CommunityRating },
    { label: 'Runtime',      value: ItemSortBy.Runtime }
];

/**
 * Glass-styled sort/filter toolbar rendered above a library grid.
 *
 * Exposes sort field selection, ascending/descending toggle, and a
 * grid vs. list view toggle. All state changes are lifted out via
 * callbacks so the parent page owns the source of truth (and can
 * persist it in URL search params).
 *
 * Sort direction cycles on the same button so the interaction is
 * a single click regardless of current order — familiar from most
 * streaming UIs and file browsers.
 */
export function FilterBar({
    sortBy,
    sortOrder,
    onSortChange,
    viewType = 'grid',
    onViewTypeChange
}: FilterBarProps) {
    const sortSelectId = useId();

    const handleSortFieldChange = useCallback(
        (event: React.ChangeEvent<HTMLSelectElement>) => {
            const selectedSortBy = event.target.value as ItemSortBy;
            onSortChange(selectedSortBy, sortOrder);
        },
        [onSortChange, sortOrder]
    );

    const handleSortDirectionToggle = useCallback(() => {
        const nextSortOrder =
            sortOrder === SortOrder.Ascending ? SortOrder.Descending : SortOrder.Ascending;
        onSortChange(sortBy, nextSortOrder);
    }, [onSortChange, sortBy, sortOrder]);

    const handleGridViewSelect = useCallback(() => {
        onViewTypeChange?.('grid');
    }, [onViewTypeChange]);

    const handleListViewSelect = useCallback(() => {
        onViewTypeChange?.('list');
    }, [onViewTypeChange]);

    const isAscending = sortOrder === SortOrder.Ascending;

    return (
        <div className='sb-filter-bar glass-interactive' role='toolbar' aria-label='Library filters'>
            <div className='sb-filter-bar__sort-group'>
                <label className='sb-filter-bar__sort-label' htmlFor={sortSelectId}>
                    Sort
                </label>

                <select
                    id={sortSelectId}
                    className='sb-filter-bar__sort-select'
                    value={sortBy}
                    onChange={handleSortFieldChange}
                    aria-label='Sort by'
                >
                    {SORT_OPTIONS.map(option => (
                        <option key={option.value} value={option.value}>
                            {option.label}
                        </option>
                    ))}
                </select>

                <button
                    type='button'
                    className='sb-filter-bar__direction-btn'
                    onClick={handleSortDirectionToggle}
                    aria-label={isAscending ? 'Sort ascending — click to reverse' : 'Sort descending — click to reverse'}
                    aria-pressed={!isAscending}
                >
                    <SortDirectionIcon isAscending={isAscending} />
                </button>
            </div>

            {onViewTypeChange != null && (
                <div className='sb-filter-bar__view-group' role='group' aria-label='View type'>
                    <button
                        type='button'
                        className={`sb-filter-bar__view-btn${viewType === 'grid' ? ' sb-filter-bar__view-btn--active' : ''}`}
                        onClick={handleGridViewSelect}
                        aria-pressed={viewType === 'grid'}
                        aria-label='Grid view'
                    >
                        <GridIcon />
                    </button>
                    <button
                        type='button'
                        className={`sb-filter-bar__view-btn${viewType === 'list' ? ' sb-filter-bar__view-btn--active' : ''}`}
                        onClick={handleListViewSelect}
                        aria-pressed={viewType === 'list'}
                        aria-label='List view'
                    >
                        <ListIcon />
                    </button>
                </div>
            )}
        </div>
    );
}

// ---------------------------------------------------------------------------
// Icon sub-components — inline SVG, no external dependency needed
// ---------------------------------------------------------------------------

function SortDirectionIcon({ isAscending }: { isAscending: boolean }) {
    return (
        <svg
            viewBox='0 0 16 16'
            width='14'
            height='14'
            fill='currentColor'
            aria-hidden='true'
            style={{ transform: isAscending ? 'none' : 'scaleY(-1)' }}
        >
            <path d='M3 10.5L8 4.5L13 10.5H3Z' />
        </svg>
    );
}

function GridIcon() {
    return (
        <svg viewBox='0 0 16 16' width='14' height='14' fill='currentColor' aria-hidden='true'>
            <rect x='1' y='1' width='6' height='6' rx='1' />
            <rect x='9' y='1' width='6' height='6' rx='1' />
            <rect x='1' y='9' width='6' height='6' rx='1' />
            <rect x='9' y='9' width='6' height='6' rx='1' />
        </svg>
    );
}

function ListIcon() {
    return (
        <svg viewBox='0 0 16 16' width='14' height='14' fill='currentColor' aria-hidden='true'>
            <rect x='1' y='2' width='14' height='2' rx='1' />
            <rect x='1' y='7' width='14' height='2' rx='1' />
            <rect x='1' y='12' width='14' height='2' rx='1' />
        </svg>
    );
}
