import { RGB, Spectrum } from '../ui/types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const WAVELENGTH_COUNT = 10;

// Smits (1999) basis spectra sampled at 10 wavelengths (380–720 nm, 40 nm spacing).
// Each array has WAVELENGTH_COUNT entries representing reflectance [0,1].
const BASIS_WHITE: Spectrum = [
  1.0000, 1.0000, 0.9999, 0.9993, 0.9992, 0.9998, 1.0000, 1.0000, 1.0000, 1.0000,
];
const BASIS_CYAN: Spectrum = [
  0.9710, 0.9426, 1.0007, 1.0007, 1.0007, 1.0007, 0.1564, 0.0000, 0.0000, 0.0000,
];
const BASIS_MAGENTA: Spectrum = [
  1.0000, 1.0000, 0.9685, 0.2229, 0.0000, 0.0458, 0.8369, 1.0000, 1.0000, 0.9959,
];
const BASIS_YELLOW: Spectrum = [
  0.0001, 0.0000, 0.1088, 0.6651, 1.0000, 1.0000, 0.9996, 0.9586, 0.9685, 0.9840,
];
const BASIS_RED: Spectrum = [
  0.1012, 0.0515, 0.0000, 0.0000, 0.0000, 0.0000, 0.8325, 1.0149, 1.0149, 1.0149,
];
const BASIS_GREEN: Spectrum = [
  0.0000, 0.0000, 0.0273, 0.7937, 1.0000, 0.9418, 0.1719, 0.0000, 0.0000, 0.0025,
];
const BASIS_BLUE: Spectrum = [
  1.0000, 1.0000, 0.8916, 0.3323, 0.0000, 0.0000, 0.0003, 0.0369, 0.0483, 0.0496,
];

// CIE 1931 2-degree observer colour matching functions at 10 wavelengths
// (380, 420, 460, 500, 540, 580, 620, 660, 700, 720 nm)
const CIE_X: Spectrum = [
  0.0014, 0.0434, 0.2908, 0.0049, 0.2904, 0.9163, 0.8544, 0.1649, 0.0114, 0.0029,
];
const CIE_Y: Spectrum = [
  0.0000, 0.0120, 0.0600, 0.3230, 0.9540, 0.8700, 0.3810, 0.0610, 0.0041, 0.0010,
];
const CIE_Z: Spectrum = [
  0.0065, 0.2074, 1.5189, 0.2720, 0.0045, 0.0017, 0.0002, 0.0000, 0.0000, 0.0000,
];

// D65 illuminant at the same 10 wavelengths (relative spectral power)
const D65: Spectrum = [
  49.98, 101.40, 108.81, 109.35, 104.05, 104.59, 90.01, 68.45, 61.60, 58.73,
];

// sRGB to XYZ matrix (D65)
const SRGB_TO_XYZ = [
  [0.4124564, 0.3575761, 0.1804375],
  [0.2126729, 0.7151522, 0.0721750],
  [0.0193339, 0.1191920, 0.9503041],
];

// XYZ to linear sRGB matrix (D65)
const XYZ_TO_SRGB = [
  [ 3.2404542, -1.5371385, -0.4985314],
  [-0.9692660,  1.8760108,  0.0415560],
  [ 0.0556434, -0.2040259,  1.0572252],
];

// ---------------------------------------------------------------------------
// sRGB linearisation / de-linearisation
// ---------------------------------------------------------------------------

/**
 * Converts an 8-bit sRGB channel value to linear-light [0,1].
 * @param v - 8-bit channel value (0–255)
 * @returns Linear-light value in [0,1]
 */
