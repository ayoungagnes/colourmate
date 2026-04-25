import { randomUUID } from "expo-crypto";
import { RGB } from "../../colour/ui/types";
import { applyCoat } from "../services/facePaintService";

export interface FacePaintProps {
    id: string;
    project_id: string;
    face_index: number;
    r: number;
    g: number;
    b: number;
    coat_count: number;
}

export class FacePaint {
    readonly id: string;
    readonly project_id: string;
    readonly face_index: number;
    r: number;
    g: number;
    b: number;
    coat_count: number;

    private constructor(props: FacePaintProps) {
        this.id = props.id;
        this.project_id = props.project_id;
        this.face_index = props.face_index;
        this.r = props.r;
        this.g = props.g;
        this.b = props.b;
        this.coat_count = props.coat_count;
    }

    /**
     * Creates a new FacePaint entry for a specific face on a project.
     * @param projectId - The project this face belongs to
     * @param faceIndex - Triangle face index in the mesh
     * @param r - Red channel (0-255)
     * @param g - Green channel (0-255)
     * @param b - Blue channel (0-255)
     * @param coatCount - Number of coats applied
     * @returns A new FacePaint instance
     */
    static create(projectId: string, faceIndex: number, r: number, g: number, b: number, coatCount: number): FacePaint {
        return new FacePaint({
            id: randomUUID(),
            project_id: projectId,
            face_index: faceIndex,
            r, g, b,
            coat_count: coatCount,
        });
    }

    /**
     * Reconstitutes a FacePaint from a database row.
     * @param props - Raw properties from the database
     * @returns A FacePaint instance
     */
    static fromDatabase(props: FacePaintProps): FacePaint {
        return new FacePaint(props);
    }

    /**
     * Applies a new coat of paint using Mixbox blending, updating the
     * current colour and incrementing the coat count.
     * @param paintRgb - The paint colour to apply as a new coat
     */
    applyNewCoat(paintRgb: RGB): void {
        const blended = applyCoat({ r: this.r, g: this.g, b: this.b }, paintRgb);
        this.r = blended.r;
        this.g = blended.g;
        this.b = blended.b;
        this.coat_count += 1;
    }
}
