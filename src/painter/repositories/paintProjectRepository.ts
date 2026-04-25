import { PaintProject } from "../models/paintProject";

export interface PaintProjectRepository {
    save(project: PaintProject): Promise<void>;
    update(project: PaintProject): Promise<void>;
    findAll(): Promise<PaintProject[]>;
    findById(id: string): Promise<PaintProject | null>;
    delete(id: string): Promise<void>;
}
