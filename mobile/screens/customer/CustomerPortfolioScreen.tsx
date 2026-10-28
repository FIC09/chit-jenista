import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  StatusBar,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../store/AuthContext';
import { DataSyncManager } from '../../services/dataSync';
import { secureStorage } from '../../services/storage';
import { formatCurrency } from '../../utils/format';
import { CustomerChit } from '../../types';
import { buildCustomerChitSchedule } from '../../utils/customerChitSchedule';

const { width } = Dimensions.get('window');

export const CustomerPortfolioScreen: React.FC<{ navigation: any; route?: any }> = ({
  navigation,
  route,
}) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [customerRecord, setCustomerRecord] = useState<any>(null);
  const [chits, setChits] = useState<CustomerChit[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [pendingWithdrawals, setPendingWithdrawals] = useState<any[]>([]);
  const [portfolioFilter, setPortfolioFilter] = useState<'ALL' | 'ACTIVE' | 'DISBURSED'>('ALL');

  useEffect(() => {
    loadPortfolioData();
  }, [user]);

  const loadPortfolioData = async () => {
    try {
      if (!user) return;
      const [allCustomers, ledgerRaw, wReqsRaw] = await Promise.all([
        DataSyncManager.getCustomers(),
        secureStorage.getItem('synced_ledger'),
        secureStorage.getItem('synced_withdrawal_requests'),
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

      if (found) {
        setCustomerRecord(found);
        setChits(found.chits || []);
      } else {
        setChits([]);
      }

      if (wReqsRaw) {
        try {
          const parsed = JSON.parse(wReqsRaw);
          if (Array.isArray(parsed)) {
            const userW = parsed.filter(
              (w: any) =>
                w.customerId === user.id || (found && w.customerId === found.id)
            );
            setPendingWithdrawals(userW);
          }
        } catch {}
      }

      if (ledgerRaw) {
        try {
          const parsedLedger = JSON.parse(ledgerRaw);
          if (Array.isArray(parsedLedger)) {
            const userTrx = parsedLedger.filter(
              (t: any) =>
                t.customerId === user.id ||
                t.reference?.includes(user.id) ||
                t.description?.includes(user.id) ||
                (found && (t.customerId === found.id || t.reference?.includes(found.name)))
            );
            setTransactions(userTrx);
          }
        } catch {}
      }
    } catch (e) {
      console.error('Error loading customer portfolio:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadPortfolioData();
  };

  // Calculations for portfolio summary
  const totalChitValue = useMemo(() => {
    return chits.reduce((acc, c) => acc + Number(c.chitValue || 0), 0);
  }, [chits]);

  const totalInvested = useMemo(() => {
    return transactions.reduce((acc, t) => acc + (Number(t.amount) || 0), 0);
  }, [transactions]);

  const totalDisbursed = useMemo(() => {
    const fromChits = chits.reduce((acc, c: any) => acc + (c.isWithdrawn ? Number(c.withdrawnAmount || 0) : 0), 0);
    const fromWReqs = pendingWithdrawals
      .filter((w) => w.status === 'DISBURSED')
      .reduce((acc, w) => acc + Number(w.eligibleAmount || 0), 0);
    return fromChits + fromWReqs;
  }, [chits, pendingWithdrawals]);

  const profitLoss = useMemo(() => {
    // If disbursed amount exists, difference from invested, else estimated dividend gains (approx 7.6%)
    if (totalDisbursed > 0) {
      return totalDisbursed - totalInvested;
    }
    return Math.round(totalInvested * 0.0759);
  }, [totalDisbursed, totalInvested]);

  const returnsPct = useMemo(() => {
    if (totalInvested === 0) return '+0.00%';
    const pct = (profitLoss / totalInvested) * 100;
    return `+ ${pct.toFixed(2)}%`;
  }, [profitLoss, totalInvested]);

  const filteredChits = useMemo(() => {
    if (portfolioFilter === 'ACTIVE') {
      return chits.filter((c: any) => !c.isWithdrawn);
    }
    if (portfolioFilter === 'DISBURSED') {
      return chits.filter((c: any) => c.isWithdrawn);
    }
    return chits;
  }, [chits, portfolioFilter]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#0C8A7D" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <StatusBar barStyle="dark-content" />

      {/* Top Header Bar matching Funds Genie 'My Portfolio' */}
      <View style={styles.topHeader}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={24} color="#0C8A7D" />
        </TouchableOpacity>
        <Text style={styles.screenTitle}>My Portfolio</Text>
        <TouchableOpacity
          style={styles.notifBtn}
          onPress={() => navigation.navigate('Notifications')}
          activeOpacity={0.7}
        >
          <Ionicons name="notifications-outline" size={22} color="#0C8A7D" />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#0C8A7D" />}
      >
        {/* Hero Current Value Display */}
        <View style={styles.heroSection}>
          <Text style={styles.heroSubText}>Current Value</Text>
          <View style={styles.heroAmountRow}>
            <Text style={styles.heroMainAmount}>{formatCurrency(totalChitValue || totalInvested)}</Text>
            <Ionicons name="arrow-up" size={22} color="#0C8A7D" style={{ marginLeft: 6 }} />
          </View>
        </View>

        {/* 4-Cell Portfolio Metrics Grid (Invested, Returns, Profit/Loss, 1 Day Change) */}
        <View style={styles.metricsGrid}>
          <View style={styles.metricCell}>
            <Text style={styles.metricLabel}>Invested</Text>
            <Text style={styles.metricVal}>{formatCurrency(totalInvested)}</Text>
          </View>

          <View style={[styles.metricCell, styles.metricCellBorderLeft]}>
            <Text style={styles.metricLabel}>Returns</Text>
            <Text style={[styles.metricVal, { color: '#0C8A7D' }]}>{returnsPct}</Text>
          </View>

          <View style={[styles.metricCell, styles.metricCellBorderTop]}>
            <Text style={styles.metricLabel}>Profit / Loss</Text>
            <Text style={[styles.metricVal, { color: '#0C8A7D' }]}>
              {profitLoss >= 0 ? `+ ${formatCurrency(profitLoss)}` : formatCurrency(profitLoss)}
            </Text>
          </View>

          <View style={[styles.metricCell, styles.metricCellBorderLeft, styles.metricCellBorderTop]}>
            <Text style={styles.metricLabel}>Active Chits</Text>
            <Text style={[styles.metricVal, { color: '#0C8A7D' }]}>
              {chits.length} Schemes
            </Text>
          </View>
        </View>

        {/* Section Header: MY CURRENT INVESTMENTS */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionHeading}>MY CURRENT INVESTMENTS</Text>
          <View style={styles.filterPillsRow}>
            <TouchableOpacity
              style={[styles.filterPill, portfolioFilter === 'ALL' && styles.filterPillActive]}
              onPress={() => setPortfolioFilter('ALL')}
            >
              <Text style={[styles.filterPillText, portfolioFilter === 'ALL' && styles.filterPillTextActive]}>
                All ({chits.length})
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.filterPill, portfolioFilter === 'ACTIVE' && styles.filterPillActive]}
              onPress={() => setPortfolioFilter('ACTIVE')}
            >
              <Text style={[styles.filterPillText, portfolioFilter === 'ACTIVE' && styles.filterPillTextActive]}>
                Active
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Investments Cards List */}
        {filteredChits.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons name="layers-outline" size={44} color="#7E9596" />
            <Text style={styles.emptyTitle}>No Chit Enrollments</Text>
            <Text style={styles.emptySub}>
              You currently do not have any enrolled chits under this filter.
            </Text>
          </View>
        ) : (
          filteredChits.map((item, idx) => {
            const chitVal = Number(item.chitValue) || 100000;
            const wReq = pendingWithdrawals.find((w) => w.groupId === item.groupId);
            const isDisbursed = item.isWithdrawn || (wReq && wReq.status === 'DISBURSED');
            const scheduleSummary = buildCustomerChitSchedule({
              customer: customerRecord || user,
              chit: item,
              ledgerTransactions: transactions,
            });

            const paidMonths = scheduleSummary.completedMonthsCount;
            const totalMonths = scheduleSummary.totalDurationMonths || 20;
            const progress = Math.min(100, Math.round((paidMonths / totalMonths) * 100));

            return (
              <View key={idx} style={styles.investmentCard}>
                <View style={styles.invCardTop}>
                  <View style={styles.brandIconBox}>
                    <Text style={styles.brandIconText}>CHIT</Text>
                  </View>
                  <View style={{ flex: 1, paddingLeft: 12 }}>
                    <Text style={styles.invGroupTitle} numberOfLines={1}>{item.groupName}</Text>
                    <Text style={styles.invMetaText}>
                      Ticket #{item.ticketNumber} • {item.scheme || 'Auction'} Scheme
                    </Text>
                  </View>
                  <View style={[styles.statusTag, isDisbursed && styles.statusTagDisbursed]}>
                    <Text style={[styles.statusTagText, isDisbursed && styles.statusTagTextDisbursed]}>
                      {isDisbursed ? 'PRIZE PAID' : item.paymentStatus || 'ACTIVE'}
                    </Text>
                  </View>
                </View>

                {/* Progress bar */}
                <View style={styles.progressContainer}>
                  <View style={styles.progressLabelRow}>
                    <Text style={styles.progressLabelText}>
                      Installments Completed: {paidMonths} / {totalMonths} Months
                    </Text>
                    <Text style={styles.progressPctText}>{progress}%</Text>
                  </View>
                  <View style={styles.progressBarTrack}>
                    <View style={[styles.progressBarFill, { width: `${progress}%` }]} />
                  </View>
                </View>

                {/* Metrics Breakdown */}
                <View style={styles.invMetricsRow}>
                  <View>
                    <Text style={styles.invMetricLabel}>CHIT VALUE</Text>
                    <Text style={styles.invMetricVal}>{formatCurrency(chitVal)}</Text>
                  </View>
                  <View>
                    <Text style={styles.invMetricLabel}>MONTHLY DUE</Text>
                    <Text style={styles.invMetricVal}>{formatCurrency(item.monthlyInstallment || 5000)}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.invMetricLabel}>TOTAL PAID</Text>
                    <Text style={[styles.invMetricVal, { color: '#0C8A7D' }]}>
                      {formatCurrency(scheduleSummary.totalPaidAmount)}
                    </Text>
                  </View>
                </View>

                {/* Card Action */}
                <TouchableOpacity
                  style={styles.invActionBtn}
                  onPress={() =>
                    navigation.navigate('CustomerSchedule', {
                      customer: customerRecord,
                      chit: item,
                    })
                  }
                  activeOpacity={0.8}
                >
                  <Ionicons name="calendar-outline" size={14} color="#0C8A7D" />
                  <Text style={styles.invActionBtnText}>View Due Schedule & Statement</Text>
                  <Ionicons name="chevron-forward" size={14} color="#0C8A7D" />
                </TouchableOpacity>
              </View>
            );
          })
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F9FBFB',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F9FBFB',
  },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#F9FBFB',
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D8E4E5',
  },
  screenTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#086359',
  },
  notifBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D8E4E5',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  heroSection: {
    alignItems: 'center',
    marginVertical: 16,
  },
  heroSubText: {
    fontSize: 13,
    color: '#7E9596',
    fontWeight: '600',
    marginBottom: 4,
  },
  heroAmountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroMainAmount: {
    fontSize: 34,
    fontWeight: '900',
    color: '#133336',
    letterSpacing: -0.6,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#D8E4E5',
    overflow: 'hidden',
    marginBottom: 20,
  },
  metricCell: {
    width: '50%',
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  metricCellBorderLeft: {
    borderLeftWidth: 1,
    borderLeftColor: '#F0F5F5',
  },
  metricCellBorderTop: {
    borderTopWidth: 1,
    borderTopColor: '#F0F5F5',
  },
  metricLabel: {
    fontSize: 12,
    color: '#7E9596',
    fontWeight: '600',
    marginBottom: 6,
  },
  metricVal: {
    fontSize: 17,
    fontWeight: '800',
    color: '#133336',
  },
  waveChartCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#D8E4E5',
    marginBottom: 22,
  },
  chartHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  chartTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#7E9596',
    letterSpacing: 0.5,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#E8F5F3',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#0C8A7D',
  },
  liveText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#0C8A7D',
  },
  waveIllustrationContainer: {
    height: 100,
    width: '100%',
    position: 'relative',
    justifyContent: 'center',
  },
  waveHorizontalGuide: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 30,
    height: 1,
    backgroundColor: '#F0F5F5',
  },
  waveHorizontalGuide2: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 70,
    height: 1,
    backgroundColor: '#F0F5F5',
  },
  curvePointsWrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  },
  waveCurveSegment: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#0C8A7D',
  },
  decorativeCurvedLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 48,
    borderBottomWidth: 3,
    borderBottomColor: '#0C8A7D',
    borderRadius: 35,
    top: 20,
  },
  chartDatesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F0F5F5',
  },
  chartDateText: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '600',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionHeading: {
    fontSize: 12,
    fontWeight: '800',
    color: '#7E9596',
    letterSpacing: 0.6,
  },
  filterPillsRow: {
    flexDirection: 'row',
    gap: 6,
  },
  filterPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D8E4E5',
  },
  filterPillActive: {
    backgroundColor: '#0C8A7D',
    borderColor: '#0C8A7D',
  },
  filterPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#7E9596',
  },
  filterPillTextActive: {
    color: '#FFFFFF',
  },
  investmentCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#D8E4E5',
    marginBottom: 14,
  },
  invCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  brandIconBox: {
    width: 44,
    height: 32,
    borderRadius: 6,
    backgroundColor: '#DC2626',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandIconText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  invGroupTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#133336',
  },
  invMetaText: {
    fontSize: 11,
    color: '#7E9596',
    marginTop: 2,
  },
  statusTag: {
    backgroundColor: '#E8F5F3',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  statusTagDisbursed: {
    backgroundColor: '#FEF3C7',
  },
  statusTagText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#0C8A7D',
  },
  statusTagTextDisbursed: {
    color: '#D97706',
  },
  progressContainer: {
    marginTop: 14,
    marginBottom: 14,
  },
  progressLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  progressLabelText: {
    fontSize: 11,
    color: '#7E9596',
    fontWeight: '600',
  },
  progressPctText: {
    fontSize: 11,
    color: '#0C8A7D',
    fontWeight: '700',
  },
  progressBarTrack: {
    height: 6,
    backgroundColor: '#F0F5F5',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#0C8A7D',
    borderRadius: 3,
  },
  invMetricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F0F5F5',
    marginBottom: 12,
  },
  invMetricLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#94A3B8',
  },
  invMetricVal: {
    fontSize: 13,
    fontWeight: '800',
    color: '#133336',
    marginTop: 3,
  },
  invActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#E8F5F3',
    paddingVertical: 9,
    borderRadius: 10,
  },
  invActionBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0C8A7D',
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    padding: 30,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#D8E4E5',
    marginTop: 10,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#133336',
    marginTop: 10,
  },
  emptySub: {
    fontSize: 12,
    color: '#7E9596',
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 18,
  },
});
