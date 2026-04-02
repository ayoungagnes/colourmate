import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ColourPoint } from '@/src/colour/models/colourPoint';
import { convertSRGBToOKLCH } from '@/src/colour/services/colourConversion';
import { filterColours } from '@/src/colour/services/colourQueryService';
import { deriveMunsellLikeFromOKLCH } from '@/src/colour/services/deriveMunsellFromOklch';
import { munsellLikeToXYZ } from '@/src/colour/services/munsellToXYZ';
import {
  MixSuggestion,
  findBestMix,
  mixPaints,
  mixTwoPaints,
  munsellXYZDistance,
  PaintInput,
} from '@/src/colour/services/paintMixService';
import { RGB } from '@/src/colour/ui/types';
import { IconSymbol } from '@/src/ui/components/icon-symbol';

interface SelectedPaint {
  id: string;
  parts: number;
}

const MAX_PAINTS = 4;
const MIN_PAINTS = 2;
const MIN_PARTS = 1;
const MAX_PARTS = 5;

/**
 * Converts RGB values to a hex colour string.
 * @param r - Red channel (0–255)
 * @param g - Green channel (0–255)
 * @param b - Blue channel (0–255)
 * @returns Uppercase hex colour string (e.g. "#FF00AA")
 */
function toHex(r: number, g: number, b: number) {
  return '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0').toUpperCase()).join('');
}

/**
 * Normalises an array of integer parts into concentration weights summing to 1.0.
 * @param parts - Array of integer part values
 * @returns Array of normalised concentrations
 */
function partsToConcentrations(parts: number[]): number[] {
  const total = parts.reduce((s, p) => s + p, 0);
  if (total === 0) return parts.map(() => 1 / parts.length);
  return parts.map((p) => p / total);
}

