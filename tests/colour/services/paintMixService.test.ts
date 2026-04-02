import { describe, expect, it } from 'vitest';

import {
  findBestMix,
  mixPaints,
  mixTwoPaints,
  rgbToSpectrum,
  spectrumToRgb,
  PaintInput,
} from '@/src/colour/services/paintMixService';
import { RGB } from '@/src/colour/ui/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Checks whether two RGB values are approximately equal within a tolerance.
 * @param a - First RGB value
 * @param b - Second RGB value
 * @param tolerance - Maximum allowed difference per channel (default 10)
 */
function expectRgbClose(a: RGB, b: RGB, tolerance = 10) {
  expect(Math.abs(a.r - b.r)).toBeLessThanOrEqual(tolerance);
  expect(Math.abs(a.g - b.g)).toBeLessThanOrEqual(tolerance);
  expect(Math.abs(a.b - b.b)).toBeLessThanOrEqual(tolerance);
}

/**
 * Checks whether an RGB value has all channels within valid 0–255 range.
 * @param rgb - RGB value to validate
 */
function expectValidRgb(rgb: RGB) {
  expect(rgb.r).toBeGreaterThanOrEqual(0);
  expect(rgb.r).toBeLessThanOrEqual(255);
  expect(rgb.g).toBeGreaterThanOrEqual(0);
  expect(rgb.g).toBeLessThanOrEqual(255);
  expect(rgb.b).toBeGreaterThanOrEqual(0);
  expect(rgb.b).toBeLessThanOrEqual(255);
}

// ---------------------------------------------------------------------------
// rgbToSpectrum
// ---------------------------------------------------------------------------

describe('rgbToSpectrum', () => {
  it('converts white to a spectrum with all values near 1.0', () => {
    const spectrum = rgbToSpectrum({ r: 255, g: 255, b: 255 });
    expect(spectrum).toHaveLength(10);
    for (const val of spectrum) {
      expect(val).toBeGreaterThan(0.9);
      expect(val).toBeLessThanOrEqual(1.01);
    }
  });

  it('converts black to a spectrum with all values near 0.0', () => {
    const spectrum = rgbToSpectrum({ r: 0, g: 0, b: 0 });
    expect(spectrum).toHaveLength(10);
    for (const val of spectrum) {
      expect(val).toBeGreaterThanOrEqual(0);
      expect(val).toBeLessThan(0.01);
    }
  });

  it('converts pure red to high values in long wavelengths', () => {
    const spectrum = rgbToSpectrum({ r: 255, g: 0, b: 0 });
    expect(spectrum).toHaveLength(10);
    // Long wavelength bands (indices 7–9, ~660–720nm) should be higher than short
    const longWaveAvg = (spectrum[7] + spectrum[8] + spectrum[9]) / 3;
    const shortWaveAvg = (spectrum[0] + spectrum[1] + spectrum[2]) / 3;
    expect(longWaveAvg).toBeGreaterThan(shortWaveAvg);
  });

  it('returns exactly 10 bands for any input', () => {
    const spectrum = rgbToSpectrum({ r: 128, g: 64, b: 200 });
    expect(spectrum).toHaveLength(10);
  });
});

// ---------------------------------------------------------------------------
// spectrumToRgb (round-trip)
// ---------------------------------------------------------------------------

describe('spectrumToRgb', () => {
  it('round-trips white approximately', () => {
    const white: RGB = { r: 255, g: 255, b: 255 };
    const result = spectrumToRgb(rgbToSpectrum(white));
    // 10-band spectral representation introduces quantisation error
    expectRgbClose(result, white, 40);
  });

  it('round-trips black approximately', () => {
    const black: RGB = { r: 0, g: 0, b: 0 };
    const result = spectrumToRgb(rgbToSpectrum(black));
    expectRgbClose(result, black, 5);
  });

  it('round-trips mid-gray approximately', () => {
    const gray: RGB = { r: 128, g: 128, b: 128 };
    const result = spectrumToRgb(rgbToSpectrum(gray));
    expectRgbClose(result, gray, 20);
  });

  it('round-trips a saturated colour within tolerance', () => {
    const red: RGB = { r: 255, g: 0, b: 0 };
    const result = spectrumToRgb(rgbToSpectrum(red));
    expectValidRgb(result);
    // Red should remain dominant after round-trip
    expect(result.r).toBeGreaterThan(result.g);
    expect(result.r).toBeGreaterThan(result.b);
  });
});

// ---------------------------------------------------------------------------
// mixPaints (N-paint)
// ---------------------------------------------------------------------------

