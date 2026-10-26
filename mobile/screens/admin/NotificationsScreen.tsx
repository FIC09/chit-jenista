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

export interface AppNotificationItem {
  id: string;
  type: 'PAYMENT_VERIFICATION' | 'OVERDUE_DUE' | 'NEW_MEMBER';
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
  const [notifications, setNotifications] = useState<AppNotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState<'ALL' | 'PAYMENTS' | 'DUES'>('ALL');

  const loadNotifications = async () => {
    try {
      const items: AppNotificationItem[] = [];

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
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    loadNotifications();
  };

  const filtered = notifications.filter((item) => {
    if (activeFilter === 'PAYMENTS') return item.type === 'PAYMENT_VERIFICATION';
    if (activeFilter === 'DUES') return item.type === 'OVERDUE_DUE';
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
      <StatusBar barStyle="light-content" />

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
            <Ionicons name="refresh" size={18} color={Colors.white} />
          </TouchableOpacity>
        </View>

        {/* Filter Pills */}
        <View style={styles.filterRow}>
          <TouchableOpacity
            style={[styles.filterPill, activeFilter === 'ALL' && styles.filterPillActive]}
            onPress={() => setActiveFilter('ALL')}
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
          <ActivityIndicator size="large" color={Colors.gold.primary} />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
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
              <View style={styles.emptyIconCircle}>
                <Ionicons name="checkmark-done" size={32} color={Colors.success} />
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
    backgroundColor: '#F8FAFC',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    backgroundColor: Colors.navy.primary,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 18,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.white,
    letterSpacing: -0.4,
  },
  headerSub: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.7)',
    marginTop: 2,
    fontWeight: '500',
  },
  refreshBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
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
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  filterPillActive: {
    backgroundColor: Colors.gold.primary,
  },
  filterPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: 'rgba(255, 255, 255, 0.8)',
  },
  filterPillTextActive: {
    color: '#0B1A30',
  },
  listContent: {
    padding: 16,
    paddingBottom: 40,
  },
  card: {
    backgroundColor: Colors.white,
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
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
    color: '#0F172A',
    flex: 1,
    marginRight: 8,
  },
  timeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#94A3B8',
  },
  subtitleText: {
    fontSize: 12.5,
    color: '#475569',
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
    color: Colors.primary[600],
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
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 6,
  },
  emptySub: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 19,
  },
});
