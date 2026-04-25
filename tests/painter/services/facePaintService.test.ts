import { describe, expect, it } from "vitest";
import {
    applyCoat,
    applyCoatToFaces,
    BASE_COLOUR,
    FaceEntry,
} from "@/src/painter/services/facePaintService";

describe("applyCoat", () => {
    const red = { r: 255, g: 0, b: 0 };
    const blue = { r: 0, g: 0, b: 255 };

    it("produces a colour between the current and paint colour", () => {
        const result = applyCoat(BASE_COLOUR, red);

        expect(result.r).toBeGreaterThan(BASE_COLOUR.r * 0.5);
        expect(result.r).toBeLessThanOrEqual(255);
    });

    it("moves closer to the paint colour with multiple coats", () => {
        let current = { ...BASE_COLOUR };
        for (let i = 0; i < 5; i++) {
            current = applyCoat(current, red);
        }

        expect(current.r).toBeGreaterThan(200);
        expect(current.g).toBeLessThan(100);
        expect(current.b).toBeLessThan(100);
    });

    it("produces valid RGB values in 0-255 range", () => {
        const result = applyCoat(red, blue);

        expect(result.r).toBeGreaterThanOrEqual(0);
        expect(result.r).toBeLessThanOrEqual(255);
        expect(result.g).toBeGreaterThanOrEqual(0);
        expect(result.g).toBeLessThanOrEqual(255);
        expect(result.b).toBeGreaterThanOrEqual(0);
        expect(result.b).toBeLessThanOrEqual(255);
    });

    it("uses Mixbox for realistic pigment mixing (blue + yellow → greenish)", () => {
        const yellow = { r: 255, g: 255, b: 0 };
        let current = { ...blue };
        for (let i = 0; i < 3; i++) {
            current = applyCoat(current, yellow);
        }

        // With Mixbox, blue + yellow mixes toward green
        expect(current.g).toBeGreaterThan(current.r);
    });
});

describe("applyCoatToFaces", () => {
    const red = { r: 255, g: 0, b: 0 };

    it("creates new entries starting from BASE_COLOUR for unpainted faces", () => {
        const faceMap = new Map<number, FaceEntry>();
        const updated = applyCoatToFaces(faceMap, [0, 1, 2], red);

        expect(updated.size).toBe(3);
        expect(faceMap.size).toBe(3);

        for (const [, entry] of updated) {
            expect(entry.coatCount).toBe(1);
            expect(entry.r).toBeGreaterThan(BASE_COLOUR.r * 0.5);
        }
    });

    it("increments coat count on existing entries", () => {
        const faceMap = new Map<number, FaceEntry>();
        applyCoatToFaces(faceMap, [0], red);
        applyCoatToFaces(faceMap, [0], red);
        const entry = faceMap.get(0)!;

        expect(entry.coatCount).toBe(2);
    });

    it("returns only updated entries", () => {
        const faceMap = new Map<number, FaceEntry>();
        faceMap.set(5, { r: 100, g: 100, b: 100, coatCount: 1 });

        const updated = applyCoatToFaces(faceMap, [0, 1], red);

        expect(updated.has(0)).toBe(true);
        expect(updated.has(1)).toBe(true);
        expect(updated.has(5)).toBe(false);
    });

    it("saturates colour after many coats", () => {
        const faceMap = new Map<number, FaceEntry>();
        for (let i = 0; i < 10; i++) {
            applyCoatToFaces(faceMap, [0], red);
        }
        const entry = faceMap.get(0)!;

        expect(entry.coatCount).toBe(10);
        expect(entry.r).toBeGreaterThan(220);
    });
});
