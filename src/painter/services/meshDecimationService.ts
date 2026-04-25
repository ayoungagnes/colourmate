export interface DecimationResult {
    positions: Float32Array;
    normals: Float32Array;
    faceCount: number;
}

/**
 * Performs mesh decimation using vertex clustering to reduce face count.
 * Groups vertices into spatial grid cells and merges vertices within the
 * same cell, then rebuilds faces from the merged vertices. Degenerate
 * faces (where two or more vertices merge to the same cell) are discarded.
 * @param positions - Flat Float32Array of vertex positions (3 floats per vertex, 9 per face)
 * @param normals - Flat Float32Array of vertex normals (same layout as positions)
 * @param targetFaceCount - Desired maximum number of output faces
 * @returns Decimated geometry with reduced face count
 */
export function decimateMesh(
    positions: Float32Array,
    normals: Float32Array,
    targetFaceCount: number,
): DecimationResult {
    const inputFaceCount = positions.length / 9;

    if (inputFaceCount <= targetFaceCount) {
        return {
            positions: new Float32Array(positions),
            normals: new Float32Array(normals),
            faceCount: inputFaceCount,
        };
    }

    const reductionRatio = targetFaceCount / inputFaceCount;
    const gridSize = estimateGridSize(positions, reductionRatio);

    const bounds = computeBounds(positions);
    const cellMap = new Map<string, { pos: number[]; normal: number[]; count: number }>();
    const vertexCellIds: string[] = [];

    const vertexCount = positions.length / 3;
    for (let i = 0; i < vertexCount; i++) {
        const x = positions[i * 3];
        const y = positions[i * 3 + 1];
        const z = positions[i * 3 + 2];

        const cx = Math.floor((x - bounds.minX) / gridSize);
        const cy = Math.floor((y - bounds.minY) / gridSize);
        const cz = Math.floor((z - bounds.minZ) / gridSize);
        const cellId = `${cx},${cy},${cz}`;

        vertexCellIds.push(cellId);

        const cell = cellMap.get(cellId);
        if (cell) {
            cell.pos[0] += x;
            cell.pos[1] += y;
            cell.pos[2] += z;
            cell.normal[0] += normals[i * 3];
            cell.normal[1] += normals[i * 3 + 1];
            cell.normal[2] += normals[i * 3 + 2];
            cell.count += 1;
        } else {
            cellMap.set(cellId, {
                pos: [x, y, z],
                normal: [normals[i * 3], normals[i * 3 + 1], normals[i * 3 + 2]],
                count: 1,
            });
        }
    }

    const cellPositions = new Map<string, number[]>();
    const cellNormals = new Map<string, number[]>();
    for (const [cellId, cell] of cellMap) {
        cellPositions.set(cellId, [
            cell.pos[0] / cell.count,
            cell.pos[1] / cell.count,
            cell.pos[2] / cell.count,
        ]);
        const nl = Math.sqrt(
            cell.normal[0] ** 2 + cell.normal[1] ** 2 + cell.normal[2] ** 2,
        );
        const invLen = nl > 0 ? 1 / nl : 0;
        cellNormals.set(cellId, [
            cell.normal[0] * invLen,
            cell.normal[1] * invLen,
            cell.normal[2] * invLen,
        ]);
    }

    const outPositions: number[] = [];
    const outNormals: number[] = [];
    let outFaceCount = 0;

    for (let f = 0; f < inputFaceCount; f++) {
        const c0 = vertexCellIds[f * 3];
        const c1 = vertexCellIds[f * 3 + 1];
        const c2 = vertexCellIds[f * 3 + 2];

        if (c0 === c1 || c1 === c2 || c0 === c2) {
            continue;
        }

        const p0 = cellPositions.get(c0)!;
        const p1 = cellPositions.get(c1)!;
        const p2 = cellPositions.get(c2)!;
        const n0 = cellNormals.get(c0)!;
        const n1 = cellNormals.get(c1)!;
        const n2 = cellNormals.get(c2)!;

        outPositions.push(...p0, ...p1, ...p2);
        outNormals.push(...n0, ...n1, ...n2);
        outFaceCount++;
    }

    return {
        positions: new Float32Array(outPositions),
        normals: new Float32Array(outNormals),
        faceCount: outFaceCount,
    };
}

interface Bounds {
    minX: number; minY: number; minZ: number;
    maxX: number; maxY: number; maxZ: number;
}

/**
 * Computes the axis-aligned bounding box for a set of vertex positions.
 * @param positions - Flat Float32Array of vertex positions
 * @returns Bounding box min/max coordinates
 */
function computeBounds(positions: Float32Array): Bounds {
    let minX = Infinity, minY = Infinity, minZ = Infinity;
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

    for (let i = 0; i < positions.length; i += 3) {
        const x = positions[i];
        const y = positions[i + 1];
        const z = positions[i + 2];
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (z < minZ) minZ = z;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
        if (z > maxZ) maxZ = z;
    }

    return { minX, minY, minZ, maxX, maxY, maxZ };
}

/**
 * Estimates a grid cell size for vertex clustering based on the mesh bounding
 * box diagonal and the desired reduction ratio. A smaller ratio produces
 * larger grid cells, collapsing more vertices together.
 * @param positions - Flat Float32Array of vertex positions
 * @param reductionRatio - Target faces / input faces (0 < ratio < 1)
 * @returns Grid cell size
 */
function estimateGridSize(positions: Float32Array, reductionRatio: number): number {
    const bounds = computeBounds(positions);
    const dx = bounds.maxX - bounds.minX;
    const dy = bounds.maxY - bounds.minY;
    const dz = bounds.maxZ - bounds.minZ;
    const diagonal = Math.sqrt(dx * dx + dy * dy + dz * dz);

    const cellsPerAxis = Math.max(2, Math.round(Math.cbrt(positions.length / 9 * reductionRatio)));
    return diagonal / cellsPerAxis;
}
