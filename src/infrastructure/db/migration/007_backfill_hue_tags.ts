import { SQLiteDatabase } from 'expo-sqlite';

/**
 * Maps an OKLCH hue angle (degrees) and chroma to a Munsell-like hue name.
 * Low-chroma colours are classified as Neutral.
 *
 * Sector boundaries are the midpoints between principal OKLCH hue angles:
 *   5R≈25°, 5YR≈55°, 5Y≈100°, 5GY≈130°, 5G≈150°
 *   5BG≈200°, 5B≈250°, 5PB≈270°, 5P≈305°, 5RP≈340°
 */
export function oklchToHueName(h: number, c: number): string {
  if (c < 0.03) return 'Neutral';
  const hue = ((h % 360) + 360) % 360;
  if (hue < 40)  return 'Red';
  if (hue < 77)  return 'Yellow-Red';
  if (hue < 115) return 'Yellow';
  if (hue < 140) return 'Green-Yellow';
  if (hue < 175) return 'Green';
  if (hue < 225) return 'Blue-Green';
  if (hue < 260) return 'Blue';
  if (hue < 287) return 'Purple-Blue';
  if (hue < 322) return 'Purple';
  return 'Red-Purple';
}

/**
 * Backfills a hue tag (e.g. "Red", "Yellow-Red") on each colour_point
 * derived from the stored oklch_h / oklch_c values.
 * Skips rows that already have a recognised hue tag.
 */
export async function up(db: SQLiteDatabase): Promise<void> {
  const rows = await db.getAllAsync<{ id: string; oklch_h: number; oklch_c: number; tags: string }>(
    'SELECT id, oklch_h, oklch_c, tags FROM colour_points'
  );

  const HUE_NAMES = new Set([
    'Yellow', 'Yellow-Red', 'Red', 'Red-Purple', 'Purple',
    'Purple-Blue', 'Blue', 'Blue-Green', 'Green', 'Green-Yellow', 'Neutral',
  ]);

  await db.withTransactionAsync(async () => {
    for (const row of rows) {
      const tags: string[] = (() => {
        try { return JSON.parse(row.tags ?? '[]'); } catch { return []; }
      })();

      if (tags.some((t) => HUE_NAMES.has(t))) continue;

      const hue = oklchToHueName(row.oklch_h, row.oklch_c);
      tags.push(hue);
      await db.runAsync(
        'UPDATE colour_points SET tags = ? WHERE id = ?',
        [JSON.stringify(tags), row.id]
      );
    }
  });
}
