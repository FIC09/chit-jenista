import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  StatusBar,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../theme/colors';
import { formatCurrency } from '../../utils/format';
import { secureStorage } from '../../services/storage';
import { DataSyncManager } from '../../services/dataSync';
import { PaymentRequest } from '../../types';

import { useAuth } from '../../store/AuthContext';

export interface AppNotificationItem {
  id: string;
  type: 'PAYMENT_VERIFICATION' | 'OVERDUE_DUE' | 'NEW_MEMBER' | 'PAYMENT_APPROVED' | 'INSTALLMENT_DUE' | 'RECEIPT_RECORDED';
  title: string;
  subtitle: string;
  time: string;
  route: string;
  params?: any;
  amount?: number;
  badgeText: string;
  badgeColor: string;
  icon: any;
  iconBg: string;
  iconColor: string;
}

export const NotificationsScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<AppNotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState<'ALL' | 'PAYMENTS' | 'DUES'>('ALL');

  const isCustomer = user?.role === 'CUSTOMER';
  const isStaff = user?.role === 'STAFF' || user?.role === 'COLLECTION_AGENT';

  const loadNotifications = async () => {
    try {
      const items: AppNotificationItem[] = [];

      if (isCustomer) {
        // Customer notifications:
        // 1. Payment Requests submitted by this customer
        const rawReqs = await secureStorage.getItem('payment_requests');
        if (rawReqs) {
          try {
            const parsed: PaymentRequest[] = JSON.parse(rawReqs);
            if (Array.isArray(parsed)) {
              const myReqs = parsed.filter(
                (p) =>
                  p.customerId === user?.id ||
                  (user?.phone && p.customerMobile === user.phone) ||
                  (user?.name && p.customerName?.toLowerCase() === user.name?.toLowerCase())
              );

              myReqs.forEach((req) => {
                const isApproved = req.status === 'APPROVED';
                items.push({
                  id: `PAY-${req.id}`,
                  type: isApproved ? 'PAYMENT_APPROVED' : 'PAYMENT_VERIFICATION',
                  title: isApproved ? 'Payment Verified & Credited' : 'Payment Awaiting Verification',
                  subtitle: isApproved
                    ? `Your payment of ${formatCurrency(Number(req.amount))} via ${req.paymentMode || 'Online'} has been verified and adjusted.`
                    : `Payment of ${formatCurrency(Number(req.amount))} submitted (Ref: ${req.referenceNumber || 'N/A'}). Admin verification in progress.`,
                  time: req.requestedAt
                    ? new Date(req.requestedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
                    : 'Recent',
                  route: 'CustomerPaymentHistory',
                  amount: Number(req.amount),
                  badgeText: isApproved ? 'VERIFIED' : 'UNDER REVIEW',
                  badgeColor: isApproved ? '#059669' : '#D97706',
                  icon: isApproved ? 'checkmark-circle-outline' : 'time-outline',
                  iconBg: isApproved ? '#D1FAE5' : '#FEF3C7',
                  iconColor: isApproved ? '#059669' : '#B45309',
                });
              });
            }
          } catch {}
        }

        // 2. Customer Chit Dues
        const custs = await DataSyncManager.getCustomers();
        const currentCust = custs.find(
          (c) =>
            c.id === user?.id ||
            (user?.phone && c.phone === user?.phone) ||
            (user?.name && c.name?.toLowerCase() === user.name?.toLowerCase())
        );

        if (currentCust && Number(currentCust.pending || 0) > 0) {
          items.push({
            id: `DUE-${currentCust.id}`,
            type: 'INSTALLMENT_DUE',
            title: 'Upcoming Installment Due',
            subtitle: `You have an active pending due balance of ${formatCurrency(Number(currentCust.pending || 0))}. Pay early to maintain high bidding eligibility.`,
            time: 'Due This Cycle',
            route: 'CustomerHome',
            amount: Number(currentCust.pending || 0),
            badgeText: 'INSTALLMENT DUE',
            badgeColor: '#EF4444',
            icon: 'alert-circle-outline',
            iconBg: '#FEE2E2',
            iconColor: '#DC2626',
          });
        }

        // 3. Receipt updates for customer
        const rawReceipts = await secureStorage.getItem('local_receipts');
        if (rawReceipts) {
          try {
            const receipts = JSON.parse(rawReceipts);
            if (Array.isArray(receipts)) {
              const myReceipts = receipts.filter(
                (r: any) =>
                  r.customerId === user?.id ||
                  (user?.phone && r.customerPhone === user.phone) ||
                  (user?.name && r.customerName?.toLowerCase() === user.name?.toLowerCase())
              );
              myReceipts.slice(0, 3).forEach((r: any) => {
                items.push({
                  id: `RCPT-${r.receiptNo || r.id}`,
                  type: 'RECEIPT_RECORDED',
                  title: `Official Receipt #${r.receiptNo || 'REC'} Issued`,
                  subtitle: `Field payment of ${formatCurrency(Number(r.amount || 0))} recorded successfully.`,
                  time: r.createdAt ? new Date(r.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : 'Recent',
                  route: 'CustomerPaymentHistory',
                  amount: Number(r.amount || 0),
                  badgeText: 'RECEIPT ISSUED',
                  badgeColor: '#2563EB',
                  icon: 'receipt-outline',
                  iconBg: '#DBEAFE',
                  iconColor: '#1D4ED8',
                });
              });
            }
          } catch {}
        }
      } else if (isStaff) {
        // Staff notifications:
        // 1. Members with pending collections
        const custs = await DataSyncManager.getCustomers();
        const pendingCusts = custs.filter((c) => Number(c.pending || 0) > 0);

        pendingCusts.slice(0, 10).forEach((c) => {
          items.push({
            id: `COLLECT-${c.id}`,
            type: 'OVERDUE_DUE',
            title: `Collection Pending: ${c.name}`,
            subtitle: `Member has pending due of ${formatCurrency(Number(c.pending || 0))} in ${(c.chits && c.chits[0]?.groupName) || 'Chit Fund'}. Phone: ${c.phone || c.mobile || 'N/A'}`,
            time: 'Action Required',
            route: 'ReceiptEntry',
            params: { prefillCustomer: c },
            amount: Number(c.pending || 0),
            badgeText: 'COLLECT DUE',
            badgeColor: '#EF4444',
            icon: 'cash-outline',
            iconBg: '#FEE2E2',
            iconColor: '#DC2626',
          });
        });

        // 2. Staff recent receipts
        const rawReceipts = await secureStorage.getItem('local_receipts');
        if (rawReceipts) {
          try {
            const receipts = JSON.parse(rawReceipts);
            if (Array.isArray(receipts)) {
              receipts.slice(0, 5).forEach((r: any) => {
                items.push({
                  id: `RCPT-${r.receiptNo || r.id}`,
                  type: 'RECEIPT_RECORDED',
                  title: `Receipt #${r.receiptNo || 'REC'} Logged`,
                  subtitle: `Collected ${formatCurrency(Number(r.amount || 0))} from ${r.customerName || 'Member'}.`,
                  time: r.createdAt ? new Date(r.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : 'Logged',
                  route: 'ReceiptEntry',
                  amount: Number(r.amount || 0),
                  badgeText: 'COLLECTION LOGGED',
                  badgeColor: '#059669',
                  icon: 'checkmark-done-circle-outline',
                  iconBg: '#D1FAE5',
                  iconColor: '#059669',
                });
              });
            }
          } catch {}
        }
      } else {
        // Admin notifications:
        // 1. Fetch pending payment verifications
        const rawReqs = await secureStorage.getItem('payment_requests');
        if (rawReqs) {
          try {
            const parsed: PaymentRequest[] = JSON.parse(rawReqs);
            if (Array.isArray(parsed)) {
              const pendingReqs = parsed.filter(
                (p) =>
                  (!p.status || p.status === 'PENDING' || p.status === ('PENDING_VERIFICATION' as any)) &&
                  !['PAY-78201', 'PAY-78202', 'PAY-78203', 'PAY-78190'].includes(p.id)
              );

              pendingReqs.forEach((req) => {
                items.push({
                  id: `PAY-${req.id}`,
                  type: 'PAYMENT_VERIFICATION',
                  title: 'Online Payment Verification Required',
                  subtitle: `${req.customerName} submitted payment of ${formatCurrency(Number(req.amount))} via ${req.paymentMode || 'Online'} (Ref: ${req.referenceNumber || 'N/A'})`,
                  time: req.requestedAt ? new Date(req.requestedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : 'Pending',
                  route: 'PaymentVerifications',
                  amount: Number(req.amount),
                  badgeText: 'APPROVAL NEEDED',
                  badgeColor: '#D97706',
                  icon: 'receipt-outline',
                  iconBg: '#FEF3C7',
                  iconColor: '#B45309',
                });
              });
            }
          } catch {}
        }

        // 2. Fetch pending / overdue customer dues
        const custs = await DataSyncManager.getCustomers();
        const overdueCusts = custs.filter((c) => Number(c.pending || 0) > 0);

        overdueCusts.slice(0, 10).forEach((c) => {
          items.push({
            id: `DUE-${c.id}`,
            type: 'OVERDUE_DUE',
            title: `Overdue Installment: ${c.name}`,
            subtitle: `Member has pending due of ${formatCurrency(Number(c.pending || 0))} in ${(c.chits && c.chits[0]?.groupName) || 'Chit Fund'}`,
            time: 'Due Now',
            route: 'CustomerDetail',
            params: { customer: c },
            amount: Number(c.pending || 0),
            badgeText: 'OVERDUE DUE',
            badgeColor: '#EF4444',
            icon: 'alert-circle-outline',
            iconBg: '#FEE2E2',
            iconColor: '#DC2626',
          });
        });

        // 3. New Members recently enrolled
        const recentCusts = [...custs].reverse().slice(0, 3);
        recentCusts.forEach((c) => {
          items.push({
            id: `MEM-${c.id}`,
            type: 'NEW_MEMBER',
            title: `Member Active: ${c.name}`,
            subtitle: `Registered with ${c.activeChits || 1} active chit plan(s). Phone: ${c.phone || c.mobile || '—'}`,
            time: 'Active',
            route: 'CustomerDetail',
            params: { customer: c },
            badgeText: 'MEMBER',
            badgeColor: '#059669',
            icon: 'person-outline',
            iconBg: '#D1FAE5',
            iconColor: '#059669',
          });
        });
      }

      setNotifications(items);
    } catch (e) {
      console.warn('Failed to load notifications:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadNotifications();
  }, [user]);

  const onRefresh = () => {
    setRefreshing(true);
    loadNotifications();
  };

  const filtered = notifications.filter((item) => {
    if (activeFilter === 'PAYMENTS') {
      return item.type === 'PAYMENT_VERIFICATION' || item.type === 'PAYMENT_APPROVED' || item.type === 'RECEIPT_RECORDED';
    }
    if (activeFilter === 'DUES') {
      return item.type === 'OVERDUE_DUE' || item.type === 'INSTALLMENT_DUE';
    }
    return true;
  });

  const handlePress = (item: AppNotificationItem) => {
    if (item.params) {
      navigation.navigate(item.route, item.params);
    } else {
      navigation.navigate(item.route);
    }
  };

  const renderItem = ({ item }: { item: AppNotificationItem }) => (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.7}
      onPress={() => handlePress(item)}
    >
      <View style={[styles.iconCircle, { backgroundColor: item.iconBg }]}>
        <Ionicons name={item.icon} size={22} color={item.iconColor} />
      </View>

      <View style={{ flex: 1, marginLeft: 14 }}>
        <View style={styles.cardHeaderRow}>
          <Text style={styles.cardTitle} numberOfLines={1}>
            {item.title}
          </Text>
          <Text style={styles.timeText}>{item.time}</Text>
        </View>

        <Text style={styles.subtitleText}>{item.subtitle}</Text>

        <View style={styles.footerRow}>
          <View style={[styles.badge, { backgroundColor: `${item.badgeColor}15` }]}>
            <Text style={[styles.badgeText, { color: item.badgeColor }]}>
              {item.badgeText}
            </Text>
          </View>

          <View style={styles.actionLink}>
            <Text style={styles.actionLinkText}>View Details</Text>
            <Ionicons name="chevron-forward" size={14} color={Colors.primary[600]} />
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />

      {/* Header Banner */}
      <View style={styles.header}>
        <View style={styles.headerTitleRow}>
          <View>
            <Text style={styles.headerTitle}>Notifications & Alerts</Text>
            <Text style={styles.headerSub}>
              {notifications.length} live update{notifications.length === 1 ? '' : 's'} requiring attention
            </Text>
          </View>
          <TouchableOpacity
            style={styles.refreshBtn}
            onPress={onRefresh}
            activeOpacity={0.7}
          >
            <Ionicons name="refresh" size={18} color="#0C8A7D" />
          </TouchableOpacity>
        </View>

        {/* Filter Pills */}
        <View style={styles.filterRow}>
          <TouchableOpacity
            style={[styles.filterPill, activeFilter === 'ALL' && styles.filterPillActive]}
            onPress={() => setActiveFilter('ALL')}
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.filterPillText,
                activeFilter === 'ALL' && styles.filterPillTextActive,
              ]}
            >
              All ({notifications.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.filterPill, activeFilter === 'PAYMENTS' && styles.filterPillActive]}
            onPress={() => setActiveFilter('PAYMENTS')}
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.filterPillText,
                activeFilter === 'PAYMENTS' && styles.filterPillTextActive,
              ]}
            >
              Payments ({notifications.filter((n) => n.type === 'PAYMENT_VERIFICATION').length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.filterPill, activeFilter === 'DUES' && styles.filterPillActive]}
            onPress={() => setActiveFilter('DUES')}
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.filterPillText,
                activeFilter === 'DUES' && styles.filterPillTextActive,
              ]}
            >
              Overdue ({notifications.filter((n) => n.type === 'OVERDUE_DUE').length})
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#0C8A7D" />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item, index) => `${item.id || 'notif'}-${index}`}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#0C8A7D"
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconCircle}>
                <Ionicons name="checkmark-done" size={32} color="#0C8A7D" />
              </View>
              <Text style={styles.emptyTitle}>All Caught Up!</Text>
              <Text style={styles.emptySub}>
                There are no pending notifications or verification requests at this moment.
              </Text>
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
    backgroundColor: '#F9FBFB',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#D8E4E5',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 2,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#086359',
    letterSpacing: -0.3,
  },
  headerSub: {
    fontSize: 12,
    color: '#7E9596',
    marginTop: 2,
    fontWeight: '500',
  },
  refreshBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#E8F5F3',
    borderWidth: 1,
    borderColor: '#C3E5E0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
  },
  filterPill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#F0F5F5',
    borderWidth: 1,
    borderColor: '#D8E4E5',
  },
  filterPillActive: {
    backgroundColor: '#0C8A7D',
    borderColor: '#0C8A7D',
  },
  filterPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#7E9596',
  },
  filterPillTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  listContent: {
    padding: 16,
    paddingBottom: 40,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderWidth: 1,
    borderColor: '#D8E4E5',
    shadowColor: '#0C8A7D',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#133336',
    flex: 1,
    marginRight: 8,
  },
  timeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#7E9596',
  },
  subtitleText: {
    fontSize: 12.5,
    color: '#4A6263',
    lineHeight: 18,
    fontWeight: '500',
    marginBottom: 10,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  actionLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  actionLinkText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0C8A7D',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 32,
  },
  emptyIconCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#E8F5F3',
    borderWidth: 1,
    borderColor: '#C3E5E0',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#086359',
    marginBottom: 6,
  },
  emptySub: {
    fontSize: 13,
    color: '#7E9596',
    textAlign: 'center',
    lineHeight: 19,
  },
});
