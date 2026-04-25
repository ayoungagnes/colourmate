import React, { useCallback, useEffect, useRef } from "react";
import { StyleSheet, View } from "react-native";
import { GLView } from "expo-gl";
import { Gesture, GestureDetector } from "react-native-gesture-handler";

import { screenToNDC } from "../../../colour/services/munsellSceneService";
import { useStlPainterScene } from "../hooks/use-stl-painter-scene";
import { ParsedSTL } from "../../services/stlLoaderService";

const INITIAL_THETA = Math.PI / 4;
const INITIAL_PHI = Math.PI / 6;
const INITIAL_ZOOM = 8;  // Increased from 3 to move camera further back
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 10;
const ORBIT_SENSITIVITY = 0.005;

export type PaintMode = "tap" | "brush";

interface StlPainterCanvasProps {
    parsedSTL: ParsedSTL | null;
    paintMode: PaintMode;
    brushRadius: number;
    onPaintFaces: (faceIndices: number[]) => void;
    sceneRef?: React.MutableRefObject<ReturnType<typeof useStlPainterScene> | null>;
}

/**
 * 3D viewport component for STL painting. Wraps a GLView with gesture handlers
 * for orbit (pan), zoom (pinch), and painting (tap or brush drag).
 * @param parsedSTL - Parsed STL geometry to render
 * @param paintMode - Current painting mode ("tap" for single face, "brush" for radius)
 * @param brushRadius - Brush radius in world-space units (used in brush mode)
 * @param onPaintFaces - Callback invoked with face indices to paint
 * @param sceneRef - Optional ref to expose scene methods to parent
 */
export function StlPainterCanvas({
    parsedSTL,
    paintMode,
    brushRadius,
    onPaintFaces,
    sceneRef,
}: StlPainterCanvasProps) {
    const scene = useStlPainterScene();
    const { onContextCreate, loadMesh, updateCamera, raycastAtScreen, findFacesInRadius, dispose } = scene;

    const thetaRef = useRef(INITIAL_THETA);
    const phiRef = useRef(INITIAL_PHI);
    const zoomRef = useRef(INITIAL_ZOOM);
    const rollRef = useRef(0);
    const savedThetaRef = useRef(INITIAL_THETA);
    const savedPhiRef = useRef(INITIAL_PHI);
    const savedZoomRef = useRef(INITIAL_ZOOM);
    const savedRollRef = useRef(0);
    const layoutRef = useRef({ width: 0, height: 0 });

    useEffect(() => {
        if (sceneRef) sceneRef.current = scene;
    }, [scene, sceneRef]);

    useEffect(() => {
        if (parsedSTL) {
            console.log("🎨 Canvas useEffect: parsedSTL available, scheduling mesh load in 100ms");
            // Give the GL context time to initialize (onContextCreate needs to run first)
            const timer = setTimeout(() => {
                console.log("⏱️ 100ms timeout complete, calling loadMesh now");
                loadMesh(parsedSTL.positions, parsedSTL.normals, parsedSTL.faceCount);
            }, 100);
            return () => clearTimeout(timer);
        } else {
            console.log("⚠️ Canvas useEffect: parsedSTL is null");
        }
    }, [parsedSTL, loadMesh]);

    useEffect(() => {
        return () => dispose();
    }, [dispose]);

    const handlePaint = useCallback(
        (screenX: number, screenY: number) => {
            const { width, height } = layoutRef.current;
            if (width === 0 || height === 0) return;

            const ndc = screenToNDC(screenX, screenY, width, height);
            const hit = raycastAtScreen(ndc.x, ndc.y);
            if (!hit) return;

            if (paintMode === "tap") {
                onPaintFaces([hit.faceIndex]);
            } else {
                const faces = findFacesInRadius(hit.point, brushRadius);
                if (faces.length > 0) onPaintFaces(faces);
            }
        },
        [paintMode, brushRadius, raycastAtScreen, findFacesInRadius, onPaintFaces],
    );

    const panGesture = Gesture.Pan()
        .runOnJS(true)
        .minPointers(paintMode === "brush" ? 2 : 1)
        .onBegin(() => {
            savedThetaRef.current = thetaRef.current;
            savedPhiRef.current = phiRef.current;
        })
        .onUpdate((event) => {
            thetaRef.current = savedThetaRef.current + event.translationX * ORBIT_SENSITIVITY;
            phiRef.current = savedPhiRef.current + event.translationY * ORBIT_SENSITIVITY;
            updateCamera(thetaRef.current, phiRef.current, zoomRef.current, rollRef.current);
        });

    const brushPanGesture = Gesture.Pan()
        .runOnJS(true)
        .maxPointers(1)
        .enabled(paintMode === "brush")
        .onUpdate((event) => {
            handlePaint(event.x, event.y);
        });

    const pinchGesture = Gesture.Pinch()
        .runOnJS(true)
        .onBegin(() => {
            savedZoomRef.current = zoomRef.current;
        })
        .onUpdate((event) => {
            const newZoom = savedZoomRef.current / event.scale;
            zoomRef.current = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, newZoom));
            updateCamera(thetaRef.current, phiRef.current, zoomRef.current, rollRef.current);
        });

    const rotationGesture = Gesture.Rotation()
        .runOnJS(true)
        .onBegin(() => {
            savedRollRef.current = rollRef.current;
        })
        .onUpdate((event) => {
            rollRef.current = savedRollRef.current + event.rotation;
            updateCamera(thetaRef.current, phiRef.current, zoomRef.current, rollRef.current);
        });

    const tapGesture = Gesture.Tap()
        .runOnJS(true)
        .onEnd((event) => {
            handlePaint(event.x, event.y);
        });

    const composedGesture =
        paintMode === "brush"
            ? Gesture.Race(
                  brushPanGesture,
                  Gesture.Simultaneous(panGesture, pinchGesture, rotationGesture),
              )
            : Gesture.Race(
                  tapGesture,
                  Gesture.Simultaneous(panGesture, pinchGesture, rotationGesture),
              );

    const handleLayout = useCallback(
        (e: { nativeEvent: { layout: { width: number; height: number } } }) => {
            layoutRef.current = {
                width: e.nativeEvent.layout.width,
                height: e.nativeEvent.layout.height,
            };
        },
        [],
    );

    return (
        <GestureDetector gesture={composedGesture}>
            <View style={styles.container} onLayout={handleLayout}>
                <GLView style={styles.gl} onContextCreate={onContextCreate} />
            </View>
        </GestureDetector>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    gl: { flex: 1 },
});
