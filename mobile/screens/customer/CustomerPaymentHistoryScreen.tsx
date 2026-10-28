import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../theme/colors';
import { useAuth } from '../../store/AuthContext';
import { secureStorage } from '../../services/storage';
import { formatCurrency, formatDate } from '../../utils/format';
import { generateAndShareReceipt } from '../../services/receiptService';
import { DataSyncManager } from '../../services/dataSync';

export const CustomerPaymentHistoryScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statementFilter, setStatementFilter] = useState<'ALL' | 'CASH' | 'ONLINE'>('ALL');
  const [statementSearch, setStatementSearch] = useState('');

  useEffect(() => {
    loadTransactions();
  }, [user]);

  const loadTransactions = async () => {
    try {
      if (!user) return;
      const [allCustomers, ledgerRaw] = await Promise.all([
        DataSyncManager.getCustomers(),
        secureStorage.getItem('synced_ledger'),
      ]);

      const cleanUserPhone = (user.phone || user.mobile || user.id || '').replace(/\D/g, '');
      const found = allCustomers.find((c: any) => {
        const cPhone = (c.mobile || c.phone || '').replace(/\D/g, '');
        return (
          c.id === user.id ||
          c.mongoId === user.id ||
          (cleanUserPhone && cPhone === cleanUserPhone)
        );
      });

      let userTrx: any[] = [];
      if (ledgerRaw) {
        try {
          const parsedLedger = JSON.parse(ledgerRaw);
          if (Array.isArray(parsedLedger)) {
            userTrx = parsedLedger.filter(
              (t: any) =>
                t.customerId === user.id ||
                t.reference?.includes(user.id) ||
                t.description?.includes(user.id) ||
                (found && (t.customerId === found.id || t.reference?.includes(found.name)))
            );
          }
        } catch {}
      }
      setTransactions(userTrx);
    } catch (e) {
      console.warn('Error loading transactions:', e);
    } finally {
      setLoading(false);
    }
  };

  const filteredTransactions = transactions.filter((t) => {
    const isCash =
      (t.description || '').toLowerCase().includes('cash') ||
      (t.paymentMode || '').toLowerCase().includes('cash');
    if (statementFilter === 'CASH' && !isCash) return false;
    if (statementFilter === 'ONLINE' && isCash) return false;
    if (statementSearch) {
      const q = statementSearch.toLowerCase();
      return (
        (t.id || '').toLowerCase().includes(q) ||
        (t.description || '').toLowerCase().includes(q) ||
        (t.reference || '').toLowerCase().includes(q)
      );
    }
    return true;
  });

  const totalAmount = filteredTransactions.reduce((acc, t) => acc + Number(t.amount || 0), 0);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.navy.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header Metric Summary */}
      <View style={styles.summaryCard}>
        <View style={{ flex: 1 }}>
          <Text style={styles.summaryLabel}>TOTAL SETTLED PAYMENTS</Text>
          <Text style={styles.summaryAmount}>{formatCurrency(totalAmount)}</Text>
          <Text style={styles.summaryCount}>{filteredTransactions.length} receipt records</Text>
        </View>
        <View style={styles.summaryIcon}>
          <Ionicons name="receipt" size={28} color={Colors.gold.primary} />
        </View>
      </View>

      {/* Filter Tabs & Search */}
      <View style={styles.filterBar}>
        <View style={styles.modeRow}>
          {(['ALL', 'CASH', 'ONLINE'] as const).map((f) => (
            <TouchableOpacity
              key={f}
              style={[styles.modePill, statementFilter === f && styles.modePillActive]}
              onPress={() => setStatementFilter(f)}
            >
              <Text style={[styles.modeText, statementFilter === f && styles.modeTextActive]}>
                {f === 'ALL' ? 'All Payments' : f === 'CASH' ? 'Cash' : 'Online / UPI'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.searchBox}>
          <Ionicons name="search-outline" size={16} color={Colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search ref ID or chit description..."
            value={statementSearch}
            onChangeText={setStatementSearch}
            clearButtonMode="while-editing"
          />
        </View>
      </View>

      {/* Transaction List */}
      <FlatList
        data={filteredTransactions}
        keyExtractor={(item: any, idx: number) => `${item.id}-${idx}`}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }: { item: any }) => (
          <View style={styles.statementItemRow}>
            <View style={styles.statementIconCircle}>
              <Ionicons
                name={(item.description || '').toLowerCase().includes('cash') ? 'cash-outline' : 'card-outline'}
                size={20}
                color={Colors.navy.primary}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.statementItemTitle}>{item.description || 'Chit Installment Payment'}</Text>
              <Text style={styles.statementItemMeta}>
                {formatDate(item.date)} • Ref: {item.id}
              </Text>
              {item.reference ? (
                <Text style={styles.statementItemRef}>UTR: {item.reference}</Text>
              ) : null}
            </View>
            <View style={{ alignItems: 'flex-end', gap: 6 }}>
              <Text style={styles.statementItemAmount}>+{formatCurrency(item.amount)}</Text>
              <TouchableOpacity
                style={styles.printReceiptBtn}
                onPress={() =>
                  generateAndShareReceipt({
                    receiptNo: item.id,
                    date: item.date,
                    customerName: user?.name,
                    customerId: user?.id,
                    customerMobile: user?.phone,
                    amount: item.amount,
                    description: item.description,
                    referenceNo: item.reference,
                  })
                }
              >
                <Ionicons name="print-outline" size={13} color={Colors.navy.primary} />
                <Text style={styles.printReceiptText}>Receipt</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="document-text-outline" size={44} color={Colors.textMuted} />
            <Text style={styles.emptyTitle}>No Payment Receipts Found</Text>
            <Text style={styles.emptySub}>
              {statementSearch ? 'Try a different search keyword.' : 'Any confirmed chit payments will appear here.'}
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
    backgroundColor: '#F9FBFB',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F9FBFB',
  },
  summaryCard: {
    backgroundColor: '#0C8A7D',
    margin: 16,
    marginBottom: 10,
    borderRadius: 18,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#0C8A7D',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 3,
  },
  summaryLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: 'rgba(255, 255, 255, 0.75)',
    letterSpacing: 0.5,
  },
  summaryAmount: {
    fontSize: 24,
    fontWeight: '900',
    color: '#FFFFFF',
    marginTop: 4,
  },
  summaryCount: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 2,
  },
  summaryIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterBar: {
    paddingHorizontal: 16,
    gap: 10,
    marginBottom: 8,
  },
  modeRow: {
    flexDirection: 'row',
    gap: 8,
  },
  modePill: {
    flex: 1,
    paddingVertical: 9,
    alignItems: 'center',
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D8E4E5',
  },
  modePillActive: {
    backgroundColor: '#0C8A7D',
    borderColor: '#0C8A7D',
  },
  modeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#7E9596',
  },
  modeTextActive: {
    color: '#FFFFFF',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#D8E4E5',
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#133336',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 30,
    gap: 10,
  },
  statementItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#D8E4E5',
    gap: 12,
  },
  statementIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#E8F5F3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statementItemTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#133336',
  },
  statementItemMeta: {
    fontSize: 11,
    color: '#7E9596',
    marginTop: 2,
  },
  statementItemRef: {
    fontSize: 10,
    color: '#7E9596',
    fontFamily: 'monospace',
    marginTop: 1,
  },
  statementItemAmount: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0C8A7D',
  },
  printReceiptBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: '#E8F5F3',
    borderWidth: 1,
    borderColor: '#D2EBE6',
  },
  printReceiptText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0C8A7D',
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
    gap: 8,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.textSecondary,
  },
  emptySub: {
    fontSize: 12,
    color: Colors.textMuted,
    textAlign: 'center',
  },
});
