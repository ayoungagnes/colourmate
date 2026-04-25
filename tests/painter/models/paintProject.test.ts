import { describe, expect, it, vi } from "vitest";

vi.mock("expo-crypto", () => ({
    randomUUID: () => "test-uuid-" + Math.random().toString(36).slice(2, 10),
}));

import { PaintProject } from "@/src/painter/models/paintProject";

describe("PaintProject", () => {
    it("creates a project with generated id and timestamps", () => {
        const project = PaintProject.create("Test Model", "/path/to/model.stl");

        expect(project.id).toBeTruthy();
        expect(project.name).toBe("Test Model");
        expect(project.stl_uri).toBe("/path/to/model.stl");
        expect(project.created_at).toBeGreaterThan(0);
        expect(project.updated_at).toBe(project.created_at);
    });

    it("reconstitutes from database props", () => {
        const props = {
            id: "abc-123",
            name: "My Project",
            stl_uri: "/path/model.stl",
            created_at: 1000,
            updated_at: 2000,
        };
        const project = PaintProject.fromDatabase(props);

        expect(project.id).toBe("abc-123");
        expect(project.name).toBe("My Project");
        expect(project.created_at).toBe(1000);
        expect(project.updated_at).toBe(2000);
    });

    it("renames and bumps updated_at", () => {
        const project = PaintProject.create("Old Name", "/path/model.stl");
        const originalUpdatedAt = project.updated_at;

        // Small delay to ensure timestamp difference
        project.rename("New Name");

        expect(project.name).toBe("New Name");
        expect(project.updated_at).toBeGreaterThanOrEqual(originalUpdatedAt);
    });

    it("trims whitespace on rename", () => {
        const project = PaintProject.create("Name", "/path/model.stl");
        project.rename("  Trimmed Name  ");

        expect(project.name).toBe("Trimmed Name");
    });

    it("throws on empty rename", () => {
        const project = PaintProject.create("Name", "/path/model.stl");

        expect(() => project.rename("")).toThrow("empty");
        expect(() => project.rename("   ")).toThrow("empty");
    });
});
