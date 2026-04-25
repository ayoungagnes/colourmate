import * as SQLite from "expo-sqlite";
import { FacePaint, FacePaintProps } from "../models/facePaint";
import { FacePaintRepository } from "./facePaintRepository";

interface FacePaintRow {
    id: string;
    project_id: string;
    face_index: number;
    r: number;
    g: number;
    b: number;
    coat_count: number;
}

/**
 * Converts a database row into FacePaintProps.
 * @param row - Raw row from the face_paints table
 * @returns Props suitable for FacePaint.fromDatabase
 */
function rowToProps(row: FacePaintRow): FacePaintProps {
    return {
        id: row.id,
        project_id: row.project_id,
        face_index: row.face_index,
        r: row.r,
        g: row.g,
        b: row.b,
        coat_count: row.coat_count,
    };
}

export class SqliteFacePaintRepository implements FacePaintRepository {
    constructor(private readonly db: SQLite.SQLiteDatabase) {}

    /**
     * Inserts multiple face paint entries in a single transaction.
     * @param facePaints - Array of FacePaint instances to insert
     */
    async saveMany(facePaints: FacePaint[]): Promise<void> {
        if (facePaints.length === 0) return;

        await this.db.withTransactionAsync(async () => {
            for (const fp of facePaints) {
                await this.db.runAsync(
                    `INSERT INTO face_paints (id, project_id, face_index, r, g, b, coat_count) VALUES (?, ?, ?, ?, ?, ?, ?)`,
                    fp.id, fp.project_id, fp.face_index, fp.r, fp.g, fp.b, fp.coat_count,
                );
            }
        });
    }

    /**
     * Upserts multiple face paint entries using INSERT OR REPLACE, keyed on
     * the unique (project_id, face_index) constraint. Uses a single transaction
     * for efficient bulk writes.
     * @param facePaints - Array of FacePaint instances to upsert
     */
    async upsertMany(facePaints: FacePaint[]): Promise<void> {
        if (facePaints.length === 0) return;

        await this.db.withTransactionAsync(async () => {
            for (const fp of facePaints) {
                await this.db.runAsync(
                    `INSERT INTO face_paints (id, project_id, face_index, r, g, b, coat_count)
                     VALUES (?, ?, ?, ?, ?, ?, ?)
                     ON CONFLICT(project_id, face_index) DO UPDATE SET
                       r = excluded.r,
                       g = excluded.g,
                       b = excluded.b,
                       coat_count = excluded.coat_count`,
                    fp.id, fp.project_id, fp.face_index, fp.r, fp.g, fp.b, fp.coat_count,
                );
            }
        });
    }

    /**
     * Retrieves all face paint entries for a given project.
     * @param projectId - The project UUID
     * @returns Array of FacePaint instances for the project
     */
    async findByProjectId(projectId: string): Promise<FacePaint[]> {
        const rows = await this.db.getAllAsync<FacePaintRow>(
            "SELECT * FROM face_paints WHERE project_id = ?",
            projectId,
        );
        return rows.map((row) => FacePaint.fromDatabase(rowToProps(row)));
    }

    /**
     * Deletes all face paint entries for a given project.
     * @param projectId - The project UUID
     */
    async deleteByProjectId(projectId: string): Promise<void> {
        await this.db.runAsync(
            "DELETE FROM face_paints WHERE project_id = ?",
            projectId,
        );
    }
}
