import React, {
    createContext,
    useContext,
    useEffect,
    useState,
    type ReactNode
} from 'react';

import { useApi } from 'hooks/useApi';

export interface BrandConfig {
    name: string;
    tagline: string;
    logoUrl: string;
    accentHue: number;
    classPrefix: string;
}

interface BrandContextValue {
    name: string;
    tagline: string;
    logoUrl: string;
    accentHue: number;
    classPrefix: string;
}

const BRAND_CONFIG_URL = 'assets/brand.json';

const DEFAULT_BRAND_CONFIG: BrandContextValue = {
    name: 'Streamberry',
    tagline: 'Your cinema, reimagined',
    logoUrl: '/branding/logo.png',
    accentHue: 45,
    classPrefix: 'sb'
};

// Module-level cache so we only fetch once per page load
let cachedBrandConfig: BrandContextValue | null = null;

const BrandContext = createContext<BrandContextValue>(DEFAULT_BRAND_CONFIG);

async function fetchBrandConfig(): Promise<BrandContextValue> {
    if (cachedBrandConfig !== null) {
        return cachedBrandConfig;
    }

    const response = await fetch(BRAND_CONFIG_URL);
    if (!response.ok) {
        throw new Error(`Failed to fetch brand config: ${response.status}`);
    }

    const rawConfig = await response.json() as BrandConfig;
    cachedBrandConfig = rawConfig;
    return rawConfig;
}

interface BrandProviderProps {
    children: ReactNode;
}

export function BrandProvider({ children }: Readonly<BrandProviderProps>) {
    const [brandConfig, setBrandConfig] = useState<BrandContextValue>(DEFAULT_BRAND_CONFIG);
    const { user } = useApi();

    // Resolve the server name from the existing API context. The Jellyfin API
    // exposes server info via the user session — we use the server name as a
    // fallback display name when the brand config fetch fails.
    const serverName = user?.Name ?? null;

    useEffect(() => {
        let isCancelled = false;

        fetchBrandConfig()
            .then(config => {
                if (!isCancelled) {
                    setBrandConfig(config);
                }
            })
            .catch(() => {
                if (!isCancelled && serverName) {
                    // Fall back to server name while keeping other defaults
                    setBrandConfig(prev => ({ ...prev, name: serverName }));
                }
            });

        return () => {
            isCancelled = true;
        };
    }, [serverName]);

    // Set the brand prefix attribute on the root element so CSS selectors
    // using [data-brand-prefix] can target the active theme.
    useEffect(() => {
        document.documentElement.dataset.brandPrefix = brandConfig.classPrefix;
    }, [brandConfig.classPrefix]);

    return (
        <BrandContext.Provider value={brandConfig}>
            {children}
        </BrandContext.Provider>
    );
}

/**
 * Returns the active brand configuration. Must be used inside a BrandProvider.
 */
export function useBrand(): BrandContextValue {
    return useContext(BrandContext);
}