function linearizeChannel(v: number): number {
  const c = v / 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

/**
 * Converts a linear-light value [0,1] to an 8-bit sRGB channel value.
 * @param v - Linear-light value
 * @returns 8-bit sRGB value (0–255), clamped and rounded
 */
function delinearizeChannel(v: number): number {
  const c = v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055;
  return Math.max(0, Math.min(255, Math.round(c * 255)));
}

// ---------------------------------------------------------------------------
// Spectral conversion
// ---------------------------------------------------------------------------

/**
 * Converts an sRGB colour to a 10-band reflectance spectrum using the Smits
 * (1999) method. The RGB is first linearised, then decomposed into weighted
 * basis spectra (white, cyan, magenta, yellow, red, green, blue).
 * @param rgb - sRGB colour with channels 0–255
 * @returns 10-element reflectance spectrum, values nominally in [0,1]
 */
export function rgbToSpectrum(rgb: RGB): Spectrum {
  let r = linearizeChannel(rgb.r);
  let g = linearizeChannel(rgb.g);
  let b = linearizeChannel(rgb.b);

  const spectrum = new Array<number>(WAVELENGTH_COUNT).fill(0);

  // Smits decomposition: peel off white, then complementary, then primary
  if (r <= g && r <= b) {
    // Red is the smallest component
    addScaled(spectrum, r, BASIS_WHITE);
    g -= r;
    b -= r;
    if (g <= b) {
      addScaled(spectrum, g, BASIS_CYAN);
      addScaled(spectrum, b - g, BASIS_BLUE);
    } else {
      addScaled(spectrum, b, BASIS_CYAN);
      addScaled(spectrum, g - b, BASIS_GREEN);
    }
  } else if (g <= r && g <= b) {
    // Green is the smallest component
    addScaled(spectrum, g, BASIS_WHITE);
    r -= g;
    b -= g;
    if (r <= b) {
      addScaled(spectrum, r, BASIS_MAGENTA);
      addScaled(spectrum, b - r, BASIS_BLUE);
    } else {
      addScaled(spectrum, b, BASIS_MAGENTA);
      addScaled(spectrum, r - b, BASIS_RED);
    }
  } else {
    // Blue is the smallest component
    addScaled(spectrum, b, BASIS_WHITE);
    r -= b;
    g -= b;
    if (r <= g) {
      addScaled(spectrum, r, BASIS_YELLOW);
      addScaled(spectrum, g - r, BASIS_GREEN);
    } else {
      addScaled(spectrum, g, BASIS_YELLOW);
      addScaled(spectrum, r - g, BASIS_RED);
    }
  }

  return spectrum;
}

/**
 * Converts a 10-band reflectance spectrum back to sRGB by integrating against
 * the CIE 1931 observer functions under D65 illumination, then transforming
 * from XYZ to linear sRGB and applying gamma.
 * @param spectrum - 10-element reflectance array
 * @returns sRGB colour with channels 0–255
 */
export function spectrumToRgb(spectrum: Spectrum): RGB {
  // Integrate spectrum × D65 × CMFs → XYZ
  let X = 0;
  let Y = 0;
  let Z = 0;
  let normFactor = 0;
  for (let i = 0; i < WAVELENGTH_COUNT; i++) {
    const s = spectrum[i] * D65[i];
    X += s * CIE_X[i];
    Y += s * CIE_Y[i];
    Z += s * CIE_Z[i];
    normFactor += D65[i] * CIE_Y[i];
  }
  // Normalise so that a perfectly white spectrum maps to Y = 1
  X /= normFactor;
  Y /= normFactor;
  Z /= normFactor;

  // XYZ → linear sRGB
  const lr = XYZ_TO_SRGB[0][0] * X + XYZ_TO_SRGB[0][1] * Y + XYZ_TO_SRGB[0][2] * Z;
  const lg = XYZ_TO_SRGB[1][0] * X + XYZ_TO_SRGB[1][1] * Y + XYZ_TO_SRGB[1][2] * Z;
  const lb = XYZ_TO_SRGB[2][0] * X + XYZ_TO_SRGB[2][1] * Y + XYZ_TO_SRGB[2][2] * Z;

  return {
    r: delinearizeChannel(Math.max(0, lr)),
    g: delinearizeChannel(Math.max(0, lg)),
    b: delinearizeChannel(Math.max(0, lb)),
  };
}

// ---------------------------------------------------------------------------
// Kubelka-Munk N-paint mixing
// ---------------------------------------------------------------------------

export interface PaintInput {
  rgb: RGB;
  opacity?: number; // 0.0–1.0, defaults to 1.0 (scattering factor)
}

/**
 * Mixes N paints using two-constant Kubelka-Munk theory in the spectral
 * domain. Each paint's RGB is up-sampled to a 10-band reflectance spectrum,
 * then absorption (K) and scattering (S) are computed per band. K and S are
 * mixed linearly by concentration, and the mixed reflectance is reconstructed
 * per band before converting back to sRGB.
 *
 * @param paints - Array of paint inputs (RGB + optional opacity)
 * @param concentrations - Array of concentration weights (should sum to 1.0)
 * @returns Mixed sRGB colour
 * @throws Error if paints and concentrations arrays differ in length
 */
export function mixPaints(paints: PaintInput[], concentrations: number[]): RGB {
  if (paints.length !== concentrations.length) {
    throw new Error('paints and concentrations must have the same length');
  }
  if (paints.length === 0) {
    return { r: 0, g: 0, b: 0 };
  }
  if (paints.length === 1) {
    return { ...paints[0].rgb };
  }

  // Up-sample each paint to spectrum
  const spectra = paints.map((p) => rgbToSpectrum(p.rgb));
  const opacities = paints.map((p) => p.opacity ?? 1.0);

  const mixedSpectrum = new Array<number>(WAVELENGTH_COUNT);

  for (let band = 0; band < WAVELENGTH_COUNT; band++) {
    let kMix = 0;
    let sMix = 0;

    for (let i = 0; i < paints.length; i++) {
      const R = Math.max(spectra[i][band], 1e-6);
      const S = Math.max(opacities[i], 1e-6);
      const K = S * ((1 - R) * (1 - R)) / (2 * R);

      kMix += concentrations[i] * K;
      sMix += concentrations[i] * S;
    }

    // Reconstruct reflectance from mixed K/S
    const ks = kMix / Math.max(sMix, 1e-10);
    const rMix = 1 + ks - Math.sqrt(ks * ks + 2 * ks);
    mixedSpectrum[band] = Math.max(0, Math.min(1, rMix));
  }

  return spectrumToRgb(mixedSpectrum);
}

/**
 * Convenience wrapper for mixing two paints at a given ratio, providing
 * backward compatibility with the original two-paint API.
 * @param a - First paint RGB
 * @param b - Second paint RGB
 * @param ratioA - Proportion of paint A (0.0 to 1.0)
 * @returns Mixed sRGB colour
 */
export function mixTwoPaints(a: RGB, b: RGB, ratioA: number): RGB {
  return mixPaints(
    [{ rgb: a }, { rgb: b }],
    [ratioA, 1 - ratioA],
  );
}

// ---------------------------------------------------------------------------
// Perceptual distance
// ---------------------------------------------------------------------------

/**
 * Computes Euclidean distance between two XYZ coordinates. Used for
 * perceptual distance evaluation in the Munsell-like coordinate space.
 * @param a - First XYZ coordinate
 * @param b - Second XYZ coordinate
 * @returns Euclidean distance
 */
export function munsellXYZDistance(
  a: { x: number; y: number; z: number },
  b: { x: number; y: number; z: number },
): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

// ---------------------------------------------------------------------------
// Best-mix search (pairs + triplets)
// ---------------------------------------------------------------------------

export interface MixSuggestion {
  paintIds: string[];
  concentrations: number[];
  distance: number;
}

/**
 * Searches all pairs and triplets from the given paint palette to find the
 * combination whose mixed colour is perceptually closest to the goal XYZ.
 *
 * Pairs: coarse pass at 9 ratio steps (0.1–0.9), refine best 3 at ±0.05.
 * Triplets: concentration combos summing to 1.0 in 0.2 steps, refine best.
 *
 * @param paints - Available paints with precomputed XYZ coordinates
 * @param goalCoordinate - Target colour's Munsell XYZ coordinate
 * @param xyzOf - Callback to compute XYZ for a given mixed RGB
 * @returns Best MixSuggestion, or null if fewer than 2 paints provided
 */
export function findBestMix(
  paints: Array<{ id: string; rgb: RGB }>,
  goalCoordinate: { x: number; y: number; z: number },
  xyzOf: (rgb: RGB) => { x: number; y: number; z: number },
): MixSuggestion | null {
  if (paints.length < 2) return null;

  let best: MixSuggestion | null = null;

  const tryCandidate = (paintIds: string[], concentrations: number[], mixed: RGB) => {
    const d = munsellXYZDistance(xyzOf(mixed), goalCoordinate);
    if (!best || d < best.distance) {
      best = { paintIds, concentrations, distance: d };
    }
  };

  // --- Pairs: coarse scan ---
  const coarseRatios = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9];
  const pairCandidates: Array<{ i: number; j: number; ratio: number; distance: number }> = [];

  for (let i = 0; i < paints.length; i++) {
    for (let j = i + 1; j < paints.length; j++) {
      for (const ratio of coarseRatios) {
        const mixed = mixTwoPaints(paints[i].rgb, paints[j].rgb, ratio);
        const d = munsellXYZDistance(xyzOf(mixed), goalCoordinate);
        pairCandidates.push({ i, j, ratio, distance: d });
        if (!best || d < best.distance) {
          best = {
            paintIds: [paints[i].id, paints[j].id],
            concentrations: [ratio, 1 - ratio],
            distance: d,
          };
        }
      }
    }
  }

  // Refine top 3 pairs at ±0.05
  pairCandidates.sort((a, b) => a.distance - b.distance);
  const topPairs = pairCandidates.slice(0, 3);
  for (const { i, j, ratio } of topPairs) {
    for (const delta of [-0.05, 0.05]) {
      const r = ratio + delta;
      if (r < 0.01 || r > 0.99) continue;
      const mixed = mixTwoPaints(paints[i].rgb, paints[j].rgb, r);
      tryCandidate(
        [paints[i].id, paints[j].id],
        [r, 1 - r],
        mixed,
      );
    }
  }

  // --- Triplets: coarse scan at 0.2 steps ---
  if (paints.length >= 3) {
    const tripletCandidates: Array<{
      i: number; j: number; k: number;
      conc: number[];
      distance: number;
    }> = [];

    for (let i = 0; i < paints.length; i++) {
      for (let j = i + 1; j < paints.length; j++) {
        for (let k = j + 1; k < paints.length; k++) {
          // Generate concentration combos summing to 1.0 in 0.2 steps
          for (let a = 0.2; a <= 0.8; a += 0.2) {
            for (let b = 0.2; b <= 1.0 - a; b += 0.2) {
              const c = 1.0 - a - b;
              if (c < 0.05) continue;
              const conc = [
                parseFloat(a.toFixed(2)),
                parseFloat(b.toFixed(2)),
                parseFloat(c.toFixed(2)),
              ];
              const inputs: PaintInput[] = [
                { rgb: paints[i].rgb },
                { rgb: paints[j].rgb },
                { rgb: paints[k].rgb },
              ];
              const mixed = mixPaints(inputs, conc);
              const d = munsellXYZDistance(xyzOf(mixed), goalCoordinate);
              tripletCandidates.push({ i, j, k, conc, distance: d });
              tryCandidate(
                [paints[i].id, paints[j].id, paints[k].id],
                conc,
                mixed,
              );
            }
          }
        }
      }
    }

    // Refine the best triplet
    if (tripletCandidates.length > 0) {
      tripletCandidates.sort((a, b) => a.distance - b.distance);
      const topTrip = tripletCandidates[0];
      const { i, j, k, conc } = topTrip;
      const step = 0.1;
      for (let da = -step; da <= step; da += step) {
        for (let db = -step; db <= step; db += step) {
          const na = conc[0] + da;
          const nb = conc[1] + db;
          const nc = 1.0 - na - nb;
          if (na < 0.05 || nb < 0.05 || nc < 0.05) continue;
          const refined = [
            parseFloat(na.toFixed(2)),
            parseFloat(nb.toFixed(2)),
            parseFloat(nc.toFixed(2)),
          ];
          const inputs: PaintInput[] = [
            { rgb: paints[i].rgb },
            { rgb: paints[j].rgb },
            { rgb: paints[k].rgb },
          ];
          const mixed = mixPaints(inputs, refined);
          tryCandidate(
            [paints[i].id, paints[j].id, paints[k].id],
            refined,
            mixed,
          );
        }
      }
    }
  }

  return best;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Adds a scaled basis spectrum to an accumulator array in place.
 * @param target - Accumulator spectrum (mutated)
 * @param scale - Scalar weight
 * @param basis - Basis spectrum to add
 */
function addScaled(target: number[], scale: number, basis: readonly number[]): void {
  for (let i = 0; i < target.length; i++) {
    target[i] += scale * basis[i];
  }
}
