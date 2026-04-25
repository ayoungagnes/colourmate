import { describe, expect, it } from "vitest";
import { parseSTL } from "@/src/painter/services/stlLoaderService";

/**
 * Creates a minimal binary STL buffer with the given number of faces.
 * Each face is a unit triangle at the origin with a zero normal.
 * @param faceCount - Number of triangular faces to generate
 * @returns ArrayBuffer containing valid binary STL data
 */
function makeBinarySTL(faceCount: number): ArrayBuffer {
    const size = 84 + faceCount * 50;
    const buffer = new ArrayBuffer(size);
    const view = new DataView(buffer);

    // 80-byte header (zeroed)
    view.setUint32(80, faceCount, true);

    for (let i = 0; i < faceCount; i++) {
        const offset = 84 + i * 50;

        // normal (0, 0, 1)
        view.setFloat32(offset, 0, true);
        view.setFloat32(offset + 4, 0, true);
        view.setFloat32(offset + 8, 1, true);

        // vertex 0: (0, 0, 0)
        view.setFloat32(offset + 12, 0, true);
        view.setFloat32(offset + 16, 0, true);
        view.setFloat32(offset + 20, 0, true);

        // vertex 1: (1, 0, 0)
        view.setFloat32(offset + 24, 1, true);
        view.setFloat32(offset + 28, 0, true);
        view.setFloat32(offset + 32, 0, true);

        // vertex 2: (0, 1, 0)
        view.setFloat32(offset + 36, 0, true);
        view.setFloat32(offset + 40, 1, true);
        view.setFloat32(offset + 44, 0, true);

        // attribute byte count
        view.setUint16(offset + 48, 0, true);
    }

    return buffer;
}

describe("parseSTL (binary)", () => {
    it("parses a single-face binary STL correctly", () => {
        const buffer = makeBinarySTL(1);
        const result = parseSTL(buffer);

        expect(result.faceCount).toBe(1);
        expect(result.positions.length).toBe(9);
        expect(result.normals.length).toBe(9);
    });

    it("extracts correct vertex positions", () => {
        const buffer = makeBinarySTL(1);
        const result = parseSTL(buffer);

        // vertex 0
        expect(result.positions[0]).toBe(0);
        expect(result.positions[1]).toBe(0);
        expect(result.positions[2]).toBe(0);
        // vertex 1
        expect(result.positions[3]).toBe(1);
        expect(result.positions[4]).toBe(0);
        expect(result.positions[5]).toBe(0);
        // vertex 2
        expect(result.positions[6]).toBe(0);
        expect(result.positions[7]).toBe(1);
        expect(result.positions[8]).toBe(0);
    });

    it("extracts correct normals (replicated per vertex)", () => {
        const buffer = makeBinarySTL(1);
        const result = parseSTL(buffer);

        for (let v = 0; v < 3; v++) {
            expect(result.normals[v * 3]).toBe(0);
            expect(result.normals[v * 3 + 1]).toBe(0);
            expect(result.normals[v * 3 + 2]).toBe(1);
        }
    });

    it("parses multiple faces", () => {
        const buffer = makeBinarySTL(10);
        const result = parseSTL(buffer);

        expect(result.faceCount).toBe(10);
        expect(result.positions.length).toBe(90);
        expect(result.normals.length).toBe(90);
    });

    it("throws on truncated binary STL", () => {
        const buffer = new ArrayBuffer(90); // too small for any faces
        const view = new DataView(buffer);
        view.setUint32(80, 5, true); // claims 5 faces but only ~6 bytes of data

        expect(() => parseSTL(buffer)).toThrow("truncated");
    });
});

describe("parseSTL (ASCII)", () => {
    it("parses a simple ASCII STL", () => {
        const ascii = `solid test
facet normal 0 0 1
  outer loop
    vertex 0 0 0
    vertex 1 0 0
    vertex 0 1 0
  endloop
endfacet
endsolid test`;

        const encoder = new TextEncoder();
        const buffer = encoder.encode(ascii).buffer;
        const result = parseSTL(buffer);

        expect(result.faceCount).toBe(1);
        expect(result.positions.length).toBe(9);
        expect(result.positions[3]).toBe(1);
    });
});
