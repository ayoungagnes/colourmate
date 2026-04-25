import { randomUUID } from "expo-crypto";

export interface PaintProjectProps {
    id: string;
    name: string;
    stl_uri: string;
    created_at: number;
    updated_at: number;
}

export class PaintProject {
    readonly id: string;
    name: string;
    readonly stl_uri: string;
    readonly created_at: number;
    updated_at: number;

    private constructor(props: PaintProjectProps) {
        this.id = props.id;
        this.name = props.name;
        this.stl_uri = props.stl_uri;
        this.created_at = props.created_at;
        this.updated_at = props.updated_at;
    }

    /**
     * Creates a new PaintProject with a generated UUID and current timestamp.
     * @param name - Display name for the project
     * @param stlUri - Local file URI to the copied STL file
     * @returns A new PaintProject instance
     */
    static create(name: string, stlUri: string): PaintProject {
        const now = Date.now();
        return new PaintProject({
            id: randomUUID(),
            name,
            stl_uri: stlUri,
            created_at: now,
            updated_at: now,
        });
    }

    /**
     * Reconstitutes a PaintProject from a database row.
     * @param props - Raw properties from the database
     * @returns A PaintProject instance
     */
    static fromDatabase(props: PaintProjectProps): PaintProject {
        return new PaintProject(props);
    }

    /**
     * Updates the project name and bumps the updated_at timestamp.
     * @param name - New display name
     */
    rename(name: string): void {
        if (!name.trim()) throw new Error("Project name cannot be empty");
        this.name = name.trim();
        this.updated_at = Date.now();
    }
}
