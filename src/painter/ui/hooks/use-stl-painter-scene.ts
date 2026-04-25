import { ExpoWebGLRenderingContext } from "expo-gl";
import { Renderer } from "expo-three";
import { useCallback, useRef } from "react";
import * as THREE from "three";
import {
    acceleratedRaycast,
    computeBoundsTree,
    disposeBoundsTree,
} from "three-mesh-bvh";

import { sphericalToCartesian } from "../../../colour/services/munsellSceneService";
import { BASE_COLOUR } from "../../services/facePaintService";

THREE.BufferGeometry.prototype.computeBoundsTree = computeBoundsTree;
THREE.BufferGeometry.prototype.disposeBoundsTree = disposeBoundsTree;
THREE.Mesh.prototype.raycast = acceleratedRaycast;

interface SceneState {
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    renderer: THREE.WebGLRenderer;
    mesh: THREE.Mesh | null;
    faceCount: number;
    frameId: number;
    disposed: boolean;
}

const CLEAR_COLOR = 0xf5f5f5;

/**
 * Manages the Three.js scene lifecycle for STL 3D painting.
 * Handles scene creation, STL mesh loading with BVH-accelerated raycasting,
 * vertex colour painting, orbit camera, and the render loop.
 * @returns Object with methods to control the painting scene
 */