export function MixSheet({
  visible,
  goal,
  allColours,
  inventoryIds,
  onClose,
}: {
  visible: boolean;
  goal: ColourPoint;
  allColours: ColourPoint[];
  inventoryIds: Set<string>;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [search, setSearch] = useState('');
  const [selectedPaints, setSelectedPaints] = useState<SelectedPaint[]>([]);
  const [activeSelectorIndex, setActiveSelectorIndex] = useState<number | null>(null);
  const [computing, setComputing] = useState(false);
  const [filterBrands, setFilterBrands] = useState<Set<string>>(new Set());
  const [filterInventoryOnly, setFilterInventoryOnly] = useState(false);

  const allColoursRef = useRef(allColours);
  allColoursRef.current = allColours;
  const goalRef = useRef(goal);
  goalRef.current = goal;
  const filterBrandsRef = useRef(filterBrands);
  filterBrandsRef.current = filterBrands;
  const filterInventoryOnlyRef = useRef(filterInventoryOnly);
  filterInventoryOnlyRef.current = filterInventoryOnly;
  const inventoryIdsRef = useRef(inventoryIds);
  inventoryIdsRef.current = inventoryIds;
  const visibleRef = useRef(visible);
  visibleRef.current = visible;

  /**
   * Runs auto-suggest to find the best paint combination for the goal colour.
   * Pre-filters candidates by distance, then delegates to findBestMix.
   */
  const runAutoSuggest = useCallback(() => {
    const g = goalRef.current;
    const colours = filterColours(
      allColoursRef.current.filter((c) => c.id !== g.id),
      { search: '', brands: filterBrandsRef.current, inInventoryOnly: filterInventoryOnlyRef.current },
      inventoryIdsRef.current,
    );
    if (colours.length < 2) return;
    setComputing(true);
    setTimeout(() => {
      const xyzOf = (rgb: RGB) =>
        munsellLikeToXYZ(deriveMunsellLikeFromOKLCH(convertSRGBToOKLCH(rgb)));
      const candidates = colours
        .map((c) => ({ c, d: munsellXYZDistance(c.coordinate, g.coordinate) }))
        .sort((a, b) => a.d - b.d)
        .slice(0, 15)
        .map(({ c }) => c);
      const suggestion = findBestMix(candidates, g.coordinate, xyzOf);
      if (suggestion) {
        applySuggestion(suggestion);
      }
      setComputing(false);
    }, 0);
  }, []);

  /**
   * Applies a MixSuggestion to the selected paints state, converting
   * concentrations back to integer parts (1–5 scale).
   * @param suggestion - The mix suggestion from findBestMix
   */
  const applySuggestion = (suggestion: MixSuggestion) => {
    const maxConc = Math.max(...suggestion.concentrations);
    const newPaints: SelectedPaint[] = suggestion.paintIds.map((id, idx) => {
      const rawParts = (suggestion.concentrations[idx] / maxConc) * MAX_PARTS;
      const parts = Math.max(MIN_PARTS, Math.round(rawParts));
      return { id, parts };
    });
    setSelectedPaints(newPaints);
  };

  useEffect(() => {
    if (!visible) {
      setSearch('');
      setSelectedPaints([]);
      setActiveSelectorIndex(null);
      setFilterBrands(new Set());
      setFilterInventoryOnly(false);
      return;
    }
    runAutoSuggest();
  }, [visible, runAutoSuggest]);

  useEffect(() => {
    if (visibleRef.current) runAutoSuggest();
  }, [filterBrands, filterInventoryOnly, runAutoSuggest]);

  const resolvedPaints = useMemo(
    () =>
      selectedPaints.map((sp) => ({
        ...sp,
        colour: allColours.find((c) => c.id === sp.id) ?? null,
      })),
    [allColours, selectedPaints],
  );

  const mixedRgb: RGB | null = useMemo(() => {
    const valid = resolvedPaints.filter((p) => p.colour !== null);
    if (valid.length < 2) return null;
    const inputs: PaintInput[] = valid.map((p) => ({ rgb: p.colour!.rgb }));
    const concentrations = partsToConcentrations(valid.map((p) => p.parts));
    return mixPaints(inputs, concentrations);
  }, [resolvedPaints]);

  const distanceToGoal = useMemo((): number | null => {
    if (!mixedRgb) return null;
    const mixXyz = munsellLikeToXYZ(deriveMunsellLikeFromOKLCH(convertSRGBToOKLCH(mixedRgb)));
    return munsellXYZDistance(mixXyz, goal.coordinate);
  }, [mixedRgb, goal]);

  const matchLabel = useMemo(() => {
    if (distanceToGoal === null) return null;
    if (distanceToGoal < 5) return { text: 'Excellent match', color: '#2a9d2a' };
    if (distanceToGoal < 15) return { text: 'Good match', color: '#4A90D9' };
    if (distanceToGoal < 30) return { text: 'Moderate match', color: '#e09a00' };
    return { text: 'Far off', color: '#cc3300' };
  }, [distanceToGoal]);

  const brands = useMemo(
    () => [...new Set(allColours.filter((c) => c.id !== goal.id).map((c) => c.brand))].sort(),
    [allColours, goal.id],
  );

  const filtered = useMemo(() => {
    const selectedIds = new Set(selectedPaints.map((sp) => sp.id));
    const base = allColours.filter((c) => c.id !== goal.id && !selectedIds.has(c.id));
    return filterColours(
      base,
      { search, brands: filterBrands, inInventoryOnly: filterInventoryOnly },
      inventoryIds,
    );
  }, [allColours, goal.id, selectedPaints, filterBrands, filterInventoryOnly, inventoryIds, search]);

  /**
   * Handles selecting a paint from the picker list into the active slot.
   * @param id - The ColourPoint id to select
   */
  const selectPaint = (id: string) => {
    if (activeSelectorIndex === null) return;
    setSelectedPaints((prev) => {
      const next = [...prev];
      if (activeSelectorIndex < next.length) {
        next[activeSelectorIndex] = { ...next[activeSelectorIndex], id };
      } else {
        next.push({ id, parts: 1 });
      }
      return next;
    });
    setActiveSelectorIndex(null);
    setSearch('');
  };

  /**
   * Opens the colour picker for a given paint slot index.
   * @param index - Index in the selectedPaints array
   */
  const openSelector = (index: number) => {
    setActiveSelectorIndex((prev) => (prev === index ? null : index));
    setSearch('');
  };

  /**
   * Removes a paint from the selected list at the given index.
   * @param index - Index of the paint to remove
   */
  const removePaint = (index: number) => {
    setSelectedPaints((prev) => prev.filter((_, i) => i !== index));
    setActiveSelectorIndex(null);
  };

  /**
   * Adjusts the parts value for a paint at the given index.
   * @param index - Index of the paint in selectedPaints
   * @param delta - Amount to add to current parts value
   */
  const adjustParts = (index: number, delta: number) => {
    setSelectedPaints((prev) =>
      prev.map((sp, i) => {
        if (i !== index) return sp;
        const newParts = Math.max(MIN_PARTS, Math.min(MAX_PARTS, sp.parts + delta));
        return { ...sp, parts: newParts };
      }),
    );
  };

  /**
   * Adds a new empty paint slot and opens the selector for it.
   */
  const addPaintSlot = () => {
    const newIndex = selectedPaints.length;
    setSelectedPaints((prev) => [...prev, { id: '', parts: 1 }]);
    setActiveSelectorIndex(newIndex);
    setSearch('');
  };

  const goalBg = `rgb(${goal.rgb.r}, ${goal.rgb.g}, ${goal.rgb.b})`;
  const mixBg = mixedRgb ? `rgb(${mixedRgb.r}, ${mixedRgb.g}, ${mixedRgb.b})` : null;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={ms.backdrop} onPress={onClose} />
      <View style={[ms.panel, { paddingBottom: insets.bottom + 16 }]}>
        <View style={ms.handle} />
        <View style={ms.titleRow}>
          <Text style={ms.title}>Mix to recreate</Text>
          <Pressable onPress={onClose}>
            <Text style={ms.closeBtn}>✕</Text>
          </Pressable>
        </View>

        {/* Goal */}
        <View style={ms.goalRow}>
          <View style={[ms.goalSwatch, { backgroundColor: goalBg }]} />
          <View style={ms.goalInfo}>
            <Text style={ms.goalHint}>Goal colour</Text>
            <Text style={ms.goalName}>{goal.name}</Text>
            <Text style={ms.goalBrand}>{goal.brand}</Text>
          </View>
          {matchLabel && (
            <View style={[ms.matchBadge, { borderColor: matchLabel.color, backgroundColor: matchLabel.color + '18' }]}>
              <Text style={[ms.matchBadgeText, { color: matchLabel.color }]}>{matchLabel.text}</Text>
            </View>
          )}
        </View>

        {/* Filter chips */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={ms.filterRow} contentContainerStyle={ms.filterRowContent}>
          <Pressable
            style={[ms.filterChip, filterInventoryOnly && ms.filterChipActive]}
            onPress={() => setFilterInventoryOnly((v) => !v)}
          >
            <Text style={[ms.filterChipText, filterInventoryOnly && ms.filterChipTextActive]}>In inventory</Text>
          </Pressable>
          {brands.map((brand) => {
            const active = filterBrands.has(brand);
            return (
              <Pressable
                key={brand}
                style={[ms.filterChip, active && ms.filterChipActive]}
                onPress={() =>
                  setFilterBrands((prev) => {
                    const next = new Set(prev);
                    active ? next.delete(brand) : next.add(brand);
                    return next;
                  })
                }
              >
                <Text style={[ms.filterChipText, active && ms.filterChipTextActive]}>{brand}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {computing ? (
          <View style={ms.computingRow}>
            <Text style={ms.computingText}>Finding best combination…</Text>
          </View>
        ) : (
          <ScrollView style={ms.scrollArea} showsVerticalScrollIndicator={false}>
            {/* Paint rows */}
            {resolvedPaints.map((rp, index) => {
              const bg = rp.colour ? `rgb(${rp.colour.rgb.r}, ${rp.colour.rgb.g}, ${rp.colour.rgb.b})` : null;
              const isActive = activeSelectorIndex === index;
              return (
                <View key={`paint-${index}`} style={ms.paintRow}>
                  <Pressable
                    style={[ms.paintSelector, isActive && ms.paintSelectorActive]}
                    onPress={() => openSelector(index)}
                  >
                    {bg ? (
                      <View style={[ms.paintSwatch, { backgroundColor: bg }]} />
                    ) : (
                      <View style={ms.paintSwatchEmpty}>
                        <Text style={ms.paintSwatchEmptyText}>{index + 1}</Text>
                      </View>
                    )}
                    <View style={ms.paintInfo}>
                      <Text style={ms.paintLabel}>Paint {index + 1}  (tap to change)</Text>
                      <Text style={ms.paintName} numberOfLines={1}>
                        {rp.colour ? rp.colour.name : 'Select…'}
                      </Text>
                      {rp.colour && (
                        <Text style={ms.paintBrand} numberOfLines={1}>{rp.colour.brand}</Text>
                      )}
                    </View>
                  </Pressable>

                  {/* Parts stepper */}
                  <View style={ms.partsStepper}>
                    <Pressable
                      style={[ms.partsBtn, rp.parts <= MIN_PARTS && ms.partsBtnDisabled]}
                      onPress={() => adjustParts(index, -1)}
                      disabled={rp.parts <= MIN_PARTS}
                    >
                      <Text style={[ms.partsBtnText, rp.parts <= MIN_PARTS && ms.partsBtnTextDisabled]}>−</Text>
                    </Pressable>
                    <Text style={ms.partsValue}>{rp.parts}</Text>
                    <Pressable
                      style={[ms.partsBtn, rp.parts >= MAX_PARTS && ms.partsBtnDisabled]}
                      onPress={() => adjustParts(index, 1)}
                      disabled={rp.parts >= MAX_PARTS}
                    >
                      <Text style={[ms.partsBtnText, rp.parts >= MAX_PARTS && ms.partsBtnTextDisabled]}>+</Text>
                    </Pressable>
                  </View>

                  {/* Remove button (only when more than MIN_PAINTS) */}
                  {selectedPaints.length > MIN_PAINTS && (
                    <Pressable style={ms.removeBtn} onPress={() => removePaint(index)}>
                      <Text style={ms.removeBtnText}>✕</Text>
                    </Pressable>
                  )}
                </View>
              );
            })}

            {/* Add paint button */}
            {selectedPaints.length < MAX_PAINTS && (
              <Pressable style={ms.addPaintBtn} onPress={addPaintSlot}>
                <Text style={ms.addPaintBtnText}>+ Add paint</Text>
              </Pressable>
            )}

            {/* Parts summary */}
            {resolvedPaints.filter((p) => p.colour).length >= 2 && (
              <Text style={ms.partsSummary}>
                {resolvedPaints
                  .filter((p) => p.colour)
                  .map((p) => `${p.parts} part${p.parts > 1 ? 's' : ''} ${p.colour!.name.split(' ')[0]}`)
                  .join('  ·  ')}
              </Text>
            )}

            {/* Mix result card */}
            {mixBg && mixedRgb && (
              <View style={ms.mixResultCard}>
                <View style={ms.resultCompareRow}>
                  <View style={ms.resultBlock}>
                    <View style={[ms.resultSwatch, { backgroundColor: mixBg }]} />
                    <Text style={ms.resultSwatchLabel}>Mix result</Text>
                    <Text style={ms.resultHex}>{toHex(mixedRgb.r, mixedRgb.g, mixedRgb.b)}</Text>
                  </View>
                  <IconSymbol name="arrow.right" size={16} color="#bbb" />
                  <View style={ms.resultBlock}>
                    <View style={[ms.resultSwatch, { backgroundColor: goalBg }]} />
                    <Text style={ms.resultSwatchLabel}>Goal</Text>
                    <Text style={ms.resultHex}>{toHex(goal.rgb.r, goal.rgb.g, goal.rgb.b)}</Text>
                  </View>
                </View>
              </View>
            )}

            {/* Colour picker list */}
            {activeSelectorIndex !== null && (
              <>
                <Text style={ms.sectionLabel}>Select paint {activeSelectorIndex + 1}:</Text>
                <TextInput
                  style={ms.searchInput}
                  value={search}
                  onChangeText={setSearch}
                  placeholder="Search colours..."
                  placeholderTextColor="#999"
                  autoFocus
                />
                <FlatList
                  data={filtered}
                  keyExtractor={(item) => item.id}
                  style={ms.list}
                  keyboardShouldPersistTaps="handled"
                  renderItem={({ item }) => {
                    const itemBg = `rgb(${item.rgb.r}, ${item.rgb.g}, ${item.rgb.b})`;
                    const isSelected = selectedPaints.some((sp) => sp.id === item.id);
                    return (
                      <Pressable
                        style={[ms.colourRow, isSelected && ms.colourRowActive]}
                        onPress={() => selectPaint(item.id)}
                      >
                        <View style={[ms.colourSwatch, { backgroundColor: itemBg }]} />
                        <View style={ms.colourInfo}>
                          <Text style={ms.colourName}>{item.name}</Text>
                          <Text style={ms.colourBrand}>{item.brand}</Text>
                        </View>
                        {inventoryIds.has(item.id) && (
                          <View style={ms.inStockBadge}>
                            <Text style={ms.inStockText}>In inventory</Text>
                          </View>
                        )}
                        {isSelected && <Text style={ms.colourCheck}>✓</Text>}
                      </Pressable>
                    );
                  }}
                />
              </>
            )}
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}

const ms = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
  panel: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 12,
    maxHeight: '90%',
  },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: '#ddd', alignSelf: 'center', marginBottom: 12 },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  title: { fontSize: 17, fontWeight: '700', color: '#111' },
  closeBtn: { fontSize: 18, color: '#888', padding: 4 },
  goalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#f8f8f8',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  goalSwatch: { width: 52, height: 52, borderRadius: 10 },
  goalInfo: { flex: 1 },
  goalHint: { fontSize: 11, color: '#888', marginBottom: 2 },
  goalName: { fontSize: 15, fontWeight: '700', color: '#111' },
  goalBrand: { fontSize: 12, color: '#888' },
  matchBadge: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  matchBadgeText: { fontSize: 11, fontWeight: '700' },
  scrollArea: { flexGrow: 0 },
  computingRow: { paddingVertical: 24, alignItems: 'center' },
  computingText: { fontSize: 14, color: '#888' },
  paintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  paintSelector: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  paintSelectorActive: { borderColor: '#4A90D9', backgroundColor: '#EBF3FD' },
  paintSwatch: { width: 36, height: 36, borderRadius: 8 },
  paintSwatchEmpty: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#ddd',
    justifyContent: 'center',
    alignItems: 'center',
  },
  paintSwatchEmptyText: { fontSize: 14, fontWeight: '700', color: '#999' },
  paintInfo: { flex: 1 },
  paintLabel: { fontSize: 10, color: '#888', marginBottom: 2 },
  paintName: { fontSize: 12, fontWeight: '600', color: '#111' },
  paintBrand: { fontSize: 11, color: '#888' },
  partsStepper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 10,
    paddingHorizontal: 4,
    paddingVertical: 4,
    gap: 2,
  },
  partsBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#e8e8e8',
    justifyContent: 'center',
    alignItems: 'center',
  },
  partsBtnDisabled: { backgroundColor: '#f0f0f0' },
  partsBtnText: { fontSize: 16, color: '#333', lineHeight: 20 },
  partsBtnTextDisabled: { color: '#ccc' },
  partsValue: { fontSize: 14, fontWeight: '700', color: '#333', minWidth: 20, textAlign: 'center' },
  removeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#f0e0e0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeBtnText: { fontSize: 12, color: '#cc3300', fontWeight: '700' },
  addPaintBtn: {
    borderWidth: 1.5,
    borderColor: '#ddd',
    borderStyle: 'dashed',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 10,
  },
  addPaintBtnText: { fontSize: 14, color: '#4A90D9', fontWeight: '600' },
  partsSummary: { fontSize: 12, color: '#666', textAlign: 'center', marginBottom: 10 },
  mixResultCard: {
    backgroundColor: '#f8f8f8',
    borderRadius: 12,
    padding: 12,
    gap: 10,
    marginBottom: 12,
  },
  resultCompareRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16 },
  resultBlock: { alignItems: 'center', gap: 4 },
  resultSwatch: { width: 56, height: 56, borderRadius: 10 },
  resultSwatchLabel: { fontSize: 11, color: '#888' },
  resultHex: { fontSize: 11, color: '#555', fontWeight: '500' },
  sectionLabel: { fontSize: 13, fontWeight: '600', color: '#888', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  searchInput: { borderWidth: 1, borderColor: '#ddd', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, fontSize: 14, backgroundColor: '#fff', marginBottom: 8 },
  list: { maxHeight: 200 },
  colourRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  colourRowActive: { backgroundColor: '#EBF3FD', borderRadius: 10, paddingHorizontal: 8 },
  colourSwatch: { width: 36, height: 36, borderRadius: 8 },
  colourInfo: { flex: 1 },
  colourName: { fontSize: 14, fontWeight: '500', color: '#111' },
  colourBrand: { fontSize: 12, color: '#888' },
  colourCheck: { fontSize: 16, color: '#4A90D9', fontWeight: '700' },
  inStockBadge: { backgroundColor: '#EBF3FD', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1, borderColor: '#4A90D9' },
  inStockText: { fontSize: 11, color: '#4A90D9', fontWeight: '600' },
  filterRow: { maxHeight: 40, marginBottom: 8 },
  filterRowContent: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 2 },
  filterChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, borderWidth: 1, borderColor: '#ccc', backgroundColor: '#f5f5f5' },
  filterChipActive: { borderColor: '#4A90D9', backgroundColor: '#4A90D918' },
  filterChipText: { fontSize: 13, color: '#555' },
  filterChipTextActive: { color: '#4A90D9', fontWeight: '600' },
});
