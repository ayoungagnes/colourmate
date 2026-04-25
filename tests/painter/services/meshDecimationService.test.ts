import { describe, expect, it } from "vitest";
import { decimateMesh } from "@/src/painter/services/meshDecimationService";

/**
 * Creates a grid of triangles for testing decimation.
 * @param gridSize - Number of quads along each axis
 * @returns Flat position and normal arrays with the face count
 */
function makeGrid(gridSize: number): {
    positions: Float32Array;
    normals: Float32Array;
    faceCount: number;
} {
    const faceCount = gridSize * gridSize * 2;
    const positions = new Float32Array(faceCount * 9);
    const normals = new Float32Array(faceCount * 9);
    let idx = 0;

    for (let x = 0; x < gridSize; x++) {
        for (let z = 0; z < gridSize; z++) {
            // Triangle 1
            positions[idx] = x;
            positions[idx + 1] = 0;
            positions[idx + 2] = z;
            positions[idx + 3] = x + 1;
            positions[idx + 4] = 0;
            positions[idx + 5] = z;
            positions[idx + 6] = x;
            positions[idx + 7] = 0;
            positions[idx + 8] = z + 1;

            for (let n = 0; n < 9; n += 3) {
                normals[idx + n] = 0;
                normals[idx + n + 1] = 1;
                normals[idx + n + 2] = 0;
            }
            idx += 9;

            // Triangle 2
            positions[idx] = x + 1;
            positions[idx + 1] = 0;
            positions[idx + 2] = z;
            positions[idx + 3] = x + 1;
            positions[idx + 4] = 0;
            positions[idx + 5] = z + 1;
            positions[idx + 6] = x;
            positions[idx + 7] = 0;
            positions[idx + 8] = z + 1;

            for (let n = 0; n < 9; n += 3) {
                normals[idx + n] = 0;
                normals[idx + n + 1] = 1;
                normals[idx + n + 2] = 0;
            }
            idx += 9;
        }
    }

    return { positions, normals, faceCount };
}

describe("decimateMesh", () => {
    it("returns original mesh when face count is below target", () => {
        const { positions, normals, faceCount } = makeGrid(2);
        const result = decimateMesh(positions, normals, 100);

        expect(result.faceCount).toBe(faceCount);
        expect(result.positions.length).toBe(positions.length);
    });

    it("reduces face count when above target", () => {
        const { positions, normals, faceCount } = makeGrid(20);
        expect(faceCount).toBe(800);

        const result = decimateMesh(positions, normals, 200);

        expect(result.faceCount).toBeLessThan(faceCount);
        expect(result.faceCount).toBeGreaterThan(0);
    });

    it("produces valid position arrays (length divisible by 9)", () => {
        const { positions, normals } = makeGrid(10);
        const result = decimateMesh(positions, normals, 50);

        expect(result.positions.length % 9).toBe(0);
        expect(result.normals.length % 9).toBe(0);
        expect(result.positions.length / 9).toBe(result.faceCount);
    });

    it("preserves approximate geometry bounds", () => {
        const { positions, normals } = makeGrid(10);
        const result = decimateMesh(positions, normals, 50);

        let minX = Infinity, maxX = -Infinity;
        for (let i = 0; i < result.positions.length; i += 3) {
            const x = result.positions[i];
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
        }

        expect(minX).toBeGreaterThanOrEqual(0);
        expect(maxX).toBeLessThanOrEqual(10);
        expect(maxX - minX).toBeGreaterThan(5);
    });
});
