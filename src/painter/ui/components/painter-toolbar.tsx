import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { AppColors } from "../../../ui/constants/theme";
import { IconSymbol } from "../../../ui/components/icon-symbol";
import { PaintMode } from "./stl-painter-canvas";

interface PainterToolbarProps {
    paintMode: PaintMode;
    onToggleMode: () => void;
    brushRadius: number;
    onBrushRadiusChange: (value: number) => void;
    activePaintColour: { r: number; g: number; b: number } | null;
    onOpenPalette: () => void;
    onResetPaint: () => void;
}

/**
 * Toolbar overlay for the painting screen. Shows the active paint colour,
 * mode toggle (tap vs brush), brush size slider, palette button, and reset.
 * @param paintMode - Current painting mode
 * @param onToggleMode - Callback to toggle between tap and brush mode
 * @param brushRadius - Current brush radius value
 * @param onBrushRadiusChange - Callback when brush slider changes
 * @param activePaintColour - Currently selected paint RGB or null
 * @param onOpenPalette - Callback to open the colour palette sheet
 * @param onResetPaint - Callback to reset all paint on the model
 */
export function PainterToolbar({
    paintMode,
    onToggleMode,
    brushRadius,
    onBrushRadiusChange,
    activePaintColour,
    onOpenPalette,
    onResetPaint,
}: PainterToolbarProps) {
    const activeBg = activePaintColour
        ? `rgb(${activePaintColour.r}, ${activePaintColour.g}, ${activePaintColour.b})`
        : AppColors.muted;

    return (
        <View style={styles.container}>
            <View style={styles.row}>
                <Pressable style={styles.paletteBtn} onPress={onOpenPalette}>
                    <View style={[styles.activeColourSwatch, { backgroundColor: activeBg }]} />
                    <Text style={styles.btnText}>Palette</Text>
                </Pressable>

                <Pressable
                    style={[styles.modeBtn, paintMode === "brush" && styles.modeBtnActive]}
                    onPress={onToggleMode}
                >
                    <IconSymbol
                        name={paintMode === "tap" ? "hand.tap" : "paintbrush.pointed"}
                        size={18}
                        color={paintMode === "brush" ? AppColors.interactive : AppColors.text}
                    />
                    <Text style={[styles.btnText, paintMode === "brush" && styles.btnTextActive]}>
                        {paintMode === "tap" ? "Tap" : "Brush"}
                    </Text>
                </Pressable>

                <Pressable style={styles.resetBtn} onPress={onResetPaint}>
                    <IconSymbol name="arrow.counterclockwise" size={18} color={AppColors.action} />
                    <Text style={[styles.btnText, { color: AppColors.action }]}>Reset</Text>
                </Pressable>
            </View>

            {paintMode === "brush" && (
                <View style={styles.brushSizeContainer}>
                    <Text style={styles.sliderLabel}>Size</Text>
                    <SliderComponent
                        value={brushRadius}
                        onValueChange={onBrushRadiusChange}
                        minimumValue={0.05}
                        maximumValue={0.5}
                        step={0.01}
                    />
                    <Text style={styles.sliderValue}>{brushRadius.toFixed(2)}</Text>
                </View>
            )}
        </View>
    );
}

/**
 * Simple stepper component for adjusting the brush radius.
 * @param value - Current value
 * @param onValueChange - Callback when value changes
 * @param minimumValue - Minimum allowed value
 * @param maximumValue - Maximum allowed value
 * @param step - Increment/decrement step size
 */
function SliderComponent({
    value,
    onValueChange,
    minimumValue,
    maximumValue,
    step,
}: {
    value: number;
    onValueChange: (v: number) => void;
    minimumValue: number;
    maximumValue: number;
    step: number;
}) {
    return (
        <View style={styles.fallbackSlider}>
            <Pressable onPress={() => onValueChange(Math.max(minimumValue, value - step))}>
                <Text style={styles.fallbackBtn}>-</Text>
            </Pressable>
            <Text style={styles.fallbackValue}>{value.toFixed(2)}</Text>
            <Pressable onPress={() => onValueChange(Math.min(maximumValue, value + step))}>
                <Text style={styles.fallbackBtn}>+</Text>
            </Pressable>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        position: "absolute",
        top: 16,
        left: 16,
        bottom: 16,
        backgroundColor: "rgba(15, 15, 26, 0.95)",
        borderRadius: 16,
        paddingVertical: 12,
        paddingHorizontal: 12,
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "flex-start",
        gap: 12,
        width: 70,
    },
    row: {
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "flex-start",
        gap: 12,
    },
    paletteBtn: {
        flexDirection: "column",
        alignItems: "center",
        gap: 6,
        paddingVertical: 10,
        paddingHorizontal: 8,
        backgroundColor: AppColors.card,
        borderRadius: 10,
        width: "100%",
    },
    activeColourSwatch: {
        width: 36,
        height: 36,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: AppColors.border,
    },
    modeBtn: {
        flexDirection: "column",
        alignItems: "center",
        gap: 4,
        paddingVertical: 10,
        paddingHorizontal: 8,
        backgroundColor: AppColors.card,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: "transparent",
        width: "100%",
    },
    modeBtnActive: {
        borderColor: AppColors.interactive,
    },
    resetBtn: {
        flexDirection: "column",
        alignItems: "center",
        gap: 4,
        paddingVertical: 10,
        paddingHorizontal: 8,
        backgroundColor: AppColors.card,
        borderRadius: 10,
        width: "100%",
    },
    btnText: {
        fontSize: 11,
        fontWeight: "600",
        color: AppColors.text,
        textAlign: "center",
    },
    btnTextActive: {
        color: AppColors.interactive,
    },
    brushSizeContainer: {
        flexDirection: "column",
        alignItems: "center",
        marginTop: 12,
        gap: 6,
        width: "100%",
        backgroundColor: AppColors.card,
        borderRadius: 10,
        paddingVertical: 10,
        paddingHorizontal: 8,
    },
    sliderLabel: {
        fontSize: 11,
        color: AppColors.muted,
        fontWeight: "500",
    },
    sliderContainer: {
        flex: 1,
    },
    sliderValue: {
        fontSize: 11,
        color: AppColors.text,
        fontWeight: "500",
        textAlign: "center",
    },
    fallbackSlider: {
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 16,
    },
    fallbackBtn: {
        fontSize: 22,
        color: AppColors.interactive,
        fontWeight: "700",
        paddingHorizontal: 12,
    },
    fallbackValue: {
        fontSize: 14,
        color: AppColors.text,
    },
});
