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
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../theme/colors';
import { useAuth } from '../../store/AuthContext';
import { DataSyncManager } from '../../services/dataSync';
import { formatCurrency, formatDate } from '../../utils/format';
import { CustomerChit, CustomerGoal } from '../../types';
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

export const CustomerDashboardScreen: React.FC<{ navigation: any; route?: any }> = ({
  navigation,
  route,
}) => {
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
  const [payMode, setPayMode] = useState<'UPI' | 'Bank Transfer'>('UPI');
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
  const [showSupportModal, setShowSupportModal] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Savings Goals State (Funds Genie Custom Goals)
  const [customerGoals, setCustomerGoals] = useState<CustomerGoal[]>([]);
  const [showSetGoalModal, setShowSetGoalModal] = useState(false);
  const [goalTitle, setGoalTitle] = useState('');
  const [goalCategory, setGoalCategory] = useState<CustomerGoal['category']>('EDUCATION');
  const [selectedChitForGoal, setSelectedChitForGoal] = useState<CustomerChit | null>(null);
  const [goalSubmitting, setGoalSubmitting] = useState(false);

  // Scheme Schedules selected category state
  const [selectedRegularCat, setSelectedRegularCat] = useState<number>(100000);
  const [selectedFixedCat, setSelectedFixedCat] = useState<number>(100000);
  const [selectedAuctionCat, setSelectedAuctionCat] = useState<number>(100000);

  // Handle incoming sidebar action route params
  useEffect(() => {
    if (route?.params?.action) {
      const act = route.params.action;
      if (act === 'HOME' || act === 'PORTFOLIO') {
        setActiveTab('myChits');
      } else if (act === 'BANK_DETAILS') {
        const fallbackBank = companyBank || (allCompanyBanks && allCompanyBanks[0]) || {
          accountHolderName: 'Jenista Chit Funds Pvt Ltd',
          upiId: 'jenistachits@hdfcbank',
          bankName: 'HDFC Bank',
          accountNumber: '50200012345678',
          ifscCode: 'HDFC0001234',
        };
        setShowQrModal(fallbackBank);
      } else if (act === 'STATEMENTS') {
        setShowStatementsModal(true);
      } else if (act === 'SUPPORT') {
        setShowSupportModal(true);
      }
    }
  }, [route?.params]);

  const fetchCustomerProfile = async () => {
    try {
      if (!user) return;
      const [allCustomers, banks, ledgerRaw, reqsList, wReqsList, goalsList] = await Promise.all([
        DataSyncManager.getCustomers(),
        DataSyncManager.getBankAccounts(),
        secureStorage.getItem('synced_ledger'),
        DataSyncManager.getPaymentRequests(),
        DataSyncManager.getWithdrawalRequests(),
        DataSyncManager.getCustomerGoals(user.id),
      ]);

      if (goalsList && goalsList.length > 0) {
        setCustomerGoals(goalsList);
      } else {
        setCustomerGoals([]);
      }

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
      const userReqs = (reqsList || []).filter(
        (r: any) =>
          r.customerId === user.id ||
          (user.phone && r.mobile?.replace(/\D/g, '') === cleanUserPhone) ||
          (user.phone && r.customerMobile?.replace(/\D/g, '') === cleanUserPhone)
      );
      setPendingRequests(userReqs);

      // Parse Withdrawal Requests
      const userWReqs = (wReqsList || []).filter(
        (w: any) =>
          w.customerId === user.id ||
          (user.phone && w.mobile?.replace(/\D/g, '') === cleanUserPhone)
      );
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

  useFocusEffect(
    React.useCallback(() => {
      fetchCustomerProfile();
    }, [user])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchCustomerProfile();
  };

  const handleLogout = () => {
    Alert.alert(
      'Log Out',
      'Are you sure you want to log out of your account?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Log Out',
          style: 'destructive',
          onPress: async () => {
            await logout();
          },
        },
      ]
    );
  };

  const copyToClipboard = (text: string, key: string) => {
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
    Alert.alert('Copied', `"${text}" copied to clipboard.`);
  };

  const handleSaveGoal = async () => {
    if (!goalTitle.trim()) {
      Alert.alert('Required', 'Please enter what you are saving for (e.g., Child’s Education, Marriage, House Construction).');
      return;
    }
    if (!selectedChitForGoal) {
      Alert.alert('Select Chit', 'Please select which active chit subscription is dedicated for this savings goal.');
      return;
    }

    const chitVal = Number(selectedChitForGoal.chitValue) || 100000;
    const durationM = Number(selectedChitForGoal.duration) || 20;

    // Calculate real paid amount and completed months from ledger
    const scheduleSummary = buildCustomerChitSchedule({
      customer: customerRecord || user,
      chit: selectedChitForGoal,
      ledgerTransactions: transactions,
    });

    const savedAmt = scheduleSummary.totalPaidAmount || 0;
    const completedM = scheduleSummary.completedMonthsCount || 0;

    try {
      setGoalSubmitting(true);
      const newGoal = await DataSyncManager.saveCustomerGoal({
        customerId: user?.id || 'customer',
        title: goalTitle.trim(),
        category: goalCategory,
        targetAmount: chitVal,
        targetMonths: durationM,
        savedAmount: savedAmt,
        completedMonths: completedM,
        associatedGroupId: selectedChitForGoal.groupId,
      });

      setCustomerGoals((prev) => [newGoal, ...prev]);
      setShowSetGoalModal(false);
      setGoalTitle('');
      setSelectedChitForGoal(null);
      Alert.alert('Goal Created', `"${newGoal.title}" dedicated to ${selectedChitForGoal.groupName} has been saved!`);
    } catch (e) {
      Alert.alert('Error', 'Unable to save your goal right now. Please try again.');
    } finally {
      setGoalSubmitting(false);
    }
  };

  const handleDeleteGoal = (goalId: string, title: string) => {
    Alert.alert(
      'Delete Goal',
      `Are you sure you want to remove "${title}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            await DataSyncManager.deleteCustomerGoal(goalId, user?.id || 'customer');
            setCustomerGoals((prev) => prev.filter((g) => g.id !== goalId));
          },
        },
      ]
    );
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
    if (!payRefNo.trim()) {
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

      const savedReq = await DataSyncManager.savePaymentRequest(newReq);
      setPendingRequests((prev) => [savedReq, ...prev.filter((r) => r.id !== savedReq.id)]);
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
      const isAuction = String(withdrawModalChit.scheme || '').toLowerCase().includes('auc');
      const isFixed = String(withdrawModalChit.scheme || '').toLowerCase().includes('fix');
      
      let prizeAmount = chitVal * 0.95;
      if (isAuction) {
        const scheduleSum = buildCustomerChitSchedule({
          customer: customerRecord || user,
          chit: withdrawModalChit,
          ledgerTransactions: transactions,
        });
        prizeAmount = scheduleSum.currentEligiblePrizeAmount || chitVal * 0.85;
      }

      const newWReq = {
        id: `WDR-${Date.now().toString().slice(-6)}`,
        customerId: user?.id || 'CUST',
        customerName: user?.name || 'Customer',
        mobile: user?.phone || '',
        groupId: withdrawModalChit.groupId,
        groupName: withdrawModalChit.groupName || withdrawModalChit.groupId,
        ticketNumber: withdrawModalChit.ticketNumber || '',
        chitValue: chitVal,
        eligibleAmount: Math.round(prizeAmount),
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

      const savedWReq = await DataSyncManager.saveWithdrawalRequest(newWReq);
      setPendingWithdrawals((prev) => [savedWReq, ...prev.filter((w) => w.id !== savedWReq.id)]);
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
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView
        style={styles.container}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.gold.primary} />}
      >
        <StatusBar barStyle="dark-content" />

        {/* 1. Top Brand & Profile Bar */}
        <View style={styles.topProfileBar}>
          <View style={styles.companyLogoBox}>
            <Image
              source={require('../../assets/Golden Tree Emblem Logo.png')}
              style={styles.companyLogoImage}
              resizeMode="contain"
            />
          </View>

          <View style={styles.brandTitleBox}>
            <Text style={styles.topBrandName}>Jenista Chits</Text>
          </View>

          <View style={styles.topRightActions}>
            <TouchableOpacity
              style={styles.notifIconBtn}
              onPress={() => navigation.navigate('Notifications')}
              activeOpacity={0.7}
            >
              <Ionicons name="notifications-outline" size={20} color="#0C8A7D" />
              <View style={styles.notifBadgeDot} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.logoutIconBtn}
              onPress={handleLogout}
              activeOpacity={0.7}
            >
              <Ionicons name="log-out-outline" size={20} color="#DC2626" />
            </TouchableOpacity>
          </View>
        </View>

      {/* 2. Primary Mint-Teal Portfolio Summary Banner (Funds Genie Card 1) */}
      <View style={styles.tealPortfolioCard}>
        <View style={styles.portfolioTopRow}>
          <View>
            <Text style={styles.tealCardSmallLabel}>Total Chit Value</Text>
            <View style={styles.tealCardAmountRow}>
              <Text style={styles.tealCardMainAmount}>
                {formatCurrency(chits.reduce((acc, c) => acc + Number(c.chitValue || 0), 0) || totalInvested)}
              </Text>
              <Ionicons name="arrow-up" size={18} color="#FFFFFF" style={{ marginLeft: 4 }} />
            </View>
          </View>

          <TouchableOpacity
            style={styles.seePortfolioPill}
            onPress={() => navigation.navigate('CustomerPortfolio')}
            activeOpacity={0.8}
          >
            <Text style={styles.seePortfolioText}>See my Portfolio</Text>
            <Ionicons name="chevron-forward" size={14} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        <View style={styles.tealCardDivider} />

        <View style={styles.tealCardBottomRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.tealCardSubLabel}>Invested Value</Text>
            <Text style={styles.tealCardSubAmount}>{formatCurrency(totalInvested)}</Text>
          </View>

          <View style={{ flex: 1 }}>
            <Text style={styles.tealCardSubLabel}>Eligible Returns / Dues</Text>
            <Text style={styles.tealCardSubAmountPositive}>
              {pendingDues > 0 ? `-${formatCurrency(pendingDues)} Due` : `+${formatCurrency(totalWithdrawnAmount || totalInvested * 0.08)}`}
            </Text>
          </View>
        </View>
      </View>

      {/* 3. MY GOALS SECTION (Funds Genie Savings Purposes) */}
      <View style={styles.goalsSection}>
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionHeaderTitle}>MY GOALS</Text>
          <TouchableOpacity onPress={() => setShowSetGoalModal(true)} activeOpacity={0.7}>
            <Text style={styles.sectionHeaderAction}>Set New Goal</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.goalsScrollContent}
        >
          {customerGoals.length > 0 ? (
            customerGoals.map((goal, idx) => {
              // Locate associated chit subscription if linked
              const linkedChit = chits.find((c) => c.groupId === goal.associatedGroupId);
              let target = goal.targetAmount || 100000;
              let totalM = goal.targetMonths || 20;
              let saved = goal.savedAmount || 0;
              let completedM = goal.completedMonths || 0;

              if (linkedChit) {
                target = Number(linkedChit.chitValue) || target;
                totalM = Number(linkedChit.duration) || totalM;
                const scheduleSummary = buildCustomerChitSchedule({
                  customer: customerRecord || user,
                  chit: linkedChit,
                  ledgerTransactions: transactions,
                });
                saved = scheduleSummary.totalPaidAmount;
                completedM = scheduleSummary.completedMonthsCount;
              }

              const progressPct = Math.min(100, Math.round(target > 0 ? (saved / target) * 100 : 0));
              const targetLac = (target / 100000).toFixed(1);
              const savedLac = (saved / 100000).toFixed(1);

              const getGoalIcon = (cat: string) => {
                switch (cat) {
                  case 'EDUCATION':
                    return 'school-outline';
                  case 'MARRIAGE':
                    return 'heart-outline';
                  case 'HOME':
                    return 'home-outline';
                  case 'VEHICLE':
                    return 'car-sport-outline';
                  case 'WEALTH':
                    return 'trending-up-outline';
                  case 'BUSINESS':
                    return 'briefcase-outline';
                  case 'RETIREMENT':
                    return 'shield-checkmark-outline';
                  default:
                    return 'ribbon-outline';
                }
              };

              return (
                <TouchableOpacity
                  key={goal.id || idx}
                  style={styles.goalCard}
                  onLongPress={() => handleDeleteGoal(goal.id, goal.title)}
                  activeOpacity={0.9}
                >
                  <View style={styles.goalCardTop}>
                    <View style={{ flex: 1, paddingRight: 4 }}>
                      <Text style={styles.goalCardTitle} numberOfLines={1}>{goal.title}</Text>
                      <Text style={styles.goalCardScheme}>
                        {goal.category} GOAL
                      </Text>
                    </View>
                    <View style={styles.goalIconCircle}>
                      <Ionicons
                        name={getGoalIcon(goal.category) as any}
                        size={18}
                        color="#0C8A7D"
                      />
                    </View>
                  </View>

                  <View style={styles.goalProgressWrap}>
                    <Text style={styles.goalValText}>
                      {savedLac} / {targetLac} Lac
                    </Text>
                    <View style={styles.goalProgressBarTrack}>
                      <View style={[styles.goalProgressBarFill, { width: `${progressPct}%` }]} />
                    </View>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6, alignItems: 'center' }}>
                      <Text style={styles.goalDurationText}>
                        {completedM} / {totalM} Months
                      </Text>
                      <Text style={[styles.goalDurationText, { color: '#0C8A7D', fontWeight: '700' }]}>
                        {progressPct}%
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })
          ) : (
            <TouchableOpacity
              style={[styles.goalCard, { alignItems: 'center', justifyContent: 'center', borderStyle: 'dashed' }]}
              onPress={() => setShowSetGoalModal(true)}
              activeOpacity={0.8}
            >
              <Ionicons name="add-circle-outline" size={32} color="#0C8A7D" />
              <Text style={{ fontSize: 13, fontWeight: '800', color: '#0C8A7D', marginTop: 6 }}>Set Your First Goal</Text>
              <Text style={{ fontSize: 10, color: '#7E9596', textAlign: 'center', marginTop: 2 }}>
                e.g. Child's Education, Home, Marriage
              </Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      </View>

      {/* 4. Web-Style Segment Tabs Bar */}
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
            color={activeTab === 'myChits' ? '#FFFFFF' : '#7E9596'}
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
            color={activeTab === 'regularPlan' ? '#FFFFFF' : '#7E9596'}
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
            color={activeTab === 'fixedPlan' ? '#FFFFFF' : '#7E9596'}
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
            color={activeTab === 'auctionPlan' ? '#FFFFFF' : '#7E9596'}
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
                const wReq = pendingWithdrawals.find((w) => w.groupId === item.groupId);
                const isDisbursed = item.isWithdrawn || (wReq && wReq.status === 'DISBURSED');
                const isPending = wReq && wReq.status === 'PENDING_ADMIN_DISBURSAL';

                const scheduleSummary = buildCustomerChitSchedule({
                  customer: customerRecord || user,
                  chit: item,
                  ledgerTransactions: transactions,
                });

                // Dynamically obtain eligible prize based on scheme (auction discount vs fixed)
                const prizeVal = scheduleSummary.currentEligiblePrizeAmount || (item.scheme === 'Auction' ? chitVal * 0.85 : chitVal * 0.95);
                const prizeLabel = item.scheme === 'Auction' ? 'EST. PRIZE (AUCTION)' : 'NET PRIZE (95%)';

                const firstUnpaidRow = scheduleSummary.schedule.find((r) => r.status !== 'PAID');
                const now = new Date();
                const currentMonthDueRow = scheduleSummary.schedule.find((r) => {
                  const d = new Date(r.dueDateIso);
                  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
                });

                // Current month is considered paid if the row for this month is marked PAID, or if all completed
                const isCurrentMonthPaid =
                  !firstUnpaidRow ||
                  (currentMonthDueRow && currentMonthDueRow.status === 'PAID') ||
                  (scheduleSummary.remainingBalanceDue === 0 && scheduleSummary.totalPaidAmount > 0);

                const targetRow = firstUnpaidRow || scheduleSummary.schedule[scheduleSummary.schedule.length - 1];
                const nextDueStr = targetRow ? targetRow.dueDate : (item as any)?.dueDate || '15th of month';
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

                    {/* Progress Bar & Cycle Status */}
                    <View style={styles.chitProgressBox}>
                      <View style={styles.progressRow}>
                        <Text style={styles.progressLabel}>
                          Installments: {scheduleSummary.completedMonthsCount} of {scheduleSummary.totalDurationMonths} Months Paid
                        </Text>
                        <Text style={styles.dueDateBadge}>
                          Due: {nextDueStr}
                        </Text>
                      </View>
                      <View style={styles.progressTrack}>
                        <View
                          style={[
                            styles.progressFill,
                            {
                              width: `${Math.min(
                                100,
                                Math.round((scheduleSummary.completedMonthsCount / scheduleSummary.totalDurationMonths) * 100)
                              )}%`,
                            },
                          ]}
                        />
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
                        <Text style={styles.subLabel}>{prizeLabel}</Text>
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

          {/* MY RECENT TRANSACTIONS - Funds Genie Table Style */}
          <View style={styles.transactionsContainer}>
            <View style={styles.recentTransactionsHeader}>
              <Text style={styles.recentSectionTitle}>MY RECENT TRANSACTIONS</Text>
              <TouchableOpacity onPress={() => setShowStatementsModal(true)}>
                <Text style={styles.recentMoreLink}>More</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.trxTableCard}>
              <View style={styles.trxTableHeader}>
                <Text style={[styles.trxThText, { width: 75 }]}>Date</Text>
                <Text style={[styles.trxThText, { flex: 1 }]}>Scheme</Text>
                <Text style={[styles.trxThText, { width: 85, textAlign: 'right' }]}>Amount</Text>
                <Text style={[styles.trxThText, { width: 44, textAlign: 'center' }]}></Text>
              </View>

              {transactions.length === 0 ? (
                <View style={styles.emptyCardSmall}>
                  <Text style={{ fontSize: 12, color: '#7E9596' }}>No transactions recorded yet.</Text>
                </View>
              ) : (
                transactions.slice(0, 5).map((t, idx) => (
                  <View key={idx} style={styles.trxTableRow}>
                    <Text style={styles.trxColDate}>{formatDate(t.date).slice(0, 6)}</Text>
                    <View style={{ flex: 1, paddingRight: 6 }}>
                      <Text style={styles.trxColScheme} numberOfLines={1}>
                        {t.description || 'Chit Installment'}
                      </Text>
                    </View>
                    <Text style={styles.trxColAmount}>+{formatCurrency(t.amount)}</Text>
                    <TouchableOpacity
                      style={styles.trxPrintIconBtn}
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
                      activeOpacity={0.7}
                    >
                      <Ionicons name="receipt-outline" size={15} color="#0C8A7D" />
                    </TouchableOpacity>
                  </View>
                ))
              )}
            </View>
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
                  {(['UPI', 'Bank Transfer'] as const).map((m) => (
                    <TouchableOpacity
                      key={m}
                      style={[styles.modePill, payMode === m && styles.modePillActive]}
                      onPress={() => setPayMode(m)}
                    >
                      <Text style={[styles.modeText, payMode === m && styles.modeTextActive]}>{m}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

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
                  <Text style={styles.prizeBannerLabel}>
                    {String(withdrawModalChit.scheme || '').toLowerCase().includes('auc')
                      ? 'Current Cycle Eligible Auction Prize:'
                      : 'Net Payout (95% after 5% foreman fee):'}
                  </Text>
                  <Text style={styles.prizeBannerAmount}>
                    {formatCurrency(
                      String(withdrawModalChit.scheme || '').toLowerCase().includes('auc')
                        ? (buildCustomerChitSchedule({
                            customer: customerRecord || user,
                            chit: withdrawModalChit,
                            ledgerTransactions: transactions,
                          }).currentEligiblePrizeAmount || (withdrawModalChit.chitValue || 100000) * 0.85)
                        : (withdrawModalChit.chitValue || 100000) * 0.95
                    )}
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

      {/* 7. MODAL: HELP & SUPPORT */}
      {showSupportModal && (
        <Modal visible transparent animationType="fade" onRequestClose={() => setShowSupportModal(false)}>
          <View style={styles.modalOverlay}>
            <View style={[styles.modalCard, { padding: 22 }]}>
              <View style={{ flexDirection: 'row', width: '100%', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Ionicons name="headset-outline" size={22} color={Colors.gold.dark} />
                  <Text style={styles.modalTitle}>Member Support</Text>
                </View>
                <TouchableOpacity onPress={() => setShowSupportModal(false)}>
                  <Ionicons name="close" size={22} color={Colors.textSecondary} />
                </TouchableOpacity>
              </View>

              <Text style={{ fontSize: 13, color: Colors.textSecondary, marginBottom: 16, lineHeight: 18 }}>
                Jenista Chit Funds Customer Care & Branch Support Team is available Monday through Saturday (9:00 AM – 6:30 PM).
              </Text>

              <TouchableOpacity
                style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#f8fafc', padding: 14, borderRadius: 14, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 10 }}
                onPress={() => Linking.openURL('tel:+919876543210').catch(() => {})}
              >
                <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: '#e0f2fe', alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="call" size={18} color="#0284c7" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 11, color: Colors.textMuted, fontWeight: '700' }}>CALL HELPLINE</Text>
                  <Text style={{ fontSize: 14, fontWeight: '800', color: Colors.navy.primary, marginTop: 2 }}>+91 98765 43210</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={Colors.border} />
              </TouchableOpacity>

              <TouchableOpacity
                style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#f8fafc', padding: 14, borderRadius: 14, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 10 }}
                onPress={() => Linking.openURL('https://wa.me/919876543210?text=Hello%20Jenista%20Chits,%20I%20need%20assistance.').catch(() => {})}
              >
                <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: '#dcfce7', alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="logo-whatsapp" size={18} color="#16a34a" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 11, color: Colors.textMuted, fontWeight: '700' }}>WHATSAPP ASSISTANCE</Text>
                  <Text style={{ fontSize: 14, fontWeight: '800', color: '#15803d', marginTop: 2 }}>Chat with Branch Executive</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={Colors.border} />
              </TouchableOpacity>

              <TouchableOpacity
                style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#f8fafc', padding: 14, borderRadius: 14, borderWidth: 1, borderColor: '#e2e8f0' }}
                onPress={() => Linking.openURL('mailto:support@jenistachits.com').catch(() => {})}
              >
                <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: '#fef3c7', alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="mail" size={18} color="#d97706" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 11, color: Colors.textMuted, fontWeight: '700' }}>OFFICIAL EMAIL</Text>
                  <Text style={{ fontSize: 14, fontWeight: '800', color: Colors.text, marginTop: 2 }}>support@jenistachits.com</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={Colors.border} />
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}

      {/* 8. MODAL: SET NEW SAVINGS GOAL (Funds Genie Goals) */}
      {showSetGoalModal && (
        <Modal visible transparent animationType="slide" onRequestClose={() => setShowSetGoalModal(false)}>
          <View style={styles.modalOverlay}>
            <View style={[styles.modalCard, { maxHeight: '90%' }]}>
              <View style={styles.modalHeader}>
                <View>
                  <Text style={styles.modalTitle}>Set New Savings Goal</Text>
                  <Text style={styles.modalSubtitle}>What purpose are you saving your chits for?</Text>
                </View>
                <TouchableOpacity onPress={() => setShowSetGoalModal(false)}>
                  <Ionicons name="close" size={22} color={Colors.textSecondary} />
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
                {/* Goal Title */}
                <Text style={styles.inputLabel}>WHAT ARE YOU SAVING FOR?</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="e.g. Child's Higher Education, Daughter's Marriage"
                  placeholderTextColor="#94A3B8"
                  value={goalTitle}
                  onChangeText={setGoalTitle}
                />

                {/* Category Preset Pills */}
                <Text style={[styles.inputLabel, { marginTop: 14 }]}>CATEGORY</Text>
                <View style={styles.goalCategoryPillsRow}>
                  {[
                    { label: 'Education', val: 'EDUCATION', icon: 'school-outline' },
                    { label: 'Marriage', val: 'MARRIAGE', icon: 'heart-outline' },
                    { label: 'Dream Home', val: 'HOME', icon: 'home-outline' },
                    { label: 'Vehicle', val: 'VEHICLE', icon: 'car-sport-outline' },
                    { label: 'Wealth', val: 'WEALTH', icon: 'trending-up-outline' },
                    { label: 'Business', val: 'BUSINESS', icon: 'briefcase-outline' },
                    { label: 'Retirement', val: 'RETIREMENT', icon: 'shield-checkmark-outline' },
                  ].map((catItem) => (
                    <TouchableOpacity
                      key={catItem.val}
                      style={[
                        styles.goalCatPill,
                        goalCategory === catItem.val && styles.goalCatPillActive,
                      ]}
                      onPress={() => {
                        setGoalCategory(catItem.val as any);
                        if (!goalTitle || ['Education', 'Marriage', 'Home', 'Vehicle', 'Wealth', 'Business', 'Retirement'].some(s => goalTitle.toLowerCase().includes(s.toLowerCase()))) {
                          setGoalTitle(
                            catItem.val === 'EDUCATION' ? "Child's Education" :
                            catItem.val === 'MARRIAGE' ? "Family Marriage" :
                            catItem.val === 'HOME' ? "New House Construction" :
                            catItem.val === 'VEHICLE' ? "Buy New Car / Bike" :
                            catItem.val === 'BUSINESS' ? "Business Growth Fund" :
                            catItem.val === 'RETIREMENT' ? "Retirement Nest Egg" : "Wealth Accumulation"
                          );
                        }
                      }}
                      activeOpacity={0.8}
                    >
                      <Ionicons
                        name={catItem.icon as any}
                        size={13}
                        color={goalCategory === catItem.val ? '#FFFFFF' : '#0C8A7D'}
                      />
                      <Text
                        style={[
                          styles.goalCatPillText,
                          goalCategory === catItem.val && styles.goalCatPillTextActive,
                        ]}
                      >
                        {catItem.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Select Dedicated Chit Subscription */}
                <Text style={[styles.inputLabel, { marginTop: 14 }]}>DEDICATE ACTIVE CHIT SUBSCRIPTION</Text>
                {(() => {
                  // Exclude chits already assigned to an existing savings goal
                  const availableChits = chits.filter(
                    (c) => !customerGoals.some((g) => g.associatedGroupId === c.groupId)
                  );

                  if (availableChits.length === 0) {
                    return (
                      <View style={{ backgroundColor: '#FEF3C7', padding: 14, borderRadius: 12, borderWidth: 1, borderColor: '#FDE68A', marginTop: 4 }}>
                        <Text style={{ fontSize: 12, fontWeight: '800', color: '#92400E' }}>
                          All Enrolled Chits Already Have Assigned Goals
                        </Text>
                        <Text style={{ fontSize: 11, color: '#B45309', marginTop: 3 }}>
                          Every active chit in your portfolio is currently linked to a dedicated savings purpose. Join a new chit group or remove an existing goal to link a new one.
                        </Text>
                      </View>
                    );
                  }

                  return (
                    <View style={{ gap: 8, marginTop: 4 }}>
                      {availableChits.map((item) => {
                        const isSelected = selectedChitForGoal?.groupId === item.groupId;
                        const chitVal = Number(item.chitValue) || 100000;
                        const durationM = Number(item.duration) || 20;

                        return (
                          <TouchableOpacity
                            key={item.groupId}
                            style={[
                              styles.chitSelectOptionCard,
                              isSelected && styles.chitSelectOptionCardActive,
                            ]}
                            onPress={() => setSelectedChitForGoal(item)}
                            activeOpacity={0.8}
                          >
                            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                              <View style={{ flex: 1, paddingRight: 8 }}>
                                <Text style={[styles.chitSelectTitle, isSelected && styles.chitSelectTitleActive]}>
                                  {item.groupName}
                                </Text>
                                <Text style={styles.chitSelectMeta}>
                                  Ticket #{item.ticketNumber} • {item.scheme || 'Auction'} Plan
                                </Text>
                              </View>
                              <View style={{ alignItems: 'flex-end' }}>
                                <Text style={[styles.chitSelectVal, isSelected && { color: '#0C8A7D' }]}>
                                  {formatCurrency(chitVal)}
                                </Text>
                                <Text style={styles.chitSelectDuration}>
                                  {durationM} Months
                                </Text>
                              </View>
                            </View>

                            {isSelected && (
                              <View style={styles.chitSelectedCheckRow}>
                                <Ionicons name="checkmark-circle" size={16} color="#0C8A7D" />
                                <Text style={styles.chitSelectedCheckText}>
                                  Goal Target: {formatCurrency(chitVal)} across {durationM} Months
                                </Text>
                              </View>
                            )}
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  );
                })()}

                <TouchableOpacity
                  style={[
                    styles.submitActionBtn,
                    { marginTop: 22 },
                    (!selectedChitForGoal || goalSubmitting) && { opacity: 0.6 },
                  ]}
                  onPress={handleSaveGoal}
                  disabled={!selectedChitForGoal || goalSubmitting}
                  activeOpacity={0.85}
                >
                  <Text style={styles.submitActionBtnText}>
                    {goalSubmitting ? 'Saving Goal...' : 'Link Chit & Save Goal'}
                  </Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          </View>
        </Modal>
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
  container: {
    flex: 1,
    backgroundColor: '#F9FBFB',
  },
  topProfileBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingTop: 8,
    paddingBottom: 14,
  },
  companyLogoBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFF9ED',
    borderWidth: 1.5,
    borderColor: '#FEE8BA',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  companyLogoImage: {
    width: 32,
    height: 32,
  },
  brandTitleBox: {
    flex: 1,
    alignItems: 'center',
  },
  topBrandName: {
    fontSize: 18,
    fontWeight: '800',
    color: '#086359',
    letterSpacing: -0.3,
  },
  topRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  notifIconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D2EBE6',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  notifBadgeDot: {
    position: 'absolute',
    top: 8,
    right: 9,
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#DC4545',
  },
  logoutIconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#FFF1F2',
    borderWidth: 1,
    borderColor: '#FECDD3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tealPortfolioCard: {
    backgroundColor: '#0C8A7D',
    marginHorizontal: 16,
    marginBottom: 18,
    borderRadius: 18,
    padding: 18,
    shadowColor: '#0C8A7D',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.22,
    shadowRadius: 10,
    elevation: 4,
  },
  portfolioTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  tealCardSmallLabel: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
    fontWeight: '600',
  },
  tealCardAmountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  tealCardMainAmount: {
    fontSize: 26,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: -0.5,
  },
  seePortfolioPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
  },
  seePortfolioText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  tealCardDivider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    marginVertical: 14,
  },
  tealCardBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  tealCardSubLabel: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.75)',
    fontWeight: '500',
  },
  tealCardSubAmount: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
    marginTop: 2,
  },
  tealCardSubAmountPositive: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFECC2',
    marginTop: 2,
  },
  goalsSection: {
    marginBottom: 18,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 18,
    marginBottom: 10,
  },
  sectionHeaderTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#7E9596',
    letterSpacing: 0.5,
  },
  sectionHeaderAction: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0C8A7D',
  },
  goalsScrollContent: {
    paddingHorizontal: 16,
    gap: 12,
  },
  goalCard: {
    width: 175,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#D8E4E5',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  goalCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 6,
  },
  goalCardTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#133336',
  },
  goalCardScheme: {
    fontSize: 10,
    color: '#7E9596',
    marginTop: 2,
  },
  goalIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#E8F5F3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  goalProgressWrap: {
    marginTop: 12,
  },
  goalValText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#133336',
    marginBottom: 6,
  },
  goalProgressBarTrack: {
    height: 5,
    borderRadius: 3,
    backgroundColor: '#E8F5F3',
    overflow: 'hidden',
  },
  goalProgressBarFill: {
    height: '100%',
    backgroundColor: '#0C8A7D',
    borderRadius: 3,
  },
  goalDurationText: {
    fontSize: 10,
    color: '#7E9596',
    marginTop: 6,
    fontWeight: '500',
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
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D8E4E5',
  },
  tabButtonActive: {
    backgroundColor: '#0C8A7D',
    borderColor: '#0C8A7D',
  },
  tabButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#7E9596',
  },
  tabButtonTextActive: {
    color: '#FFFFFF',
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
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#D8E4E5',
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
    color: '#086359',
  },
  ticketSubtitle: {
    fontSize: 12,
    color: '#7E9596',
    marginTop: 2,
  },
  chitProgressBox: {
    marginTop: 12,
    marginBottom: 4,
  },
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  progressLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },
  dueDateBadge: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0C8A7D',
    backgroundColor: '#E8F5F3',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: '#E8F5F3',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#0C8A7D',
    borderRadius: 3,
  },
  activePlanBadge: {
    backgroundColor: '#E8F5F3',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  activePlanText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#086359',
  },
  currentMonthPaidBadge: {
    backgroundColor: '#E8F5F3',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#D2EBE6',
  },
  currentMonthPaidBadgeText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#086359',
  },
  cardDivider: {
    height: 1,
    backgroundColor: '#E8F5F3',
    marginVertical: 12,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  subLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#7E9596',
    letterSpacing: 0.5,
  },
  mainVal: {
    fontSize: 14,
    fontWeight: '800',
    color: '#133336',
    marginTop: 2,
  },
  cardActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E8F5F3',
  },
  payNowBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    backgroundColor: '#0C8A7D',
    paddingVertical: 8,
    borderRadius: 8,
  },
  payNowBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
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
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#D8E4E5',
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
    backgroundColor: '#E8F5F3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bankCardTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#133336',
  },
  bankCardSub: {
    fontSize: 11,
    color: '#7E9596',
  },
  viewQrPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#E8F5F3',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D2EBE6',
  },
  viewQrPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0C8A7D',
  },
  bankGrid: {
    backgroundColor: '#F7FBFA',
    padding: 12,
    borderRadius: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: '#E8F5F3',
  },
  bankDetailItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  bLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#7E9596',
  },
  bVal: {
    fontSize: 12,
    fontWeight: '700',
    color: '#133336',
  },
  bValMono: {
    fontSize: 12,
    fontWeight: '700',
    fontFamily: 'monospace',
    color: '#133336',
  },
  bValGold: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0C8A7D',
  },
  transactionsContainer: {
    paddingHorizontal: 16,
    marginTop: 4,
    marginBottom: 20,
  },
  recentTransactionsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  recentSectionTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#7E9596',
    letterSpacing: 0.6,
  },
  recentMoreLink: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0C8A7D',
  },
  trxTableCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#D8E4E5',
    overflow: 'hidden',
  },
  trxTableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5F3',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  trxThText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#086359',
  },
  trxTableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F5F5',
  },
  trxColDate: {
    width: 75,
    fontSize: 12,
    fontWeight: '600',
    color: '#7E9596',
  },
  trxColScheme: {
    fontSize: 13,
    fontWeight: '700',
    color: '#133336',
  },
  trxColAmount: {
    width: 85,
    textAlign: 'right',
    fontSize: 13,
    fontWeight: '800',
    color: '#0C8A7D',
  },
  trxPrintIconBtn: {
    width: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  receiptsCard: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#D8E4E5',
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
    color: '#133336',
  },
  trxMeta: {
    fontSize: 11,
    color: '#7E9596',
    marginTop: 2,
  },
  trxAmount: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0C8A7D',
  },
  printReceiptBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#E8F5F3',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#D2EBE6',
  },
  printReceiptText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#0C8A7D',
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
    backgroundColor: '#0C8A7D',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 18,
  },
  submitActionBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  filterPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
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
  statementItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F5F5',
  },
  statementItemTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#133336',
  },
  statementItemMeta: {
    fontSize: 11,
    color: '#7E9596',
    marginTop: 2,
  },
  statementItemAmount: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0C8A7D',
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
  goalCategoryPillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  goalCatPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: '#E8F5F3',
    borderWidth: 1,
    borderColor: '#D2EBE6',
  },
  goalCatPillActive: {
    backgroundColor: '#0C8A7D',
    borderColor: '#0C8A7D',
  },
  goalCatPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0C8A7D',
  },
  goalCatPillTextActive: {
    color: '#FFFFFF',
  },
  quickAmtPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  quickAmtPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  quickMonthPill: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  quickMonthPillActive: {
    backgroundColor: '#0C8A7D',
    borderColor: '#0C8A7D',
  },
  quickMonthPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  quickMonthPillTextActive: {
    color: '#FFFFFF',
  },
  chitSelectOptionCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
  },
  chitSelectOptionCardActive: {
    backgroundColor: '#E8F5F3',
    borderColor: '#0C8A7D',
  },
  chitSelectTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1E293B',
  },
  chitSelectTitleActive: {
    color: '#086359',
  },
  chitSelectMeta: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  chitSelectVal: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1E293B',
  },
  chitSelectDuration: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748B',
    marginTop: 2,
  },
  chitSelectedCheckRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(12, 138, 125, 0.2)',
  },
  chitSelectedCheckText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0C8A7D',
  },
});

