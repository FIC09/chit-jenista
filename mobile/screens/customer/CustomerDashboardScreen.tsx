import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  StatusBar,
  Modal,
  TextInput,
  Alert,
  Linking,
  Image,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../theme/colors';
import { useAuth } from '../../store/AuthContext';
import { DataSyncManager } from '../../services/dataSync';
import { formatCurrency, formatDate } from '../../utils/format';
import { CustomerChit } from '../../types';
import { secureStorage } from '../../services/storage';
import { generateAndShareReceipt } from '../../services/receiptService';
import {
  calculateRegularPlanSchedule,
  calculateFixedPlanSchedule,
  calculateAuctionPlanSchedule,
  defaultRegularCategories,
  defaultFixedCategories,
  defaultAuctionCategories,
} from '../../utils/chitCalculations';
import { buildCustomerChitSchedule } from '../../utils/customerChitSchedule';

export const CustomerDashboardScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<'myChits' | 'regularPlan' | 'fixedPlan' | 'auctionPlan'>('myChits');
  const [customerRecord, setCustomerRecord] = useState<any>(null);
  const [chits, setChits] = useState<CustomerChit[]>([]);
  const [totalInvested, setTotalInvested] = useState(0);
  const [pendingDues, setPendingDues] = useState(0);
  const [companyBank, setCompanyBank] = useState<any>(null);
  const [allCompanyBanks, setAllCompanyBanks] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);
  const [pendingWithdrawals, setPendingWithdrawals] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  // Modals state
  const [paymentModalChit, setPaymentModalChit] = useState<any | null>(null);
  const [isAdvancePayment, setIsAdvancePayment] = useState(false);
  const [payAmount, setPayAmount] = useState<string>('');
  const [payMode, setPayMode] = useState<'UPI' | 'Bank Transfer' | 'Cash'>('UPI');
  const [payRefNo, setPayRefNo] = useState<string>('');
  const [payScreenshot, setPayScreenshot] = useState<string | null>(null);
  const [paySubmitting, setPaySubmitting] = useState(false);

  const [withdrawModalChit, setWithdrawModalChit] = useState<any | null>(null);
  const [withdrawPayoutMethod, setWithdrawPayoutMethod] = useState<'Bank Transfer' | 'UPI'>('Bank Transfer');
  const [bankName, setBankName] = useState('');
  const [accNo, setAccNo] = useState('');
  const [ifsc, setIfsc] = useState('');
  const [holderName, setHolderName] = useState('');
  const [upiId, setUpiId] = useState('');
  const [withdrawSubmitting, setWithdrawSubmitting] = useState(false);

  const [showStatementsModal, setShowStatementsModal] = useState(false);
  const [statementFilter, setStatementFilter] = useState<'ALL' | 'CASH' | 'ONLINE'>('ALL');
  const [statementSearch, setStatementSearch] = useState('');

  const [showQrModal, setShowQrModal] = useState<any | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Scheme Schedules selected category state
  const [selectedRegularCat, setSelectedRegularCat] = useState<number>(100000);
  const [selectedFixedCat, setSelectedFixedCat] = useState<number>(100000);
  const [selectedAuctionCat, setSelectedAuctionCat] = useState<number>(100000);

  const fetchCustomerProfile = async () => {
    try {
      if (!user) return;
      const [allCustomers, banks, ledgerRaw, reqsRaw, wReqsRaw] = await Promise.all([
        DataSyncManager.getCustomers(),
        DataSyncManager.getBankAccounts(),
        secureStorage.getItem('synced_ledger'),
        secureStorage.getItem('payment_requests'),
        secureStorage.getItem('withdrawal_requests'),
      ]);

      if (banks && banks.length > 0) {
        setAllCompanyBanks(banks);
        const defaultB = banks.find((b: any) => b.isDefault) || banks[0];
        setCompanyBank(defaultB);
      }

      const cleanUserPhone = (user.phone || user.mobile || user.id || '').replace(/\D/g, '');
      const found = allCustomers.find((c) => {
        const cPhone = (c.mobile || c.phone || '').replace(/\D/g, '');
        return (
          c.id === user.id ||
          c.mongoId === user.id ||
          (cleanUserPhone && cPhone === cleanUserPhone)
        );
      });

      // Parse Ledger Transactions
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

      // Parse Payment Requests
      let userReqs: any[] = [];
      if (reqsRaw) {
        try {
          const parsedReqs = JSON.parse(reqsRaw);
          if (Array.isArray(parsedReqs)) {
            userReqs = parsedReqs.filter(
              (r: any) =>
                r.customerId === user.id ||
                (user.phone && r.mobile?.replace(/\D/g, '') === cleanUserPhone)
            );
          }
        } catch {}
      }
      setPendingRequests(userReqs);

      // Parse Withdrawal Requests
      let userWReqs: any[] = [];
      if (wReqsRaw) {
        try {
          const parsedWReqs = JSON.parse(wReqsRaw);
          if (Array.isArray(parsedWReqs)) {
            userWReqs = parsedWReqs.filter(
              (w: any) =>
                w.customerId === user.id ||
                (user.phone && w.mobile?.replace(/\D/g, '') === cleanUserPhone)
            );
          }
        } catch {}
      }
      setPendingWithdrawals(userWReqs);

      if (found) {
        setCustomerRecord(found);
        setTotalInvested(Number(found.totalPaid || 0));
        setPendingDues(Number(found.pending || 0));
        setChits(found.chits || []);
      } else {
        setCustomerRecord(null);
        setTotalInvested(0);
        setPendingDues(0);
        setChits([]);
      }
    } catch (e) {
      console.warn('Error fetching customer profile:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchCustomerProfile();
  }, [user]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchCustomerProfile();
  };

  const copyToClipboard = (text: string, key: string) => {
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
    Alert.alert('Copied', `"${text}" copied to clipboard.`);
  };

  // Payment Submission
  const handleOpenPay = (chit: any, isAdvance: boolean = false, suggestedAmount?: number) => {
    setPaymentModalChit(chit);
    setIsAdvancePayment(isAdvance);
    setPayAmount(String(suggestedAmount || chit.monthlyInstallment || 5000));
    setPayMode('UPI');
    setPayRefNo('');
    setPayScreenshot(null);
  };

  const pickPaymentScreenshot = async () => {
    try {
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.8,
        base64: true,
      });

      if (!res.canceled && res.assets && res.assets.length > 0) {
        const asset = res.assets[0];
        // Use base64 data URI if available for cross-platform portability & admin view, or file URI
        if (asset.base64) {
          const mime = asset.mimeType || 'image/jpeg';
          setPayScreenshot(`data:${mime};base64,${asset.base64}`);
        } else {
          setPayScreenshot(asset.uri);
        }
      }
    } catch (e: any) {
      Alert.alert('Error', 'Unable to pick screenshot image.');
    }
  };

  const submitPaymentRequest = async () => {
    if (payMode !== 'Cash' && !payRefNo.trim()) {
      Alert.alert('Missing Reference', 'Please enter your Transaction / Reference / UTR ID.');
      return;
    }
    setPaySubmitting(true);
    try {
      const activeBank = companyBank || allCompanyBanks[0];
      const newReq = {
        id: `PAY-${Date.now().toString().slice(-6)}`,
        customerId: user?.id || 'CUST',
        customerName: user?.name || 'Customer',
        customerMobile: user?.phone || user?.mobile || '',
        groupId: paymentModalChit?.groupId || 'CHIT-GROUP',
        groupName: paymentModalChit?.groupName || paymentModalChit?.groupId,
        ticketNumber: paymentModalChit?.ticketNumber || '1',
        amount: Number(payAmount) || 0,
        paymentMode: payMode,
        referenceNumber: payRefNo.trim() || `CASH-${Date.now().toString().slice(-4)}`,
        paymentScreenshot: payScreenshot || undefined,
        screenshotUrl: payScreenshot || undefined,
        bankAccountId: activeBank?.id,
        bankName: activeBank?.bankName || 'Company Bank',
        requestedAt: new Date().toISOString(),
        status: 'PENDING',
        adminNotes: isAdvancePayment 
          ? `[Advance Payment] Submitted from mobile app via ${payMode}`
          : `Submitted from mobile app via ${payMode}`,
      };

      const existingRaw = await secureStorage.getItem('payment_requests');
      const existing = existingRaw ? JSON.parse(existingRaw) : [];
      const updated = [newReq, ...existing.filter((r: any) => r.id !== newReq.id)];
      await secureStorage.setItem('payment_requests', JSON.stringify(updated));

      setPendingRequests((prev) => [newReq, ...prev.filter((r) => r.id !== newReq.id)]);
      setPaymentModalChit(null);
      setPayScreenshot(null);
      Alert.alert(
        isAdvancePayment ? 'Advance Payment Submitted' : 'Payment Request Submitted',
        isAdvancePayment
          ? 'Your advance payment has been submitted for admin verification. It will be credited towards your upcoming installment.'
          : 'Your payment request has been submitted for admin verification. Receipt will be generated once verified.'
      );
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to submit payment request');
    } finally {
      setPaySubmitting(false);
    }
  };

  // Withdrawal / Prize Claim Submission
  const handleOpenWithdraw = (chit: any) => {
    setWithdrawModalChit(chit);
    setWithdrawPayoutMethod('Bank Transfer');
    setBankName('');
    setAccNo('');
    setIfsc('');
    setHolderName(user?.name || customerRecord?.name || '');
    setUpiId('');
  };

  const submitWithdrawalRequest = async () => {
    if (withdrawPayoutMethod === 'Bank Transfer') {
      if (!accNo.trim() || !ifsc.trim()) {
        Alert.alert('Required Fields', 'Please enter your Account Number and IFSC Code.');
        return;
      }
    } else {
      if (!upiId.trim()) {
        Alert.alert('Required Fields', 'Please enter your UPI ID.');
        return;
      }
    }

    setWithdrawSubmitting(true);
    try {
      const chitVal = withdrawModalChit.chitValue || withdrawModalChit.amount || 100000;
      const prizeAmount = chitVal * 0.95;

      const newWReq = {
        id: `WDR-${Date.now().toString().slice(-6)}`,
        customerId: user?.id || 'CUST',
        customerName: user?.name || 'Customer',
        mobile: user?.phone || '',
        groupId: withdrawModalChit.groupId,
        groupName: withdrawModalChit.groupName || withdrawModalChit.groupId,
        ticketNumber: withdrawModalChit.ticketNumber || '',
        chitValue: chitVal,
        eligibleAmount: prizeAmount,
        payoutMethod: withdrawPayoutMethod,
        payoutDetails: {
          bankName: withdrawPayoutMethod === 'Bank Transfer' ? bankName.trim() : undefined,
          accountNumber: withdrawPayoutMethod === 'Bank Transfer' ? accNo.trim() : undefined,
          ifsc: withdrawPayoutMethod === 'Bank Transfer' ? ifsc.trim().toUpperCase() : undefined,
          accountHolderName: withdrawPayoutMethod === 'Bank Transfer' ? holderName.trim() : undefined,
          upiId: withdrawPayoutMethod === 'UPI' ? upiId.trim() : undefined,
        },
        requestedAt: new Date().toISOString(),
        status: 'PENDING_ADMIN_DISBURSAL',
      };

      const existingRaw = await secureStorage.getItem('withdrawal_requests');
      const existing = existingRaw ? JSON.parse(existingRaw) : [];
      const updated = [newWReq, ...existing.filter((w: any) => w.id !== newWReq.id)];
      await secureStorage.setItem('withdrawal_requests', JSON.stringify(updated));

      setPendingWithdrawals((prev) => [newWReq, ...prev.filter((w) => w.id !== newWReq.id)]);
      setWithdrawModalChit(null);
      Alert.alert(
        'Claim Submitted',
        'Prize money withdrawal claim has been submitted to admin for verification and disbursal.'
      );
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to submit claim request');
    } finally {
      setWithdrawSubmitting(false);
    }
  };

  // Calculations for Schedule tabs
  const regularPlan = useMemo(() => calculateRegularPlanSchedule(selectedRegularCat), [selectedRegularCat]);
  const fixedPlan = useMemo(() => calculateFixedPlanSchedule(selectedFixedCat), [selectedFixedCat]);
  const auctionPlan = useMemo(() => calculateAuctionPlanSchedule(selectedAuctionCat), [selectedAuctionCat]);

  // Total Withdrawn metric
  const totalWithdrawnAmount = useMemo(() => {
    const fromChits = chits.reduce((acc, c: any) => acc + (c.isWithdrawn ? Number(c.withdrawnAmount || 0) : 0), 0);
    const fromWReqs = pendingWithdrawals
      .filter((w) => w.status === 'DISBURSED')
      .reduce((acc, w) => acc + Number(w.eligibleAmount || 0), 0);
    return fromChits + fromWReqs;
  }, [chits, pendingWithdrawals]);

  return (
    <ScrollView
      style={styles.container}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.gold.primary} />}
    >
      <StatusBar barStyle="light-content" />

      {/* 1. Account Hero Card */}
      <View style={styles.heroCard}>
        <View style={styles.heroTop}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarText}>
              {(customerRecord?.name || user?.name || 'C').charAt(0).toUpperCase()}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.clientName}>{customerRecord?.name || user?.name || 'Customer'}</Text>
            <Text style={styles.clientMeta}>
              ID: {customerRecord?.id || user?.id} • {customerRecord?.phone || user?.phone || 'Member'}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.referralBtn}
            onPress={() => copyToClipboard(`https://jenistachits.com/register?ref=${user?.id}`, 'ref-link')}
          >
            <Ionicons name="copy-outline" size={14} color={Colors.white} />
            <Text style={styles.referralBtnText}>Refer</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.logoutPill} onPress={logout}>
            <Ionicons name="log-out-outline" size={16} color={Colors.danger} />
          </TouchableOpacity>
        </View>
      </View>

      {/* 4-Stat Metric Cards Grid (Same as Web App) */}
      <View style={styles.metricsGrid}>
        <View style={styles.metricBox}>
          <Text style={styles.metricLabel}>ACTIVE CHITS</Text>
          <Text style={styles.metricVal}>{chits.length}</Text>
        </View>
        <View style={styles.metricBox}>
          <Text style={styles.metricLabel}>TOTAL INVESTED</Text>
          <Text style={[styles.metricVal, styles.metricValInvested]}>{formatCurrency(totalInvested)}</Text>
        </View>
        <View style={styles.metricBox}>
          <Text style={styles.metricLabel}>TOTAL WITHDRAWN</Text>
          <Text style={[styles.metricVal, styles.metricValGold]}>{formatCurrency(totalWithdrawnAmount)}</Text>
        </View>
        <View style={styles.metricBox}>
          <Text style={styles.metricLabel}>NEXT DUE</Text>
          <Text style={[styles.metricVal, pendingDues > 0 ? { color: '#dc2626' } : { color: '#059669' }]}>
            {formatCurrency(pendingDues > 0 ? pendingDues : chits[0]?.monthlyInstallment || 0)}
          </Text>
        </View>
      </View>

      {/* 2. Web-Style Segment Tabs Bar */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabsScrollContent}
        style={styles.tabsScroll}
      >
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'myChits' && styles.tabButtonActive]}
          onPress={() => setActiveTab('myChits')}
          activeOpacity={0.8}
        >
          <Ionicons
            name="layers"
            size={15}
            color={activeTab === 'myChits' ? Colors.gold.dark : Colors.textSecondary}
          />
          <Text style={[styles.tabButtonText, activeTab === 'myChits' && styles.tabButtonTextActive]}>
            My Portfolio
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'regularPlan' && styles.tabButtonActive]}
          onPress={() => setActiveTab('regularPlan')}
          activeOpacity={0.8}
        >
          <Ionicons
            name="calendar"
            size={15}
            color={activeTab === 'regularPlan' ? Colors.gold.dark : Colors.textSecondary}
          />
          <Text style={[styles.tabButtonText, activeTab === 'regularPlan' && styles.tabButtonTextActive]}>
            Regular (20M)
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'fixedPlan' && styles.tabButtonActive]}
          onPress={() => setActiveTab('fixedPlan')}
          activeOpacity={0.8}
        >
          <Ionicons
            name="grid"
            size={15}
            color={activeTab === 'fixedPlan' ? Colors.gold.dark : Colors.textSecondary}
          />
          <Text style={[styles.tabButtonText, activeTab === 'fixedPlan' && styles.tabButtonTextActive]}>
            Fixed (20M)
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'auctionPlan' && styles.tabButtonActive]}
          onPress={() => setActiveTab('auctionPlan')}
          activeOpacity={0.8}
        >
          <Ionicons
            name="hammer"
            size={15}
            color={activeTab === 'auctionPlan' ? Colors.gold.dark : Colors.textSecondary}
          />
          <Text style={[styles.tabButtonText, activeTab === 'auctionPlan' && styles.tabButtonTextActive]}>
            Auction (20M)
          </Text>
        </TouchableOpacity>
      </ScrollView>

      {/* TAB 1: MY PORTFOLIO */}
      {activeTab === 'myChits' && (
        <View style={{ gap: 14 }}>
          {/* Pending Verifications Banner */}
          {pendingRequests.filter((r) => r.status === 'PENDING').length > 0 && (
            <View style={styles.pendingVerifyBanner}>
              <View style={styles.pulsingDot} />
              <View style={{ flex: 1 }}>
                <Text style={styles.pendingVerifyTitle}>
                  Pending Payment Verifications ({pendingRequests.filter((r) => r.status === 'PENDING').length})
                </Text>
                <Text style={styles.pendingVerifySub}>
                  Awaiting branch admin verification. Receipts will update immediately upon approval.
                </Text>
              </View>
            </View>
          )}

          {/* Quick Pay CTA Bar when due */}
          {pendingDues > 0 && (
            <View style={styles.alertBanner}>
              <Ionicons name="information-circle" size={20} color="#c2410c" />
              <View style={{ flex: 1 }}>
                <Text style={styles.alertTitle}>Installment Payment Due</Text>
                <Text style={styles.alertText}>
                  You have {formatCurrency(pendingDues)} pending for this month. Pay online via UPI or Bank Transfer.
                </Text>
              </View>
            </View>
          )}

          {/* Section: My Chit Groups */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>My Chit Enrollments ({chits.length})</Text>
            <TouchableOpacity
              style={styles.statementsActionPill}
              onPress={() => setShowStatementsModal(true)}
              activeOpacity={0.8}
            >
              <Ionicons name="document-text-outline" size={13} color={Colors.navy.primary} />
              <Text style={styles.statementsActionText}>All Statements</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.chitsList}>
            {chits.length === 0 ? (
              <View style={styles.emptyCard}>
                <Ionicons name="folder-open-outline" size={40} color={Colors.textMuted} />
                <Text style={styles.emptyTitle}>No Active Chit Enrollments</Text>
                <Text style={styles.emptySub}>
                  You are not currently enrolled in any chit groups. Contact admin to join a savings scheme.
                </Text>
              </View>
            ) : (
              chits.map((item, idx) => {
                const chitVal = item.chitValue || 100000;
                const prizeVal = chitVal * 0.95;
                const wReq = pendingWithdrawals.find((w) => w.groupId === item.groupId);
                const isDisbursed = item.isWithdrawn || (wReq && wReq.status === 'DISBURSED');
                const isPending = wReq && wReq.status === 'PENDING_ADMIN_DISBURSAL';

                const scheduleSummary = buildCustomerChitSchedule({
                  customer: customerRecord || user,
                  chit: item,
                  ledgerTransactions: transactions,
                });
                const firstUnpaidRow = scheduleSummary.schedule.find((r) => r.status !== 'PAID');
                const isCurrentMonthPaid =
                  !firstUnpaidRow ||
                  (firstUnpaidRow.monthNumber > 1 && item.paymentStatus === 'PAID') ||
                  (item.paymentStatus === 'PAID' && scheduleSummary.remainingBalanceDue === 0);
                const targetRow = firstUnpaidRow || scheduleSummary.schedule[scheduleSummary.schedule.length - 1];
                const nextDueStr = targetRow ? targetRow.dueDate : (item as any)?.dueDate || '15 Oct, 2026';
                const amountDueForChit = targetRow ? targetRow.revisedDue : item.monthlyInstallment || 5000;

                return (
                  <View key={idx} style={styles.chitCard}>
                    {/* Header Row */}
                    <View style={styles.chitHeader}>
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
                          <Text style={styles.groupTitle}>{item.groupName}</Text>
                          {isCurrentMonthPaid && (
                            <View style={styles.currentMonthPaidBadge}>
                              <Text style={styles.currentMonthPaidBadgeText}>✓ CURRENT MONTH PAID</Text>
                            </View>
                          )}
                        </View>
                        <Text style={styles.ticketSubtitle}>
                          Ticket #{item.ticketNumber} • {item.scheme || 'Auction'} Plan (20M)
                        </Text>
                      </View>
                      <View style={[styles.activePlanBadge, isCurrentMonthPaid && { backgroundColor: '#d1fae5' }]}>
                        <Text style={[styles.activePlanText, isCurrentMonthPaid && { color: '#065f46' }]}>
                          {isCurrentMonthPaid ? 'ADVANCE ELIGIBLE' : item.paymentStatus || 'ACTIVE'}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.cardDivider} />

                    {/* Stats Row */}
                    <View style={styles.statsRow}>
                      <View>
                        <Text style={styles.subLabel}>CHIT VALUE</Text>
                        <Text style={styles.mainVal}>{formatCurrency(item.chitValue)}</Text>
                      </View>
                      <View>
                        <Text style={styles.subLabel}>
                          {isCurrentMonthPaid ? 'ADVANCE DUE' : 'MONTHLY DUE'}
                        </Text>
                        <Text style={styles.mainVal}>{formatCurrency(amountDueForChit)}</Text>
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={styles.subLabel}>NET PRIZE (95%)</Text>
                        <Text style={[styles.mainVal, { color: Colors.gold.dark }]}>{formatCurrency(prizeVal)}</Text>
                      </View>
                    </View>

                    {/* Action Bar (Pay Now / Pay in Advance, Due Chart, Claim Prize) */}
                    <View style={styles.cardActionRow}>
                      <TouchableOpacity
                        style={[styles.payNowBtn, isCurrentMonthPaid && { backgroundColor: '#d97706' }]}
                        onPress={() => handleOpenPay(item, isCurrentMonthPaid, amountDueForChit)}
                        activeOpacity={0.85}
                      >
                        <Ionicons name={isCurrentMonthPaid ? "arrow-forward-circle-outline" : "card-outline"} size={14} color={Colors.white} />
                        <Text style={styles.payNowBtnText}>
                          {isCurrentMonthPaid ? 'Pay in Advance' : 'Pay Now'}
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.scheduleBtn}
                        onPress={() =>
                          navigation.navigate('CustomerSchedule', {
                            customer: customerRecord,
                            chit: item,
                          })
                        }
                        activeOpacity={0.8}
                      >
                        <Ionicons name="calendar-outline" size={13} color={Colors.text} />
                        <Text style={styles.scheduleBtnText}>Due Chart</Text>
                      </TouchableOpacity>

                      {isDisbursed ? (
                        <View style={styles.disbursedPill}>
                          <Ionicons name="checkmark-circle" size={13} color="#065f46" />
                          <Text style={styles.disbursedText}>Disbursed</Text>
                        </View>
                      ) : isPending ? (
                        <View style={styles.pendingClaimPill}>
                          <Text style={styles.pendingClaimText}>In Review</Text>
                        </View>
                      ) : (
                        <TouchableOpacity
                          style={styles.claimPrizeBtn}
                          onPress={() => handleOpenWithdraw(item)}
                          activeOpacity={0.8}
                        >
                          <Ionicons name="trophy-outline" size={13} color={Colors.gold.dark} />
                          <Text style={styles.claimPrizeBtnText}>Claim</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                );
              })
            )}
          </View>

          {/* Official Company Bank & UPI Transfer Card */}
          <View style={styles.bankCard}>
            <View style={styles.bankTopRow}>
              <View style={styles.bankIconCircle}>
                <Ionicons name="shield-checkmark" size={20} color={Colors.navy.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.bankCardTitle}>Official Payment Account</Text>
                <Text style={styles.bankCardSub}>{companyBank?.bankName || 'HDFC Bank'} • Verified Direct Deposit</Text>
              </View>
              <TouchableOpacity
                style={styles.viewQrPill}
                onPress={() => setShowQrModal(companyBank)}
                activeOpacity={0.8}
              >
                <Ionicons name="qr-code-outline" size={14} color={Colors.navy.primary} />
                <Text style={styles.viewQrPillText}>QR</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.bankGrid}>
              <View style={styles.bankDetailItem}>
                <Text style={styles.bLabel}>HOLDER</Text>
                <Text style={styles.bVal}>{companyBank?.accountHolderName || 'Jenista Chits Pvt Ltd'}</Text>
              </View>
              <View style={styles.bankDetailItem}>
                <Text style={styles.bLabel}>A/C NUMBER</Text>
                <TouchableOpacity
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
                  onPress={() => copyToClipboard(companyBank?.accountNumber || '', 'acc')}
                >
                  <Text style={styles.bValMono}>{companyBank?.accountNumber || '50200084729104'}</Text>
                  <Ionicons name="copy-outline" size={12} color={Colors.navy.primary} />
                </TouchableOpacity>
              </View>
              <View style={styles.bankDetailItem}>
                <Text style={styles.bLabel}>IFSC</Text>
                <TouchableOpacity
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
                  onPress={() => copyToClipboard(companyBank?.ifscCode || companyBank?.ifsc || '', 'ifsc')}
                >
                  <Text style={styles.bValMono}>{companyBank?.ifscCode || companyBank?.ifsc || 'HDFC0000123'}</Text>
                  <Ionicons name="copy-outline" size={12} color={Colors.navy.primary} />
                </TouchableOpacity>
              </View>
              <View style={styles.bankDetailItem}>
                <Text style={styles.bLabel}>UPI ID</Text>
                <TouchableOpacity
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
                  onPress={() => copyToClipboard(companyBank?.upiId || 'jenistachits@hdfcbank', 'upi')}
                >
                  <Text style={styles.bValGold}>{companyBank?.upiId || 'jenistachits@hdfcbank'}</Text>
                  <Ionicons name="copy-outline" size={12} color={Colors.gold.dark} />
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* Recent Transactions List with Print Receipt */}
          <View style={{ paddingHorizontal: 16 }}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Recent Receipts ({transactions.length})</Text>
              <TouchableOpacity onPress={() => setShowStatementsModal(true)}>
                <Text style={styles.viewAllText}>View All</Text>
              </TouchableOpacity>
            </View>

            {transactions.length === 0 ? (
              <View style={styles.emptyCardSmall}>
                <Text style={{ fontSize: 12, color: Colors.textMuted }}>No transactions recorded yet.</Text>
              </View>
            ) : (
              transactions.slice(0, 5).map((t, idx) => (
                <View key={idx} style={styles.trxRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.trxTitle} numberOfLines={1}>
                      {t.description || 'Chit Installment Payment'}
                    </Text>
                    <Text style={styles.trxMeta}>
                      {formatDate(t.date)} • Ref: {t.id}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: 4 }}>
                    <Text style={styles.trxAmount}>+{formatCurrency(t.amount)}</Text>
                    <TouchableOpacity
                      style={styles.printReceiptBtn}
                      onPress={() =>
                        generateAndShareReceipt({
                          receiptNo: t.id,
                          date: t.date,
                          customerName: user?.name,
                          customerId: user?.id,
                          customerMobile: user?.phone,
                          amount: t.amount,
                          description: t.description,
                          referenceNo: t.reference,
                        })
                      }
                      activeOpacity={0.8}
                    >
                      <Ionicons name="print-outline" size={11} color={Colors.navy.primary} />
                      <Text style={styles.printReceiptText}>Receipt</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}
          </View>
        </View>
      )}

      {/* TAB 2: REGULAR PLAN SCHEDULE (20M) */}
      {activeTab === 'regularPlan' && (
        <View style={styles.planScheduleContainer}>
          <View style={styles.planHeaderCard}>
            <Text style={styles.planHeaderBadge}>OFFICIAL BROCHURE PLAN</Text>
            <Text style={styles.planHeaderTitle}>Regular Scheme (20 Months)</Text>
            <Text style={styles.planHeaderSub}>
              Low dues starting from 3.75%, guaranteed prize payouts up to 95%, total dues capped at 84.35%.
            </Text>

            {/* Category Pills */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 12 }}>
              {defaultRegularCategories.map((cat) => (
                <TouchableOpacity
                  key={cat.id}
                  style={[styles.catPill, selectedRegularCat === cat.value && styles.catPillActive]}
                  onPress={() => setSelectedRegularCat(cat.value)}
                >
                  <Text
                    style={[styles.catPillText, selectedRegularCat === cat.value && styles.catPillTextActive]}
                  >
                    {formatCurrency(cat.value)}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Schedule Table */}
          <View style={styles.scheduleTableCard}>
            <View style={styles.scheduleTableHeader}>
              <Text style={[styles.scheduleThText, { width: 50 }]}>MONTH</Text>
              <Text style={[styles.scheduleThText, { flex: 1, textAlign: 'center' }]}>INSTALLMENT</Text>
              <Text style={[styles.scheduleThText, { flex: 1, textAlign: 'right' }]}>PRIZE MONEY</Text>
            </View>
            {regularPlan.schedule.map((row) => (
              <View key={row.month} style={styles.scheduleTableRow}>
                <Text style={[styles.scheduleTdText, { width: 50, fontWeight: '800' }]}>M{row.month}</Text>
                <Text style={[styles.scheduleTdText, { flex: 1, textAlign: 'center', color: Colors.navy.primary }]}>
                  {formatCurrency(row.due)}
                </Text>
                <Text style={[styles.scheduleTdText, { flex: 1, textAlign: 'right', color: Colors.gold.dark, fontWeight: '800' }]}>
                  {row.isCompany ? 'Company' : formatCurrency(row.payment)}
                </Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* TAB 3: FIXED PLAN SCHEDULE (20M) */}
      {activeTab === 'fixedPlan' && (
        <View style={styles.planScheduleContainer}>
          <View style={[styles.planHeaderCard, { backgroundColor: '#064e3b' }]}>
            <Text style={[styles.planHeaderBadge, { backgroundColor: '#a7f3d0', color: '#065f46' }]}>
              FIXED PLAN SCHEME
            </Text>
            <Text style={styles.planHeaderTitle}>Fixed Plan (20 Months)</Text>
            <Text style={styles.planHeaderSub}>
              Predetermined fixed monthly installments with increasing payout multipliers up to 114%.
            </Text>

            {/* Category Pills */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 12 }}>
              {defaultFixedCategories.map((cat) => (
                <TouchableOpacity
                  key={cat.id}
                  style={[styles.catPill, selectedFixedCat === cat.value && styles.catPillActive]}
                  onPress={() => setSelectedFixedCat(cat.value)}
                >
                  <Text
                    style={[styles.catPillText, selectedFixedCat === cat.value && styles.catPillTextActive]}
                  >
                    {formatCurrency(cat.value)}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Schedule Table */}
          <View style={styles.scheduleTableCard}>
            <View style={styles.scheduleTableHeader}>
              <Text style={[styles.scheduleThText, { width: 50 }]}>MONTH</Text>
              <Text style={[styles.scheduleThText, { flex: 1, textAlign: 'center' }]}>FIXED DUE</Text>
              <Text style={[styles.scheduleThText, { flex: 1, textAlign: 'right' }]}>PAYOUT</Text>
            </View>
            {fixedPlan.schedule.map((row) => (
              <View key={row.month} style={styles.scheduleTableRow}>
                <Text style={[styles.scheduleTdText, { width: 50, fontWeight: '800' }]}>M{row.month}</Text>
                <Text style={[styles.scheduleTdText, { flex: 1, textAlign: 'center', color: Colors.navy.primary }]}>
                  {formatCurrency(row.due)}
                </Text>
                <Text style={[styles.scheduleTdText, { flex: 1, textAlign: 'right', color: '#047857', fontWeight: '800' }]}>
                  {formatCurrency(row.payout)}
                </Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* TAB 4: AUCTION PLAN SCHEDULE (20M) */}
      {activeTab === 'auctionPlan' && (
        <View style={styles.planScheduleContainer}>
          <View style={[styles.planHeaderCard, { backgroundColor: '#581c87' }]}>
            <Text style={[styles.planHeaderBadge, { backgroundColor: '#e9d5ff', color: '#6b21a8' }]}>
              AUCTION REVERSE BID
            </Text>
            <Text style={styles.planHeaderTitle}>Auction Scheme (20 Months)</Text>
            <Text style={styles.planHeaderSub}>
              Transparent reverse bidding capped at 30% discount. Dividends distributed to members monthly.
            </Text>

            {/* Category Pills */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 12 }}>
              {defaultAuctionCategories.map((cat) => (
                <TouchableOpacity
                  key={cat.id}
                  style={[styles.catPill, selectedAuctionCat === cat.value && styles.catPillActive]}
                  onPress={() => setSelectedAuctionCat(cat.value)}
                >
                  <Text
                    style={[styles.catPillText, selectedAuctionCat === cat.value && styles.catPillTextActive]}
                  >
                    {formatCurrency(cat.value)}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Schedule Table */}
          <View style={styles.scheduleTableCard}>
            <View style={styles.scheduleTableHeader}>
              <Text style={[styles.scheduleThText, { width: 45 }]}>MO</Text>
              <Text style={[styles.scheduleThText, { flex: 1, textAlign: 'center' }]}>NET DUE</Text>
              <Text style={[styles.scheduleThText, { flex: 0.9, textAlign: 'center' }]}>DIVIDEND</Text>
              <Text style={[styles.scheduleThText, { flex: 1, textAlign: 'right' }]}>PRIZE</Text>
            </View>
            {auctionPlan.schedule.map((row) => (
              <View key={row.month} style={styles.scheduleTableRow}>
                <Text style={[styles.scheduleTdText, { width: 45, fontWeight: '800' }]}>M{row.month}</Text>
                <Text style={[styles.scheduleTdText, { flex: 1, textAlign: 'center', color: Colors.navy.primary }]}>
                  {formatCurrency(row.netDue)}
                </Text>
                <Text style={[styles.scheduleTdText, { flex: 0.9, textAlign: 'center', color: '#047857' }]}>
                  {row.dividend > 0 ? `+${formatCurrency(row.dividend)}` : '—'}
                </Text>
                <Text style={[styles.scheduleTdText, { flex: 1, textAlign: 'right', color: '#6b21a8', fontWeight: '800' }]}>
                  {formatCurrency(row.payout)}
                </Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* 3. MODAL: SUBMIT PAYMENT */}
      {paymentModalChit && (
        <Modal visible transparent animationType="fade" onRequestClose={() => setPaymentModalChit(null)}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <View>
                  <Text style={styles.modalTitle}>
                    {isAdvancePayment ? 'Pay in Advance' : 'Submit Payment'}
                  </Text>
                  <Text style={styles.modalSubtitle}>
                    {paymentModalChit.groupName} • Ticket #{paymentModalChit.ticketNumber}
                    {isAdvancePayment ? ' • Advance Pay' : ''}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => setPaymentModalChit(null)}>
                  <Ionicons name="close" size={22} color={Colors.textSecondary} />
                </TouchableOpacity>
              </View>

              <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false}>
                <Text style={styles.inputLabel}>
                  {isAdvancePayment ? 'ADVANCE PAYMENT AMOUNT (₹)' : 'PAYMENT AMOUNT (₹)'}
                </Text>
                <TextInput
                  style={styles.modalInput}
                  keyboardType="numeric"
                  value={payAmount}
                  onChangeText={setPayAmount}
                  placeholder="Installment amount"
                />

                <Text style={[styles.inputLabel, { marginTop: 12 }]}>PAYMENT METHOD</Text>
                <View style={styles.modeRow}>
                  {(['UPI', 'Bank Transfer', 'Cash'] as const).map((m) => (
                    <TouchableOpacity
                      key={m}
                      style={[styles.modePill, payMode === m && styles.modePillActive]}
                      onPress={() => setPayMode(m)}
                    >
                      <Text style={[styles.modeText, payMode === m && styles.modeTextActive]}>{m}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {payMode !== 'Cash' && (
                  <>
                    <Text style={[styles.inputLabel, { marginTop: 12 }]}>
                      TRANSACTION / UTR REFERENCE NUMBER <Text style={{ color: Colors.danger }}>*</Text>
                    </Text>
                    <TextInput
                      style={styles.modalInput}
                      value={payRefNo}
                      onChangeText={setPayRefNo}
                      placeholder="e.g. 329048102948 or Bank Ref ID"
                      autoCapitalize="characters"
                    />
                  </>
                )}

                {/* Upload Payment Screenshot */}
                <View style={{ marginTop: 12 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <Text style={[styles.inputLabel, { marginTop: 0, marginBottom: 0 }]}>
                      PAYMENT SCREENSHOT / RECEIPT SLIP
                    </Text>
                    <Text style={{ fontSize: 10, color: Colors.textMuted }}>Optional</Text>
                  </View>

                  {payScreenshot ? (
                    <View style={styles.screenshotPreviewCard}>
                      <Image source={{ uri: payScreenshot }} style={styles.screenshotThumb} />
                      <View style={{ flex: 1, marginLeft: 10 }}>
                        <Text style={styles.screenshotAttachedTitle} numberOfLines={1}>
                          Screenshot Attached
                        </Text>
                        <Text style={styles.screenshotAttachedSub}>
                          Ready to submit for admin verification
                        </Text>
                      </View>
                      <TouchableOpacity
                        style={styles.removeScreenshotBtn}
                        onPress={() => setPayScreenshot(null)}
                      >
                        <Ionicons name="trash-outline" size={16} color={Colors.danger} />
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <TouchableOpacity
                      style={styles.uploadScreenshotBox}
                      onPress={pickPaymentScreenshot}
                      activeOpacity={0.8}
                    >
                      <View style={styles.uploadIconCircle}>
                        <Ionicons name="cloud-upload-outline" size={18} color={Colors.navy.primary} />
                      </View>
                      <Text style={styles.uploadScreenshotText}>Tap to upload payment screenshot</Text>
                      <Text style={styles.uploadScreenshotSub}>PNG, JPG or JPEG proof image</Text>
                    </TouchableOpacity>
                  )}
                </View>

                {/* Company Destination Bank Info */}
                <View style={styles.modalBankBox}>
                  <Text style={styles.modalBankBoxTitle}>Pay To Company Account:</Text>
                  <Text style={styles.modalBankBoxVal}>
                    {companyBank?.bankName} • A/C: {companyBank?.accountNumber}
                  </Text>
                  <Text style={styles.modalBankBoxVal}>
                    IFSC: {companyBank?.ifscCode || companyBank?.ifsc} • UPI: {companyBank?.upiId}
                  </Text>
                </View>

                <TouchableOpacity
                  style={[styles.submitActionBtn, paySubmitting && { opacity: 0.6 }]}
                  onPress={submitPaymentRequest}
                  disabled={paySubmitting}
                >
                  <Text style={styles.submitActionBtnText}>
                    {paySubmitting ? 'Submitting...' : 'Submit Payment for Verification'}
                  </Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          </View>
        </Modal>
      )}

      {/* 4. MODAL: CLAIM PRIZE / WITHDRAW */}
      {withdrawModalChit && (
        <Modal visible transparent animationType="fade" onRequestClose={() => setWithdrawModalChit(null)}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <View>
                  <Text style={styles.modalTitle}>Claim Chit Prize Money</Text>
                  <Text style={styles.modalSubtitle}>
                    {withdrawModalChit.groupName} • Ticket #{withdrawModalChit.ticketNumber}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => setWithdrawModalChit(null)}>
                  <Ionicons name="close" size={22} color={Colors.textSecondary} />
                </TouchableOpacity>
              </View>

              <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false}>
                {/* Prize Breakdown */}
                <View style={styles.prizeBanner}>
                  <Text style={styles.prizeBannerLabel}>Net Payout (95% after 5% foreman fee):</Text>
                  <Text style={styles.prizeBannerAmount}>
                    {formatCurrency((withdrawModalChit.chitValue || 100000) * 0.95)}
                  </Text>
                </View>

                <Text style={styles.inputLabel}>RECEIVING METHOD</Text>
                <View style={styles.modeRow}>
                  {(['Bank Transfer', 'UPI'] as const).map((m) => (
                    <TouchableOpacity
                      key={m}
                      style={[styles.modePill, withdrawPayoutMethod === m && styles.modePillActive]}
                      onPress={() => setWithdrawPayoutMethod(m)}
                    >
                      <Text style={[styles.modeText, withdrawPayoutMethod === m && styles.modeTextActive]}>
                        {m}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {withdrawPayoutMethod === 'Bank Transfer' ? (
                  <>
                    <Text style={[styles.inputLabel, { marginTop: 10 }]}>BANK NAME</Text>
                    <TextInput
                      style={styles.modalInput}
                      value={bankName}
                      onChangeText={setBankName}
                      placeholder="e.g. State Bank of India"
                    />

                    <Text style={[styles.inputLabel, { marginTop: 10 }]}>ACCOUNT NUMBER *</Text>
                    <TextInput
                      style={styles.modalInput}
                      value={accNo}
                      onChangeText={setAccNo}
                      keyboardType="numeric"
                      placeholder="Your bank account number"
                    />

                    <Text style={[styles.inputLabel, { marginTop: 10 }]}>IFSC CODE *</Text>
                    <TextInput
                      style={styles.modalInput}
                      value={ifsc}
                      onChangeText={setIfsc}
                      placeholder="Bank IFSC code"
                      autoCapitalize="characters"
                    />
                  </>
                ) : (
                  <>
                    <Text style={[styles.inputLabel, { marginTop: 10 }]}>UPI ID *</Text>
                    <TextInput
                      style={styles.modalInput}
                      value={upiId}
                      onChangeText={setUpiId}
                      placeholder="e.g. yourname@okaxis"
                      autoCapitalize="none"
                    />
                  </>
                )}

                <TouchableOpacity
                  style={[styles.submitActionBtn, withdrawSubmitting && { opacity: 0.6 }]}
                  onPress={submitWithdrawalRequest}
                  disabled={withdrawSubmitting}
                >
                  <Text style={styles.submitActionBtnText}>
                    {withdrawSubmitting ? 'Submitting Claim...' : 'Submit Claim Request'}
                  </Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          </View>
        </Modal>
      )}

      {/* 5. MODAL: ALL STATEMENTS & RECEIPTS */}
      {showStatementsModal && (
        <Modal visible transparent animationType="slide" onRequestClose={() => setShowStatementsModal(false)}>
          <View style={styles.modalOverlay}>
            <View style={[styles.modalCard, { maxHeight: '90%' }]}>
              <View style={styles.modalHeader}>
                <View>
                  <Text style={styles.modalTitle}>All Receipts & Statements</Text>
                  <Text style={styles.modalSubtitle}>{transactions.length} total payment record(s)</Text>
                </View>
                <TouchableOpacity onPress={() => setShowStatementsModal(false)}>
                  <Ionicons name="close" size={22} color={Colors.textSecondary} />
                </TouchableOpacity>
              </View>

              {/* Filter Pills */}
              <View style={[styles.modeRow, { paddingVertical: 10 }]}>
                {(['ALL', 'CASH', 'ONLINE'] as const).map((f) => (
                  <TouchableOpacity
                    key={f}
                    style={[styles.modePill, statementFilter === f && styles.modePillActive]}
                    onPress={() => setStatementFilter(f)}
                  >
                    <Text style={[styles.modeText, statementFilter === f && styles.modeTextActive]}>
                      {f === 'ALL' ? 'All' : f === 'CASH' ? 'Cash' : 'Online'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <FlatList
                data={transactions.filter((t) => {
                  const isCash = (t.description || '').toLowerCase().includes('cash') || (t.paymentMode || '').toLowerCase().includes('cash');
                  if (statementFilter === 'CASH' && !isCash) return false;
                  if (statementFilter === 'ONLINE' && isCash) return false;
                  if (statementSearch) {
                    const q = statementSearch.toLowerCase();
                    return (t.id || '').toLowerCase().includes(q) || (t.description || '').toLowerCase().includes(q);
                  }
                  return true;
                })}
                keyExtractor={(item: any, idx: number) => `${item.id}-${idx}`}
                renderItem={({ item }: { item: any }) => (
                  <View style={styles.statementItemRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.statementItemTitle}>{item.description || 'Payment'}</Text>
                      <Text style={styles.statementItemMeta}>
                        {formatDate(item.date)} • Ref: {item.id}
                      </Text>
                    </View>
                    <View style={{ alignItems: 'flex-end', gap: 4 }}>
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
                        <Ionicons name="print-outline" size={11} color={Colors.navy.primary} />
                        <Text style={styles.printReceiptText}>Receipt</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
                ListEmptyComponent={
                  <View style={{ padding: 30, alignItems: 'center' }}>
                    <Text style={{ fontSize: 13, color: Colors.textMuted }}>No statements found.</Text>
                  </View>
                }
              />
            </View>
          </View>
        </Modal>
      )}

      {/* 6. MODAL: QR CODE PREVIEW */}
      {showQrModal && (
        <Modal visible transparent animationType="fade" onRequestClose={() => setShowQrModal(null)}>
          <View style={styles.modalOverlay}>
            <View style={[styles.modalCard, { alignItems: 'center' }]}>
              <View style={{ flexDirection: 'row', width: '100%', justifyContent: 'space-between', marginBottom: 12 }}>
                <Text style={styles.modalTitle}>Scan & Pay via UPI</Text>
                <TouchableOpacity onPress={() => setShowQrModal(null)}>
                  <Ionicons name="close" size={22} color={Colors.textSecondary} />
                </TouchableOpacity>
              </View>

              <View style={styles.qrImageBox}>
                <Ionicons name="qr-code-outline" size={120} color={Colors.navy.primary} />
              </View>

              <Text style={styles.qrAccountName}>{showQrModal.accountHolderName || 'Jenista Chits Pvt Ltd'}</Text>
              <Text style={styles.qrUpiId}>{showQrModal.upiId || 'jenistachits@hdfcbank'}</Text>
              <Text style={styles.qrBankSub}>{showQrModal.bankName} • Thoothukudi Branch</Text>

              <TouchableOpacity
                style={styles.copyUpiBtn}
                onPress={() => copyToClipboard(showQrModal.upiId || '', 'qr-upi')}
              >
                <Ionicons name="copy-outline" size={14} color={Colors.white} />
                <Text style={styles.copyUpiBtnText}>Copy UPI ID</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}

      <View style={{ height: 40 }} />
    </ScrollView>
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
    alignItems: 'center',
    gap: 12,
  },
  avatarCircle: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: Colors.gold.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 20,
    fontWeight: '900',
    color: '#0B1A30',
  },
  clientName: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.white,
  },
  clientMeta: {
    fontSize: 12,
    color: Colors.neutral[400],
    marginTop: 2,
  },
  logoutPill: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  heroDivider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    marginVertical: 16,
  },
  referralBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  referralBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.gold.primary,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  metricBox: {
    flex: 1,
    minWidth: '47%',
    backgroundColor: Colors.white,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  metricLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textMuted,
    letterSpacing: 0.3,
  },
  metricVal: {
    fontSize: 18,
    fontWeight: '900',
    color: Colors.text,
    marginTop: 4,
  },
  metricValInvested: {
    color: '#059669',
  },
  metricValGold: {
    color: Colors.gold.dark,
  },
  tabsScroll: {
    marginBottom: 14,
  },
  tabsScrollContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  tabButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  tabButtonActive: {
    backgroundColor: Colors.navy.primary,
    borderColor: Colors.navy.primary,
  },
  tabButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textMuted,
  },
  tabButtonTextActive: {
    color: Colors.white,
  },
  pendingVerifyBanner: {
    flexDirection: 'row',
    backgroundColor: '#eff6ff',
    marginHorizontal: 16,
    padding: 12,
    borderRadius: 12,
    gap: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  pulsingDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#2563eb',
  },
  pendingVerifyTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1e40af',
  },
  pendingVerifySub: {
    fontSize: 11,
    color: '#3b82f6',
    marginTop: 1,
  },
  alertBanner: {
    flexDirection: 'row',
    backgroundColor: '#ffedd5',
    marginHorizontal: 16,
    marginBottom: 4,
    padding: 14,
    borderRadius: 12,
    gap: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#fed7aa',
  },
  alertTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#9a3412',
  },
  alertText: {
    fontSize: 11,
    color: '#c2410c',
    marginTop: 1,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 18,
    marginTop: 6,
    marginBottom: 4,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0f172a',
  },
  statementsActionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    backgroundColor: '#e0e7ff',
  },
  statementsActionText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.navy.primary,
  },
  chitsList: {
    paddingHorizontal: 16,
    gap: 12,
  },
  chitCard: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  chitHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  groupTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
  },
  ticketSubtitle: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  activePlanBadge: {
    backgroundColor: '#dcfce7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  activePlanText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#15803d',
  },
  currentMonthPaidBadge: {
    backgroundColor: '#d1fae5',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#a7f3d0',
  },
  currentMonthPaidBadgeText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#065f46',
  },
  cardDivider: {
    height: 1,
    backgroundColor: '#f1f5f9',
    marginVertical: 12,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  subLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#94a3b8',
    letterSpacing: 0.5,
  },
  mainVal: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0f172a',
    marginTop: 2,
  },
  cardActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  payNowBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    backgroundColor: Colors.navy.primary,
    paddingVertical: 8,
    borderRadius: 8,
  },
  payNowBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.white,
  },
  scheduleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  scheduleBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.text,
  },
  claimPrizeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#fef3c7',
    borderWidth: 1,
    borderColor: '#fde68a',
  },
  claimPrizeBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: Colors.gold.dark,
  },
  disbursedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: '#d1fae5',
  },
  disbursedText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#065f46',
  },
  pendingClaimPill: {
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: '#fef3c7',
  },
  pendingClaimText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#92400e',
  },
  emptyCard: {
    backgroundColor: Colors.white,
    padding: 30,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.text,
    marginTop: 10,
  },
  emptySub: {
    fontSize: 12,
    color: Colors.textMuted,
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 18,
  },
  emptyCardSmall: {
    backgroundColor: Colors.white,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  bankCard: {
    backgroundColor: Colors.white,
    marginHorizontal: 16,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  bankTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
  },
  bankIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#fef3c7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bankCardTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0f172a',
  },
  bankCardSub: {
    fontSize: 11,
    color: '#64748b',
  },
  viewQrPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  viewQrPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.navy.primary,
  },
  bankGrid: {
    backgroundColor: '#f8fafc',
    padding: 12,
    borderRadius: 12,
    gap: 8,
  },
  bankDetailItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  bLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748b',
  },
  bVal: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0f172a',
  },
  bValMono: {
    fontSize: 12,
    fontWeight: '700',
    fontFamily: 'monospace',
    color: '#0f172a',
  },
  bValGold: {
    fontSize: 12,
    fontWeight: '800',
    color: Colors.primary[700],
  },
  receiptsCard: {
    backgroundColor: Colors.white,
    marginHorizontal: 16,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  trxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  trxTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.text,
  },
  trxMeta: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 2,
  },
  trxAmount: {
    fontSize: 14,
    fontWeight: '800',
    color: '#059669',
  },
  printReceiptBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  printReceiptText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.navy.primary,
  },
  viewAllBtn: {
    alignItems: 'center',
    paddingTop: 10,
  },
  viewAllText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.primary[700],
  },
  planScheduleContainer: {
    paddingHorizontal: 16,
    gap: 14,
  },
  planHeaderCard: {
    backgroundColor: Colors.white,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  planHeaderBadge: {
    fontSize: 10,
    fontWeight: '800',
    color: Colors.gold.dark,
    backgroundColor: '#fef3c7',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    marginBottom: 6,
  },
  planHeaderTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: Colors.text,
  },
  planHeaderSub: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
  },
  catScroll: {
    marginTop: 12,
  },
  catPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: '#f1f5f9',
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  catPillActive: {
    backgroundColor: Colors.navy.primary,
    borderColor: Colors.navy.primary,
  },
  catPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textMuted,
  },
  catPillTextActive: {
    color: Colors.white,
  },
  scheduleTableCard: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    overflow: 'hidden',
  },
  scheduleTableHeader: {
    flexDirection: 'row',
    backgroundColor: Colors.navy.primary,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  scheduleThText: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.white,
    textAlign: 'center',
  },
  scheduleTableRow: {
    flexDirection: 'row',
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  scheduleTableRowAlt: {
    backgroundColor: '#f8fafc',
  },
  scheduleTdText: {
    fontSize: 11,
    color: Colors.text,
    textAlign: 'center',
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: Colors.text,
  },
  modalSubtitle: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
    marginTop: 12,
    marginBottom: 6,
  },
  modalInput: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: Colors.text,
    fontWeight: '600',
  },
  modeRow: {
    flexDirection: 'row',
    gap: 8,
  },
  modePill: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  modePillActive: {
    backgroundColor: Colors.navy.primary,
    borderColor: Colors.navy.primary,
  },
  modeText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textMuted,
  },
  modeTextActive: {
    color: Colors.white,
  },
  modalBankBox: {
    backgroundColor: '#f8fafc',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginTop: 12,
    gap: 4,
  },
  modalBankBoxTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.navy.primary,
    marginBottom: 4,
  },
  modalBankBoxVal: {
    fontSize: 11,
    color: '#475569',
    fontWeight: '600',
  },
  prizeBanner: {
    backgroundColor: '#fef3c7',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#fde68a',
    marginTop: 10,
    alignItems: 'center',
  },
  prizeBannerLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#92400e',
  },
  prizeBannerAmount: {
    fontSize: 20,
    fontWeight: '900',
    color: Colors.gold.dark,
    marginTop: 2,
  },
  submitActionBtn: {
    backgroundColor: Colors.navy.primary,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 18,
  },
  submitActionBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.white,
  },
  filterPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  filterPillActive: {
    backgroundColor: Colors.navy.primary,
    borderColor: Colors.navy.primary,
  },
  filterPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textMuted,
  },
  filterPillTextActive: {
    color: Colors.white,
  },
  statementItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  statementItemTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.text,
  },
  statementItemMeta: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 2,
  },
  statementItemAmount: {
    fontSize: 14,
    fontWeight: '800',
    color: '#059669',
  },
  qrImageBox: {
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#f8fafc',
    borderRadius: 16,
    marginVertical: 14,
  },
  qrAccountName: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.text,
    marginTop: 10,
  },
  qrUpiId: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.navy.primary,
    marginTop: 4,
    fontFamily: 'monospace',
  },
  qrBankSub: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 2,
  },
  copyUpiBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: Colors.navy.primary,
    paddingVertical: 10,
    borderRadius: 8,
    marginTop: 8,
  },
  copyUpiBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.white,
  },
  uploadScreenshotBox: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: '#cbd5e1',
    borderRadius: 12,
    backgroundColor: '#f8fafc',
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#e0e7ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  uploadScreenshotText: {
    fontSize: 12,
    fontWeight: '800',
    color: Colors.navy.primary,
  },
  uploadScreenshotSub: {
    fontSize: 10,
    color: Colors.textMuted,
    marginTop: 2,
  },
  screenshotPreviewCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#bbf7d0',
    borderRadius: 12,
    padding: 10,
  },
  screenshotThumb: {
    width: 50,
    height: 50,
    borderRadius: 8,
    backgroundColor: '#e2e8f0',
  },
  screenshotAttachedTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#166534',
  },
  screenshotAttachedSub: {
    fontSize: 10,
    color: '#15803d',
    marginTop: 2,
  },
  removeScreenshotBtn: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#fee2e2',
  },
});

