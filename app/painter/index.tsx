import { useFocusEffect, useRouter } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import { useCallback, useMemo, useState } from "react";
import {
    Alert,
    FlatList,
    Pressable,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { PaintProject } from "@/src/painter/models/paintProject";
import { SqlitePaintProjectRepository } from "@/src/painter/repositories/sqlitePaintProjectRepository";
import { IconSymbol } from "@/src/ui/components/icon-symbol";
import { AppColors } from "@/src/ui/constants/theme";

/**
 * Project list screen for STL painter. Displays saved projects and lets
 * the user create new ones by picking an STL file from the device.
 */
export default function PaintProjectsScreen() {
    const db = useSQLiteContext();
    const projectRepo = useMemo(() => new SqlitePaintProjectRepository(db), [db]);
    const router = useRouter();
    const insets = useSafeAreaInsets();

    const [projects, setProjects] = useState<PaintProject[]>([]);

    const loadProjects = useCallback(async () => {
        const all = await projectRepo.findAll();
        setProjects(all);
    }, [projectRepo]);

    useFocusEffect(
        useCallback(() => {
            loadProjects();
        }, [loadProjects]),
    );

    /**
     * Opens the document picker for STL files, copies the file to app
     * storage, creates a new project, and navigates to the painter screen.
     */
    const handleNewProject = useCallback(async () => {
        try {
            const result = await DocumentPicker.getDocumentAsync({
                type: "*/*",
                copyToCacheDirectory: true,
            });

            if (result.canceled || result.assets.length === 0) return;

            const asset = result.assets[0];
            const fileName = asset.name || `model_${Date.now()}.stl`;

            if (!fileName.toLowerCase().endsWith(".stl")) {
                Alert.alert("Invalid file", "Please select an STL file.");
                return;
            }

            const destDir = `${FileSystem.documentDirectory}stl_models/`;
            await FileSystem.makeDirectoryAsync(destDir, { intermediates: true });
            const destUri = `${destDir}${Date.now()}_${fileName}`;
            await FileSystem.copyAsync({ from: asset.uri, to: destUri });

            const projectName = fileName.replace(/\.stl$/i, "");
            const project = PaintProject.create(projectName, destUri);
            await projectRepo.save(project);

            router.push({ pathname: "/painter/[id]" as any, params: { id: project.id } });
        } catch (e) {
            Alert.alert("Error", `Failed to create project: ${String(e)}`);
        }
    }, [projectRepo, router]);

    /**
     * Confirms and deletes a project along with its STL file.
     * @param project - The project to delete
     */
    const handleDelete = useCallback(
        (project: PaintProject) => {
            Alert.alert(
                "Delete Project",
                `Delete "${project.name}"? This cannot be undone.`,
                [
                    { text: "Cancel", style: "cancel" },
                    {
                        text: "Delete",
                        style: "destructive",
                        onPress: async () => {
                            try {
                                await projectRepo.delete(project.id);
                                await FileSystem.deleteAsync(project.stl_uri, { idempotent: true });
                            } catch {
                                // ignore file deletion errors
                            }
                            loadProjects();
                        },
                    },
                ],
            );
        },
        [projectRepo, loadProjects],
    );

    const renderItem = ({ item }: { item: PaintProject }) => {
        const date = new Date(item.updated_at);
        const dateStr = date.toLocaleDateString();
        return (
            <Pressable
                style={styles.projectCard}
                onPress={() =>
                    router.push({ pathname: "/painter/[id]" as any, params: { id: item.id } })
                }
                onLongPress={() => handleDelete(item)}
            >
                <View style={styles.projectIcon}>
                    <IconSymbol name="cube.fill" size={28} color={AppColors.interactive} />
                </View>
                <View style={styles.projectInfo}>
                    <Text style={styles.projectName} numberOfLines={1}>
                        {item.name}
                    </Text>
                    <Text style={styles.projectDate}>{dateStr}</Text>
                </View>
                <IconSymbol name="chevron.right" size={16} color={AppColors.muted} />
            </Pressable>
        );
    };

    return (
        <View style={[styles.screen, { paddingTop: insets.top }]}>
            <Text style={styles.title}>Paint Projects</Text>

            <Pressable style={styles.newBtn} onPress={handleNewProject}>
                <IconSymbol name="plus.circle.fill" size={22} color={AppColors.interactive} />
                <Text style={styles.newBtnText}>New Project</Text>
            </Pressable>

            <FlatList
                data={projects}
                keyExtractor={(item) => item.id}
                renderItem={renderItem}
                contentContainerStyle={styles.list}
                ListEmptyComponent={
                    <Text style={styles.empty}>
                        No projects yet. Tap "New Project" to load an STL file.
                    </Text>
                }
            />
        </View>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: AppColors.bg },
    title: {
        fontSize: 22,
        fontWeight: "700",
        textAlign: "center",
        paddingTop: 16,
        paddingBottom: 12,
        color: AppColors.text,
    },
    newBtn: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        marginHorizontal: 16,
        marginBottom: 12,
        paddingVertical: 14,
        backgroundColor: AppColors.card,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: AppColors.border,
    },
    newBtnText: {
        fontSize: 16,
        fontWeight: "600",
        color: AppColors.interactive,
    },
    list: { paddingHorizontal: 16, paddingBottom: 24 },
    projectCard: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: AppColors.card,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: AppColors.border,
        padding: 14,
        marginBottom: 10,
        gap: 12,
    },
    projectIcon: {
        width: 48,
        height: 48,
        borderRadius: 12,
        backgroundColor: AppColors.surface,
        justifyContent: "center",
        alignItems: "center",
    },
    projectInfo: { flex: 1 },
    projectName: { fontSize: 16, fontWeight: "600", color: AppColors.text },
    projectDate: { fontSize: 12, color: AppColors.muted, marginTop: 2 },
    empty: {
        textAlign: "center",
        color: AppColors.muted,
        marginTop: 40,
        fontSize: 14,
    },
});
