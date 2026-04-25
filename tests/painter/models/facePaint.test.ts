import { describe, expect, it, vi } from "vitest";

vi.mock("expo-crypto", () => ({
    randomUUID: () => "test-uuid-" + Math.random().toString(36).slice(2, 10),
}));

import { FacePaint } from "@/src/painter/models/facePaint";

describe("FacePaint", () => {
    it("creates with correct properties", () => {
        const fp = FacePaint.create("proj-1", 42, 200, 100, 50, 3);

        expect(fp.id).toBeTruthy();
        expect(fp.project_id).toBe("proj-1");
        expect(fp.face_index).toBe(42);
        expect(fp.r).toBe(200);
        expect(fp.g).toBe(100);
        expect(fp.b).toBe(50);
        expect(fp.coat_count).toBe(3);
    });

    it("reconstitutes from database props", () => {
        const props = {
            id: "fp-1",
            project_id: "proj-1",
            face_index: 10,
            r: 128,
            g: 64,
            b: 32,
            coat_count: 2,
        };
        const fp = FacePaint.fromDatabase(props);

        expect(fp.id).toBe("fp-1");
        expect(fp.face_index).toBe(10);
        expect(fp.coat_count).toBe(2);
    });

    it("applies a new coat and increments coat count", () => {
        const fp = FacePaint.create("proj-1", 0, 245, 245, 245, 0);
        const paintRgb = { r: 255, g: 0, b: 0 };

        fp.applyNewCoat(paintRgb);

        expect(fp.coat_count).toBe(1);
        expect(fp.r).not.toBe(245);
        expect(fp.r).toBeGreaterThan(200);
    });

    it("builds up colour saturation with multiple coats", () => {
        const fp = FacePaint.create("proj-1", 0, 245, 245, 245, 0);
        const paintRgb = { r: 0, g: 0, b: 255 };

        for (let i = 0; i < 7; i++) {
            fp.applyNewCoat(paintRgb);
        }

        expect(fp.coat_count).toBe(7);
        expect(fp.b).toBeGreaterThan(fp.r);
        expect(fp.b).toBeGreaterThan(fp.g);
    });
});
