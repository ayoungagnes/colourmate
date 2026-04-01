import { useFocusEffect, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useMemo, useState } from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ColourPoint } from '@/src/colour/models/colourPoint';
import { SqliteColourPointRepository } from '@/src/colour/repositories/sqliteColourPointRepository';
import {
  ColourFilter,
  EMPTY_FILTER,
  filterColours,
  isFilterActive,
  sortByHue,
} from '@/src/colour/services/colourQueryService';
import { FilterSheet } from '@/src/colour/ui/components/filter-sheet';
import { Inventory } from '@/src/inventory/models/inventory';
import { SqliteInventoryRepository } from '@/src/inventory/repositories/sqliteInventoryRepository';
import { IconSymbol } from '@/src/ui/components/icon-symbol';

// ---------------------------------------------------------------------------
// InventoryScreen
// ---------------------------------------------------------------------------
export default function InventoryScreen() {
  const db = useSQLiteContext();
  const colourRepo = useMemo(() => new SqliteColourPointRepository(db), [db]);
  const inventoryRepo = useMemo(() => new SqliteInventoryRepository(db), [db]);

  const [colours, setColours] = useState<ColourPoint[]>([]);
  const [inventoryIds, setInventoryIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<ColourFilter>(EMPTY_FILTER);
  const [showFilter, setShowFilter] = useState(false);
  const router = useRouter();

  const loadData = useCallback(async () => {
    const [allColours, allInventory] = await Promise.all([
      colourRepo.findAll(),
      inventoryRepo.findAll(),
    ]);
    setColours(allColours);
    setInventoryIds(new Set(allInventory.map((i) => i.colour_id)));
  }, [colourRepo, inventoryRepo]);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  const handleToggle = useCallback(async (colour: ColourPoint) => {
    if (inventoryIds.has(colour.id)) {
      await inventoryRepo.deleteByColourId(colour.id);
      setInventoryIds((prev) => { const next = new Set(prev); next.delete(colour.id); return next; });
    } else {
      const entry = Inventory.create({ colour_id: colour.id, quantity: 1 });
      await inventoryRepo.create(entry);
      setInventoryIds((prev) => new Set([...prev, colour.id]));
    }
  }, [inventoryIds, inventoryRepo]);

  const allBrands = useMemo(
    () => [...new Set(colours.map((c) => c.brand))].sort(),
    [colours],
  );

  const filtered = useMemo(
    () => sortByHue(filterColours(colours, { ...filter, search }, inventoryIds)),
    [colours, search, filter, inventoryIds],
  );

  const renderItem = ({ item }: { item: ColourPoint }) => {
    const bg = `rgb(${item.rgb.r}, ${item.rgb.g}, ${item.rgb.b})`;
    const inInventory = inventoryIds.has(item.id);
    return (
      <Pressable style={styles.card} onPress={() => router.push({ pathname: '/colour/[id]' as any, params: { id: item.id } })}>
        <View style={[styles.swatch, { backgroundColor: bg }]} />
        <View style={styles.cardInfo}>
          <Text style={styles.colourName}>{item.name}</Text>
          <Text style={styles.colourBrand}>{item.brand}</Text>
          {item.tag.length > 0 && (
            <View style={styles.tagRow}>
              {item.tag.map((t) => (
                <View key={t} style={styles.tag}>
                  <Text style={styles.tagText}>{t}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
        <Pressable
          style={[styles.addBtn, inInventory && styles.addBtnActive]}
          onPress={() => handleToggle(item)}
        >
          <Text style={[styles.addBtnText, inInventory && styles.addBtnTextActive]}>
            {inInventory ? '✓' : '+'}
          </Text>
        </Pressable>
      </Pressable>
    );
  };

  const insets = useSafeAreaInsets();
  const filterActive = isFilterActive(filter);

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <Text style={styles.title}>Colourmate</Text>

      <View style={styles.searchRow}>
        <View style={styles.searchBar}>
          <IconSymbol name="magnifyingglass" size={16} color="#999" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search colors..."
            placeholderTextColor="#999"
            value={search}
            onChangeText={setSearch}
          />
          {search.length > 0 && (
            <Pressable onPress={() => setSearch('')} style={styles.clearBtn}>
              <IconSymbol name="xmark.circle.fill" size={16} color="#999" />
            </Pressable>
          )}
        </View>
        <Pressable
          style={[styles.filterBtn, filterActive && styles.filterBtnActive]}
          onPress={() => setShowFilter(true)}
        >
          <IconSymbol
            name="line.3.horizontal.decrease"
            size={18}
            color={filterActive ? '#4A90D9' : '#555'}
          />
          {filterActive && <View style={styles.filterBadge} />}
        </Pressable>
      </View>

      <View style={styles.statsRow}>
        <Text style={styles.stat}>{filtered.length} colors</Text>
        <Text style={styles.stat}>{inventoryIds.size} in inventory</Text>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<Text style={styles.empty}>No colours found.</Text>}
      />

      <FilterSheet
        visible={showFilter}
        brands={allBrands}
        filter={filter}
        onApply={setFilter}
        onClose={() => setShowFilter(false)}
      />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f5f5f5' },
  title: {
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
    paddingTop: 16,
    paddingBottom: 12,
    color: '#111',
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    gap: 8,
    marginBottom: 6,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    paddingHorizontal: 10,
    height: 42,
  },
  searchIcon: { marginRight: 6 },
  searchInput: { flex: 1, fontSize: 15, color: '#111' },
  clearBtn: { paddingHorizontal: 4 },
  filterBtn: {
    width: 42,
    height: 42,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterBtnActive: { borderColor: '#4A90D9', backgroundColor: '#EBF3FD' },
  filterBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#4A90D9',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  stat: { fontSize: 13, color: '#4A90D9', fontWeight: '500' },
  list: { paddingHorizontal: 14, paddingBottom: 16, gap: 8 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ebebeb',
    padding: 12,
  },
  swatch: { width: 56, height: 56, borderRadius: 10 },
  cardInfo: { flex: 1, marginLeft: 12, gap: 2 },
  colourName: { fontSize: 16, fontWeight: '600', color: '#111' },
  colourBrand: { fontSize: 13, color: '#888' },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 4 },
  tag: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  tagText: { fontSize: 11, color: '#555' },
  addBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#ccc',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  addBtnActive: { borderColor: '#4A90D9', backgroundColor: '#EBF3FD' },
  addBtnText: { fontSize: 18, color: '#888', lineHeight: 20 },
  addBtnTextActive: { fontSize: 14, color: '#4A90D9' },
  empty: { textAlign: 'center', color: '#999', marginTop: 40 },
});
