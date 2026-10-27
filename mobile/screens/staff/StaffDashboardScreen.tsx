import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Linking,
  StatusBar,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../theme/colors';
import { useAuth } from '../../store/AuthContext';
import { DataSyncManager } from '../../services/dataSync';
import { formatCurrency } from '../../utils/format';

export const StaffDashboardScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'DUES' | 'COLLECTED'>('DUES');
  const [customersWithDues, setCustomersWithDues] = useState<any[]>([]);
  const [ledgerEntries, setLedgerEntries] = useState<any[]>([]);
  const [todayTotal, setTodayTotal] = useState(0);
  const [totalOverdue, setTotalOverdue] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const fetchStaffData = async () => {
    try {
      const [custs, ledger] = await Promise.all([
        DataSyncManager.getCustomers(),
        DataSyncManager.getLedgerTransactions(),
      ]);

      const dues = custs.filter((c) => Number(c.pending || 0) > 0);
      setCustomersWithDues(dues);
      setTotalOverdue(dues.reduce((s, c) => s + Number(c.pending || 0), 0));

      const staffCredits = ledger.filter((l) => l.type === 'CREDIT');
      setLedgerEntries(staffCredits);
      setTodayTotal(staffCredits.reduce((s, l) => s + Number(l.amount || 0), 0));
    } catch (e) {
      console.warn('Failed to load staff data:', e);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchStaffData();
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchStaffData();
    }, [])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchStaffData();
  };

  const dialCustomer = (phone: string) => {
    if (!phone) return;
    Linking.openURL(`tel:${phone}`);
  };

  const openWhatsApp = (phone: string, name: string, due: number) => {
    if (!phone) return;
    const clean = phone.replace(/\D/g, '');
    const msg = `Vanakkam ${name}, greeting from Jenista Chits. Your installment payment of ₹${due} is due for this cycle. Please settle at the earliest.`;
    Linking.openURL(`https://wa.me/91${clean}?text=${encodeURIComponent(msg)}`);
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Staff Header Hero Card */}
      <View style={styles.heroCard}>
        <View style={styles.heroTop}>
          <View>
            <Text style={styles.roleTag}>FIELD COLLECTION EXECUTIVE</Text>
            <Text style={styles.staffName}>{user?.name || 'Staff User'}</Text>
          </View>
          <TouchableOpacity
            style={styles.newReceiptBtn}
            onPress={() => navigation.navigate('ReceiptEntry')}
          >
            <Ionicons name="receipt" size={16} color="#0f172a" />
            <Text style={styles.newReceiptText}>+ Issue Receipt</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.divider} />

        <View style={styles.statsRow}>
          <View style={styles.statCol}>
            <Text style={styles.statLabel}>TODAY'S COLLECTIONS</Text>
            <Text style={styles.collectionAmt}>{formatCurrency(todayTotal)}</Text>
          </View>
          <View style={styles.vDivider} />
          <View style={styles.statCol}>
            <Text style={styles.statLabel}>OVERDUE BALANCES</Text>
            <Text style={styles.overdueAmt}>{formatCurrency(totalOverdue)}</Text>
          </View>
        </View>
      </View>

      {/* Staff Quick Actions Row */}
      <View style={styles.quickActionsCard}>
        <TouchableOpacity
          style={styles.actionTile}
          onPress={() => navigation.navigate('ReceiptEntry')}
          activeOpacity={0.7}
        >
          <View style={[styles.actionIconCircle, { backgroundColor: '#F0FDF4' }]}>
            <Ionicons name="card-outline" size={20} color="#16A34A" />
          </View>
          <Text style={styles.actionTileText}>Raise Receipt</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionTile}
          onPress={() => navigation.navigate('AddCustomer')}
          activeOpacity={0.7}
        >
          <View style={[styles.actionIconCircle, { backgroundColor: Colors.blueSubtle }]}>
            <Ionicons name="person-add-outline" size={20} color={Colors.blueAccent} />
          </View>
          <Text style={styles.actionTileText}>Add Customer</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionTile}
          onPress={() => navigation.navigate('ChitGroupList')}
          activeOpacity={0.7}
        >
          <View style={[styles.actionIconCircle, { backgroundColor: '#FFF8EB' }]}>
            <Ionicons name="person-add" size={20} color={Colors.gold.dark} />
          </View>
          <Text style={styles.actionTileText}>Add to Group</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionTile}
          onPress={() => navigation.navigate('CustomerList')}
          activeOpacity={0.7}
        >
          <View style={[styles.actionIconCircle, { backgroundColor: '#F1F5F9' }]}>
            <Ionicons name="people-outline" size={20} color={Colors.navy.primary} />
          </View>
          <Text style={styles.actionTileText}>Members</Text>
        </TouchableOpacity>
      </View>

      {/* Tab Switcher */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'DUES' && styles.tabActive]}
          onPress={() => setActiveTab('DUES')}
        >
          <Text style={[styles.tabText, activeTab === 'DUES' && styles.tabTextActive]}>
            Assigned Dues ({customersWithDues.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'COLLECTED' && styles.tabActive]}
          onPress={() => setActiveTab('COLLECTED')}
        >
          <Text style={[styles.tabText, activeTab === 'COLLECTED' && styles.tabTextActive]}>
            Recorded Receipts
          </Text>
        </TouchableOpacity>
      </View>

      {activeTab === 'DUES' ? (
        <FlatList
          data={customersWithDues}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <View style={styles.dueCard}>
              <View style={styles.dueTop}>
                <TouchableOpacity
                  style={{ flex: 1 }}
                  activeOpacity={0.7}
                  onPress={() => navigation.navigate('CustomerDetail', { customer: item })}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={styles.custName}>{item.name}</Text>
                    <Ionicons name="open-outline" size={14} color={Colors.primary[600]} />
                  </View>
                  <Text style={styles.custPhone}>ID: {item.id} • {item.phone || 'No phone'}</Text>
                </TouchableOpacity>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.pendingAmount}>{formatCurrency(item.pending)}</Text>
                  <Text style={styles.pendingLabel}>INSTALLMENT DUE</Text>
                </View>
              </View>

              <View style={styles.actionRow}>
                <TouchableOpacity
                  style={styles.callBtn}
                  onPress={() => dialCustomer(item.phone || item.mobile)}
                >
                  <Ionicons name="call" size={15} color={Colors.white} />
                  <Text style={styles.btnTextWhite}>Call Member</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.waBtn}
                  onPress={() =>
                    openWhatsApp(item.phone || item.mobile, item.name, item.pending)
                  }
                >
                  <Ionicons name="logo-whatsapp" size={15} color={Colors.white} />
                  <Text style={styles.btnTextWhite}>WhatsApp</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.collectBtn}
                  onPress={() =>
                    navigation.navigate('ReceiptEntry', {
                      customerId: item.id,
                      customerName: item.name,
                      mobile: item.phone || item.mobile,
                      amount: item.pending,
                      chitGroup: item.chits?.[0]?.groupName || item.chits?.[0]?.groupId || '',
                    })
                  }
                >
                  <Ionicons name="cash" size={15} color="#0f172a" />
                  <Text style={styles.btnTextDark}>Collect</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        />
      ) : (
        <FlatList
          data={ledgerEntries}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <View style={styles.receiptCard}>
              <View style={styles.recHeader}>
                <Text style={styles.recNo}>#{item.id}</Text>
                <Text style={styles.recAmt}>+{formatCurrency(item.amount)}</Text>
              </View>
              <Text style={styles.recDesc}>{item.description}</Text>
              <Text style={styles.recMeta}>
                {item.paymentMode} • Ref: {item.reference}
              </Text>
            </View>
          )}
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
  heroCard: {
    backgroundColor: Colors.navy.primary,
    margin: 16,
    borderRadius: 22,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    shadowColor: Colors.navy.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 3,
  },
  heroTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  roleTag: {
    fontSize: 10,
    fontWeight: '800',
    color: Colors.gold.primary,
    letterSpacing: 1,
  },
  staffName: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.white,
    marginTop: 2,
    letterSpacing: 0.2,
  },
  newReceiptBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.gold.primary,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    gap: 6,
    shadowColor: Colors.gold.dark,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.16,
    shadowRadius: 4,
    elevation: 2,
  },
  newReceiptText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0B1A30',
  },
  notifBtn: {
    width: 38,
    height: 38,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  notifBadgeDot: {
    position: 'absolute',
    top: 7,
    right: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ef4444',
    borderWidth: 1.5,
    borderColor: Colors.navy.primary,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    marginVertical: 14,
  },
  statsRow: {
    flexDirection: 'row',
  },
  statCol: {
    flex: 1,
    alignItems: 'center',
  },
  vDivider: {
    width: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.neutral[400],
    letterSpacing: 0.5,
  },
  collectionAmt: {
    fontSize: 18,
    fontWeight: '800',
    color: '#4ade80',
    marginTop: 4,
  },
  overdueAmt: {
    fontSize: 18,
    fontWeight: '800',
    color: '#f87171',
    marginTop: 4,
  },
  quickActionsCard: {
    backgroundColor: Colors.surface,
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 20,
    paddingVertical: 14,
    paddingHorizontal: 10,
    flexDirection: 'row',
    justifyContent: 'space-around',
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  actionTile: {
    alignItems: 'center',
    width: '24%',
  },
  actionIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  actionTileText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.text,
    textAlign: 'center',
  },
  tabContainer: {
    flexDirection: 'row',
    marginHorizontal: 16,
    backgroundColor: '#e2e8f0',
    borderRadius: 10,
    padding: 4,
    marginBottom: 8,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
  },
  tabActive: {
    backgroundColor: Colors.white,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  tabText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
  },
  tabTextActive: {
    color: '#0f172a',
    fontWeight: '800',
  },
  listContent: {
    padding: 16,
    gap: 12,
  },
  dueCard: {
    backgroundColor: Colors.white,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  dueTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  custName: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0f172a',
  },
  custPhone: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  pendingAmount: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.danger,
  },
  pendingLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: '#94a3b8',
    marginTop: 2,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 8,
  },
  callBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2563eb',
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
  },
  waBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#059669',
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
  },
  collectBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary[400],
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
  },
  btnTextWhite: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.white,
  },
  btnTextDark: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0f172a',
  },
  receiptCard: {
    backgroundColor: Colors.white,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  recHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  recNo: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748b',
  },
  recAmt: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.success,
  },
  recDesc: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
    marginTop: 4,
  },
  recMeta: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 2,
  },
});