export function useStlPainterScene() {
    const stateRef = useRef<SceneState | null>(null);
    const cameraParamsRef = useRef({ theta: Math.PI / 4, phi: Math.PI / 6, zoom: 8, roll: 0 }); // Increased from 3 to 8
    const sceneCenterRef = useRef(new THREE.Vector3(0, 0, 0));

    /**
     * Initialises the Three.js scene, camera, renderer, and lighting when
     * the GL context becomes available.
     * @param gl - The Expo WebGL rendering context from GLView's onContextCreate
     */
    const onContextCreate = useCallback((gl: ExpoWebGLRenderingContext) => {
        console.log("🎨 GL Context Created - buffer size:", gl.drawingBufferWidth, "x", gl.drawingBufferHeight);
        const _getShaderInfoLog = gl.getShaderInfoLog.bind(gl);
        (gl as any).getShaderInfoLog = (s: WebGLShader) => _getShaderInfoLog(s) ?? "";
        const _getProgramInfoLog = gl.getProgramInfoLog.bind(gl);
        (gl as any).getProgramInfoLog = (p: WebGLProgram) => _getProgramInfoLog(p) ?? "";
        const _getShaderPrecisionFormat = gl.getShaderPrecisionFormat.bind(gl);
        (gl as any).getShaderPrecisionFormat = (...args: [number, number]) =>
            _getShaderPrecisionFormat(...args) ?? { rangeMin: 127, rangeMax: 127, precision: 23 };

        const renderer = new Renderer({ gl });
        renderer.setSize(gl.drawingBufferWidth, gl.drawingBufferHeight);
        renderer.setClearColor(CLEAR_COLOR, 1);
        console.log("🎨 Renderer created and sized");

        const scene = new THREE.Scene();

        const camera = new THREE.PerspectiveCamera(
            50,
            gl.drawingBufferWidth / gl.drawingBufferHeight,
            0.01,
            1000,
        );
        console.log("🎥 Camera created - fov: 50, near: 0.01, far: 1000, aspect:", gl.drawingBufferWidth / gl.drawingBufferHeight);

        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        scene.add(ambientLight);

        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(5, 10, 7);
        scene.add(directionalLight);

        const backLight = new THREE.DirectionalLight(0xffffff, 0.3);
        backLight.position.set(-5, -3, -5);
        scene.add(backLight);

        // Add gizmo for rotation visualization
        const axesHelper = new THREE.AxesHelper(1.5);
        scene.add(axesHelper);

        const state: SceneState = {
            scene,
            camera,
            renderer,
            mesh: null,
            faceCount: 0,
            frameId: 0,
            disposed: false,
        };
        stateRef.current = state;

        const { theta, phi, zoom, roll } = cameraParamsRef.current;
        applyCameraPosition(state, theta, phi, zoom, roll);

        let frameCount = 0;
        const animate = () => {
            if (state.disposed) return;
            state.frameId = requestAnimationFrame(animate);
            frameCount++;
            renderer.render(scene, camera);
            gl.endFrameEXP();
        };
        console.log("🎬 Starting animation loop");
        animate();
    }, []);

    /**
     * Creates a BufferGeometry from parsed STL data, applies vertex colours
     * (default light grey), computes BVH for fast raycasting, and adds the
     * mesh to the scene. Auto-centres and scales the model to fit the viewport.
     * @param positions - Flat Float32Array of vertex positions (9 floats per face)
     * @param normals - Flat Float32Array of vertex normals (same layout)
     * @param faceCount - Number of triangular faces
     */
    const loadMesh = useCallback(
        (positions: Float32Array, normals: Float32Array, faceCount: number) => {
            console.log("📦 loadMesh called - faceCount:", faceCount, "positions length:", positions.length, "normals length:", normals.length);
            const state = stateRef.current;
            if (!state) {
                console.error("❌ loadMesh ERROR: stateRef.current is null!");
                return;
            }
            console.log("✅ State exists, proceeding with mesh load");

            if (state.mesh) {
                state.scene.remove(state.mesh);
                state.mesh.geometry.disposeBoundsTree?.();
                state.mesh.geometry.dispose();
                (state.mesh.material as THREE.Material).dispose();
                state.mesh = null;
            }

            const geometry = new THREE.BufferGeometry();
            geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
            geometry.setAttribute("normal", new THREE.BufferAttribute(normals, 3));
            console.log("✨ Geometry created - vertex count:", positions.length / 3);

            const colors = new Float32Array(positions.length);
            for (let i = 0; i < colors.length; i += 3) {
                colors[i] = BASE_COLOUR.r / 255;        // R - light grey
                colors[i + 1] = BASE_COLOUR.g / 255;   // G - light grey
                colors[i + 2] = BASE_COLOUR.b / 255;   // B - light grey
            }
            geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
            console.log("🎨 Mesh color set to BASE_COLOUR (light grey)");

            geometry.computeBoundsTree?.();

            const material = new THREE.MeshStandardMaterial({
                vertexColors: true,
                roughness: 0.7,
                metalness: 0.1,
                flatShading: true,
            });
            console.log("🎨 Material created - vertexColors:", material.vertexColors, "wireframe:", material.wireframe);

            const mesh = new THREE.Mesh(geometry, material);
            console.log("🧩 Mesh created - geometry.vertices:", geometry.getAttribute('position')?.array?.length);

            geometry.computeBoundingBox();
            const box = geometry.boundingBox!;
            console.log("📦 Bounding box:", {
                min: {x: box.min.x, y: box.min.y, z: box.min.z},
                max: {x: box.max.x, y: box.max.y, z: box.max.z}
            });

            // Center the geometry vertices themselves
            const center = new THREE.Vector3();
            box.getCenter(center);
            console.log("📍 Geometry center:", {x: center.x, y: center.y, z: center.z});

            const posAttr = geometry.getAttribute("position") as THREE.BufferAttribute;
            const posArray = posAttr.array as Float32Array;
            for (let i = 0; i < posArray.length; i += 3) {
                posArray[i] -= center.x;
                posArray[i + 1] -= center.y;
                posArray[i + 2] -= center.z;
            }
            posAttr.needsUpdate = true;
            console.log("✅ Geometry vertices centered");

            // Recompute bounding box after centering
            geometry.computeBoundingBox();
            const newBox = geometry.boundingBox!;

            const size = new THREE.Vector3();
            newBox.getSize(size);
            console.log("📏 Bounding box size:", {x: size.x, y: size.y, z: size.z});
            const maxDim = Math.max(size.x, size.y, size.z);
            if (maxDim > 0) {
                const scale = 2 / maxDim;
                console.log("🔍 Scale factor:", scale, "maxDim:", maxDim);
                mesh.scale.setScalar(scale);
            }

            // Keep mesh at origin
            mesh.position.set(0, 0, 0);
            console.log("🎯 Mesh position set to (0, 0, 0)");

            sceneCenterRef.current.set(0, 0, 0);

            state.scene.add(mesh);
            state.mesh = mesh;
            state.faceCount = faceCount;
            console.log("🎯 Mesh added to scene - position:", mesh.position, "scale:", mesh.scale);
            console.log("🎥 Scene objects count:", state.scene.children.length);

            // Log world-space bounds
            const worldMin = new THREE.Vector3(
                newBox.min.x * mesh.scale.x + mesh.position.x,
                newBox.min.y * mesh.scale.y + mesh.position.y,
                newBox.min.z * mesh.scale.z + mesh.position.z
            );
            const worldMax = new THREE.Vector3(
                newBox.max.x * mesh.scale.x + mesh.position.x,
                newBox.max.y * mesh.scale.y + mesh.position.y,
                newBox.max.z * mesh.scale.z + mesh.position.z
            );
            console.log("🌍 Mesh world bounds - min:", {x: worldMin.x.toFixed(2), y: worldMin.y.toFixed(2), z: worldMin.z.toFixed(2)});
            console.log("🌍 Mesh world bounds - max:", {x: worldMax.x.toFixed(2), y: worldMax.y.toFixed(2), z: worldMax.z.toFixed(2)});

            const { theta, phi, zoom, roll } = cameraParamsRef.current;
            applyCameraPosition(state, theta, phi, zoom, roll);
            console.log("📷 Camera positioned at theta:", theta, "phi:", phi, "zoom:", zoom, "roll:", roll);
        },
        [],
    );

    /**
     * Updates the camera position using spherical coordinates for orbit control.
     * @param theta - Azimuth angle in radians (horizontal orbit)
     * @param phi - Elevation angle in radians (vertical orbit, clamped internally)
     * @param zoom - Camera distance from the scene center
     * @param roll - Roll angle in radians (rotation around view axis)
     */
    const updateCamera = useCallback(
        (theta: number, phi: number, zoom: number, roll: number = 0) => {
            cameraParamsRef.current = { theta, phi, zoom, roll };
            const state = stateRef.current;
            if (!state) return;
            applyCameraPosition(state, theta, phi, zoom, roll);
        },
        [],
    );

    /**
     * Updates the vertex colour buffer for the given face indices.
     * @param faceIndices - Array of face indices to repaint
     * @param rgb - Colour to apply (each channel 0-255)
     */
    const paintFaces = useCallback(
        (faceIndices: number[], rgb: { r: number; g: number; b: number }) => {
            const state = stateRef.current;
            if (!state?.mesh) return;

            const colorAttr = state.mesh.geometry.getAttribute("color") as THREE.BufferAttribute;
            const rNorm = rgb.r / 255;
            const gNorm = rgb.g / 255;
            const bNorm = rgb.b / 255;

            for (const faceIdx of faceIndices) {
                const baseVertex = faceIdx * 3;
                for (let v = 0; v < 3; v++) {
                    const vi = baseVertex + v;
                    colorAttr.setXYZ(vi, rNorm, gNorm, bNorm);
                }
            }

            colorAttr.needsUpdate = true;
        },
        [],
    );

    /**
     * Performs raycasting from NDC screen coordinates to identify which
     * triangle face (if any) was hit. Returns the face index and the
     * world-space intersection point (needed for brush-radius mode).
     * @param ndcX - Normalised device coordinate X [-1, 1]
     * @param ndcY - Normalised device coordinate Y [-1, 1]
     * @returns Object with faceIndex and point, or null if no hit
     */
    const raycastAtScreen = useCallback(
        (ndcX: number, ndcY: number): { faceIndex: number; point: THREE.Vector3 } | null => {
            const state = stateRef.current;
            if (!state?.mesh) return null;

            const raycaster = new THREE.Raycaster();
            raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), state.camera);

            const intersects = raycaster.intersectObject(state.mesh);
            if (intersects.length === 0) return null;

            const hit = intersects[0];
            if (hit.faceIndex === undefined) return null;

            return { faceIndex: hit.faceIndex, point: hit.point };
        },
        [],
    );

    /**
     * Finds all faces whose centroid falls within a given world-space radius
     * of a centre point. Used for brush-radius painting mode.
     * @param center - World-space centre point of the brush
     * @param radius - Brush radius in world-space units
     * @returns Array of face indices within the brush radius
     */
    const findFacesInRadius = useCallback(
        (center: THREE.Vector3, radius: number): number[] => {
            const state = stateRef.current;
            if (!state?.mesh) return [];

            const posAttr = state.mesh.geometry.getAttribute("position") as THREE.BufferAttribute;
            const results: number[] = [];
            const radiusSq = radius * radius;
            const centroid = new THREE.Vector3();
            const worldV = new THREE.Vector3();

            for (let f = 0; f < state.faceCount; f++) {
                centroid.set(0, 0, 0);
                for (let v = 0; v < 3; v++) {
                    const vi = f * 3 + v;
                    worldV.set(
                        posAttr.getX(vi),
                        posAttr.getY(vi),
                        posAttr.getZ(vi),
                    );
                    state.mesh.localToWorld(worldV);
                    centroid.add(worldV);
                }
                centroid.divideScalar(3);

                if (centroid.distanceToSquared(center) <= radiusSq) {
                    results.push(f);
                }
            }

            return results;
        },
        [],
    );

    /**
     * Cleans up the Three.js scene, stopping the render loop and disposing
     * GPU resources. Should be called when the component unmounts.
     */
    const dispose = useCallback(() => {
        const state = stateRef.current;
        if (!state) return;
        state.disposed = true;
        cancelAnimationFrame(state.frameId);

        if (state.mesh) {
            state.mesh.geometry.disposeBoundsTree?.();
            state.mesh.geometry.dispose();
            (state.mesh.material as THREE.Material).dispose();
        }
        state.renderer.dispose();
        stateRef.current = null;
    }, []);

    return {
        onContextCreate,
        loadMesh,
        updateCamera,
        paintFaces,
        raycastAtScreen,
        findFacesInRadius,
        dispose,
    };
}

