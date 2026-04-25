import { useLocalSearchParams, useRouter } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import * as FileSystem from "expo-file-system/legacy";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ColourPoint } from "@/src/colour/models/colourPoint";
import { SqliteColourPointRepository } from "@/src/colour/repositories/sqliteColourPointRepository";
import { SqliteInventoryRepository } from "@/src/inventory/repositories/sqliteInventoryRepository";
import { FacePaint } from "@/src/painter/models/facePaint";
import { SqliteFacePaintRepository } from "@/src/painter/repositories/sqliteFacePaintRepository";
import { SqlitePaintProjectRepository } from "@/src/painter/repositories/sqlitePaintProjectRepository";
import {
    BASE_COLOUR,
    FaceEntry,
    applyCoatToFaces,
} from "@/src/painter/services/facePaintService";
import { ParsedSTL, parseSTL } from "@/src/painter/services/stlLoaderService";
import { decimateMesh } from "@/src/painter/services/meshDecimationService";
import {
    PaintPaletteSheet,
    PaletteColour,
} from "@/src/painter/ui/components/paint-palette-sheet";
import {
    PaintMode,
    StlPainterCanvas,
} from "@/src/painter/ui/components/stl-painter-canvas";
import { PainterToolbar } from "@/src/painter/ui/components/painter-toolbar";
import { useStlPainterScene } from "@/src/painter/ui/hooks/use-stl-painter-scene";
import { IconSymbol } from "@/src/ui/components/icon-symbol";
import { AppColors } from "@/src/ui/constants/theme";

const MAX_FACES_BEFORE_DECIMATE = 500_000;

/**
 * Main painter screen. Loads a saved project, reads the STL file,
 * renders it in 3D, and lets the user paint faces with inventory colours.
 * Auto-saves painted faces when leaving the screen.
 */
