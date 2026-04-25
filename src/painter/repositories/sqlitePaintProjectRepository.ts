import * as SQLite from "expo-sqlite";
import { PaintProject, PaintProjectProps } from "../models/paintProject";
import { PaintProjectRepository } from "./paintProjectRepository";

interface PaintProjectRow {
    id: string;
    name: string;
    stl_uri: string;
    created_at: number;
    updated_at: number;
}

/**
 * Converts a database row into PaintProjectProps.
 * @param row - Raw row from the paint_projects table
 * @returns Props suitable for PaintProject.fromDatabase
 */
function rowToProps(row: PaintProjectRow): PaintProjectProps {
    return {
        id: row.id,
        name: row.name,
        stl_uri: row.stl_uri,
        created_at: row.created_at,
        updated_at: row.updated_at,
    };
}

export class SqlitePaintProjectRepository implements PaintProjectRepository {
    constructor(private readonly db: SQLite.SQLiteDatabase) {}

    /**
     * Inserts a new paint project into the database.
     * @param project - The PaintProject to persist
     */
    async save(project: PaintProject): Promise<void> {
        await this.db.runAsync(
            `INSERT INTO paint_projects (id, name, stl_uri, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`,
            project.id,
            project.name,
            project.stl_uri,
            project.created_at,
            project.updated_at,
        );
    }

    /**
     * Updates an existing paint project's name and updated_at timestamp.
     * @param project - The PaintProject with updated fields
     */
    async update(project: PaintProject): Promise<void> {
        await this.db.runAsync(
            `UPDATE paint_projects SET name = ?, updated_at = ? WHERE id = ?`,
            project.name,
            project.updated_at,
            project.id,
        );
    }

    /**
     * Retrieves all paint projects ordered by most recently updated.
     * @returns Array of all PaintProject instances
     */
    async findAll(): Promise<PaintProject[]> {
        const rows = await this.db.getAllAsync<PaintProjectRow>(
            "SELECT * FROM paint_projects ORDER BY updated_at DESC",
        );
        return rows.map((row) => PaintProject.fromDatabase(rowToProps(row)));
    }

    /**
     * Finds a paint project by its unique ID.
     * @param id - The project UUID
     * @returns The PaintProject or null if not found
     */
    async findById(id: string): Promise<PaintProject | null> {
        const row = await this.db.getFirstAsync<PaintProjectRow>(
            "SELECT * FROM paint_projects WHERE id = ?",
            id,
        );
        if (!row) return null;
        return PaintProject.fromDatabase(rowToProps(row));
    }

    /**
     * Deletes a paint project by ID. Associated face_paints are cascade-deleted.
     * @param id - The project UUID to delete
     */
    async delete(id: string): Promise<void> {
        await this.db.runAsync("DELETE FROM paint_projects WHERE id = ?", id);
    }
}
