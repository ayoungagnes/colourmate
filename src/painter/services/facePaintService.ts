import { mixPaints } from "../../colour/services/paintMixService";
import { RGB } from "../../colour/ui/types";

export const BASE_COLOUR: RGB = { r: 245, g: 245, b: 245 };
const COAT_STRENGTH = 0.3;

/**
 * Applies a single coat of paint over a current colour using Mixbox pigment blending.
 * Each coat blends 30% of the new paint into the current colour, producing
 * realistic layered painting where ~6-7 coats approach full saturation.
 * @param currentRgb - The current surface colour (each channel 0-255)
 * @param paintRgb - The paint colour being applied (each channel 0-255)
 * @returns The resulting blended colour after one coat
 */
export function applyCoat(currentRgb: RGB, paintRgb: RGB): RGB {
    return mixPaints(currentRgb, paintRgb, 1 - COAT_STRENGTH);
}

export interface FaceEntry {
    r: number;
    g: number;
    b: number;
    coatCount: number;
}

/**
 * Applies one coat of paint to multiple faces, creating new entries for
 * unpainted faces starting from the base colour (light grey).
 * @param facePaints - Map of face index to current paint state
 * @param faceIndices - Array of face indices to paint
 * @param paintRgb - The paint colour to apply
 * @returns Map of updated face entries (only those that changed)
 */
export function applyCoatToFaces(
    facePaints: Map<number, FaceEntry>,
    faceIndices: number[],
    paintRgb: RGB,
): Map<number, FaceEntry> {
    const updated = new Map<number, FaceEntry>();

    for (const idx of faceIndices) {
        const existing = facePaints.get(idx);
        const current: RGB = existing
            ? { r: existing.r, g: existing.g, b: existing.b }
            : BASE_COLOUR;
        const currentCoatCount = existing?.coatCount ?? 0;

        const blended = applyCoat(current, paintRgb);
        const entry: FaceEntry = {
            r: blended.r,
            g: blended.g,
            b: blended.b,
            coatCount: currentCoatCount + 1,
        };

        facePaints.set(idx, entry);
        updated.set(idx, entry);
    }

    return updated;
}
