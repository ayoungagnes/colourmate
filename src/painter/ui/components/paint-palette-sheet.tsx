import React from "react";
import {
    FlatList,
    Modal,
    Pressable,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppColors } from "../../../ui/constants/theme";

export interface PaletteColour {
    id: string;
    name: string;
    brand: string;
    r: number;
    g: number;
    b: number;
}

interface PaintPaletteSheetProps {
    visible: boolean;
    colours: PaletteColour[];
    selectedId: string | null;
    onSelect: (colour: PaletteColour) => void;
    onClose: () => void;
}

/**
 * Bottom sheet modal displaying inventory colours as a scrollable grid.
 * Tap a colour to select it as the active paint. The currently selected
 * colour is shown with a highlight border.
 * @param visible - Whether the sheet is visible
 * @param colours - Array of available paint colours from inventory
 * @param selectedId - ID of the currently selected paint colour
 * @param onSelect - Callback when a colour is tapped
 * @param onClose - Callback to close the sheet
 */
export function PaintPaletteSheet({
    visible,
    colours,
    selectedId,
    onSelect,
    onClose,
}: PaintPaletteSheetProps) {
    const insets = useSafeAreaInsets();

    const renderItem = ({ item }: { item: PaletteColour }) => {
        const isSelected = item.id === selectedId;
        const bg = `rgb(${item.r}, ${item.g}, ${item.b})`;
        return (
            <Pressable
                style={[styles.colourCell, isSelected && styles.colourCellSelected]}
                onPress={() => onSelect(item)}
            >
                <View style={[styles.swatch, { backgroundColor: bg }]} />
                <Text style={styles.colourName} numberOfLines={1}>
                    {item.name}
                </Text>
            </Pressable>
        );
    };

    return (
        <Modal
            visible={visible}
            transparent
            animationType="slide"
            onRequestClose={onClose}
        >
            <Pressable style={styles.backdrop} onPress={onClose} />
            <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
                <View style={styles.handle} />
                <Text style={styles.title}>Paint Palette</Text>
                {colours.length === 0 ? (
                    <Text style={styles.empty}>
                        No colours in inventory. Add some from the Inventory tab.
                    </Text>
                ) : (
                    <FlatList
                        data={colours}
                        keyExtractor={(item) => item.id}
                        renderItem={renderItem}
                        numColumns={4}
                        columnWrapperStyle={styles.row}
                        contentContainerStyle={styles.list}
                    />
                )}
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    backdrop: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.5)",
    },
    sheet: {
        backgroundColor: AppColors.surface,
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        paddingTop: 12,
        paddingHorizontal: 16,
        maxHeight: "60%",
    },
    handle: {
        width: 40,
        height: 4,
        borderRadius: 2,
        backgroundColor: AppColors.muted,
        alignSelf: "center",
        marginBottom: 12,
    },
    title: {
        fontSize: 18,
        fontWeight: "700",
        color: AppColors.text,
        textAlign: "center",
        marginBottom: 12,
    },
    empty: {
        fontSize: 14,
        color: AppColors.muted,
        textAlign: "center",
        paddingVertical: 24,
    },
    list: {
        paddingBottom: 8,
    },
    row: {
        gap: 10,
        marginBottom: 10,
    },
    colourCell: {
        flex: 1,
        alignItems: "center",
        backgroundColor: AppColors.card,
        borderRadius: 10,
        borderWidth: 2,
        borderColor: "transparent",
        padding: 6,
    },
    colourCellSelected: {
        borderColor: AppColors.interactive,
    },
    swatch: {
        width: "100%",
        aspectRatio: 1,
        borderRadius: 8,
        marginBottom: 4,
    },
    colourName: {
        fontSize: 11,
        color: AppColors.text,
        textAlign: "center",
    },
});
