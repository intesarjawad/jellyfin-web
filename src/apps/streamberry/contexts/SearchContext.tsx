import React, {
    createContext,
    useCallback,
    useContext,
    useState,
    type ReactNode
} from 'react';

interface SearchPaletteContextValue {
    isOpen: boolean;
    openPalette: () => void;
    closePalette: () => void;
    togglePalette: () => void;
}

const SearchPaletteContext = createContext<SearchPaletteContextValue | null>(null);

interface SearchProviderProps {
    children: ReactNode;
}

export function SearchProvider({ children }: SearchProviderProps): JSX.Element {
    const [isOpen, setIsOpen] = useState(false);

    const openPalette = useCallback(() => setIsOpen(true), []);
    const closePalette = useCallback(() => setIsOpen(false), []);
    const togglePalette = useCallback(() => setIsOpen(prev => !prev), []);

    return (
        <SearchPaletteContext.Provider value={{ isOpen, openPalette, closePalette, togglePalette }}>
            {children}
        </SearchPaletteContext.Provider>
    );
}

/**
 * Returns controls for the command palette overlay.
 * Must be used inside SearchProvider.
 */
export function useSearchPalette(): SearchPaletteContextValue {
    const ctx = useContext(SearchPaletteContext);
    if (ctx === null) {
        throw new Error('useSearchPalette must be used within SearchProvider');
    }
    return ctx;
}
