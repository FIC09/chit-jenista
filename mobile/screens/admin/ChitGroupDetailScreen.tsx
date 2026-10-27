import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  StatusBar,
  Modal,
  TextInput,
  Alert,
  Linking,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../theme/colors';
import { DataSyncManager } from '../../services/dataSync';
import { formatCurrency } from '../../utils/format';
import { ChitGroup } from '../../types';

export const ChitGroupDetailScreen: React.FC<{ route: any; navigation: any }> = ({
  route,
  navigation,
}) => {
  const group: ChitGroup = route.params?.group;
  const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'MEMBERS'>('OVERVIEW');
  const [enrolledMembers, setEnrolledMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Add Member Modal State (Matches Web App exact workflow)
  const [isAddMemberModalOpen, setIsAddMemberModalOpen] = useState(false);
  const [allCustomers, setAllCustomers] = useState<any[]>([]);

  // Search & Verification state
  const [searchMobile, setSearchMobile] = useState('');
  const [foundCustomer, setFoundCustomer] = useState<any | null>(null);
  const [verificationCustomer, setVerificationCustomer] = useState<any | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [isSearchingCustomer, setIsSearchingCustomer] = useState(false);

  // Scheme & plan parameters
  const [memberScheme, setMemberScheme] = useState<'Regular' | 'Fixed' | 'Auction'>(
    (group?.type as any) || 'Regular'
  );
  const [customValue, setCustomValue] = useState(String(group?.value || 100000));
  const [customDuration, setCustomDuration] = useState(String(group?.duration || 20));
  const [customerEnrollInstallment, setCustomerEnrollInstallment] = useState(
    String(Math.round(Number(group?.value || 100000) / Number(group?.duration || 20)))
  );
  const [dueDate, setDueDate] = useState(() => {
    const d = new Date();
    d.setDate(15);
    if (d.getTime() < Date.now()) d.setMonth(d.getMonth() + 1);
    return d.toISOString().split('T')[0];
  });
  const [enrolling, setEnrolling] = useState(false);

  const chitValue = Number(group?.value || 100000);
  const duration = Number(group?.duration || 20);
  const membersCapacity = Number(group?.members || 20);
  const monthlyInstallment = Math.round(chitValue / duration);

  const loadGroupMembers = async () => {
    try {
      const customers = await DataSyncManager.getCustomers();
      const targetId = (group?.id || '').toLowerCase().trim();
      const targetName = (group?.name || '').toLowerCase().trim();

      const matched: any[] = [];
      const seenKey = new Set<string>();

      customers.forEach((c) => {
        if (Array.isArray(c.chits)) {
          c.chits.forEach((ch: any) => {
            const chGId = String(ch.groupId || '').toLowerCase().trim();
            const chGName = String(ch.groupName || '').toLowerCase().trim();

            // Strict matching: only include if chit belongs to THIS group
            const isMatch =
              (targetId && chGId === targetId) ||
              (targetName && chGName === targetName) ||
              (targetId && chGName === targetId) ||
              (targetName && chGId === targetName);

            if (isMatch) {
              const custId = c.id || (c as any).customerCode || c.mongoId || 'CUST';
              const ticket = String(ch.ticketNumber || matched.length + 1);
              const key = `${custId}-${ticket}`;

              if (!seenKey.has(key)) {
                const chitPendingVal = ch.pending !== undefined ? Number(ch.pending) : undefined;
                const chitPaidVal = Number(ch.totalPaid ?? ch.paidAmount ?? 0);
                const isPaidStatus =
                  ch.paymentStatus === 'PAID' ||
                  (chitPendingVal !== undefined && chitPendingVal === 0 && chitPaidVal > 0);
                
                const finalPending = isPaidStatus
                  ? 0
                  : chitPendingVal !== undefined
                  ? chitPendingVal
                  : (c.chits && c.chits.length === 1 && Number(c.pending || 0) > 0)
                  ? Number(c.pending)
                  : Number(ch.monthlyInstallment || monthlyInstallment);

                seenKey.add(key);
                matched.push({
                  customerId: custId,
                  mongoId: c.mongoId,
                  customerName: c.name || c.fullName || 'Member',
                  mobile: c.phone || c.mobile || '—',
                  ticketNumber: ticket,
                  scheme: ch.scheme || (c as any).scheme || group?.type || 'Regular',
                  duration: Number(ch.duration || ch.months || group?.duration || 20),
                  chitValue: Number(ch.chitValue || chitValue),
                  monthlyInstallment: Number(ch.monthlyInstallment || monthlyInstallment),
                  paymentStatus: isPaidStatus ? 'PAID' : 'DUE',
                  totalPaid: Number(ch.totalPaid ?? ch.paidAmount ?? (c.chits && c.chits.length === 1 ? c.totalPaid : 0) ?? 0),
                  pending: finalPending,
                  isWithdrawn: ch.isWithdrawn || false,
                  withdrawnAmount: ch.withdrawnAmount,
                  fullCustomer: c,
                  chitObject: ch,
                });
              }
            }
          });
        }
      });

      // Sort by ticket number
      matched.sort((a, b) => Number(a.ticketNumber) - Number(b.ticketNumber));

      setEnrolledMembers(matched);
      setAllCustomers(customers);
    } catch (e) {
      console.warn('Error loading group detail members:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
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
      let matched = allCustomers.find((c: any) => {
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
        matched = allCustomers.find((c: any) => {
          const cMobile = (c.mobile || c.phone || '').replace(/\D/g, '');
          return cMobile.includes(cleanDigits);
        });
      }

      if (!matched && q.length >= 3) {
        matched = allCustomers.find((c: any) => {
          const cName = String(c.name || c.fullName || '').toLowerCase();
          return cName.includes(q.toLowerCase());
        });
      }

      if (matched) {
        setVerificationCustomer(matched);
        setSearchError(null);
      } else {
        setVerificationCustomer(null);
        setSearchError(`No customer found with "${q}". Please check or add customer.`);
      }
    } finally {
      setIsSearchingCustomer(false);
    }
  };

  const handleEnrollMember = async () => {
    if (!foundCustomer) {
      Alert.alert('Validation Error', 'Please search and select a verified customer to enroll.');
      return;
    }

    const val = Number(customValue) || chitValue;
    const dur = Number(customDuration) || duration;
    const installment =
      Number(customerEnrollInstallment) || (dur > 0 ? Math.round(val / dur) : monthlyInstallment);

    // Cache customer details before resetting state
    const enrolledCustomerName = foundCustomer.name || foundCustomer.fullName || 'Member';
    const enrolledCustomerId = foundCustomer.id;
    const enrolledCustomerPhone = foundCustomer.mobile || foundCustomer.phone || '';
    const enrolledCustomerMongoId = foundCustomer.mongoId || foundCustomer._id;

    setEnrolling(true);
    try {
      await DataSyncManager.enrollMemberToGroup({
        customerId: enrolledCustomerId,
        groupId: group.id,
        groupName: group.name,
        scheme: memberScheme,
        chitValue: val,
        duration: dur,
        monthlyInstallment: installment,
        customerPhone: enrolledCustomerPhone,
        customerMongoId: enrolledCustomerMongoId,
        customerName: enrolledCustomerName,
        dueDate: dueDate,
      });

      setIsAddMemberModalOpen(false);
      setFoundCustomer(null);
      setSearchMobile('');
      setVerificationCustomer(null);

      // Reload group members and switch to MEMBERS tab to immediately reveal the new member
      await loadGroupMembers();
      setActiveTab('MEMBERS');

      Alert.alert(
        'Member Enrolled',
        `Successfully enrolled "${enrolledCustomerName}" into group "${group.name}"!`
      );
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to enroll customer');
    } finally {
      setEnrolling(false);
    }
  };

  useEffect(() => {
    loadGroupMembers();
  }, [group]);

  useFocusEffect(
    useCallback(() => {
      loadGroupMembers();
    }, [group])
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadGroupMembers();
  };

  const paidMembersCount = enrolledMembers.filter((m) => m.paymentStatus === 'PAID').length;
  const pendingMembersCount = enrolledMembers.length - paidMembersCount;

  // Exact Web calculations:
  // 1. Total Enrolled Value: sum of all member chit values (or fallback to count * group value)
  const enrolledTotalChitValueSum = enrolledMembers.reduce((sum, m) => {
    return sum + (Number(m.chitValue) || Number(group?.value) || 100000);
  }, 0) || (enrolledMembers.length * Number(chitValue));

  // 2. Scheme breakdown counts
  const fixedCount = enrolledMembers.filter((m) =>
    (m.scheme || '').toUpperCase().includes('FIX')
  ).length;
  const regularCount = enrolledMembers.filter((m) =>
    (m.scheme || '').toUpperCase().includes('REG')
  ).length;
  const auctionCount = enrolledMembers.filter((m) =>
    (m.scheme || '').toUpperCase().includes('AUC')
  ).length;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* 1. Deep Navy Header Banner (Matches Web Group Header Drilldown) */}
      <View style={styles.headerHero}>
        <View style={styles.groupHeroTop}>
          <View style={styles.groupHeroIconBox}>
            <Ionicons name="people" size={26} color={Colors.white} />
          </View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <Text style={styles.groupHeroTitle} numberOfLines={1}>{group.name}</Text>
              <View style={styles.statusPillActive}>
                <Text style={styles.statusPillActiveText}>{group.status || 'Active'}</Text>
              </View>
            </View>

            {/* Total Enrolled Value Badge (Identical to Web) */}
            <View style={styles.totalEnrolledBadge}>
              <Ionicons name="cash-outline" size={13} color="#78350F" />
              <Text style={styles.totalEnrolledBadgeText}>
                Total Enrolled Value: {formatCurrency(enrolledTotalChitValueSum)}
              </Text>
            </View>

            {/* Capacity & Scheme Breakdown subtitle (Identical to Web) */}
            <Text style={styles.groupHeroBreakdown}>
              {membersCapacity > 0
                ? `${membersCapacity} Capacity (${enrolledMembers.length} Enrolled)`
                : `${enrolledMembers.length} Enrolled`}
              {' • '}
              <Text style={{ color: '#6EE7B7', fontWeight: '700' }}>{fixedCount} Fixed</Text>
              {' • '}
              <Text style={{ color: '#FDE68A', fontWeight: '700' }}>{regularCount} Regular</Text>
              {' • '}
              <Text style={{ color: '#E9D5FF', fontWeight: '700' }}>{auctionCount} Auction</Text>
            </Text>
          </View>
        </View>
      </View>

      {/* 2. Top Specifications Card (Total Amount & Next Due Date) */}
      <View style={styles.specsCardWrapper}>
        <View style={styles.specsCard}>
          <View style={styles.specRow}>
            <View style={styles.specCol}>
              <Text style={styles.specLabel}>Total Amount</Text>
              <Text style={styles.specValue}>{formatCurrency(enrolledTotalChitValueSum)}</Text>
            </View>
            <View style={[styles.specCol, { alignItems: 'flex-end' }]}>
              <Text style={styles.specLabel}>Next Due Date</Text>
              <Text style={styles.specValueDark}>{dueDate || '15th of month'}</Text>
            </View>
          </View>
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.gold.primary} />}
        showsVerticalScrollIndicator={false}
      >
        {/* 3. Member Progress Card with Circular Ratio Indicator */}
        <View style={styles.memberProgressCard}>
          <Text style={styles.progressSectionTitle}>Member Progress</Text>

          <View style={styles.progressRow}>
            {/* Donut Progress Visual */}
            <View style={styles.donutCircle}>
              <Text style={styles.donutRatioText}>
                {paidMembersCount}/{enrolledMembers.length}
              </Text>
              <Text style={styles.donutSubText}>Paid Members</Text>
            </View>

            {/* Legend Stats */}
            <View style={styles.legendContainer}>
              <View style={styles.legendRow}>
                <View style={[styles.legendDot, { backgroundColor: Colors.success }]} />
                <Text style={styles.legendLabel}>Paid</Text>
                <Text style={styles.legendValue}>{paidMembersCount}</Text>
              </View>

              <View style={styles.legendRow}>
                <View style={[styles.legendDot, { backgroundColor: Colors.border }]} />
                <Text style={styles.legendLabel}>Pending</Text>
                <Text style={styles.legendValue}>{pendingMembersCount}</Text>
              </View>

              <View style={styles.legendRow}>
                <View style={[styles.legendDot, { backgroundColor: Colors.navy.primary }]} />
                <Text style={styles.legendLabel}>Total</Text>
                <Text style={styles.legendValue}>{enrolledMembers.length}</Text>
              </View>
            </View>
          </View>

          {/* Action Buttons Row */}
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <TouchableOpacity
              style={[styles.viewMembersBtn, { flex: 1 }]}
              activeOpacity={0.85}
              onPress={() => setActiveTab(activeTab === 'MEMBERS' ? 'OVERVIEW' : 'MEMBERS')}
            >
              <Ionicons name="people" size={16} color="#0B1A30" />
              <Text style={styles.viewMembersBtnText}>
                {activeTab === 'MEMBERS' ? 'Hide' : 'Members'}
              </Text>
              <Ionicons name="chevron-forward" size={14} color="#0B1A30" />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.addMemberBtn, { flex: 1.2 }]}
              activeOpacity={0.85}
              onPress={() => setIsAddMemberModalOpen(true)}
            >
              <Ionicons name="person-add" size={16} color={Colors.white} />
              <Text style={styles.addMemberBtnText}>Add Member</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* 4. Next Payment Due Action Card with Dark Button */}
        <View style={styles.nextPaymentCard}>
          <View style={styles.calendarRow}>
            <View style={styles.calendarIconCircle}>
              <Ionicons name="calendar-outline" size={20} color={Colors.blueAccent} />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.calendarLabel}>Next Payment Due</Text>
              <Text style={styles.calendarDateText}>{dueDate || '15th of month'}</Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.recordPaymentNavyBtn}
            activeOpacity={0.85}
            onPress={() =>
              navigation.navigate('ReceiptEntry', {
                chitGroup: group.id || group.name,
                amount: monthlyInstallment,
              })
            }
          >
            <Text style={styles.recordPaymentNavyText}>Record Payment</Text>
            <Ionicons name="chevron-forward" size={16} color={Colors.white} />
          </TouchableOpacity>
        </View>

        {/* 5. Members List (When Expanded or in MEMBERS tab) */}
        {activeTab === 'MEMBERS' && (
          <View style={styles.enrolledListCard}>
            <View style={styles.enrolledListHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.enrolledListTitle}>Enrolled Members ({enrolledMembers.length})</Text>
                <Text style={styles.enrolledListSub}>
                  Same member details, schemes, and schedule as in Web Dashboard
                </Text>
              </View>
            </View>

            {enrolledMembers.length === 0 ? (
              <View style={styles.emptyMembersBox}>
                <Ionicons name="people-outline" size={36} color={Colors.textMuted} />
                <Text style={styles.emptyMembersTitle}>No customers enrolled in this group yet</Text>
                <Text style={styles.emptyMembersSub}>
                  Tap "Add Member" above to begin enrollment.
                </Text>
              </View>
            ) : (
              enrolledMembers.map((item, idx) => {
                const isPaid = item.paymentStatus === 'PAID';
                const schemeName = (item.scheme || 'Regular').trim();
                const schemeUpper = schemeName.toUpperCase();
                const isFix = schemeUpper.includes('FIX');
                const isAuc = schemeUpper.includes('AUC');

                return (
                  <View key={`${item.customerId}-${idx}`} style={styles.memberCardPremium}>
                    {/* Header Row: Ticket #, Name & ID, Scheme & Payment Status Badges */}
                    <View style={styles.memberCardHeader}>
                      <View style={styles.ticketBadge}>
                        <Text style={styles.ticketBadgeText}>#{item.ticketNumber}</Text>
                      </View>

                      <TouchableOpacity
                        style={{ flex: 1, marginHorizontal: 10, justifyContent: 'center' }}
                        onPress={() =>
                          navigation.navigate('CustomerSchedule', {
                            customer: item.fullCustomer,
                            chit: item.chitObject,
                            groupId: group.id || group.name,
                            groupName: group.name,
                          })
                        }
                        activeOpacity={0.7}
                      >
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                          <Text style={styles.memberNameText} numberOfLines={1}>
                            {item.customerName}
                          </Text>
                          <Ionicons name="calendar-outline" size={13} color={Colors.gold.dark} />
                        </View>
                        <Text style={styles.memberCustIdText}>ID: {item.customerId}</Text>
                      </TouchableOpacity>

                      <View style={{ alignItems: 'flex-end', gap: 4 }}>
                        {/* Scheme Pill (Emerald for Fixed, Purple for Auction, Amber for Regular) */}
                        <View
                          style={[
                            styles.schemePillWeb,
                            isFix
                              ? styles.schemePillFix
                              : isAuc
                                ? styles.schemePillAuc
                                : styles.schemePillReg,
                          ]}
                        >
                          <Text
                            style={[
                              styles.schemePillWebText,
                              isFix
                                ? styles.schemeTextFix
                                : isAuc
                                  ? styles.schemeTextAuc
                                  : styles.schemeTextReg,
                            ]}
                          >
                            {schemeName}
                          </Text>
                        </View>

                        {/* Payment Status Pill */}
                        <View style={[styles.statusPillWeb, isPaid ? styles.statusPillPaid : styles.statusPillDue]}>
                          <Text style={[styles.statusPillWebText, isPaid ? styles.statusTextPaid : styles.statusTextDue]}>
                            {isPaid ? 'PAID' : 'DUE'}
                          </Text>
                        </View>
                      </View>
                    </View>

                    {/* Specifications Grid: Mobile, Duration, Monthly Due, Chit Value */}
                    <View style={styles.memberSpecGrid}>
                      <View style={[styles.memberSpecCol, { flex: 1.2 }]}>
                        <Text style={styles.memberSpecLabel}>MOBILE</Text>
                        <TouchableOpacity
                          style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}
                          onPress={() => {
                            if (item.mobile && item.mobile !== '—') {
                              Linking.openURL(`tel:${item.mobile.replace(/\D/g, '')}`).catch(() => { });
                            }
                          }}
                        >
                          <Ionicons name="call-outline" size={11} color={Colors.navy.primary} />
                          <Text style={styles.memberSpecValHighlight} numberOfLines={1}>{item.mobile}</Text>
                        </TouchableOpacity>
                      </View>

                      <View style={[styles.memberSpecCol, { flex: 0.8, alignItems: 'center' }]}>
                        <Text style={styles.memberSpecLabel}>DUR</Text>
                        <Text style={styles.memberSpecVal}>{item.duration || duration}m</Text>
                      </View>

                      <View style={[styles.memberSpecCol, { flex: 1.1, alignItems: 'center' }]}>
                        <Text style={styles.memberSpecLabel}>MONTHLY DUE</Text>
                        <Text style={styles.memberSpecVal}>{formatCurrency(item.monthlyInstallment)}</Text>
                      </View>

                      <View style={[styles.memberSpecCol, { flex: 1.2, alignItems: 'flex-end' }]}>
                        <Text style={styles.memberSpecLabel}>CHIT VALUE</Text>
                        <Text style={styles.memberSpecValBold}>{formatCurrency(item.chitValue)}</Text>
                      </View>
                    </View>

                    {/* Bottom Action Bar: Due Chart & Profile (Same as Web App) */}
                    <View style={styles.memberActionBar}>
                      <TouchableOpacity
                        style={styles.dueChartBtn}
                        onPress={() =>
                          navigation.navigate('CustomerSchedule', {
                            customer: item.fullCustomer,
                            chit: item.chitObject,
                            groupId: group.id || group.name,
                            groupName: group.name,
                          })
                        }
                        activeOpacity={0.85}
                      >
                        <Ionicons name="calendar-outline" size={13} color={Colors.white} />
                        <Text style={styles.dueChartBtnText}>Due Chart</Text>
                        <Ionicons name="arrow-forward" size={12} color={Colors.white} />
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.profileBtn}
                        onPress={() => navigation.navigate('CustomerDetail', { customer: item.fullCustomer })}
                        activeOpacity={0.8}
                      >
                        <Ionicons name="person-outline" size={13} color={Colors.textSecondary} />
                        <Text style={styles.profileBtnText}>Profile</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })
            )}
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Add Member into Group Modal (Exact Web App Experience) */}
      <Modal
        visible={isAddMemberModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsAddMemberModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { maxHeight: '92%' }]}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>Enroll Customer into Group</Text>
                <Text style={styles.modalSubtitle}>
                  Group: <Text style={{ color: Colors.gold.dark, fontWeight: '700' }}>{group.name}</Text>
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setIsAddMemberModalOpen(false)}
                style={styles.modalCloseBtn}
              >
                <Ionicons name="close" size={22} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={styles.modalBody}>
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

              {/* Verified Selected Customer Details */}
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

              {/* 2. Scheme Selection */}
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
                      const m = Number(txt) || duration;
                      const val = Number(customValue) || chitValue;
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

              {/* 4. Value and Installment */}
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>CHIT VALUE (₹) *</Text>
                  <TextInput
                    style={styles.textInput}
                    keyboardType="numeric"
                    value={customValue}
                    onChangeText={(txt) => {
                      setCustomValue(txt);
                      const val = Number(txt) || 0;
                      const m = Number(customDuration) || duration;
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
                onPress={() => setIsAddMemberModalOpen(false)}
                disabled={enrolling}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.createBtn,
                  (!foundCustomer || enrolling) && styles.createBtnDisabled,
                ]}
                onPress={handleEnrollMember}
                disabled={!foundCustomer || enrolling}
              >
                <Text style={styles.createBtnText}>
                  {enrolling ? 'Enrolling...' : `Enroll Customer (${memberScheme})`}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Verification Customer Details Popup */}
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
                      {group.name}
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
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },

  // 1. Deep Navy Header Banner
  headerHero: {
    backgroundColor: Colors.navy.primary,
    paddingTop: 16,
    paddingHorizontal: 20,
    paddingBottom: 36,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  groupHeroTop: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  groupHeroIconBox: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  groupHeroTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.white,
    letterSpacing: 0.3,
  },
  groupHeroMembers: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.gold.primary,
    marginTop: 2,
  },
  statusPillActive: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(21, 150, 106, 0.25)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  statusPillActiveText: {
    color: '#34D399',
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  totalEnrolledBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FCD34D',
    alignSelf: 'flex-start',
    marginTop: 6,
  },
  totalEnrolledBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#78350F',
  },
  groupHeroBreakdown: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.85)',
    marginTop: 5,
    lineHeight: 16,
  },

  // 2. Overlapping Specs Card
  specsCardWrapper: {
    paddingHorizontal: 20,
    marginTop: -20,
  },
  specsCard: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: Colors.navy.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
  },
  specRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  specCol: {
    flex: 1,
  },
  specLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  specValue: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.text,
  },
  specValueDark: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
  },
  specDivider: {
    height: 1,
    backgroundColor: Colors.borderLight,
    marginVertical: 14,
  },

  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    gap: 16,
  },

  // 3. Member Progress Card
  memberProgressCard: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  progressSectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.text,
    marginBottom: 16,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    marginBottom: 16,
  },
  donutCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 8,
    borderColor: Colors.success,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
  },
  donutRatioText: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.text,
  },
  donutSubText: {
    fontSize: 10,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  legendContainer: {
    gap: 8,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textSecondary,
    width: 60,
  },
  legendValue: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.text,
  },
  viewMembersBtn: {
    backgroundColor: Colors.gold.primary,
    height: 48,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: Colors.gold.dark,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },
  viewMembersBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0B1A30',
  },

  // 4. Next Payment Due Card
  nextPaymentCard: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  calendarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  calendarIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: Colors.blueSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calendarLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  calendarDateText: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.text,
    marginTop: 2,
  },
  recordPaymentNavyBtn: {
    backgroundColor: Colors.navy.primary,
    height: 46,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  recordPaymentNavyText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.white,
  },

  // 5. Enrolled List Card
  enrolledListCard: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  enrolledListHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  enrolledListTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.text,
  },
  enrolledListSub: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  emptyMembersBox: {
    paddingVertical: 32,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  emptyMembersTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  emptyMembersSub: {
    fontSize: 11,
    color: Colors.textMuted,
    textAlign: 'center',
  },

  // Premium Member Card (1:1 Web Mirror)
  memberCardPremium: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  memberCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  ticketBadge: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ticketBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#92400E',
  },
  memberNameText: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.text,
    maxWidth: 160,
  },
  memberCustIdText: {
    fontSize: 10,
    fontFamily: 'monospace',
    color: Colors.textMuted,
    marginTop: 1,
  },
  schemePillWeb: {
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 12,
    borderWidth: 1,
  },
  schemePillFix: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
  },
  schemeTextFix: {
    color: '#065F46',
  },
  schemePillAuc: {
    backgroundColor: '#F3E8FF',
    borderColor: '#DDD6FE',
  },
  schemeTextAuc: {
    color: '#6B21A8',
  },
  schemePillReg: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
  },
  schemeTextReg: {
    color: '#92400E',
  },
  schemePillWebText: {
    fontSize: 10,
    fontWeight: '800',
  },
  statusPillWeb: {
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 12,
  },
  statusPillPaid: {
    backgroundColor: '#D1FAE5',
  },
  statusTextPaid: {
    color: '#065F46',
  },
  statusPillDue: {
    backgroundColor: '#FEF3C7',
  },
  statusTextDue: {
    color: '#92400E',
  },
  statusPillWebText: {
    fontSize: 10,
    fontWeight: '800',
  },

  // 4-Column Spec Grid
  memberSpecGrid: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    marginBottom: 10,
  },
  memberSpecCol: {
    justifyContent: 'center',
  },
  memberSpecLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: Colors.textMuted,
    letterSpacing: 0.4,
    marginBottom: 2,
  },
  memberSpecVal: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.text,
  },
  memberSpecValBold: {
    fontSize: 12,
    fontWeight: '800',
    color: Colors.navy.primary,
  },
  memberSpecValHighlight: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.navy.primary,
  },

  // Action Buttons Bar
  memberActionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dueChartBtn: {
    flex: 1.2,
    backgroundColor: '#9A6D25',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 8,
    borderRadius: 10,
    shadowColor: '#9A6D25',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 1,
  },
  dueChartBtnText: {
    color: Colors.white,
    fontSize: 11,
    fontWeight: '800',
  },
  profileBtn: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 8,
    borderRadius: 10,
  },
  profileBtnText: {
    color: Colors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
  },
  addMemberBtn: {
    backgroundColor: Colors.navy.primary,
    height: 44,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 14,
  },
  addMemberBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.white,
  },

  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: Colors.white,
    borderRadius: 24,
    padding: 22,
    width: '100%',
    maxWidth: 400,
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: Colors.text,
  },
  modalSubtitle: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 4,
    lineHeight: 16,
  },
  modalCloseBtn: {
    padding: 4,
    marginLeft: 10,
  },
  modalBody: {
    paddingVertical: 14,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.textSecondary,
    letterSpacing: 0.6,
    marginBottom: 8,
  },
  textInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
  },
  textInputReadOnly: {
    backgroundColor: '#F1F5F9',
    borderColor: '#CBD5E1',
    color: Colors.textSecondary,
    fontWeight: '700',
  },
  itemPickerChip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: '#F8FAFC',
  },
  itemPickerChipActive: {
    backgroundColor: '#FFF8EB',
    borderColor: Colors.gold.primary,
  },
  itemPickerChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  itemPickerChipTextActive: {
    color: Colors.gold.dark,
    fontWeight: '800',
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
    borderColor: Colors.border,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
  },
  schemeChipActive: {
    backgroundColor: '#FFF8EB',
    borderColor: Colors.gold.primary,
  },
  schemeChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  schemeChipTextActive: {
    color: Colors.gold.dark,
  },
  calculationPreviewBox: {
    marginTop: 14,
    padding: 12,
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  calculationPreviewLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  calculationPreviewValue: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.navy.primary,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  cancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: '#F8FAFC',
  },
  cancelBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  createBtn: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: Colors.gold.primary,
  },
  createBtnDisabled: {
    opacity: 0.5,
  },
  createBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.navy.primary,
  },

  // Search & Verification Styles (Exact Web Match)
  searchRow: {
    flexDirection: 'row',
    gap: 8,
  },
  searchBarWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    paddingHorizontal: 12,
  },
  searchTextInput: {
    flex: 1,
    paddingVertical: 10,
    fontSize: 13,
    color: Colors.text,
    fontWeight: '600',
  },
  searchClearBtn: {
    padding: 4,
  },
  searchActionBtn: {
    backgroundColor: Colors.gold.dark,
    paddingHorizontal: 14,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  searchActionText: {
    color: Colors.white,
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
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    borderRadius: 14,
    padding: 12,
    marginTop: 10,
  },
  verifiedCheckCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#D1FAE5',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#6EE7B7',
  },
  verifiedCustomerName: {
    fontSize: 13,
    fontWeight: '800',
    color: '#064E3B',
  },
  verifiedBadge: {
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  verifiedBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#047857',
  },
  verifiedCustomerMeta: {
    fontSize: 11,
    color: '#059669',
    fontWeight: '600',
    marginTop: 2,
  },
  changeCustomerBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: '#D1FAE5',
  },
  changeCustomerText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#047857',
  },
  schemeSelectCard: {
    flex: 1,
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: '#F8FAFC',
  },
  schemeSelectCardActive: {
    backgroundColor: '#FFF8EB',
    borderColor: Colors.gold.primary,
  },
  schemeSelectTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: Colors.text,
  },
  schemeSelectTitleActive: {
    color: Colors.gold.dark,
  },
  schemeSelectDesc: {
    fontSize: 9,
    color: Colors.textMuted,
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
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  verifyAvatarText: {
    fontSize: 18,
    fontWeight: '900',
    color: Colors.gold.dark,
  },
  verifyNameText: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.text,
  },
  verifyMetaText: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  verifySummaryCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
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
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  verifyRowVal: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.text,
  },
  verifyPromptText: {
    fontSize: 10,
    color: Colors.textMuted,
    textAlign: 'center',
    marginTop: 10,
    lineHeight: 14,
  },
  confirmVerifyBtn: {
    backgroundColor: Colors.gold.dark,
    paddingVertical: 11,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  confirmVerifyText: {
    color: Colors.white,
    fontSize: 13,
    fontWeight: '800',
  },
  cancelVerifyBtn: {
    backgroundColor: '#F1F5F9',
    paddingVertical: 9,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelVerifyText: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },
});