describe('mixPaints', () => {
  it('returns the original colour when a single paint is at 100%', () => {
    const colour: RGB = { r: 200, g: 100, b: 50 };
    const result = mixPaints([{ rgb: colour }], [1.0]);
    expect(result).toEqual(colour);
  });

  it('mixing two identical paints returns approximately the same colour', () => {
    const colour: RGB = { r: 100, g: 150, b: 200 };
    const result = mixPaints(
      [{ rgb: colour }, { rgb: colour }],
      [0.5, 0.5],
    );
    // Spectral round-trip through 10-band approximation introduces error
    expectRgbClose(result, colour, 40);
  });

  it('blue + yellow produces a dark/brownish result, not bright green or gray', () => {
    const blue: RGB = { r: 0, g: 0, b: 255 };
    const yellow: RGB = { r: 255, g: 255, b: 0 };
    const result = mixPaints(
      [{ rgb: blue }, { rgb: yellow }],
      [0.5, 0.5],
    );
    expectValidRgb(result);
    // Should not be bright — K-M subtractive mixing darkens
    const brightness = (result.r + result.g + result.b) / 3;
    expect(brightness).toBeLessThan(200);
    // Should not be pure gray (some chromatic content expected)
    const maxChannel = Math.max(result.r, result.g, result.b);
    const minChannel = Math.min(result.r, result.g, result.b);
    expect(maxChannel - minChannel).toBeGreaterThan(5);
  });

  it('3-paint mix with concentrations summing to 1.0 produces valid RGB', () => {
    const red: RGB = { r: 255, g: 0, b: 0 };
    const green: RGB = { r: 0, g: 255, b: 0 };
    const blue: RGB = { r: 0, g: 0, b: 255 };
    const result = mixPaints(
      [{ rgb: red }, { rgb: green }, { rgb: blue }],
      [0.33, 0.34, 0.33],
    );
    expectValidRgb(result);
  });

  it('throws when paints and concentrations have different lengths', () => {
    expect(() =>
      mixPaints([{ rgb: { r: 0, g: 0, b: 0 } }], [0.5, 0.5]),
    ).toThrow('paints and concentrations must have the same length');
  });

  it('returns black for an empty paint array', () => {
    const result = mixPaints([], []);
    expect(result).toEqual({ r: 0, g: 0, b: 0 });
  });

  it('respects opacity parameter', () => {
    const red: RGB = { r: 200, g: 50, b: 30 };
    const blue: RGB = { r: 30, g: 50, b: 200 };
    const resultHigh = mixPaints(
      [{ rgb: red, opacity: 1.0 }, { rgb: blue, opacity: 1.0 }],
      [0.5, 0.5],
    );
    const resultLow = mixPaints(
      [{ rgb: red, opacity: 0.3 }, { rgb: blue, opacity: 1.0 }],
      [0.5, 0.5],
    );
    // Different opacity on a chromatic paint should produce different results
    const sameness = Math.abs(resultHigh.r - resultLow.r) +
                     Math.abs(resultHigh.g - resultLow.g) +
                     Math.abs(resultHigh.b - resultLow.b);
    expect(sameness).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// mixTwoPaints (backward compatibility)
// ---------------------------------------------------------------------------

describe('mixTwoPaints', () => {
  it('mixing the same colour at 50/50 returns approximately itself', () => {
    const colour: RGB = { r: 120, g: 80, b: 200 };
    const result = mixTwoPaints(colour, colour, 0.5);
    // Spectral round-trip introduces error from 10-band approximation
    expectRgbClose(result, colour, 40);
  });

  it('produces valid RGB for arbitrary inputs', () => {
    const result = mixTwoPaints(
      { r: 200, g: 50, b: 30 },
      { r: 10, g: 100, b: 220 },
      0.7,
    );
    expectValidRgb(result);
  });

  it('ratio 1.0 returns approximately the first colour', () => {
    const a: RGB = { r: 200, g: 100, b: 50 };
    const b: RGB = { r: 50, g: 200, b: 100 };
    const result = mixTwoPaints(a, b, 1.0);
    // At ratio 1.0, paint B has 0 contribution — result should be close to A
    // (spectral round-trip adds some error)
    expectRgbClose(result, a, 30);
  });
});

// ---------------------------------------------------------------------------
// findBestMix
// ---------------------------------------------------------------------------

describe('findBestMix', () => {
  const simplePaints = [
    { id: 'red', rgb: { r: 255, g: 0, b: 0 } as RGB },
    { id: 'green', rgb: { r: 0, g: 255, b: 0 } as RGB },
    { id: 'blue', rgb: { r: 0, g: 0, b: 255 } as RGB },
    { id: 'white', rgb: { r: 255, g: 255, b: 255 } as RGB },
  ];

  // Simple identity XYZ function for testing — just use RGB values as coordinates
  const xyzOf = (rgb: RGB) => ({ x: rgb.r, y: rgb.g, z: rgb.b });

  it('returns null when fewer than 2 paints provided', () => {
    expect(findBestMix([simplePaints[0]], { x: 128, y: 128, z: 128 }, xyzOf)).toBeNull();
    expect(findBestMix([], { x: 128, y: 128, z: 128 }, xyzOf)).toBeNull();
  });

  it('returns a valid MixSuggestion with paintIds and concentrations', () => {
    const goal = { x: 128, y: 128, z: 0 };
    const result = findBestMix(simplePaints, goal, xyzOf);
    expect(result).not.toBeNull();
    expect(result!.paintIds.length).toBeGreaterThanOrEqual(2);
    expect(result!.concentrations.length).toBe(result!.paintIds.length);
    // All paintIds should be from the input set
    const validIds = new Set(simplePaints.map((p) => p.id));
    for (const id of result!.paintIds) {
      expect(validIds.has(id)).toBe(true);
    }
  });

  it('concentrations sum to approximately 1.0', () => {
    const goal = { x: 100, y: 50, z: 200 };
    const result = findBestMix(simplePaints, goal, xyzOf);
    expect(result).not.toBeNull();
    const sum = result!.concentrations.reduce((s, c) => s + c, 0);
    expect(sum).toBeCloseTo(1.0, 1);
  });

  it('returns a result with a non-negative distance', () => {
    const goal = { x: 200, y: 100, z: 50 };
    const result = findBestMix(simplePaints, goal, xyzOf);
    expect(result).not.toBeNull();
    expect(result!.distance).toBeGreaterThanOrEqual(0);
  });
});
