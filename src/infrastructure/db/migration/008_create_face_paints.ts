import * as SQLite from "expo-sqlite";

export async function up(db: SQLite.SQLiteDatabase): Promise<void> {
    await db.execAsync(`
        CREATE TABLE IF NOT EXISTS face_paints (
            id TEXT PRIMARY KEY NOT NULL,
            project_id TEXT NOT NULL,
            face_index INTEGER NOT NULL,
            r INTEGER NOT NULL,
            g INTEGER NOT NULL,
            b INTEGER NOT NULL,
            coat_count INTEGER NOT NULL DEFAULT 0,
            FOREIGN KEY (project_id) REFERENCES paint_projects(id) ON DELETE CASCADE
        )
    `);
    await db.execAsync(`
        CREATE UNIQUE INDEX IF NOT EXISTS idx_face_paints_project_face
        ON face_paints (project_id, face_index)
    `);
}
