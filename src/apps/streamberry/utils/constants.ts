// Timing constants — milliseconds unless the suffix says otherwise

export const HERO_CYCLE_INTERVAL_MS = 8000;
export const HERO_CROSSFADE_DURATION_MS = 700;
export const CARD_MORPH_DURATION_MS = 500;
export const AMBIENT_CROSSFADE_DURATION_MS = 800;
export const TAB_TRANSITION_DURATION_MS = 250;
export const CARD_STAGGER_DELAY_MS = 40;
export const MAX_STAGGER_CARDS = 20;
export const OSD_HIDE_DELAY_MS = 3000;
export const OSD_HIDE_DELAY_TV_MS = 5000;
export const AUTO_NEXT_THRESHOLD_S = 15;
export const SCENE_DEBOUNCE_MS = 200;
export const PALETTE_CACHE_MAX = 30;
export const DATA_CACHE_DURATION_MS = 300000; // 5 minutes

// Distance and physics constants — pixels unless otherwise noted

export const AURA_ACTIVATION_DISTANCE_PX = 80;
export const AURA_MAX_DISPLACEMENT_PX = 4;
export const AURA_GLOW_OPACITY_MAX = 0.08;
export const AURA_FRICTION = 0.92;

// Color governance thresholds — matches the oklch util governance gates

export const AMBIENT_LUMINANCE_MIN = 0.08;
export const AMBIENT_LUMINANCE_MAX = 0.35;
export const AMBIENT_CHROMA_MAX = 0.12;
export const ACCENT_LUMINANCE_MIN = 0.40;
export const ACCENT_LUMINANCE_MAX = 0.75;
export const ACCENT_CHROMA_MAX = 0.15;
export const ANTI_MUD_THRESHOLD_DEG = 30;
export const ANTI_MUD_ROTATION_DEG = 60;

// Color quantization parameters — median cut canvas pipeline

export const QUANTIZE_CANVAS_SIZE = 64;
export const QUANTIZE_SKIP_DARK = 25;
export const QUANTIZE_SKIP_LIGHT = 230;

// Minimum bucket population for a quantized color to be considered significant
export const QUANTIZE_MIN_BUCKET_POPULATION = 3;

// Minimum chroma to treat a color as chromatic rather than grayscale
export const GRAYSCALE_CHROMA_THRESHOLD = 0.02;

// WCAG contrast ratio targets
export const WCAG_AA_BODY_CONTRAST_RATIO = 4.5;
export const WCAG_AA_LARGE_TEXT_CONTRAST_RATIO = 3.0;

// Lightness step size used when iterating toward a contrast target
export const CONTRAST_ADJUSTMENT_STEP = 0.03;
export const CONTRAST_ADJUSTMENT_MAX_STEPS = 20;

// Warm charcoal fallback when artwork is grayscale or extraction fails
export const SEMANTIC_FALLBACK_LIGHTNESS = 0.12;
export const SEMANTIC_FALLBACK_CHROMA = 0.02;
export const SEMANTIC_FALLBACK_HUE = 45;