export default function PainterScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const db = useSQLiteContext();
    const router = useRouter();
    const insets = useSafeAreaInsets();

    const projectRepo = useMemo(() => new SqlitePaintProjectRepository(db), [db]);
    const facePaintRepo = useMemo(() => new SqliteFacePaintRepository(db), [db]);
    const colourRepo = useMemo(() => new SqliteColourPointRepository(db), [db]);
    const inventoryRepo = useMemo(() => new SqliteInventoryRepository(db), [db]);

    const [loading, setLoading] = useState(true);
    const [projectName, setProjectName] = useState("");
    const [parsedSTL, setParsedSTL] = useState<ParsedSTL | null>(null);
    const [paletteColours, setPaletteColours] = useState<PaletteColour[]>([]);
    const [activePaint, setActivePaint] = useState<PaletteColour | null>(null);
    const [paintMode, setPaintMode] = useState<PaintMode>("tap");
    const [brushRadius, setBrushRadius] = useState(0.15);
    const [showPalette, setShowPalette] = useState(false);

    const facePaintsRef = useRef<Map<number, FaceEntry>>(new Map());
    const projectIdRef = useRef(id);
    const sceneRef = useRef<ReturnType<typeof useStlPainterScene> | null>(null);
    const dirtyFacesRef = useRef<Set<number>>(new Set());

    useEffect(() => {
        loadProject();
        loadPalette();
    }, []);

    /**
     * Loads the project metadata, reads and parses the STL file, and
     * restores any previously saved face paints onto the mesh.
     */
    async function loadProject() {
        try {
            console.log("📂 Loading project with id:", id);
            const project = await projectRepo.findById(id);
            if (!project) {
                console.error("❌ Project not found");
                Alert.alert("Error", "Project not found");
                router.back();
                return;
            }
            console.log("✅ Project found:", project.name, "STL URI:", project.stl_uri);
            setProjectName(project.name);

            const fileInfo = await FileSystem.getInfoAsync(project.stl_uri);
            if (!fileInfo.exists) {
                console.error("❌ STL file not found at:", project.stl_uri);
                Alert.alert("Error", "STL file not found");
                router.back();
                return;
            }
            console.log("✅ STL file exists, size:", fileInfo.size, "bytes");

            const base64 = await FileSystem.readAsStringAsync(project.stl_uri, {
                encoding: FileSystem.EncodingType.Base64,
            });
            console.log("📖 Read base64, length:", base64.length);
            const binaryStr = atob(base64);
            const bytes = new Uint8Array(binaryStr.length);
            for (let i = 0; i < binaryStr.length; i++) {
                bytes[i] = binaryStr.charCodeAt(i);
            }
            const buffer = bytes.buffer;
            console.log("🔄 Converted to buffer, size:", buffer.byteLength, "bytes");

            let stl = parseSTL(buffer);
            console.log("✅ STL parsed - faceCount:", stl.faceCount, "positions:", stl.positions.length, "normals:", stl.normals.length);

            // Decimation disabled to preserve full STL detail
            // if (stl.faceCount > MAX_FACES_BEFORE_DECIMATE) {
            //     const decimated = decimateMesh(
            //         stl.positions,
            //         stl.normals,
            //         MAX_FACES_BEFORE_DECIMATE,
            //     );
            //     stl = decimated;
            // }

            console.log("🎨 Calling setParsedSTL with faceCount:", stl.faceCount);
            setParsedSTL(stl);

            const savedFaces = await facePaintRepo.findByProjectId(id);
            console.log("💾 Loaded", savedFaces.length, "previously painted faces");
            const faceMap = new Map<number, FaceEntry>();
            for (const fp of savedFaces) {
                faceMap.set(fp.face_index, {
                    r: fp.r,
                    g: fp.g,
                    b: fp.b,
                    coatCount: fp.coat_count,
                });
            }
            facePaintsRef.current = faceMap;

            // Restored colours will be applied once the scene loads the mesh
            // via a timeout to give the GL context time to initialise
            setTimeout(() => {
                if (sceneRef.current && faceMap.size > 0) {
                    for (const [faceIdx, entry] of faceMap) {
                        sceneRef.current.paintFaces([faceIdx], {
                            r: entry.r,
                            g: entry.g,
                            b: entry.b,
                        });
                    }
                }
            }, 500);

            setLoading(false);
            console.log("✅ Project loaded successfully");
        } catch (e) {
            console.error("❌ Project load error:", e);
            Alert.alert("Error", `Failed to load project: ${String(e)}`);
            router.back();
        }
    }

    /**
     * Loads inventory colours from the database to populate the palette.
     */
    async function loadPalette() {
        const [colours, inventories] = await Promise.all([
            colourRepo.findAll(),
            inventoryRepo.findAll(),
        ]);
        const inventoryColourIds = new Set(inventories.map((i) => i.colour_id));
        const palette: PaletteColour[] = colours
            .filter((c) => inventoryColourIds.has(c.id))
            .map((c) => ({
                id: c.id,
                name: c.name,
                brand: c.brand,
                r: c.rgb.r,
                g: c.rgb.g,
                b: c.rgb.b,
            }));
        setPaletteColours(palette);
        if (palette.length > 0 && !activePaint) {
            setActivePaint(palette[0]);
        }
    }

    /**
     * Handles painting faces by applying a coat of the active paint colour
     * using Mixbox blending, then updating the 3D mesh vertex colours.
     * @param faceIndices - Array of face indices to paint
     */
    const handlePaintFaces = useCallback(
        (faceIndices: number[]) => {
            if (!activePaint) {
                setShowPalette(true);
                return;
            }

            const paintRgb = { r: activePaint.r, g: activePaint.g, b: activePaint.b };
            const updated = applyCoatToFaces(facePaintsRef.current, faceIndices, paintRgb);

            if (sceneRef.current) {
                for (const [faceIdx, entry] of updated) {
                    sceneRef.current.paintFaces([faceIdx], {
                        r: entry.r,
                        g: entry.g,
                        b: entry.b,
                    });
                }
            }

            for (const idx of updated.keys()) {
                dirtyFacesRef.current.add(idx);
            }
        },
        [activePaint],
    );

    /**
     * Saves all dirty (changed) face paint entries to the database.
     */
    const saveProject = useCallback(async () => {
        const dirtyIndices = Array.from(dirtyFacesRef.current);
        if (dirtyIndices.length === 0) return;

        const facePaintsToSave: FacePaint[] = dirtyIndices
            .map((idx) => {
                const entry = facePaintsRef.current.get(idx);
                if (!entry) return null;
                return FacePaint.create(
                    projectIdRef.current,
                    idx,
                    Math.round(entry.r),
                    Math.round(entry.g),
                    Math.round(entry.b),
                    entry.coatCount,
                );
            })
            .filter((fp): fp is FacePaint => fp !== null);

        await facePaintRepo.upsertMany(facePaintsToSave);

        const project = await projectRepo.findById(projectIdRef.current);
        if (project) {
            project.updated_at = Date.now();
            await projectRepo.update(project);
        }

        dirtyFacesRef.current.clear();
    }, [facePaintRepo, projectRepo]);

    /**
     * Resets all painted faces back to the base colour and clears
     * saved face paints from the database.
     */
    const handleReset = useCallback(() => {
        Alert.alert("Reset Paint", "Remove all paint from this model?", [
            { text: "Cancel", style: "cancel" },
            {
                text: "Reset",
                style: "destructive",
                onPress: async () => {
                    if (sceneRef.current) {
                        const allFaces = Array.from(facePaintsRef.current.keys());
                        sceneRef.current.paintFaces(allFaces, BASE_COLOUR);
                    }
                    facePaintsRef.current.clear();
                    dirtyFacesRef.current.clear();
                    await facePaintRepo.deleteByProjectId(projectIdRef.current);
                },
            },
        ]);
    }, [facePaintRepo]);

    const handleBack = useCallback(async () => {
        await saveProject();
        router.back();
    }, [saveProject, router]);

    if (loading) {
        return (
            <View style={styles.loadingScreen}>
                <ActivityIndicator size="large" color={AppColors.interactive} />
                <Text style={styles.loadingText}>Loading model...</Text>
            </View>
        );
    }

    return (
        <View style={styles.screen}>
            <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
                <Pressable style={styles.backBtn} onPress={handleBack}>
                    <IconSymbol name="chevron.left" size={20} color={AppColors.text} />
                </Pressable>
                <Text style={styles.headerTitle} numberOfLines={1}>
                    {projectName}
                </Text>
                <Pressable style={styles.saveBtn} onPress={saveProject}>
                    <IconSymbol name="square.and.arrow.down" size={20} color={AppColors.interactive} />
                </Pressable>
            </View>

            <View style={styles.canvasContainer}>
                <StlPainterCanvas
                    parsedSTL={parsedSTL}
                    paintMode={paintMode}
                    brushRadius={brushRadius}
                    onPaintFaces={handlePaintFaces}
                    sceneRef={sceneRef}
                />
                <PainterToolbar
                    paintMode={paintMode}
                    onToggleMode={() =>
                        setPaintMode((m) => (m === "tap" ? "brush" : "tap"))
                    }
                    brushRadius={brushRadius}
                    onBrushRadiusChange={setBrushRadius}
                    activePaintColour={
                        activePaint
                            ? { r: activePaint.r, g: activePaint.g, b: activePaint.b }
                            : null
                    }
                    onOpenPalette={() => setShowPalette(true)}
                    onResetPaint={handleReset}
                />
            </View>

            <PaintPaletteSheet
                visible={showPalette}
                colours={paletteColours}
                selectedId={activePaint?.id ?? null}
                onSelect={(c) => {
                    setActivePaint(c);
                    setShowPalette(false);
                }}
                onClose={() => setShowPalette(false)}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: AppColors.bg },
    loadingScreen: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: AppColors.bg,
    },
    loadingText: {
        marginTop: 16,
        fontSize: 14,
        color: AppColors.text,
    },
    header: {
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 12,
        paddingBottom: 8,
        backgroundColor: AppColors.surface,
        borderBottomWidth: 1,
        borderBottomColor: AppColors.border,
    },
    backBtn: {
        width: 36,
        height: 36,
        justifyContent: "center",
        alignItems: "center",
    },
    headerTitle: {
        flex: 1,
        fontSize: 17,
        fontWeight: "600",
        color: AppColors.text,
        textAlign: "center",
    },
    saveBtn: {
        width: 36,
        height: 36,
        justifyContent: "center",
        alignItems: "center",
    },
    canvasContainer: { flex: 1, position: "relative" },
});
