/**
 * Median cut color quantization on a downscaled canvas.
 *
 * Extracts the N most dominant colors from an image URL.
 * Draws to a 64×64 offscreen canvas, runs median cut on the pixel data,
 * and returns RGB objects ordered by dominance. Target: <50ms per image.
 */

import {
    QUANTIZE_CANVAS_SIZE,
    QUANTIZE_MIN_BUCKET_POPULATION,
    QUANTIZE_SKIP_DARK,
    QUANTIZE_SKIP_LIGHT
} from './constants';

export interface QuantizedColor {
    r: number;
    g: number;
    b: number;
    population: number;
}

// A pixel is [R, G, B] — three-element tuple
type PixelTriplet = [number, number, number];

// Channel index: 0 = red, 1 = green, 2 = blue
type ColorChannel = 0 | 1 | 2;

const DEFAULT_PALETTE_SIZE = 5;

// -- Image loading ------------------------------------------------------------

/**
 * Loads an image from a URL and returns its pixel data downscaled to
 * QUANTIZE_CANVAS_SIZE × QUANTIZE_CANVAS_SIZE. Uses OffscreenCanvas when
 * available for off-main-thread performance.
 */
function loadDownscaledPixelData(imageUrl: string): Promise<ImageData> {
    return new Promise((resolve, reject) => {
        const image = new Image();
        image.crossOrigin = 'anonymous';

        image.onload = () => {
            let canvas: HTMLCanvasElement | OffscreenCanvas;
            let context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

            if (typeof OffscreenCanvas !== 'undefined') {
                canvas = new OffscreenCanvas(QUANTIZE_CANVAS_SIZE, QUANTIZE_CANVAS_SIZE);
                context = canvas.getContext('2d', { willReadFrequently: true }) as OffscreenCanvasRenderingContext2D;
            } else {
                const htmlCanvas = document.createElement('canvas');
                htmlCanvas.width = QUANTIZE_CANVAS_SIZE;
                htmlCanvas.height = QUANTIZE_CANVAS_SIZE;
                canvas = htmlCanvas;
                context = htmlCanvas.getContext('2d', { willReadFrequently: true }) as CanvasRenderingContext2D;
            }

            context.drawImage(image, 0, 0, QUANTIZE_CANVAS_SIZE, QUANTIZE_CANVAS_SIZE);
            resolve(context.getImageData(0, 0, QUANTIZE_CANVAS_SIZE, QUANTIZE_CANVAS_SIZE));
        };

        image.onerror = () => reject(new Error(`Failed to load image for quantization: ${imageUrl}`));
        image.src = imageUrl;
    });
}

// -- Pixel filtering ----------------------------------------------------------

/**
 * Extracts significant pixels from ImageData, discarding near-black, near-white,
 * and transparent pixels. These add noise rather than character to the palette.
 */
function extractSignificantPixels(imageData: ImageData): PixelTriplet[] {
    const rawBytes = imageData.data;
    const significantPixels: PixelTriplet[] = [];
    const totalPixelCount = rawBytes.length / 4;

    for (let pixelIndex = 0; pixelIndex < totalPixelCount; pixelIndex++) {
        const byteOffset = pixelIndex * 4;
        const red = rawBytes[byteOffset];
        const green = rawBytes[byteOffset + 1];
        const blue = rawBytes[byteOffset + 2];
        const alpha = rawBytes[byteOffset + 3];

        // Transparent pixels carry no color information
        if (alpha < 128) continue;

        // Near-black and near-white are filtered by their range across channels
        const maxChannel = Math.max(red, green, blue);
        const minChannel = Math.min(red, green, blue);
        if (maxChannel < QUANTIZE_SKIP_DARK) continue;
        if (minChannel > QUANTIZE_SKIP_LIGHT) continue;

        significantPixels.push([red, green, blue]);
    }

    return significantPixels;
}

// -- Median cut ---------------------------------------------------------------

/**
 * Identifies which color channel has the widest value range in a pixel set.
 * The widest-range channel is the best axis to split on.
 */
