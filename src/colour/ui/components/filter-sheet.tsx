import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ColourFilter, EMPTY_FILTER, HUE_ORDER } from '@/src/colour/services/colourQueryService';

export function FilterSheet({
  visible,
  brands,
  filter,
  onApply,
  onClose,
}: {
  visible: boolean;
  brands: string[];
  filter: ColourFilter;
  onApply: (f: ColourFilter) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<ColourFilter>(filter);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (visible) setDraft(filter);
  }, [visible, filter]);

  const toggleBrand = (brand: string) => {
    setDraft((prev) => {
      const next = new Set(prev.brands);
      next.has(brand) ? next.delete(brand) : next.add(brand);
      return { ...prev, brands: next };
    });
  };

  const toggleTag = (tag: string) => {
    setDraft((prev) => {
      const next = new Set(prev.tags);
      next.has(tag) ? next.delete(tag) : next.add(tag);
      return { ...prev, tags: next };
    });
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={s.backdrop} onPress={onClose} />
      <View style={[s.panel, { paddingBottom: insets.bottom + 16 }]}>
        <View style={s.handle} />
        <View style={s.header}>
          <Text style={s.heading}>Filters</Text>
          <Pressable onPress={() => setDraft(EMPTY_FILTER)}>
            <Text style={s.clearAll}>Clear all</Text>
          </Pressable>
        </View>
        <View style={s.row}>
          <Text style={s.rowLabel}>In inventory only</Text>
          <Switch
            value={draft.inInventoryOnly}
            onValueChange={(v) => setDraft((p) => ({ ...p, inInventoryOnly: v }))}
            trackColor={{ true: '#4A90D9' }}
          />
        </View>
        <Text style={s.sectionLabel}>Hue</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.hueRow} contentContainerStyle={s.hueRowContent}>
          {HUE_ORDER.map((hue) => {
            const active = draft.tags.has(hue);
            return (
              <Pressable key={hue} style={[s.hueChip, active && s.hueChipActive]} onPress={() => toggleTag(hue)}>
                <Text style={[s.hueChipText, active && s.hueChipTextActive]}>{hue}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
        <Text style={s.sectionLabel}>Brand</Text>
        <ScrollView style={s.brandList} showsVerticalScrollIndicator={false}>
          {brands.map((brand) => {
            const selected = draft.brands.has(brand);
            return (
              <Pressable key={brand} style={s.brandRow} onPress={() => toggleBrand(brand)}>
                <View style={[s.checkbox, selected && s.checkboxActive]}>
                  {selected && <Text style={s.checkmark}>✓</Text>}
                </View>
                <Text style={s.brandLabel}>{brand}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
        <Pressable style={s.applyBtn} onPress={() => { onApply(draft); onClose(); }}>
          <Text style={s.applyBtnText}>Apply</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)' },
  panel: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 12,
    maxHeight: '75%',
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#ddd',
    alignSelf: 'center',
    marginBottom: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  heading: { fontSize: 17, fontWeight: '700', color: '#111' },
  clearAll: { fontSize: 14, color: '#4A90D9' },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  rowLabel: { fontSize: 15, color: '#111' },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#888',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 16,
    marginBottom: 8,
  },
  hueRow: { maxHeight: 44, marginBottom: 8 },
  hueRowContent: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 2 },
  hueChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, borderWidth: 1, borderColor: '#ccc', backgroundColor: '#f5f5f5' },
  hueChipActive: { borderColor: '#4A90D9', backgroundColor: '#EBF3FD' },
  hueChipText: { fontSize: 13, color: '#555' },
  hueChipTextActive: { color: '#4A90D9', fontWeight: '600' },
  brandList: { maxHeight: 200 },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#ccc',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxActive: { backgroundColor: '#4A90D9', borderColor: '#4A90D9' },
  checkmark: { color: '#fff', fontSize: 13, fontWeight: '700' },
  brandLabel: { fontSize: 15, color: '#111' },
  applyBtn: {
    backgroundColor: '#4A90D9',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 16,
  },
  applyBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
