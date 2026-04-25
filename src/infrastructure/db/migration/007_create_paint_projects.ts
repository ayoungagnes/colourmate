import * as SQLite from "expo-sqlite";

export async function up(db: SQLite.SQLiteDatabase): Promise<void> {
    await db.execAsync(`
        CREATE TABLE IF NOT EXISTS paint_projects (
            id TEXT PRIMARY KEY NOT NULL,
            name TEXT NOT NULL,
            stl_uri TEXT NOT NULL,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL
        )
    `);
}
