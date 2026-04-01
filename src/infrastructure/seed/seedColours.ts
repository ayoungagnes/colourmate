import { SQLiteDatabase } from 'expo-sqlite';
import { ColourPoint } from '@/src/colour/models/colourPoint';
import { oklchToHueName } from '@/src/infrastructure/db/migration/007_backfill_hue_tags';
import swatchesData from './swatches.json';

interface SeedEntry {
  brand: string;
  name: string;
  rgb: number[];
}

export async function seedColours(db: SQLiteDatabase): Promise<void> {
  const existing = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM colour_points',
  );
  if (existing && existing.count > 0) return;

  const allEntries = [...swatchesData] as SeedEntry[];

  await db.withTransactionAsync(async () => {
    for (const entry of allEntries) {
      if (!entry.brand?.trim() || !entry.name?.trim()) continue;

      try {
        const colour = ColourPoint.create({
          name: entry.name,
          brand: entry.brand,
          rgb: { r: entry.rgb[0], g: entry.rgb[1], b: entry.rgb[2] },
          tag: [],
        });
        colour.update({ tag: [oklchToHueName(colour.oklch.h, colour.oklch.c)] });

        await db.runAsync(
          `INSERT OR IGNORE INTO colour_points (id, name, brand, r, g, b, oklch_l, oklch_c, oklch_h, coord_x, coord_y, coord_Z, tags)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            colour.id,
            colour.name,
            colour.brand,
            colour.rgb.r,
            colour.rgb.g,
            colour.rgb.b,
            colour.oklch.l,
            colour.oklch.c,
            colour.oklch.h,
            colour.coordinate.x,
            colour.coordinate.y,
            colour.coordinate.z,
            JSON.stringify(colour.tag),
          ],
        );
      } catch {
        // skip invalid entries
      }
    }
  });
}
