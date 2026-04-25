import { FacePaint } from "../models/facePaint";

export interface FacePaintRepository {
    saveMany(facePaints: FacePaint[]): Promise<void>;
    upsertMany(facePaints: FacePaint[]): Promise<void>;
    findByProjectId(projectId: string): Promise<FacePaint[]>;
    deleteByProjectId(projectId: string): Promise<void>;
}
