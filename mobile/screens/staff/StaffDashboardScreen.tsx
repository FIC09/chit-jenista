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
            activeOpacity={0.85}
          >
            <Ionicons name="receipt" size={15} color="#0C8A7D" />
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
          <View style={[styles.actionIconCircle, { backgroundColor: '#E8F5F3' }]}>
            <Ionicons name="card-outline" size={20} color="#0C8A7D" />
          </View>
          <Text style={styles.actionTileText}>Raise Receipt</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionTile}
          onPress={() => navigation.navigate('AddCustomer')}
          activeOpacity={0.7}
        >
          <View style={[styles.actionIconCircle, { backgroundColor: '#EBF5FF' }]}>
            <Ionicons name="person-add-outline" size={20} color="#0284C7" />
          </View>
          <Text style={styles.actionTileText}>Add Customer</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionTile}
          onPress={() => navigation.navigate('ChitGroupList')}
          activeOpacity={0.7}
        >
          <View style={[styles.actionIconCircle, { backgroundColor: '#FEF3C7' }]}>
            <Ionicons name="people" size={20} color="#D97706" />
          </View>
          <Text style={styles.actionTileText}>Add to Group</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionTile}
          onPress={() => navigation.navigate('CustomerList')}
          activeOpacity={0.7}
        >
          <View style={[styles.actionIconCircle, { backgroundColor: '#E8F5F3' }]}>
            <Ionicons name="people-outline" size={20} color="#086359" />
          </View>
          <Text style={styles.actionTileText}>Members</Text>
        </TouchableOpacity>
      </View>

      {/* Tab Switcher */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'DUES' && styles.tabActive]}
          onPress={() => setActiveTab('DUES')}
          activeOpacity={0.8}
        >
          <Text style={[styles.tabText, activeTab === 'DUES' && styles.tabTextActive]}>
            Assigned Dues ({customersWithDues.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'COLLECTED' && styles.tabActive]}
          onPress={() => setActiveTab('COLLECTED')}
          activeOpacity={0.8}
        >
          <Text style={[styles.tabText, activeTab === 'COLLECTED' && styles.tabTextActive]}>
            Recorded Receipts
          </Text>
        </TouchableOpacity>
      </View>

      {activeTab === 'DUES' ? (
        <FlatList
          data={customersWithDues}
          keyExtractor={(item, index) => `${item.id || item.phone || 'due'}-${index}`}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#0C8A7D"
            />
          }
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
                    <Ionicons name="open-outline" size={14} color="#0C8A7D" />
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
                  activeOpacity={0.8}
                >
                  <Ionicons name="call" size={14} color="#FFFFFF" />
                  <Text style={styles.btnTextWhite}>Call</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.waBtn}
                  onPress={() =>
                    openWhatsApp(item.phone || item.mobile, item.name, item.pending)
                  }
                  activeOpacity={0.8}
                >
                  <Ionicons name="logo-whatsapp" size={14} color="#FFFFFF" />
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
                  activeOpacity={0.8}
                >
                  <Ionicons name="cash" size={14} color="#FFFFFF" />
                  <Text style={styles.btnTextTeal}>Collect</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        />
      ) : (
        <FlatList
          data={ledgerEntries}
          keyExtractor={(item, index) => `${item.id || 'rec'}-${index}`}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#0C8A7D"
            />
          }
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
    backgroundColor: '#F9FBFB',
  },
  heroCard: {
    backgroundColor: '#0C8A7D',
    margin: 16,
    borderRadius: 22,
    padding: 20,
    shadowColor: '#0C8A7D',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 4,
  },
  heroTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  roleTag: {
    fontSize: 10,
    fontWeight: '800',
    color: '#FFECC2',
    letterSpacing: 1,
  },
  staffName: {
    fontSize: 19,
    fontWeight: '800',
    color: '#FFFFFF',
    marginTop: 2,
    letterSpacing: 0.2,
  },
  newReceiptBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 14,
    gap: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  newReceiptText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0C8A7D',
  },
  notifBtn: {
    width: 38,
    height: 38,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
  },
  notifBadgeDot: {
    position: 'absolute',
    top: 7,
    right: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EF4444',
    borderWidth: 1.5,
    borderColor: '#0C8A7D',
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
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
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: 'rgba(255, 255, 255, 0.8)',
    letterSpacing: 0.5,
  },
  collectionAmt: {
    fontSize: 19,
    fontWeight: '800',
    color: '#FFECC2',
    marginTop: 4,
  },
  overdueAmt: {
    fontSize: 19,
    fontWeight: '800',
    color: '#FED7AA',
    marginTop: 4,
  },
  quickActionsCard: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 20,
    paddingVertical: 14,
    paddingHorizontal: 10,
    flexDirection: 'row',
    justifyContent: 'space-around',
    borderWidth: 1,
    borderColor: '#D8E4E5',
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
    color: '#133336',
    textAlign: 'center',
  },
  tabContainer: {
    flexDirection: 'row',
    marginHorizontal: 16,
    backgroundColor: '#E8F5F3',
    borderRadius: 14,
    padding: 4,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#C3E5E0',
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 10,
  },
  tabActive: {
    backgroundColor: '#0C8A7D',
    shadowColor: '#0C8A7D',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 2,
  },
  tabText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#7E9596',
  },
  tabTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  listContent: {
    padding: 16,
    gap: 12,
  },
  dueCard: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#D8E4E5',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
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
    color: '#133336',
  },
  custPhone: {
    fontSize: 12,
    color: '#7E9596',
    marginTop: 2,
  },
  pendingAmount: {
    fontSize: 16,
    fontWeight: '800',
    color: '#D97706',
  },
  pendingLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: '#7E9596',
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
    backgroundColor: '#0284C7',
    paddingVertical: 9,
    borderRadius: 10,
    gap: 5,
  },
  waBtn: {
    flex: 1.2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#16A34A',
    paddingVertical: 9,
    borderRadius: 10,
    gap: 5,
  },
  collectBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0C8A7D',
    paddingVertical: 9,
    borderRadius: 10,
    gap: 5,
  },
  btnTextWhite: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  btnTextTeal: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  receiptCard: {
    backgroundColor: '#FFFFFF',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#D8E4E5',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  recHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  recNo: {
    fontSize: 13,
    fontWeight: '700',
    color: '#7E9596',
  },
  recAmt: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0C8A7D',
  },
  recDesc: {
    fontSize: 14,
    fontWeight: '700',
    color: '#133336',
    marginTop: 4,
  },
  recMeta: {
    fontSize: 11,
    color: '#7E9596',
    marginTop: 2,
  },
});