function findWidestChannel(pixels: PixelTriplet[]): ColorChannel {
    let redMin = 255, redMax = 0;
    let greenMin = 255, greenMax = 0;
    let blueMin = 255, blueMax = 0;

    for (const pixel of pixels) {
        if (pixel[0] < redMin) redMin = pixel[0];
        if (pixel[0] > redMax) redMax = pixel[0];
        if (pixel[1] < greenMin) greenMin = pixel[1];
        if (pixel[1] > greenMax) greenMax = pixel[1];
        if (pixel[2] < blueMin) blueMin = pixel[2];
        if (pixel[2] > blueMax) blueMax = pixel[2];
    }

    const redRange = redMax - redMin;
    const greenRange = greenMax - greenMin;
    const blueRange = blueMax - blueMin;

    if (redRange >= greenRange && redRange >= blueRange) return 0;
    if (greenRange >= redRange && greenRange >= blueRange) return 1;
    return 2;
}

/**
 * Computes the average RGB color for a set of pixels.
 */
function computeBucketAverage(pixels: PixelTriplet[]): QuantizedColor {
    if (pixels.length === 0) {
        return { r: 0, g: 0, b: 0, population: 0 };
    }

    let redSum = 0, greenSum = 0, blueSum = 0;
    for (const pixel of pixels) {
        redSum += pixel[0];
        greenSum += pixel[1];
        blueSum += pixel[2];
    }

    const populationCount = pixels.length;
    return {
        r: Math.round(redSum / populationCount),
        g: Math.round(greenSum / populationCount),
        b: Math.round(blueSum / populationCount),
        population: populationCount
    };
}

/**
 * Recursively splits pixel buckets along the widest color channel until
 * the target bucket count is reached.
 *
 * Returns colors ordered by population (most dominant first), filtered
 * to remove statistically insignificant clusters.
 */
function medianCutQuantize(pixels: PixelTriplet[], targetBucketCount: number): QuantizedColor[] {
    if (pixels.length === 0) return [];

    const buckets: PixelTriplet[][] = [pixels];

    while (buckets.length < targetBucketCount) {
        // Always split the largest bucket — it contains the most color variance
        let largestBucketIndex = 0;
        let largestBucketSize = 0;

        for (let bucketIndex = 0; bucketIndex < buckets.length; bucketIndex++) {
            if (buckets[bucketIndex].length > largestBucketSize) {
                largestBucketSize = buckets[bucketIndex].length;
                largestBucketIndex = bucketIndex;
            }
        }

        const bucketToSplit = buckets[largestBucketIndex];
        if (bucketToSplit.length <= 1) break;

        const splitChannel = findWidestChannel(bucketToSplit);
        bucketToSplit.sort((pixelA, pixelB) => pixelA[splitChannel] - pixelB[splitChannel]);

        const medianIndex = Math.floor(bucketToSplit.length / 2);
        const lowerHalf = bucketToSplit.slice(0, medianIndex);
        const upperHalf = bucketToSplit.slice(medianIndex);

        buckets.splice(largestBucketIndex, 1, lowerHalf, upperHalf);
    }

    return buckets
        .map(computeBucketAverage)
        .filter(color => color.population >= QUANTIZE_MIN_BUCKET_POPULATION)
        .sort((colorA, colorB) => colorB.population - colorA.population);
}

// -- Public API ---------------------------------------------------------------

/**
 * Extracts the dominant color palette from an image URL using median cut
 * quantization on a downscaled canvas.
 *
 * Colors are returned ordered by dominance (most representative first).
 * Near-black and near-white pixels are excluded.
 *
 * @param imageUrl - URL to the image (must allow CORS access for cross-origin images)
 * @param count - Number of dominant colors to extract (defaults to 5)
 */
export async function extractDominantColors(
    imageUrl: string,
    count: number = DEFAULT_PALETTE_SIZE
): Promise<Array<{ r: number; g: number; b: number }>> {
    const imageData = await loadDownscaledPixelData(imageUrl);
    const significantPixels = extractSignificantPixels(imageData);

    if (significantPixels.length === 0) {
        return [];
    }

    return medianCutQuantize(significantPixels, count).map(({ r, g, b }) => ({ r, g, b }));
}
