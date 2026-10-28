import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Share,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../theme/colors';
import { DataSyncManager } from '../../services/dataSync';
import { formatCurrency } from '../../utils/format';

interface DefaulterRow {
  customerId: string;
  customerName: string;
  mobile: string;
  groupName: string;
  amountDue: number;
}

export const ReportsScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const [nonPayers, setNonPayers] = useState<DefaulterRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchDefaulters = async () => {
    try {
      const custs = await DataSyncManager.getCustomers();
      const defaulters: DefaulterRow[] = [];

      custs.forEach((c) => {
        const totalPending = Number(c.pending || 0);
        if (totalPending <= 0) return;

        // If customer has chits, check which chits have pending dues
        if (Array.isArray(c.chits) && c.chits.length > 0) {
          const chitsWithDues = c.chits.filter((ch: any) => Number(ch.pending ?? ch.monthlyInstallment ?? 0) > 0 && ch.paymentStatus !== 'PAID');

          if (chitsWithDues.length > 0) {
            chitsWithDues.forEach((ch: any) => {
              defaulters.push({
                customerId: c.id,
                customerName: c.name || c.fullName || 'Member',
                mobile: c.phone || c.mobile || '—',
                groupName: ch.groupName || ch.groupId || 'Chit Group',
                amountDue: Number(ch.pending ?? ch.monthlyInstallment ?? totalPending),
              });
            });
          } else {
            // Customer overall has pending balance
            const groupNames = c.chits.map((ch: any) => ch.groupName || ch.groupId).join(', ');
            defaulters.push({
              customerId: c.id,
              customerName: c.name || c.fullName || 'Member',
              mobile: c.phone || c.mobile || '—',
              groupName: groupNames || 'Chit Group',
              amountDue: totalPending,
            });
          }
        } else {
          defaulters.push({
            customerId: c.id,
            customerName: c.name || c.fullName || 'Member',
            mobile: c.phone || c.mobile || '—',
            groupName: 'General Chit Fund',
            amountDue: totalPending,
          });
        }
      });

      setNonPayers(defaulters);
    } catch (e) {
      console.warn('Error loading defaulters report:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDefaulters();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchDefaulters();
  };

  const totalOutstanding = nonPayers.reduce((s, p) => s + p.amountDue, 0);

  const shareReport = async () => {
    const list = nonPayers
      .map((d, i) => `${i + 1}. ${d.customerName} (${d.mobile}) - ₹${d.amountDue}`)
      .join('\n');
    const msg = `*Jenista Chits - Overdue Dues Report*\nTotal Defaulters: ${nonPayers.length}\nTotal Outstanding: ${formatCurrency(totalOutstanding)}\n\n${list}`;
    try {
      await Share.share({ message: msg });
    } catch {}
  };

  const renderItem = ({ item }: { item: DefaulterRow }) => {
    const initial = (item.customerName || 'M').charAt(0).toUpperCase();

    return (
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.7}
        onPress={() =>
          navigation.navigate('CustomerDetail', {
            customer: {
              id: item.customerId,
              name: item.customerName,
              phone: item.mobile,
              mobile: item.mobile,
              pending: item.amountDue,
              status: 'ACTIVE',
              chits: [
                {
                  groupId: item.groupName,
                  groupName: item.groupName,
                  ticketNumber: '1',
                  chitValue: 100000,
                  duration: 20,
                },
              ],
            },
          })
        }
      >
        <View style={styles.cardMainRow}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initial}</Text>
          </View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={styles.name}>{item.customerName}</Text>
              <Ionicons name="open-outline" size={13} color={Colors.navy.primary} />
            </View>
            <Text style={styles.contact}>ID: {item.customerId} • {item.mobile}</Text>
            <Text style={styles.schemeTag}>{item.groupName}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.amount}>{formatCurrency(item.amountDue)}</Text>
            <View style={styles.overdueBadge}>
              <Text style={styles.overdueBadgeText}>OVERDUE</Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Top Defaulters Summary Banner */}
      <View style={styles.heroBox}>
        <View>
          <Text style={styles.heroLabel}>TOTAL OVERDUE DUES</Text>
          <Text style={styles.heroAmount}>{formatCurrency(totalOutstanding)}</Text>
          <Text style={styles.heroSub}>{nonPayers.length} Members with pending installments</Text>
        </View>
        <TouchableOpacity style={styles.shareBtn} onPress={shareReport} activeOpacity={0.8}>
          <Ionicons name="share-social" size={18} color="#133336" />
          <Text style={styles.shareBtnText}>Share</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color={Colors.gold.primary} />
        </View>
      ) : (
        <FlatList
          data={nonPayers}
          keyExtractor={(item, index) => `${item.customerId}-${item.groupName}-${index}`}
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
            <View style={styles.empty}>
              <Ionicons name="checkmark-done-circle" size={54} color={Colors.success} />
              <Text style={styles.emptyTitle}>Zero Overdue Accounts</Text>
              <Text style={styles.emptySub}>All customer chit installments are completely up to date!</Text>
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
  heroBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.navy.primary,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 24,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  heroLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#FFECC2',
    letterSpacing: 1,
  },
  heroAmount: {
    fontSize: 24,
    fontWeight: '900',
    color: Colors.white,
    marginTop: 2,
    letterSpacing: -0.5,
  },
  heroSub: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.85)',
    marginTop: 2,
  },
  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.gold.primary,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    gap: 6,
    shadowColor: Colors.gold.dark,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.16,
    shadowRadius: 4,
    elevation: 2,
  },
  shareBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#133336',
  },
  loader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
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
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#FFECC2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.gold.text,
  },
  name: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.text,
  },
  contact: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  schemeTag: {
    fontSize: 11,
    color: Colors.navy.secondary,
    fontWeight: '700',
    marginTop: 4,
  },
  amount: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.danger,
  },
  overdueBadge: {
    backgroundColor: Colors.dangerLight,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
    marginTop: 3,
  },
  overdueBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: Colors.danger,
  },
  empty: {
    padding: 60,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.text,
    marginTop: 12,
  },
  emptySub: {
    fontSize: 12,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: 4,
  },
});
