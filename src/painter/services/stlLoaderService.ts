export interface ParsedSTL {
    positions: Float32Array;
    normals: Float32Array;
    faceCount: number;
}

/**
 * Parses an STL file from an ArrayBuffer, supporting both binary and ASCII formats.
 * Binary STL format: 80-byte header, 4-byte uint32 face count, then 50 bytes per face
 * (12 bytes normal + 36 bytes for 3 vertices + 2 bytes attribute byte count).
 * @param buffer - Raw STL file data as ArrayBuffer
 * @returns Parsed geometry with flat position/normal arrays ready for BufferGeometry
 * @throws Error if the buffer is too small or format is unrecognised
 */
export function parseSTL(buffer: ArrayBuffer): ParsedSTL {
    if (isASCII(buffer)) {
        return parseASCII(buffer);
    }
    return parseBinary(buffer);
}

/**
 * Checks whether an ArrayBuffer contains ASCII STL data by looking for the "solid" keyword.
 * A binary STL can also start with "solid" in its header, so we also check if the
 * file has enough bytes for a valid binary and whether face count matches file size.
 * @param buffer - Raw file data
 * @returns true if the file is likely ASCII STL
 */
function isASCII(buffer: ArrayBuffer): boolean {
    if (buffer.byteLength < 84) return true;

    const header = new Uint8Array(buffer, 0, 5);
    const solid = String.fromCharCode(...header);
    if (solid !== "solid") return false;

    const view = new DataView(buffer);
    const faceCount = view.getUint32(80, true);
    const expectedSize = 84 + faceCount * 50;

    return buffer.byteLength !== expectedSize;
}

/**
 * Parses a binary STL file into flat vertex position and normal arrays.
 * @param buffer - Raw binary STL data
 * @returns ParsedSTL with positions, normals, and face count
 * @throws Error if the binary data is truncated
 */
function parseBinary(buffer: ArrayBuffer): ParsedSTL {
    const view = new DataView(buffer);
    const faceCount = view.getUint32(80, true);
    const expectedSize = 84 + faceCount * 50;

    if (buffer.byteLength < expectedSize) {
        throw new Error(
            `Binary STL truncated: expected ${expectedSize} bytes, got ${buffer.byteLength}`
        );
    }

    const positions = new Float32Array(faceCount * 9);
    const normals = new Float32Array(faceCount * 9);

    for (let i = 0; i < faceCount; i++) {
        const offset = 84 + i * 50;

        const nx = view.getFloat32(offset, true);
        const ny = view.getFloat32(offset + 4, true);
        const nz = view.getFloat32(offset + 8, true);

        for (let v = 0; v < 3; v++) {
            const vOffset = offset + 12 + v * 12;
            const posIdx = i * 9 + v * 3;

            positions[posIdx] = view.getFloat32(vOffset, true);
            positions[posIdx + 1] = view.getFloat32(vOffset + 4, true);
            positions[posIdx + 2] = view.getFloat32(vOffset + 8, true);

            normals[posIdx] = nx;
            normals[posIdx + 1] = ny;
            normals[posIdx + 2] = nz;
        }
    }

    return { positions, normals, faceCount };
}

/**
 * Parses an ASCII STL file by extracting facet normals and vertex positions
 * using regex matching on the text content.
 * @param buffer - Raw ASCII STL data
 * @returns ParsedSTL with positions, normals, and face count
 */
function parseASCII(buffer: ArrayBuffer): ParsedSTL {
    const text = new TextDecoder().decode(buffer);

    const facetPattern =
        /facet\s+normal\s+([\d.eE+\-]+)\s+([\d.eE+\-]+)\s+([\d.eE+\-]+)\s+outer\s+loop\s+vertex\s+([\d.eE+\-]+)\s+([\d.eE+\-]+)\s+([\d.eE+\-]+)\s+vertex\s+([\d.eE+\-]+)\s+([\d.eE+\-]+)\s+([\d.eE+\-]+)\s+vertex\s+([\d.eE+\-]+)\s+([\d.eE+\-]+)\s+([\d.eE+\-]+)/g;

    const positionsList: number[] = [];
    const normalsList: number[] = [];
    let match: RegExpExecArray | null;

    while ((match = facetPattern.exec(text)) !== null) {
        const nx = parseFloat(match[1]);
        const ny = parseFloat(match[2]);
        const nz = parseFloat(match[3]);

        for (let v = 0; v < 3; v++) {
            const baseIdx = 4 + v * 3;
            positionsList.push(
                parseFloat(match[baseIdx]),
                parseFloat(match[baseIdx + 1]),
                parseFloat(match[baseIdx + 2]),
            );
            normalsList.push(nx, ny, nz);
        }
    }

    const faceCount = positionsList.length / 9;
    return {
        positions: new Float32Array(positionsList),
        normals: new Float32Array(normalsList),
        faceCount,
    };
}
