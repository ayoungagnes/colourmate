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
import { findBestMix, mixPaints, munsellXYZDistance } from '@/src/colour/services/paintMixService';
import { RGB } from '@/src/colour/ui/types';
import { IconSymbol } from '@/src/ui/components/icon-symbol';

type Selector = 'A' | 'B';

function toHex(r: number, g: number, b: number) {
  return '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0').toUpperCase()).join('');
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
  const [selectedAId, setSelectedAId] = useState<string | null>(null);
  const [selectedBId, setSelectedBId] = useState<string | null>(null);
  const [activeSelector, setActiveSelector] = useState<Selector | null>(null);
  const [ratioA, setRatioA] = useState(0.5);
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

  const runAutoSuggest = useCallback(() => {
    const g = goalRef.current;
    const colours = filterColours(
      allColoursRef.current.filter((c) => c.id !== g.id),
      { search: '', brands: filterBrandsRef.current, tags: new Set(), inInventoryOnly: filterInventoryOnlyRef.current },
      inventoryIdsRef.current
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
        setSelectedAId(suggestion.idA);
        setSelectedBId(suggestion.idB);
        setRatioA(suggestion.ratio);
      }
      setComputing(false);
    }, 0);
  }, []);

  useEffect(() => {
    if (!visible) {
      setSearch('');
      setSelectedAId(null);
      setSelectedBId(null);
      setActiveSelector(null);
      setRatioA(0.5);
      setFilterBrands(new Set());
      setFilterInventoryOnly(false);
      return;
    }
    runAutoSuggest();
  }, [visible, runAutoSuggest]);

  useEffect(() => {
    if (visibleRef.current) runAutoSuggest();
  }, [filterBrands, filterInventoryOnly, runAutoSuggest]);

  const paintA = useMemo(() => allColours.find((c) => c.id === selectedAId) ?? null, [allColours, selectedAId]);
  const paintB = useMemo(() => allColours.find((c) => c.id === selectedBId) ?? null, [allColours, selectedBId]);

  const mixedRgb: RGB | null = useMemo(
    () => (paintA && paintB ? mixPaints(paintA.rgb, paintB.rgb, ratioA) : null),
    [paintA, paintB, ratioA]
  );

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
    [allColours, goal.id]
  );

  const filtered = useMemo(() => {
    const excludeOther = activeSelector === 'A' ? selectedBId : selectedAId;
    const base = allColours.filter((c) => c.id !== goal.id && c.id !== excludeOther);
    return filterColours(
      base,
      { search, brands: filterBrands, tags: new Set(), inInventoryOnly: filterInventoryOnly },
      inventoryIds
    );
  }, [allColours, goal.id, activeSelector, selectedAId, selectedBId, filterBrands, filterInventoryOnly, inventoryIds, search]);

  const selectPaint = (id: string) => {
    if (activeSelector === 'A') setSelectedAId(id);
    else if (activeSelector === 'B') setSelectedBId(id);
    setActiveSelector(null);
    setSearch('');
  };

  const openSelector = (sel: Selector) => {
    setActiveSelector((prev) => (prev === sel ? null : sel));
    setSearch('');
  };

  const adjustRatio = (delta: number) => {
    setRatioA((prev) => Math.max(0.1, Math.min(0.9, parseFloat((prev + delta).toFixed(1)))));
  };

  const goalBg = `rgb(${goal.rgb.r}, ${goal.rgb.g}, ${goal.rgb.b})`;
  const aBg = paintA ? `rgb(${paintA.rgb.r}, ${paintA.rgb.g}, ${paintA.rgb.b})` : null;
  const bBg = paintB ? `rgb(${paintB.rgb.r}, ${paintB.rgb.g}, ${paintB.rgb.b})` : null;
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
          <>
            {/* Paint selectors */}
            <View style={ms.selectorRow}>
              <Pressable
                style={[ms.selectorBtn, activeSelector === 'A' && ms.selectorBtnActive]}
                onPress={() => openSelector('A')}
              >
                {aBg ? (
                  <View style={[ms.selectorSwatch, { backgroundColor: aBg }]} />
                ) : (
                  <View style={ms.selectorSwatchEmpty}>
                    <Text style={ms.selectorSwatchEmptyText}>A</Text>
                  </View>
                )}
                <View style={ms.selectorInfo}>
                  <Text style={ms.selectorLabel}>Paint A  (tap to change)</Text>
                  <Text style={ms.selectorName} numberOfLines={1}>{paintA ? paintA.name : 'Select…'}</Text>
                  {paintA && <Text style={ms.selectorBrand} numberOfLines={1}>{paintA.brand}</Text>}
                </View>
              </Pressable>

              <Text style={ms.mixOp}>+</Text>

              <Pressable
                style={[ms.selectorBtn, activeSelector === 'B' && ms.selectorBtnActive]}
                onPress={() => openSelector('B')}
              >
                {bBg ? (
                  <View style={[ms.selectorSwatch, { backgroundColor: bBg }]} />
                ) : (
                  <View style={ms.selectorSwatchEmpty}>
                    <Text style={ms.selectorSwatchEmptyText}>B</Text>
                  </View>
                )}
                <View style={ms.selectorInfo}>
                  <Text style={ms.selectorLabel}>Paint B  (tap to change)</Text>
                  <Text style={ms.selectorName} numberOfLines={1}>{paintB ? paintB.name : 'Select…'}</Text>
                  {paintB && <Text style={ms.selectorBrand} numberOfLines={1}>{paintB.brand}</Text>}
                </View>
              </Pressable>
            </View>

            {/* Ratio + result card */}
            {paintA && paintB && mixBg && (
              <View style={ms.mixResultCard}>
                <View style={ms.ratioRow}>
                  <Pressable style={ms.ratioBtn} onPress={() => adjustRatio(-0.1)}>
                    <Text style={ms.ratioBtnText}>−</Text>
                  </Pressable>
                  <View style={ms.ratioTrack}>
                    <View style={[ms.ratioFillA, { flex: ratioA }]} />
                    <View style={[ms.ratioFillB, { flex: 1 - ratioA }]} />
                  </View>
                  <Pressable style={ms.ratioBtn} onPress={() => adjustRatio(0.1)}>
                    <Text style={ms.ratioBtnText}>+</Text>
                  </Pressable>
                </View>
                <Text style={ms.ratioLabel}>
                  {Math.round(ratioA * 100)}% {paintA.name.split(' ')[0]}
                  {'  ·  '}
                  {Math.round((1 - ratioA) * 100)}% {paintB.name.split(' ')[0]}
                </Text>
                <View style={ms.presetRow}>
                  {[0.25, 0.5, 0.75].map((r) => (
                    <Pressable
                      key={r}
                      style={[ms.preset, ratioA === r && ms.presetActive]}
                      onPress={() => setRatioA(r)}
                    >
                      <Text style={[ms.presetText, ratioA === r && ms.presetTextActive]}>
                        {r === 0.25 ? '1:3' : r === 0.5 ? '1:1' : '3:1'}
                      </Text>
                    </Pressable>
                  ))}
                </View>
                <View style={ms.resultCompareRow}>
                  <View style={ms.resultBlock}>
                    <View style={[ms.resultSwatch, { backgroundColor: mixBg }]} />
                    <Text style={ms.resultSwatchLabel}>Mix result</Text>
                    <Text style={ms.resultHex}>{toHex(mixedRgb!.r, mixedRgb!.g, mixedRgb!.b)}</Text>
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
            {activeSelector && (
              <>
                <Text style={ms.sectionLabel}>Select paint {activeSelector}:</Text>
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
                    const bg = `rgb(${item.rgb.r}, ${item.rgb.g}, ${item.rgb.b})`;
                    const currentId = activeSelector === 'A' ? selectedAId : selectedBId;
                    const isSelected = item.id === currentId;
                    return (
                      <Pressable
                        style={[ms.colourRow, isSelected && ms.colourRowActive]}
                        onPress={() => selectPaint(item.id)}
                      >
                        <View style={[ms.colourSwatch, { backgroundColor: bg }]} />
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
          </>
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
  selectorRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  selectorBtn: {
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
  selectorBtnActive: { borderColor: '#4A90D9', backgroundColor: '#EBF3FD' },
  selectorSwatch: { width: 36, height: 36, borderRadius: 8 },
  selectorSwatchEmpty: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#ddd',
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectorSwatchEmptyText: { fontSize: 14, fontWeight: '700', color: '#999' },
  computingRow: { paddingVertical: 24, alignItems: 'center' },
  computingText: { fontSize: 14, color: '#888' },
  selectorInfo: { flex: 1 },
  selectorLabel: { fontSize: 10, color: '#888', marginBottom: 2 },
  selectorName: { fontSize: 12, fontWeight: '600', color: '#111' },
  selectorBrand: { fontSize: 11, color: '#888' },
  mixOp: { fontSize: 20, color: '#bbb', fontWeight: '400' },
  mixResultCard: {
    backgroundColor: '#f8f8f8',
    borderRadius: 12,
    padding: 12,
    gap: 10,
    marginBottom: 12,
  },
  ratioRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  ratioBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#e8e8e8', justifyContent: 'center', alignItems: 'center' },
  ratioBtnText: { fontSize: 20, color: '#333', lineHeight: 24 },
  ratioTrack: { flex: 1, height: 12, borderRadius: 6, flexDirection: 'row', overflow: 'hidden' },
  ratioFillA: { backgroundColor: '#4A90D9' },
  ratioFillB: { backgroundColor: '#ddd' },
  ratioLabel: { fontSize: 12, color: '#666', textAlign: 'center' },
  presetRow: { flexDirection: 'row', gap: 8, justifyContent: 'center' },
  preset: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, paddingHorizontal: 16, paddingVertical: 6, backgroundColor: '#fff' },
  presetActive: { borderColor: '#4A90D9', backgroundColor: '#EBF3FD' },
  presetText: { fontSize: 13, color: '#555' },
  presetTextActive: { color: '#4A90D9', fontWeight: '600' },
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
