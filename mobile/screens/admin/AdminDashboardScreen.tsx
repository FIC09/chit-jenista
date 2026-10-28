import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  StatusBar,
  Image,
  Modal,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../theme/colors';
import { useAuth } from '../../store/AuthContext';
import { DataSyncManager } from '../../services/dataSync';
import { formatCurrency } from '../../utils/format';

export const AdminDashboardScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const { user } = useAuth();
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  // Add Group Modal State
  const [isAddGroupModalOpen, setIsAddGroupModalOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupScheme, setNewGroupScheme] = useState<'Auction' | 'Fixed' | 'Regular'>('Auction');
  const [creatingGroup, setCreatingGroup] = useState(false);

  // Add Customer / Member into Group Modal State (matching Web App exactly)
  const [isEnrollModalOpen, setIsEnrollModalOpen] = useState(false);
  const [availableGroups, setAvailableGroups] = useState<any[]>([]);
  const [allCustomersList, setAllCustomersList] = useState<any[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState('');
  
  // Search & Verification state (exact Web match)
  const [searchMobile, setSearchMobile] = useState('');
  const [foundCustomer, setFoundCustomer] = useState<any | null>(null);
  const [verificationCustomer, setVerificationCustomer] = useState<any | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [isSearchingCustomer, setIsSearchingCustomer] = useState(false);

  // Enrollment configuration state (exact Web match)
  const [memberScheme, setMemberScheme] = useState<'Regular' | 'Fixed' | 'Auction'>('Regular');
  const [customChitValue, setCustomChitValue] = useState('100000');
  const [customDuration, setCustomDuration] = useState('20');
  const [customerEnrollInstallment, setCustomerEnrollInstallment] = useState('5000');
  const [dueDate, setDueDate] = useState(() => {
    const d = new Date();
    d.setDate(15);
    if (d.getTime() < Date.now()) d.setMonth(d.getMonth() + 1);
    return d.toISOString().split('T')[0];
  });
  const [enrollingMember, setEnrollingMember] = useState(false);

  // Live Metrics
  const [totalCustomers, setTotalCustomers] = useState(0);
  const [activeGroups, setActiveGroups] = useState(0);
  const [totalCollections, setTotalCollections] = useState(0);
  const [totalDues, setTotalDues] = useState(0);

  // Enrollment by scheme breakdown (matching design reference)
  const [fixedEnrollments, setFixedEnrollments] = useState(0);
  const [regularEnrollments, setRegularEnrollments] = useState(0);
  const [auctionEnrollments, setAuctionEnrollments] = useState(0);

  const [recentCustomers, setRecentCustomers] = useState<any[]>([]);
  const [recentLedger, setRecentLedger] = useState<any[]>([]);
  const [pendingVerifications, setPendingVerifications] = useState<any[]>([]);

  const loadAllMetrics = async () => {
    try {
      const [custs, groups, ledger, paymentReqs] = await Promise.all([
        DataSyncManager.getCustomers(),
        DataSyncManager.getChitGroups(),
        DataSyncManager.getLedgerTransactions(),
        DataSyncManager.getPaymentRequests(),
      ]);

      setAllCustomersList(custs);
      setAvailableGroups(groups);
      if (groups.length > 0 && !selectedGroupId) {
        setSelectedGroupId(groups[0].id);
      }

      setTotalCustomers(custs.length);
      setActiveGroups(groups.length);

      const totalPaid = custs.reduce((acc, c) => acc + Number(c.totalPaid || 0), 0);
      const dues = custs.reduce((acc, c) => acc + Number(c.pending || 0), 0);
      setTotalCollections(totalPaid);
      setTotalDues(dues);

      // Compute scheme counts across all customer chits
      let fix = 0;
      let reg = 0;
      let auc = 0;
      custs.forEach((c) => {
        if (Array.isArray(c.chits)) {
          c.chits.forEach((ch: any) => {
            const sch = String(ch.scheme || ch.type || '').toUpperCase();
            if (sch.includes('FIX')) fix += 1;
            else if (sch.includes('AUC')) auc += 1;
            else reg += 1;
          });
        }
      });
      setFixedEnrollments(fix);
      setRegularEnrollments(reg);
      setAuctionEnrollments(auc);

      setRecentCustomers(custs.slice(0, 4));
      setRecentLedger(ledger.slice(0, 4));

      const pending = (paymentReqs || []).filter((r: any) => r.status === 'PENDING');
      setPendingVerifications(pending);
    } catch (e) {
      console.warn('Dashboard sync error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleCreateGroup = async () => {
    if (!newGroupName.trim()) {
      Alert.alert('Validation Error', 'Please enter a chit group name.');
      return;
    }
    setCreatingGroup(true);
    try {
      await DataSyncManager.createChitGroup({
        name: newGroupName.trim(),
        type: newGroupScheme,
        value: 100000,
        duration: 20,
        members: 20,
      });
      setIsAddGroupModalOpen(false);
      setNewGroupName('');
      await loadAllMetrics();
      Alert.alert('Group Created', `Group "${newGroupName.trim()}" has been created successfully!`);
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to create group');
    } finally {
      setCreatingGroup(false);
    }
  };

  const executeCustomerSearch = async () => {
    const q = searchMobile.trim();
    if (!q) {
      setSearchError('Please enter a 10-digit mobile number or customer name/ID.');
      return;
    }
    const cleanDigits = q.replace(/\D/g, '');
    setIsSearchingCustomer(true);
    setSearchError(null);

    try {
      // 1. Check local customers
      let matched = allCustomersList.find((c: any) => {
        const cMobile = (c.mobile || c.phone || '').replace(/\D/g, '');
        const cId = String(c.id || c.customerCode || '').toLowerCase();
        const cName = String(c.name || c.fullName || '').toLowerCase();
        return (
          (cleanDigits && cMobile === cleanDigits) ||
          (cleanDigits.length >= 7 && cMobile.includes(cleanDigits)) ||
          (cId && cId === q.toLowerCase()) ||
          (cName && cName === q.toLowerCase())
        );
      });

      if (!matched && cleanDigits.length >= 4) {
        matched = allCustomersList.find((c: any) => {
          const cMobile = (c.mobile || c.phone || '').replace(/\D/g, '');
          return cMobile.includes(cleanDigits);
        });
      }

      if (!matched && q.length >= 3) {
        matched = allCustomersList.find((c: any) => {
          const cName = String(c.name || c.fullName || '').toLowerCase();
          return cName.includes(q.toLowerCase());
        });
      }

      if (matched) {
        setVerificationCustomer(matched);
        setSearchError(null);
      } else {
        setVerificationCustomer(null);
        setSearchError(`No customer found with "${q}". Please check or create a new customer.`);
      }
    } finally {
      setIsSearchingCustomer(false);
    }
  };

  const handleEnrollCustomer = async () => {
    if (!selectedGroupId) {
      Alert.alert('Validation Error', 'Please select a chit group.');
      return;
    }
    if (!foundCustomer) {
      Alert.alert('Validation Error', 'Please search and select a verified customer to enroll.');
      return;
    }

    const val = Number(customChitValue) || 100000;
    const dur = Number(customDuration) || 20;
    const installment =
      Number(customerEnrollInstallment) || (dur > 0 ? Math.round(val / dur) : 5000);

    const targetGroup = availableGroups.find((g) => g.id === selectedGroupId);

    // Cache customer details before resetting state
    const enrolledCustomerName = foundCustomer.name || foundCustomer.fullName || 'Member';
    const enrolledCustomerId = foundCustomer.id;
    const enrolledCustomerPhone = foundCustomer.mobile || foundCustomer.phone || '';
    const enrolledCustomerMongoId = foundCustomer.mongoId || foundCustomer._id;

    setEnrollingMember(true);
    try {
      await DataSyncManager.enrollMemberToGroup({
        customerId: enrolledCustomerId,
        groupId: selectedGroupId,
        groupName: targetGroup?.name || selectedGroupId,
        scheme: memberScheme,
        chitValue: val,
        duration: dur,
        monthlyInstallment: installment,
        customerPhone: enrolledCustomerPhone,
        customerMongoId: enrolledCustomerMongoId,
        customerName: enrolledCustomerName,
      });

      setIsEnrollModalOpen(false);
      setFoundCustomer(null);
      setSearchMobile('');
      setVerificationCustomer(null);
      await loadAllMetrics();
      Alert.alert(
        'Member Enrolled',
        `Successfully enrolled "${enrolledCustomerName}" into "${targetGroup?.name || selectedGroupId}"!`
      );
    } catch (e: any) {
      Alert.alert('Enrollment Error', e?.message || 'Failed to enroll member into group.');
    } finally {
      setEnrollingMember(false);
    }
  };

  useEffect(() => {
    loadAllMetrics();
    const unsubscribe = navigation?.addListener?.('focus', () => {
      loadAllMetrics();
    });
    return unsubscribe;
  }, [navigation]);

  const onRefresh = () => {
    setRefreshing(true);
    loadAllMetrics();
  };

  const displayName = user?.name || 'Dhanush J';
  const userInitials = displayName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();

  return (
    <ScrollView
      style={styles.container}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={Colors.gold.primary}
        />
      }
    >
      <StatusBar barStyle="light-content" />

      {/* 1. Clean Funds Genie Teal Header */}
      <View style={styles.navyHeader}>
        {/* Greeting Banner */}
        <View style={styles.greetingRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.greetingSub}>Good Morning,</Text>
            <Text style={styles.greetingName}>{displayName}</Text>
            <Text style={styles.greetingTagline}>Your dreams, our support —</Text>
          </View>
        </View>
      </View>

      {/* 2. Overlapping Total Cumulative Fund Hero Card */}
      <View style={styles.fundCardWrapper}>
        <TouchableOpacity
          style={styles.fundCard}
          activeOpacity={0.85}
          onPress={() => navigation.navigate('Ledger')}
        >
          <View style={styles.fundCardContent}>
            <View style={{ flex: 1 }}>
              <Text style={styles.fundLabel}>Total Cumulative Fund</Text>
              <Text style={styles.fundAmount}>{formatCurrency(totalCollections)}</Text>
              <View style={styles.fundTrendRow}>
                <Ionicons name="trending-up" size={14} color="#0C8A7D" />
                <Text style={styles.fundTrendText}>
                  +₹{Math.round(totalCollections * 0.08).toLocaleString('en-IN')} this month
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#7E9596" />
          </View>
        </TouchableOpacity>
      </View>

      {/* Prominent Pending Online Payment Verifications Banner (Advance & Installments) */}
      {pendingVerifications.length > 0 && (
        <TouchableOpacity
          style={styles.pendingVerificationAlert}
          activeOpacity={0.85}
          onPress={() => navigation.navigate('PaymentVerifications')}
        >
          <View style={styles.alertIconPulseBox}>
            <Ionicons name="alert-circle" size={24} color="#D97706" />
          </View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={styles.alertTitle}>Payment Verifications</Text>
              <View style={styles.alertBadge}>
                <Text style={styles.alertBadgeText}>{pendingVerifications.length} PENDING</Text>
              </View>
            </View>
            <Text style={styles.alertSubtitle}>
              {pendingVerifications[0]?.isAdvance || pendingVerifications[0]?.adminNotes?.includes('Advance')
                ? `Customer advance payment of ${formatCurrency(pendingVerifications[0]?.amount || 0)} awaiting approval`
                : `${pendingVerifications.length} online payment${pendingVerifications.length > 1 ? 's' : ''} submitted by customers need verification`}
            </Text>
          </View>
          <View style={styles.alertActionBtn}>
            <Text style={styles.alertActionBtnText}>Review</Text>
            <Ionicons name="chevron-forward" size={14} color="#FFFFFF" />
          </View>
        </TouchableOpacity>
      )}

      {/* 3. 2x2 Distinctive Metric Cards Grid (Total Groups, Fixed, Regular, Auction) */}
      <View style={styles.gridContainer}>
        {/* Total Groups */}
        <TouchableOpacity
          style={styles.metricCard}
          activeOpacity={0.8}
          onPress={() => navigation.navigate('ChitGroupList')}
        >
          <View style={[styles.metricIconWrap, { backgroundColor: '#E8F5F3' }]}>
            <Ionicons name="people" size={18} color="#0C8A7D" />
          </View>
          <Text style={styles.metricTitle}>Total Groups</Text>
          <Text style={styles.metricValue}>{activeGroups}</Text>
          <Text style={styles.metricSub}>Active Groups</Text>
        </TouchableOpacity>

        {/* Fixed Enrollments */}
        <TouchableOpacity
          style={styles.metricCard}
          activeOpacity={0.8}
          onPress={() => navigation.navigate('CustomerList', { schemeFilter: 'FIXED' })}
        >
          <View style={[styles.metricIconWrap, { backgroundColor: '#EBF5FF' }]}>
            <Ionicons name="person-add" size={18} color="#0284C7" />
          </View>
          <Text style={styles.metricTitle}>Fixed Enrollments</Text>
          <Text style={styles.metricValue}>{fixedEnrollments}</Text>
          <Text style={styles.metricSub}>Enrolled Members</Text>
        </TouchableOpacity>

        {/* Regular Enrollments */}
        <TouchableOpacity
          style={styles.metricCard}
          activeOpacity={0.8}
          onPress={() => navigation.navigate('CustomerList', { schemeFilter: 'REGULAR' })}
        >
          <View style={[styles.metricIconWrap, { backgroundColor: '#F0FDF4' }]}>
            <Ionicons name="time-outline" size={18} color="#16A34A" />
          </View>
          <Text style={styles.metricTitle}>Regular Enrollments</Text>
          <Text style={styles.metricValue}>{regularEnrollments}</Text>
          <Text style={styles.metricSub}>Enrolled Members</Text>
        </TouchableOpacity>

        {/* Auction Enrollments */}
        <TouchableOpacity
          style={styles.metricCard}
          activeOpacity={0.8}
          onPress={() => navigation.navigate('CustomerList', { schemeFilter: 'AUCTION' })}
        >
          <View style={[styles.metricIconWrap, { backgroundColor: '#FFFBEB' }]}>
            <Ionicons name="hammer-outline" size={18} color="#D97706" />
          </View>
          <Text style={styles.metricTitle}>Auction Enrollments</Text>
          <Text style={styles.metricValue}>{auctionEnrollments}</Text>
          <Text style={styles.metricSub}>Enrolled Members</Text>
        </TouchableOpacity>
      </View>

      {/* 4. Quick Actions Tiles Row */}
      <View style={styles.quickActionsCard}>
        <TouchableOpacity
          style={styles.actionTile}
          onPress={() => navigation.navigate('PaymentVerifications')}
          activeOpacity={0.7}
        >
          <View style={[styles.actionIconCircle, { backgroundColor: '#FEF3C7', position: 'relative' }]}>
            <Ionicons name="shield-checkmark-outline" size={20} color="#D97706" />
            {pendingVerifications.length > 0 && (
              <View style={styles.tileBadgeCount}>
                <Text style={styles.tileBadgeCountText}>{pendingVerifications.length}</Text>
              </View>
            )}
          </View>
          <Text style={styles.actionTileText}>Verify Pay</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionTile}
          onPress={() => {
            setNewGroupName('');
            setNewGroupScheme('Auction');
            setIsAddGroupModalOpen(true);
          }}
          activeOpacity={0.7}
        >
          <View style={[styles.actionIconCircle, { backgroundColor: '#E8F5F3' }]}>
            <Ionicons name="add" size={22} color="#0C8A7D" />
          </View>
          <Text style={styles.actionTileText}>Add Group</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionTile}
          onPress={() => setIsEnrollModalOpen(true)}
          activeOpacity={0.7}
        >
          <View style={[styles.actionIconCircle, { backgroundColor: '#E8F5F3' }]}>
            <Ionicons name="person-add" size={20} color="#086359" />
          </View>
          <Text style={styles.actionTileText}>Add to Group</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionTile}
          onPress={() => navigation.navigate('AddCustomer')}
          activeOpacity={0.7}
        >
          <View style={[styles.actionIconCircle, { backgroundColor: '#EBF5FF' }]}>
            <Ionicons name="person-add-outline" size={20} color="#0284C7" />
          </View>
          <Text style={styles.actionTileText}>Add Member</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionTile}
          onPress={() => navigation.navigate('ReceiptEntry')}
          activeOpacity={0.7}
        >
          <View style={[styles.actionIconCircle, { backgroundColor: '#F0FDF4' }]}>
            <Ionicons name="card-outline" size={20} color="#16A34A" />
          </View>
          <Text style={styles.actionTileText}>Payments</Text>
        </TouchableOpacity>
      </View>

      {/* 4.5. Pending Online Verifications Section (Advance Payments & Installments) */}
      {pendingVerifications.length > 0 && (
        <>
          <View style={styles.sectionHeaderRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={styles.sectionTitle}>Pending Verifications</Text>
              <View style={[styles.alertBadge, { backgroundColor: '#FEF3C7' }]}>
                <Text style={[styles.alertBadgeText, { color: '#B45309' }]}>
                  {pendingVerifications.length}
                </Text>
              </View>
            </View>
            <TouchableOpacity onPress={() => navigation.navigate('PaymentVerifications')}>
              <Text style={styles.sectionLink}>Review All</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.listWrapper}>
            {pendingVerifications.slice(0, 3).map((pv: any, idx: number) => {
              const isAdv = pv.isAdvance || pv.adminNotes?.includes('Advance');
              return (
                <TouchableOpacity
                  key={`${pv.id || 'pv'}-${idx}`}
                  style={styles.verificationRowCard}
                  activeOpacity={0.8}
                  onPress={() => navigation.navigate('PaymentVerifications')}
                >
                  <View style={[styles.verifyIconBubble, isAdv && { backgroundColor: '#FFFBEB' }]}>
                    <Ionicons
                      name="receipt-outline"
                      size={18}
                      color={isAdv ? '#D97706' : '#0C8A7D'}
                    />
                  </View>

                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={styles.verifyCustName}>{pv.customerName || 'Customer'}</Text>
                      {isAdv && (
                        <View style={styles.advanceMiniBadge}>
                          <Text style={styles.advanceMiniBadgeText}>ADVANCE</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.verifyMeta}>
                      {pv.groupName || 'Chit Group'} • {pv.paymentMode || 'Online'}
                    </Text>
                  </View>

                  <View style={{ alignItems: 'flex-end', marginLeft: 8 }}>
                    <Text style={styles.verifyAmount}>{formatCurrency(pv.amount || 0)}</Text>
                    <View style={styles.pendingActionPill}>
                      <Text style={styles.pendingActionPillText}>Verify</Text>
                      <Ionicons name="arrow-forward" size={10} color="#B45309" />
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </>
      )}

      {/* 5. Enrolled Members Section (Reference Card Style) */}
      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionTitle}>Enrolled Members</Text>
        <TouchableOpacity onPress={() => navigation.navigate('CustomerList')}>
          <Text style={styles.sectionLink}>View All ({totalCustomers})</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.listWrapper}>
        {recentCustomers.map((cust, idx) => {
          const isPending = Number(cust.pending || 0) > 0;
          const initial = (cust.name || 'M').charAt(0).toUpperCase();

          return (
            <TouchableOpacity
              key={`${cust.id || 'cust'}-${idx}`}
              style={styles.customerRowCard}
              activeOpacity={0.7}
              onPress={() => navigation.navigate('CustomerDetail', { customer: cust })}
            >
              <View style={styles.avatarBubble}>
                <Text style={styles.avatarBubbleText}>{initial}</Text>
              </View>

              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.custRowName}>{cust.name}</Text>
                <Text style={styles.custRowMeta}>
                  {cust.chits?.[0]?.groupName || cust.id} • {cust.phone || 'No contact'}
                </Text>
              </View>

              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.custRowAmount}>
                  {isPending ? formatCurrency(cust.pending) : '₹0'}
                </Text>
                <View
                  style={[
                    styles.statusPillSmall,
                    isPending ? styles.pillPending : styles.pillPaid,
                  ]}
                >
                  <Text
                    style={[
                      styles.statusPillTextSmall,
                      isPending ? styles.textPending : styles.textPaid,
                    ]}
                  >
                    {isPending ? 'Pending' : 'Paid'}
                  </Text>
                </View>
              </View>

              <Ionicons
                name="chevron-forward"
                size={18}
                color="#D8E4E5"
                style={{ marginLeft: 6 }}
              />
            </TouchableOpacity>
          );
        })}
      </View>

      {/* 6. Recent Ledger Transactions Section */}
      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionTitle}>Recent Payments</Text>
        <TouchableOpacity onPress={() => navigation.navigate('Ledger')}>
          <Text style={styles.sectionLink}>Full Ledger</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.listWrapper}>
        {recentLedger.map((tx, idx) => {
          const isCredit = tx.type === 'CREDIT';
          return (
            <View key={`${tx.id || 'tx'}-${idx}`} style={styles.ledgerRowCard}>
              <View
                style={[
                  styles.txIconBox,
                  { backgroundColor: isCredit ? Colors.successLight : Colors.dangerLight },
                ]}
              >
                <Ionicons
                  name={isCredit ? 'arrow-down' : 'arrow-up'}
                  size={16}
                  color={isCredit ? Colors.success : Colors.danger}
                />
              </View>

              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.txRowDesc} numberOfLines={1}>
                  {tx.description}
                </Text>
                <Text style={styles.txRowRef}>{tx.reference}</Text>
              </View>

              <View style={{ alignItems: 'flex-end' }}>
                <Text
                  style={[
                    styles.txRowAmount,
                    { color: isCredit ? Colors.success : Colors.danger },
                  ]}
                >
                  {isCredit ? '+' : '-'}{formatCurrency(tx.amount)}
                </Text>
                <Text style={styles.txRowMode}>{tx.paymentMode || 'Cash'}</Text>
              </View>
            </View>
          );
        })}
      </View>

      <View style={{ height: 48 }} />

      {/* Add Chit Group Modal (Matches Web App Experience) */}
      <Modal
        visible={isAddGroupModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsAddGroupModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>Add New Chit Group</Text>
                <Text style={styles.modalSubtitle}>
                  Enter group name to create the group and start adding customers.
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setIsAddGroupModalOpen(false)}
                style={styles.modalCloseBtn}
              >
                <Ionicons name="close" size={22} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Input Field */}
            <View style={styles.modalBody}>
              <Text style={styles.inputLabel}>GROUP NAME *</Text>
              <TextInput
                style={styles.textInput}
                placeholder="e.g. Diamond Series A or Chit Group 1"
                placeholderTextColor={Colors.textMuted}
                value={newGroupName}
                onChangeText={setNewGroupName}
                autoFocus
              />
              <Text style={styles.helperText}>
                Only group name is needed to create the group.
              </Text>

              {/* Scheme Category Selection */}
              <Text style={[styles.inputLabel, { marginTop: 16 }]}>DEFAULT SCHEME TYPE</Text>
              <View style={styles.schemeChipRow}>
                {(['Auction', 'Fixed', 'Regular'] as const).map((scheme) => {
                  const isSelected = newGroupScheme === scheme;
                  return (
                    <TouchableOpacity
                      key={scheme}
                      style={[
                        styles.schemeChip,
                        isSelected && styles.schemeChipActive,
                      ]}
                      onPress={() => setNewGroupScheme(scheme)}
                    >
                      <Text
                        style={[
                          styles.schemeChipText,
                          isSelected && styles.schemeChipTextActive,
                        ]}
                      >
                        {scheme}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Info Note Box */}
              <View style={styles.infoNoteBox}>
                <View style={styles.infoNoteHeader}>
                  <View style={styles.goldDot} />
                  <Text style={styles.infoNoteTitle}>Flexible Mixed Schemes</Text>
                </View>
                <Text style={styles.infoNoteBody}>
                  Once created, you can add customers to this group. Each customer can have their own individual scheme (Fixed, Regular, or Auction), duration, and chit value.
                </Text>
              </View>
            </View>

            {/* Modal Actions */}
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setIsAddGroupModalOpen(false)}
                disabled={creatingGroup}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.createBtn,
                  (!newGroupName.trim() || creatingGroup) && styles.createBtnDisabled,
                ]}
                onPress={handleCreateGroup}
                disabled={!newGroupName.trim() || creatingGroup}
              >
                <Text style={styles.createBtnText}>
                  {creatingGroup ? 'Creating...' : 'Create Group'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal: Enroll Customer into Group (Exact Web Experience) */}
      <Modal
        visible={isEnrollModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsEnrollModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { maxHeight: '92%' }]}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>Enroll Customer into Group</Text>
                <Text style={styles.modalSubtitle}>
                  Search customer by mobile number to verify and enroll.
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setIsEnrollModalOpen(false)}
                style={styles.modalCloseBtn}
              >
                <Ionicons name="close" size={22} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={styles.modalBody}>
              {/* Target Chit Group Picker */}
              <Text style={styles.inputLabel}>TARGET CHIT GROUP *</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {availableGroups.map((g) => {
                    const isSelected = selectedGroupId === g.id;
                    return (
                      <TouchableOpacity
                        key={g.id}
                        style={[
                          styles.itemPickerChip,
                          isSelected && styles.itemPickerChipActive,
                        ]}
                        onPress={() => setSelectedGroupId(g.id)}
                      >
                        <Text
                          style={[
                            styles.itemPickerChipText,
                            isSelected && styles.itemPickerChipTextActive,
                          ]}
                        >
                          {g.name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </ScrollView>

              {/* 1. Search Customer by Mobile Number */}
              <Text style={styles.inputLabel}>1. SEARCH CUSTOMER BY MOBILE NUMBER *</Text>
              <View style={styles.searchRow}>
                <View style={styles.searchBarWrapper}>
                  <TextInput
                    style={styles.searchTextInput}
                    placeholder="Enter full 10-digit mobile number..."
                    placeholderTextColor={Colors.textMuted}
                    value={searchMobile}
                    keyboardType="phone-pad"
                    onChangeText={(txt) => {
                      setSearchMobile(txt);
                      if (searchError) setSearchError(null);
                    }}
                    onSubmitEditing={executeCustomerSearch}
                  />
                  {searchMobile.length > 0 && (
                    <TouchableOpacity
                      onPress={() => {
                        setSearchMobile('');
                        setFoundCustomer(null);
                        setSearchError(null);
                      }}
                      style={styles.searchClearBtn}
                    >
                      <Ionicons name="close-circle" size={18} color={Colors.textMuted} />
                    </TouchableOpacity>
                  )}
                </View>

                <TouchableOpacity
                  style={styles.searchActionBtn}
                  onPress={executeCustomerSearch}
                  disabled={isSearchingCustomer || !searchMobile.trim()}
                >
                  {isSearchingCustomer ? (
                    <ActivityIndicator size="small" color={Colors.white} />
                  ) : (
                    <>
                      <Ionicons name="search" size={15} color={Colors.white} />
                      <Text style={styles.searchActionText}>Search</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>

              {/* Search Error Notice */}
              {searchError && (
                <View style={styles.searchErrorBox}>
                  <Ionicons name="alert-circle" size={16} color={Colors.danger} />
                  <Text style={styles.searchErrorText}>{searchError}</Text>
                </View>
              )}

              {/* Verified Selected Customer Details (exact match to Web green card) */}
              {foundCustomer && (
                <View style={styles.verifiedCustomerCard}>
                  <View style={styles.verifiedCheckCircle}>
                    <Ionicons name="checkmark" size={16} color="#065F46" />
                  </View>
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={styles.verifiedCustomerName}>{foundCustomer.name}</Text>
                      <View style={styles.verifiedBadge}>
                        <Text style={styles.verifiedBadgeText}>Verified</Text>
                      </View>
                    </View>
                    <Text style={styles.verifiedCustomerMeta}>
                      {foundCustomer.mobile || foundCustomer.phone} • ID: {foundCustomer.id}
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => {
                      setFoundCustomer(null);
                      setSearchMobile('');
                    }}
                    style={styles.changeCustomerBtn}
                  >
                    <Text style={styles.changeCustomerText}>Change</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* 2. Scheme / Plan Type Selection (Regular, Fixed, Auction) */}
              <Text style={[styles.inputLabel, { marginTop: 14 }]}>
                2. SELECT SCHEME / PLAN TYPE *
              </Text>
              <View style={styles.schemeChipRow}>
                {[
                  { type: 'Regular', label: 'Regular', desc: 'Standard savings' },
                  { type: 'Fixed', label: 'Fixed', desc: 'Dividend return' },
                  { type: 'Auction', label: 'Auction', desc: 'Monthly bid' },
                ].map((s) => {
                  const isSelected = memberScheme === s.type;
                  return (
                    <TouchableOpacity
                      key={s.type}
                      style={[
                        styles.schemeSelectCard,
                        isSelected && styles.schemeSelectCardActive,
                      ]}
                      onPress={() => setMemberScheme(s.type as any)}
                    >
                      <Text
                        style={[
                          styles.schemeSelectTitle,
                          isSelected && styles.schemeSelectTitleActive,
                        ]}
                      >
                        {s.label}
                      </Text>
                      <Text style={styles.schemeSelectDesc}>{s.desc}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* 3. Duration & Due Date */}
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>3. DURATION (MOS) *</Text>
                  <TextInput
                    style={styles.textInput}
                    keyboardType="numeric"
                    value={customDuration}
                    onChangeText={(txt) => {
                      setCustomDuration(txt);
                      const m = Number(txt) || 20;
                      const val = Number(customChitValue) || 100000;
                      if (m > 0 && val > 0) {
                        setCustomerEnrollInstallment(Math.round(val / m).toString());
                      }
                    }}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>DUE DATE</Text>
                  <TextInput
                    style={styles.textInput}
                    value={dueDate}
                    onChangeText={setDueDate}
                  />
                </View>
              </View>

              {/* 4. Chit Value and Monthly Installment */}
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>CHIT VALUE (₹) *</Text>
                  <TextInput
                    style={styles.textInput}
                    keyboardType="numeric"
                    value={customChitValue}
                    onChangeText={(txt) => {
                      setCustomChitValue(txt);
                      const val = Number(txt) || 0;
                      const m = Number(customDuration) || 20;
                      if (m > 0 && val > 0) {
                        setCustomerEnrollInstallment(Math.round(val / m).toString());
                      }
                    }}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>MONTHLY EMI (₹)</Text>
                  <TextInput
                    style={[styles.textInput, styles.textInputReadOnly]}
                    keyboardType="numeric"
                    value={customerEnrollInstallment}
                    editable={false}
                  />
                </View>
              </View>
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setIsEnrollModalOpen(false)}
                disabled={enrollingMember}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.createBtn,
                  (!foundCustomer || !selectedGroupId || enrollingMember) && styles.createBtnDisabled,
                ]}
                onPress={handleEnrollCustomer}
                disabled={!foundCustomer || !selectedGroupId || enrollingMember}
              >
                <Text style={styles.createBtnText}>
                  {enrollingMember ? 'Enrolling...' : `Enroll Customer (${memberScheme})`}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Verification Customer Popup Box (exact match to Web verification popup) */}
      {verificationCustomer && (
        <Modal
          visible={!!verificationCustomer}
          transparent
          animationType="fade"
          onRequestClose={() => setVerificationCustomer(null)}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.modalCard, { maxWidth: 360 }]}>
              <View style={styles.modalHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <View style={styles.greenDotPulse} />
                  <Text style={styles.modalTitle}>Verify Customer Details</Text>
                </View>
                <TouchableOpacity onPress={() => setVerificationCustomer(null)}>
                  <Ionicons name="close" size={20} color={Colors.textSecondary} />
                </TouchableOpacity>
              </View>

              <View style={{ paddingVertical: 14 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <View style={styles.verifyAvatarCircle}>
                    <Text style={styles.verifyAvatarText}>
                      {(verificationCustomer.name || 'C').charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.verifyNameText}>{verificationCustomer.name}</Text>
                    <Text style={styles.verifyMetaText}>ID: {verificationCustomer.id}</Text>
                  </View>
                </View>

                <View style={styles.verifySummaryCard}>
                  <View style={styles.verifyRow}>
                    <Text style={styles.verifyRowLabel}>Mobile Number:</Text>
                    <Text style={styles.verifyRowVal}>
                      {verificationCustomer.mobile || verificationCustomer.phone || '—'}
                    </Text>
                  </View>
                  {verificationCustomer.address ? (
                    <View style={styles.verifyRow}>
                      <Text style={styles.verifyRowLabel}>Address:</Text>
                      <Text style={styles.verifyRowVal} numberOfLines={1}>
                        {verificationCustomer.address}
                      </Text>
                    </View>
                  ) : null}
                  <View style={styles.verifyRow}>
                    <Text style={styles.verifyRowLabel}>Enrolling Into:</Text>
                    <Text style={[styles.verifyRowVal, { color: Colors.gold.dark }]}>
                      {availableGroups.find((g) => g.id === selectedGroupId)?.name || selectedGroupId}
                    </Text>
                  </View>
                </View>

                <Text style={styles.verifyPromptText}>
                  Please verify that these customer details match before enrolling into this chit fund group.
                </Text>
              </View>

              <View style={{ gap: 8 }}>
                <TouchableOpacity
                  style={styles.confirmVerifyBtn}
                  onPress={() => {
                    setFoundCustomer(verificationCustomer);
                    setVerificationCustomer(null);
                    setSearchError(null);
                  }}
                >
                  <Ionicons name="checkmark-circle" size={16} color={Colors.white} />
                  <Text style={styles.confirmVerifyText}>✓ Verify & Add Customer</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.cancelVerifyBtn}
                  onPress={() => setVerificationCustomer(null)}
                >
                  <Text style={styles.cancelVerifyText}>Cancel / Search Again</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FBFB',
  },

  // 1. Teal Theme Header
  navyHeader: {
    backgroundColor: '#0C8A7D',
    paddingTop: 16,
    paddingHorizontal: 20,
    paddingBottom: 40,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    shadowColor: '#0C8A7D',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 4,
  },
  greetingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 4,
  },
  greetingSub: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 13,
    fontWeight: '500',
  },
  greetingName: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800',
    marginTop: 2,
    letterSpacing: 0.3,
  },
  greetingTagline: {
    color: 'rgba(255, 255, 255, 0.75)',
    fontSize: 12,
    fontWeight: '500',
    marginTop: 4,
  },

  // 2. Overlapping Fund Card
  fundCardWrapper: {
    paddingHorizontal: 20,
    marginTop: -24,
  },
  fundCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 18,
    shadowColor: '#0C8A7D',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#D8E4E5',
  },
  fundCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  fundIconCircle: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: '#E8F5F3',
    borderWidth: 1,
    borderColor: '#C3E5E0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fundLabel: {
    color: '#7E9596',
    fontSize: 12,
    fontWeight: '600',
  },
  fundAmount: {
    color: '#086359',
    fontSize: 24,
    fontWeight: '800',
    marginTop: 2,
    letterSpacing: -0.5,
  },
  fundTrendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  fundTrendText: {
    color: '#0C8A7D',
    fontSize: 12,
    fontWeight: '700',
  },

  // 3. 2x2 Distinctive Metric Cards
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    marginTop: 16,
    justifyContent: 'space-between',
  },
  metricCard: {
    width: '48%',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#D8E4E5',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  metricIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  metricTitle: {
    fontSize: 12,
    color: '#7E9596',
    fontWeight: '600',
  },
  metricValue: {
    fontSize: 22,
    fontWeight: '800',
    color: '#133336',
    marginTop: 2,
  },
  metricSub: {
    fontSize: 11,
    color: '#7E9596',
    fontWeight: '500',
    marginTop: 2,
  },

  // Pending Verification Alert Banner
  pendingVerificationAlert: {
    backgroundColor: '#FFFBEB',
    borderWidth: 1.5,
    borderColor: '#FCD34D',
    borderRadius: 18,
    marginHorizontal: 20,
    marginTop: 16,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#D97706',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  alertIconPulseBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  alertTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#92400E',
  },
  alertBadge: {
    backgroundColor: '#DC2626',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 10,
  },
  alertBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  alertSubtitle: {
    fontSize: 12,
    color: '#B45309',
    marginTop: 2,
    lineHeight: 16,
  },
  alertActionBtn: {
    backgroundColor: '#D97706',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 10,
    gap: 3,
    marginLeft: 6,
  },
  alertActionBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  tileBadgeCount: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#DC2626',
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  tileBadgeCountText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '900',
  },

  // 4. Quick Actions
  quickActionsCard: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginTop: 4,
    borderRadius: 20,
    paddingVertical: 18,
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
    width: '19%',
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

  // Verification Row Card
  verificationRowCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#FDE68A',
    shadowColor: '#D97706',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  verifyIconBubble: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: '#E8F5F3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  verifyCustName: {
    fontSize: 14,
    fontWeight: '800',
    color: '#133336',
  },
  advanceMiniBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#FCD34D',
  },
  advanceMiniBadgeText: {
    color: '#B45309',
    fontSize: 9,
    fontWeight: '900',
  },
  verifyMeta: {
    fontSize: 11,
    color: '#7E9596',
    marginTop: 2,
  },
  verifyAmount: {
    fontSize: 14,
    fontWeight: '800',
    color: '#D97706',
  },
  pendingActionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
    gap: 3,
    marginTop: 4,
  },
  pendingActionPillText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#B45309',
  },

  // 5. Section Headers & Lists
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginTop: 24,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#086359',
    letterSpacing: 0.2,
  },
  sectionLink: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0C8A7D',
  },
  listWrapper: {
    paddingHorizontal: 16,
    gap: 10,
  },
  customerRowCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#D8E4E5',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  avatarBubble: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: '#E8F5F3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarBubbleText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0C8A7D',
  },
  custRowName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#133336',
  },
  custRowMeta: {
    fontSize: 11,
    fontWeight: '500',
    color: '#7E9596',
    marginTop: 2,
  },
  custRowAmount: {
    fontSize: 14,
    fontWeight: '800',
    color: '#133336',
  },
  statusPillSmall: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    marginTop: 3,
  },
  pillPaid: {
    backgroundColor: '#E8F5F3',
  },
  pillPending: {
    backgroundColor: '#FEF3C7',
  },
  statusPillTextSmall: {
    fontSize: 10,
    fontWeight: '700',
  },
  textPaid: {
    color: '#0C8A7D',
  },
  textPending: {
    color: '#D97706',
  },

  // 6. Ledger Rows
  ledgerRowCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#D8E4E5',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  txIconBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  txRowDesc: {
    fontSize: 13,
    fontWeight: '700',
    color: '#133336',
  },
  txRowRef: {
    fontSize: 11,
    fontWeight: '500',
    color: '#7E9596',
    marginTop: 2,
  },
  txRowAmount: {
    fontSize: 14,
    fontWeight: '800',
  },
  txRowMode: {
    fontSize: 10,
    fontWeight: '600',
    color: '#7E9596',
    marginTop: 2,
  },

  // 7. Add Group Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 22,
    width: '100%',
    maxWidth: 400,
    borderWidth: 1,
    borderColor: '#D8E4E5',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F5F5',
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#086359',
  },
  modalSubtitle: {
    fontSize: 12,
    color: '#7E9596',
    marginTop: 4,
    lineHeight: 16,
  },
  modalCloseBtn: {
    padding: 4,
    marginLeft: 10,
  },
  modalBody: {
    paddingVertical: 16,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#7E9596',
    letterSpacing: 0.6,
    marginBottom: 8,
  },
  textInput: {
    backgroundColor: '#F9FBFB',
    borderWidth: 1.5,
    borderColor: '#D8E4E5',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    fontWeight: '600',
    color: '#133336',
  },
  textInputReadOnly: {
    backgroundColor: '#F0F5F5',
    borderColor: '#D8E4E5',
    color: '#7E9596',
    fontWeight: '700',
  },
  helperText: {
    fontSize: 11,
    color: '#7E9596',
    marginTop: 6,
  },
  schemeChipRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  schemeChip: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#D8E4E5',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
  },
  schemeChipActive: {
    backgroundColor: '#0C8A7D',
    borderColor: '#0C8A7D',
  },
  schemeChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#7E9596',
  },
  schemeChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  infoNoteBox: {
    backgroundColor: '#E8F5F3',
    borderWidth: 1,
    borderColor: '#C3E5E0',
    borderRadius: 14,
    padding: 12,
    marginTop: 16,
  },
  infoNoteHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  goldDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#0C8A7D',
  },
  infoNoteTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#086359',
  },
  infoNoteBody: {
    fontSize: 11,
    color: '#0C8A7D',
    lineHeight: 16,
    marginTop: 4,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#F0F5F5',
  },
  cancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#D8E4E5',
    backgroundColor: '#FFFFFF',
  },
  cancelBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#7E9596',
  },
  createBtn: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#0C8A7D',
  },
  createBtnDisabled: {
    opacity: 0.5,
  },
  createBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  itemPickerChip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#D8E4E5',
    backgroundColor: '#FFFFFF',
  },
  itemPickerChipActive: {
    backgroundColor: '#0C8A7D',
    borderColor: '#0C8A7D',
  },
  itemPickerChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#7E9596',
  },
  itemPickerChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  calculationPreviewBox: {
    marginTop: 14,
    padding: 12,
    backgroundColor: '#F9FBFB',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#D8E4E5',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  calculationPreviewLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#7E9596',
  },
  calculationPreviewValue: {
    fontSize: 14,
    fontWeight: '800',
    color: '#086359',
  },

  // Search & Verification Styles
  searchRow: {
    flexDirection: 'row',
    gap: 8,
  },
  searchBarWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FBFB',
    borderWidth: 1.5,
    borderColor: '#D8E4E5',
    borderRadius: 14,
    paddingHorizontal: 12,
  },
  searchTextInput: {
    flex: 1,
    paddingVertical: 10,
    fontSize: 13,
    color: '#133336',
    fontWeight: '600',
  },
  searchClearBtn: {
    padding: 4,
  },
  searchActionBtn: {
    backgroundColor: '#0C8A7D',
    paddingHorizontal: 14,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  searchActionText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  searchErrorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFF1F2',
    borderWidth: 1,
    borderColor: '#FECDD3',
    borderRadius: 12,
    padding: 10,
    marginTop: 8,
  },
  searchErrorText: {
    flex: 1,
    fontSize: 11,
    color: '#9F1239',
    fontWeight: '600',
  },
  verifiedCustomerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5F3',
    borderWidth: 1,
    borderColor: '#C3E5E0',
    borderRadius: 14,
    padding: 12,
    marginTop: 10,
  },
  verifiedCheckCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#0C8A7D',
    alignItems: 'center',
    justifyContent: 'center',
  },
  verifiedCustomerName: {
    fontSize: 13,
    fontWeight: '800',
    color: '#086359',
  },
  verifiedBadge: {
    backgroundColor: '#C3E5E0',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  verifiedBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#086359',
  },
  verifiedCustomerMeta: {
    fontSize: 11,
    color: '#0C8A7D',
    fontWeight: '600',
    marginTop: 2,
  },
  changeCustomerBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#C3E5E0',
  },
  changeCustomerText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0C8A7D',
  },
  schemeSelectCard: {
    flex: 1,
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#D8E4E5',
    backgroundColor: '#FFFFFF',
  },
  schemeSelectCardActive: {
    backgroundColor: '#E8F5F3',
    borderColor: '#0C8A7D',
  },
  schemeSelectTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#133336',
  },
  schemeSelectTitleActive: {
    color: '#086359',
  },
  schemeSelectDesc: {
    fontSize: 9,
    color: '#7E9596',
    marginTop: 2,
  },
  greenDotPulse: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10B981',
  },
  verifyAvatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#E8F5F3',
    borderWidth: 1,
    borderColor: '#C3E5E0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  verifyAvatarText: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0C8A7D',
  },
  verifyNameText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#133336',
  },
  verifyMetaText: {
    fontSize: 11,
    color: '#7E9596',
    marginTop: 2,
  },
  verifySummaryCard: {
    backgroundColor: '#F9FBFB',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#D8E4E5',
    padding: 12,
    marginTop: 12,
    gap: 6,
  },
  verifyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  verifyRowLabel: {
    fontSize: 11,
    color: '#7E9596',
    fontWeight: '500',
  },
  verifyRowVal: {
    fontSize: 11,
    fontWeight: '700',
    color: '#133336',
  },
  verifyPromptText: {
    fontSize: 10,
    color: '#7E9596',
    textAlign: 'center',
    marginTop: 10,
    lineHeight: 14,
  },
  confirmVerifyBtn: {
    backgroundColor: '#0C8A7D',
    paddingVertical: 11,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  confirmVerifyText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  cancelVerifyBtn: {
    backgroundColor: '#F0F5F5',
    paddingVertical: 9,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelVerifyText: {
    color: '#7E9596',
    fontSize: 12,
    fontWeight: '700',
  },
});
