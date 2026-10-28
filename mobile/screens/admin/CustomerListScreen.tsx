import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../theme/colors';
import { Input } from '../../components/common/Input';
import { DataSyncManager } from '../../services/dataSync';
import { formatCurrency } from '../../utils/format';
import { Customer } from '../../types';

export const CustomerListScreen: React.FC<{ route?: any; navigation: any }> = ({
  route,
  navigation,
}) => {
  const [search, setSearch] = useState('');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filterTab, setFilterTab] = useState<'ALL' | 'PAID' | 'PENDING'>('ALL');
  const [schemeFilter, setSchemeFilter] = useState<'ALL' | 'FIXED' | 'REGULAR' | 'AUCTION'>(
    route?.params?.schemeFilter || 'ALL'
  );

  useEffect(() => {
    if (route?.params?.schemeFilter) {
      setSchemeFilter(route.params.schemeFilter);
    }
  }, [route?.params?.schemeFilter]);

  const fetchCustomers = async () => {
    try {
      const data = await DataSyncManager.getCustomers();
      setCustomers(data);
    } catch (e) {
      console.warn('Could not fetch customers:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchCustomers();
  };

  const paidCount = customers.filter((c) => Number(c.pending || 0) <= 0).length;
  const pendingCount = customers.filter((c) => Number(c.pending || 0) > 0).length;

  const filteredCustomers = customers.filter((c) => {
    const q = search.toLowerCase();
    const matchesSearch =
      c.name.toLowerCase().includes(q) ||
      (c.phone && c.phone.includes(q)) ||
      c.id.toLowerCase().includes(q);

    const hasDues = Number(c.pending || 0) > 0;
    const matchesStatus =
      filterTab === 'ALL' ? true : filterTab === 'PAID' ? !hasDues : hasDues;

    // Filter by scheme
    let matchesScheme = true;
    if (schemeFilter !== 'ALL') {
      const hasMatchingChit = Array.isArray(c.chits) && c.chits.some((ch: any) => {
        const s = String(ch.scheme || ch.type || '').toUpperCase();
        if (schemeFilter === 'FIXED') return s.includes('FIX');
        if (schemeFilter === 'AUCTION') return s.includes('AUC');
        if (schemeFilter === 'REGULAR') return !s.includes('FIX') && !s.includes('AUC');
        return true;
      });
      matchesScheme = hasMatchingChit;
    }

    return matchesSearch && matchesStatus && matchesScheme;
  });

  const renderItem = ({ item }: { item: Customer }) => {
    const hasDues = Number(item.pending || 0) > 0;
    const initial = (item.name || 'M').charAt(0).toUpperCase();

    // Alternate avatar pastel background (matches Reference Screen 6)
    const avatarBgs = ['#FFECC2', '#FCE7F3', '#E0F2FE', '#EDE9FE', '#FEF3C7'];
    const charCode = initial.charCodeAt(0) || 0;
    const bg = avatarBgs[charCode % avatarBgs.length];

    return (
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.7}
        onPress={() => navigation.navigate('CustomerDetail', { customer: item })}
      >
        <View style={styles.cardContentRow}>
          {/* Avatar Bubble */}
          <View style={[styles.avatarBubble, { backgroundColor: bg }]}>
            <Text style={styles.avatarBubbleText}>{initial}</Text>
          </View>

          {/* Member Details */}
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.memberName}>{item.name}</Text>
            <Text style={styles.memberGroupText}>
              {item.chits?.[0]?.groupName || 'Group A'}
            </Text>
            <Text style={styles.memberPhoneText}>{item.phone || item.mobile || '+91 9988998899'}</Text>
          </View>

          {/* Financial Status Pill */}
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.dueAmountText}>
              {hasDues ? formatCurrency(item.pending) : '₹0'}
            </Text>
            <View
              style={[
                styles.statusPill,
                hasDues ? styles.pillPending : styles.pillPaid,
              ]}
            >
              <Text
                style={[
                  styles.statusPillText,
                  hasDues ? styles.textPending : styles.textPaid,
                ]}
              >
                {hasDues ? 'Pending' : 'Paid'}
              </Text>
            </View>
          </View>

          <Ionicons name="chevron-forward" size={18} color={Colors.border} style={{ marginLeft: 6 }} />
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Search Bar */}
      <View style={styles.searchSection}>
        <Input
          placeholder="Search members by name or mobile..."
          value={search}
          onChangeText={setSearch}
          leftIcon={<Ionicons name="search" size={18} color={Colors.textSecondary} />}
          containerStyle={{ marginBottom: 0, flex: 1 }}
        />
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => navigation.navigate('AddCustomer')}
          activeOpacity={0.8}
        >
          <Ionicons name="person-add" size={18} color="#133336" />
        </TouchableOpacity>
      </View>

      {/* Scheme Filter Tag (when selected from Dashboard cards) */}
      {schemeFilter !== 'ALL' && (
        <View style={styles.schemeActiveBanner}>
          <Text style={styles.schemeActiveBannerText}>
            Showing <Text style={{ fontWeight: '800' }}>{schemeFilter}</Text> Scheme Members
          </Text>
          <TouchableOpacity
            style={styles.schemeClearBtn}
            onPress={() => setSchemeFilter('ALL')}
            activeOpacity={0.7}
          >
            <Ionicons name="close-circle" size={16} color={Colors.navy.primary} />
            <Text style={styles.schemeClearText}>Clear Filter</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Filter Tabs (All (7), Paid (2), Pending (5)) - Matching Reference Screen 6 */}
      <View style={styles.filterRow}>
        <TouchableOpacity
          style={[styles.filterTab, filterTab === 'ALL' && styles.filterTabActive]}
          onPress={() => setFilterTab('ALL')}
          activeOpacity={0.8}
        >
          <Text style={[styles.filterText, filterTab === 'ALL' && styles.filterTextActive]}>
            All ({customers.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.filterTab, filterTab === 'PAID' && styles.filterTabActive]}
          onPress={() => setFilterTab('PAID')}
          activeOpacity={0.8}
        >
          <Text style={[styles.filterText, filterTab === 'PAID' && styles.filterTextActive]}>
            Paid ({paidCount})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.filterTab, filterTab === 'PENDING' && styles.filterTabActive]}
          onPress={() => setFilterTab('PENDING')}
          activeOpacity={0.8}
        >
          <Text style={[styles.filterText, filterTab === 'PENDING' && styles.filterTextActive]}>
            Pending ({pendingCount})
          </Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color={Colors.gold.primary} />
        </View>
      ) : (
        <FlatList
          data={filteredCustomers}
          keyExtractor={(item, index) => `${item.id || item.phone || 'cust'}-${index}`}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={Colors.gold.primary}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="people-outline" size={48} color={Colors.textMuted} />
              <Text style={styles.emptyTitle}>No Members Found</Text>
              <Text style={styles.emptySub}>Try searching with a different name or mobile.</Text>
            </View>
          }
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  searchSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 4,
  },
  addBtn: {
    width: 50,
    height: 50,
    borderRadius: 14,
    backgroundColor: Colors.gold.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.gold.dark,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.16,
    shadowRadius: 4,
    elevation: 2,
  },
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 10,
  },
  filterTab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  filterTabActive: {
    backgroundColor: Colors.gold.primary,
    borderColor: Colors.gold.primary,
  },
  filterText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  filterTextActive: {
    color: Colors.navy.primary,
    fontWeight: '800',
  },
  loaderContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 32,
    gap: 12,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: Colors.navy.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1,
  },
  cardContentRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarBubble: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarBubbleText: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.gold.text,
  },
  memberName: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.text,
  },
  memberGroupText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginTop: 2,
  },
  memberPhoneText: {
    fontSize: 11,
    fontWeight: '500',
    color: Colors.textMuted,
    marginTop: 2,
  },
  dueAmountText: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.text,
  },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginTop: 4,
  },
  pillPaid: {
    backgroundColor: Colors.successLight,
  },
  pillPending: {
    backgroundColor: Colors.warningLight,
  },
  statusPillText: {
    fontSize: 10,
    fontWeight: '700',
  },
  textPaid: {
    color: Colors.success,
  },
  textPending: {
    color: Colors.warning,
  },
  schemeActiveBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFECC2',
    marginHorizontal: 20,
    marginTop: 8,
    marginBottom: 4,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 191, 50, 0.4)',
  },
  schemeActiveBannerText: {
    fontSize: 12,
    color: '#133336',
    fontWeight: '600',
  },
  schemeClearBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  schemeClearText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.navy.primary,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
    marginTop: 12,
  },
  emptySub: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 4,
  },
});
