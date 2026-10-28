import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  StatusBar,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../theme/colors';
import { formatCurrency, formatDate } from '../../utils/format';
import { Input } from '../../components/common/Input';
import { LedgerTransaction } from '../../types';
import { DataSyncManager } from '../../services/dataSync';

export const LedgerScreen: React.FC = () => {
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'ALL' | 'COMPLETED' | 'PENDING' | 'FAILED'>('ALL');
  const [transactions, setTransactions] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const loadLedger = async () => {
    try {
      const [data, customers] = await Promise.all([
        DataSyncManager.getLedgerTransactions(),
        DataSyncManager.getCustomers(),
      ]);

      const mapped = data.map((t: any) => {
        // 1. Resolve Customer Name
        let resolvedCust = t.customerName;

        // Try extracting from description: "Collection Voucher #REC-123456 - Pooja"
        if (!resolvedCust || /^\d+$/.test(resolvedCust) || resolvedCust === 'Member') {
          if (t.description && t.description.includes(' - ')) {
            const parts = t.description.split(' - ');
            const candidate = parts.slice(1).join(' - ').trim();
            if (candidate && !/^\d+$/.test(candidate) && !candidate.startsWith('Deposited to')) {
              resolvedCust = candidate;
            }
          }
        }

        // Try matching against customer database by reference / customerId
        const refParts = (t.reference || '').split('/');
        const refCustId = (t.customerId || refParts[0] || '').trim();
        const cleanRefDigits = refCustId.replace(/\D/g, '');

        if (!resolvedCust || /^\d+$/.test(resolvedCust) || resolvedCust === 'Member') {
          const matched = customers.find((c: any) => {
            const cPhone = (c.phone || c.mobile || '').replace(/\D/g, '');
            return (
              c.id === refCustId ||
              c.mongoId === refCustId ||
              (cleanRefDigits && cPhone && cleanRefDigits === cPhone)
            );
          });
          if (matched) {
            resolvedCust = matched.name || matched.fullName;
          }
        }

        // Fallback for customerName
        if (!resolvedCust || /^\d+$/.test(resolvedCust)) {
          const candidate = refParts[0]?.trim();
          resolvedCust = candidate && !/^\d+$/.test(candidate) ? candidate : 'Valued Member';
        }

        // 2. Resolve Group Name
        let resolvedGrp = t.groupName;
        const refGrpCandidate = refParts[1]?.trim();
        if (!resolvedGrp || resolvedGrp === 'Chit Group') {
          if (refGrpCandidate && refGrpCandidate !== 'undefined' && refGrpCandidate !== 'null') {
            resolvedGrp = refGrpCandidate;
          }
        }

        if (!resolvedGrp || resolvedGrp === 'Chit Group') {
          // Check if customer has a chit group
          const matched = customers.find((c: any) => {
            const cPhone = (c.phone || c.mobile || '').replace(/\D/g, '');
            return (
              c.id === refCustId ||
              c.mongoId === refCustId ||
              (cleanRefDigits && cPhone && cleanRefDigits === cPhone) ||
              c.name === resolvedCust
            );
          });
          if (matched && Array.isArray(matched.chits) && matched.chits.length > 0) {
            resolvedGrp = matched.chits[0].groupName || matched.chits[0].groupId;
          }
        }

        if (!resolvedGrp || resolvedGrp === 'undefined') {
          resolvedGrp = 'Chit Group';
        }

        return {
          id: t.id,
          customerName: resolvedCust,
          groupName: resolvedGrp,
          date: formatDate(t.date),
          type: t.type || 'CREDIT',
          category: t.category || 'INSTALLMENT',
          amount: Number(t.amount || 0),
          status: t.status || 'COMPLETED',
          reference: t.reference || t.id,
          description: t.description || 'Installment Payment',
          collectedBy: t.collectedBy || 'Jenista Admin',
          paymentMode: t.paymentMode || 'Bank Transfer',
        };
      });

      setTransactions(mapped);
    } catch (e) {
      console.warn('Failed to load ledger:', e);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadLedger();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    loadLedger();
  };

  const filtered = transactions.filter((t) => {
    const q = search.toLowerCase();
    const matchesSearch =
      t.id.toLowerCase().includes(q) ||
      t.customerName.toLowerCase().includes(q) ||
      t.groupName.toLowerCase().includes(q);

    if (activeTab === 'COMPLETED') return matchesSearch && t.status === 'COMPLETED';
    if (activeTab === 'PENDING') return matchesSearch && t.status === 'PENDING';
    if (activeTab === 'FAILED') return matchesSearch && t.status === 'FAILED';
    return matchesSearch;
  });

  const totalCollected = transactions
    .filter((t) => t.status === 'COMPLETED')
    .reduce((s, t) => s + t.amount, 0);

  const renderTxn = ({ item }: { item: any }) => {
    const isCompleted = item.status === 'COMPLETED';
    const isPending = item.status === 'PENDING';
    const isFailed = item.status === 'FAILED';

    const initial = item.customerName.charAt(0).toUpperCase();

    // Alternate avatar pastel background
    const avatarBgs = ['#FFECC2', '#FCE7F3', '#E0F2FE', '#EDE9FE', '#FEF3C7'];
    const charCode = initial.charCodeAt(0) || 0;
    const bg = avatarBgs[charCode % avatarBgs.length];

    return (
      <View style={styles.card}>
        <View style={styles.cardMainRow}>
          {/* Avatar Bubble */}
          <View style={[styles.avatarBubble, { backgroundColor: bg }]}>
            <Text style={styles.avatarBubbleText}>{initial}</Text>
          </View>

          {/* Member & Group Info */}
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.customerName}>{item.customerName}</Text>
            <Text style={styles.groupMetaText}>{item.groupName}</Text>
          </View>

          {/* Amount & Status Pill */}
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.amountText}>{formatCurrency(item.amount)}</Text>
            <Text style={styles.dateText}>{item.date}</Text>
            <View
              style={[
                styles.statusPill,
                isCompleted
                  ? styles.pillCompleted
                  : isPending
                  ? styles.pillPending
                  : styles.pillFailed,
              ]}
            >
              <Text
                style={[
                  styles.statusPillText,
                  isCompleted
                    ? styles.textCompleted
                    : isPending
                    ? styles.textPending
                    : styles.textFailed,
                ]}
              >
                {item.status.charAt(0) + item.status.slice(1).toLowerCase()}
              </Text>
            </View>
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Filter Tabs (All, Completed, Pending, Failed) - Matching Reference Screen 4 */}
      <View style={styles.filterRow}>
        {(['ALL', 'COMPLETED', 'PENDING', 'FAILED'] as const).map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.filterTab, activeTab === tab && styles.filterTabActive]}
            onPress={() => setActiveTab(tab)}
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.filterTabText,
                activeTab === tab && styles.filterTabTextActive,
              ]}
            >
              {tab.charAt(0) + tab.slice(1).toLowerCase()}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Total Collected Hero Card (Reference Screen 4) */}
      <View style={styles.totalCollectedCardWrapper}>
        <View style={styles.totalCollectedCard}>
          <View style={styles.walletIconCircle}>
            <Ionicons name="wallet-outline" size={22} color={Colors.gold.dark} />
          </View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.totalCollectedLabel}>Total Collected</Text>
            <Text style={styles.totalCollectedAmount}>{formatCurrency(totalCollected)}</Text>
            <View style={styles.trendRow}>
              <Ionicons name="receipt-outline" size={14} color={Colors.success} />
              <Text style={styles.trendText}>{filtered.length} Transactions</Text>
            </View>
          </View>
          <Ionicons name="stats-chart" size={24} color={Colors.gold.primary} />
        </View>
      </View>

      {/* List of Payments */}
      <FlatList
        data={filtered}
        keyExtractor={(item, index) => `${item.id || 'txn'}-${index}`}
        renderItem={renderTxn}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.gold.primary} />}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={{ alignItems: 'center', justifyContent: 'center', padding: 40 }}>
            <Ionicons name="receipt-outline" size={48} color={Colors.neutral[400]} />
            <Text style={{ marginTop: 12, fontSize: 15, fontWeight: '700', color: Colors.textSecondary }}>
              No Ledger Records Found
            </Text>
            <Text style={{ marginTop: 4, fontSize: 13, color: Colors.textMuted, textAlign: 'center' }}>
              Installment collections and receipts will appear here in real time.
            </Text>
          </View>
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },

  // Filter Tabs
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    gap: 8,
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
  filterTabText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  filterTabTextActive: {
    color: Colors.navy.primary,
    fontWeight: '800',
  },

  // Total Collected Hero Card
  totalCollectedCardWrapper: {
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  totalCollectedCard: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: Colors.navy.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  walletIconCircle: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: Colors.gold.subtle,
    borderWidth: 1,
    borderColor: Colors.gold.light,
    alignItems: 'center',
    justifyContent: 'center',
  },
  totalCollectedLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  totalCollectedAmount: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.text,
    marginTop: 2,
    letterSpacing: -0.5,
  },
  trendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  trendText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.success,
  },

  // Payment Cards
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
  cardMainRow: {
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
  customerName: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.text,
  },
  groupMetaText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginTop: 2,
  },
  amountText: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.text,
  },
  dateText: {
    fontSize: 10,
    fontWeight: '500',
    color: Colors.textMuted,
    marginTop: 1,
  },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 5,
    marginTop: 4,
  },
  pillCompleted: {
    backgroundColor: Colors.successLight,
  },
  pillPending: {
    backgroundColor: Colors.warningLight,
  },
  pillFailed: {
    backgroundColor: Colors.dangerLight,
  },
  statusPillText: {
    fontSize: 10,
    fontWeight: '700',
  },
  textCompleted: {
    color: Colors.success,
  },
  textPending: {
    color: Colors.warning,
  },
  textFailed: {
    color: Colors.danger,
  },
});