/**
 * Positions the camera in spherical coordinates around the scene centre.
 * @param state - Current scene state
 * @param theta - Azimuth angle
 * @param phi - Elevation angle (clamped to allow full vertical range)
 * @param zoom - Distance from scene centre
 * @param roll - Roll angle around the view axis
 */
function applyCameraPosition(state: SceneState, theta: number, phi: number, zoom: number, roll: number = 0): void {
    // Allow wider phi range for better vertical control
    const clampedPhi = Math.max(-Math.PI * 0.45, Math.min(Math.PI * 0.45, phi));
    const pos = sphericalToCartesian(theta, clampedPhi, zoom);
    const center = new THREE.Vector3(0, 0, 0);
    state.camera.position.set(pos.x + center.x, pos.y + center.y, pos.z + center.z);
    state.camera.lookAt(center);

    // Apply roll rotation around the view axis (Z-axis from camera perspective)
    if (roll !== 0) {
        const viewDir = new THREE.Vector3();
        viewDir.subVectors(center, state.camera.position).normalize();
        state.camera.up.copy(new THREE.Vector3(0, 1, 0));
        state.camera.up.applyAxisAngle(viewDir, roll);
    }

    console.log("📷 Camera position set to:", {
        x: state.camera.position.x.toFixed(2),
        y: state.camera.position.y.toFixed(2),
        z: state.camera.position.z.toFixed(2),
    });
    console.log("👀 Camera looking at:", {x: center.x, y: center.y, z: center.z});
    const distToOrigin = state.camera.position.length();
    console.log("📏 Distance from camera to origin:", distToOrigin.toFixed(2), "(zoom:", zoom + ")");
}
