import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  StatusBar,
  Modal,
  TextInput,
  FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../theme/colors';
import { Input } from '../../components/common/Input';
import { useAuth } from '../../store/AuthContext';
import { DataSyncManager } from '../../services/dataSync';
import { generateAndShareReceipt } from '../../services/receiptService';
import { formatCurrency } from '../../utils/format';

export const ReceiptEntryScreen: React.FC<{ route: any; navigation: any }> = ({
  route,
  navigation,
}) => {
  const { user } = useAuth();
  const preCustomer = route.params?.customerName;
  const preId = route.params?.customerId;
  const preMobile = route.params?.mobile;
  const preAmount = route.params?.amount;

  const [receiptNo] = useState(`REC-${Date.now().toString().slice(-6)}`);
  const [customerName, setCustomerName] = useState(preCustomer || '');
  const [customerId, setCustomerId] = useState(preId || '');
  const [mobileNumber, setMobileNumber] = useState(preMobile || '');
  const [chitGroup, setChitGroup] = useState(route.params?.chitGroup || '');
  const [amount, setAmount] = useState(preAmount ? String(preAmount) : '');
  const [paymentMode, setPaymentMode] = useState<'UPI' | 'CASH' | 'BANK_TRANSFER'>('UPI');
  const [referenceNo, setReferenceNo] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Member & Group picker states
  const [customersList, setCustomersList] = useState<any[]>([]);
  const [groupsList, setGroupsList] = useState<any[]>([]);
  const [isMemberPickerOpen, setIsMemberPickerOpen] = useState(false);
  const [isGroupPickerOpen, setIsGroupPickerOpen] = useState(false);
  const [memberSearchQuery, setMemberSearchQuery] = useState('');
  const [groupSearchQuery, setGroupSearchQuery] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const [custs, grps] = await Promise.all([
          DataSyncManager.getCustomers(),
          DataSyncManager.getChitGroups(),
        ]);
        setCustomersList(custs);
        setGroupsList(grps);

        const cleanPreMobile = (preMobile || preId || '').replace(/\D/g, '');
        const found = custs.find((c: any) => {
          const cPhone = (c.phone || c.mobile || '').replace(/\D/g, '');
          return (
            (preId && (c.id === preId || c.mongoId === preId)) ||
            (cleanPreMobile && cPhone && cleanPreMobile === cPhone) ||
            (preCustomer && (c.name?.toLowerCase() === preCustomer.toLowerCase() || c.fullName?.toLowerCase() === preCustomer.toLowerCase()))
          );
        });

        if (found) {
          if (!customerName || customerName === 'Member' || /^\d+$/.test(customerName)) {
            setCustomerName(found.name || found.fullName || customerName);
          }
          if (!customerId || /^\d{10}$/.test(customerId)) {
            setCustomerId(found.id || found.mongoId || customerId);
          }
          if (!chitGroup && Array.isArray(found.chits) && found.chits.length > 0) {
            setChitGroup(found.chits[0].groupName || found.chits[0].groupId || 'Chit Group');
          }
        }
      } catch (err) {
        console.warn('ReceiptEntry auto-populate error:', err);
      }
    })();
  }, []);

  const selectCustomer = (cust: any) => {
    const name = cust.name || cust.fullName || 'Member';
    const id = cust.id || cust.mongoId || '';
    const phone = cust.phone || cust.mobile || '';
    setCustomerName(name);
    setCustomerId(id);
    setMobileNumber(phone);

    // Auto-fill active group and pending due amount if present
    if (Array.isArray(cust.chits) && cust.chits.length > 0) {
      const activeChit = cust.chits[0];
      setChitGroup(activeChit.groupName || activeChit.groupId || chitGroup);
      if (cust.pending && Number(cust.pending) > 0) {
        setAmount(String(cust.pending));
      } else if (activeChit.monthlyInstallment) {
        setAmount(String(activeChit.monthlyInstallment));
      }
    } else if (cust.pending && Number(cust.pending) > 0) {
      setAmount(String(cust.pending));
    }

    setIsMemberPickerOpen(false);
    setMemberSearchQuery('');
  };

  const selectGroup = (grp: any) => {
    const gName = grp.name || grp.id || 'Chit Group';
    setChitGroup(gName);
    setIsGroupPickerOpen(false);
    setGroupSearchQuery('');
  };

  const [filterOnlyThisGroup, setFilterOnlyThisGroup] = useState(Boolean(chitGroup));

  // Keep filterOnlyThisGroup in sync if chitGroup changes
  useEffect(() => {
    if (chitGroup) {
      setFilterOnlyThisGroup(true);
    }
  }, [chitGroup]);

  const filteredMembers = customersList.filter((c: any) => {
    // If filterOnlyThisGroup is active and chitGroup is set, only show members enrolled in that group
    if (filterOnlyThisGroup && chitGroup.trim()) {
      const targetGroup = chitGroup.trim().toLowerCase();
      const isEnrolledInGroup = Array.isArray(c.chits) && c.chits.some((ch: any) => {
        const gId = String(ch.groupId || '').toLowerCase().trim();
        const gName = String(ch.groupName || '').toLowerCase().trim();
        return (
          gId === targetGroup ||
          gName === targetGroup ||
          (gId && targetGroup.includes(gId)) ||
          (gName && targetGroup.includes(gName)) ||
          (targetGroup && gName && gName.includes(targetGroup))
        );
      });
      if (!isEnrolledInGroup) return false;
    }

    const q = memberSearchQuery.toLowerCase().trim();
    const cleanQ = memberSearchQuery.replace(/\D/g, '');
    const cPhone = (c.phone || c.mobile || '').replace(/\D/g, '');
    const cName = (c.name || c.fullName || '').toLowerCase();
    const cId = String(c.id || c.customerCode || '').toLowerCase();
    return cName.includes(q) || cId.includes(q) || (cleanQ && cPhone.includes(cleanQ));
  });

  const filteredGroups = groupsList.filter((g: any) => {
    const q = groupSearchQuery.toLowerCase().trim();
    const gName = (g.name || '').toLowerCase();
    const gId = (g.id || '').toLowerCase();
    return gName.includes(q) || gId.includes(q);
  });

  const handleSaveReceipt = async () => {
    if (!customerName.trim() || !amount.trim() || Number(amount) <= 0) {
      Alert.alert('Validation Error', 'Please enter customer name and valid amount.');
      return;
    }

    setIsSubmitting(true);
    try {
      await DataSyncManager.recordReceipt({
        receiptNo,
        customerId: customerId || 'CUST',
        customerName: customerName.trim(),
        chitGroup,
        amount: Number(amount),
        paymentMode,
        referenceNo: referenceNo.trim(),
        executive: user?.name || 'Staff User',
      });

      Alert.alert(
        'Receipt Recorded',
        `Official Receipt #${receiptNo} for ₹${amount} saved and synced into ledger!`,
        [
          {
            text: 'Share / Print PDF',
            onPress: () => {
              generateAndShareReceipt({
                receiptNo,
                customerName,
                customerId,
                customerMobile: mobileNumber,
                groupName: chitGroup,
                paymentMode,
                amount,
                referenceNo,
                collectedBy: user?.name,
              });
              navigation.goBack();
            },
          },
          { text: 'Done', onPress: () => navigation.goBack() },
        ]
      );
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to record receipt');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <StatusBar barStyle="light-content" />

      {/* 1. Group Selector Card (Reference Screen 5) */}
      <TouchableOpacity
        style={styles.groupCard}
        onPress={() => setIsGroupPickerOpen(true)}
        activeOpacity={0.7}
      >
        <View style={styles.groupIconBox}>
          <Ionicons name="layers-outline" size={20} color={Colors.purpleAccent} />
        </View>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={styles.groupCardTitle}>{chitGroup || 'Tap to Select Chit Group'}</Text>
          <Text style={styles.groupCardDue}>Tap to switch plan or group</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={Colors.border} />
      </TouchableOpacity>

      {/* 2. Member Selector Field */}
      <View style={styles.fieldSection}>
        <Text style={styles.fieldLabel}>Member</Text>
        <TouchableOpacity
          style={styles.selectMemberBox}
          activeOpacity={0.8}
          onPress={() => setIsMemberPickerOpen(true)}
        >
          <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
            <Ionicons name="person-outline" size={16} color={Colors.textSecondary} style={{ marginRight: 8 }} />
            <Text style={[styles.selectMemberText, !customerName && { color: Colors.textSecondary }]}>
              {customerName ? `${customerName} (${mobileNumber || customerId})` : 'Select member from directory...'}
            </Text>
          </View>
          <Ionicons name="chevron-down" size={18} color={Colors.textSecondary} />
        </TouchableOpacity>
      </View>

      {/* 3. Amount Field */}
      <View style={styles.fieldSection}>
        <Text style={styles.fieldLabel}>Amount</Text>
        <View style={styles.amountInputWrap}>
          <Text style={styles.currencySymbol}>₹</Text>
          <Input
            placeholder="Enter amount"
            keyboardType="number-pad"
            value={amount}
            onChangeText={setAmount}
            containerStyle={{ flex: 1, marginBottom: 0 }}
            style={styles.amountInputField}
          />
        </View>
      </View>

      {/* 4. Payment Method 3-Tile Selector (UPI, Cash, Bank Transfer) - Reference Screen 5 */}
      <View style={styles.fieldSection}>
        <Text style={styles.fieldLabel}>Payment Method</Text>
        <View style={styles.paymentMethodsRow}>
          {/* UPI */}
          <TouchableOpacity
            style={[
              styles.methodTile,
              paymentMode === 'UPI' && styles.methodTileActive,
            ]}
            onPress={() => setPaymentMode('UPI')}
            activeOpacity={0.8}
          >
            <Ionicons
              name="time-outline"
              size={18}
              color={paymentMode === 'UPI' ? '#0B1A30' : Colors.textSecondary}
            />
            <Text
              style={[
                styles.methodTileText,
                paymentMode === 'UPI' && styles.methodTileTextActive,
              ]}
            >
              UPI
            </Text>
          </TouchableOpacity>

          {/* Cash */}
          <TouchableOpacity
            style={[
              styles.methodTile,
              paymentMode === 'CASH' && styles.methodTileActive,
            ]}
            onPress={() => setPaymentMode('CASH')}
            activeOpacity={0.8}
          >
            <Ionicons
              name="cash-outline"
              size={18}
              color={paymentMode === 'CASH' ? '#0B1A30' : Colors.textSecondary}
            />
            <Text
              style={[
                styles.methodTileText,
                paymentMode === 'CASH' && styles.methodTileTextActive,
              ]}
            >
              Cash
            </Text>
          </TouchableOpacity>

          {/* Bank Transfer */}
          <TouchableOpacity
            style={[
              styles.methodTile,
              paymentMode === 'BANK_TRANSFER' && styles.methodTileActive,
            ]}
            onPress={() => setPaymentMode('BANK_TRANSFER')}
            activeOpacity={0.8}
          >
            <Ionicons
              name="business-outline"
              size={18}
              color={paymentMode === 'BANK_TRANSFER' ? '#0B1A30' : Colors.textSecondary}
            />
            <Text
              style={[
                styles.methodTileText,
                paymentMode === 'BANK_TRANSFER' && styles.methodTileTextActive,
              ]}
            >
              Bank Transfer
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* 5. Payment Date */}
      <View style={styles.fieldSection}>
        <Text style={styles.fieldLabel}>Payment Date</Text>
        <View style={styles.datePickerBox}>
          <Ionicons name="calendar-outline" size={18} color={Colors.textSecondary} />
          <Text style={styles.datePickerText}>24 Oct 2025</Text>
        </View>
      </View>

      {/* 6. Reference / UTR (Only needed for online / bank transfer / UPI, not needed for Cash) */}
      {paymentMode !== 'CASH' && (
        <View style={styles.fieldSection}>
          <Text style={styles.fieldLabel}>Reference / UTR (Optional)</Text>
          <Input
            placeholder="Enter UTR / Reference No"
            value={referenceNo}
            onChangeText={setReferenceNo}
            containerStyle={{ marginBottom: 0 }}
          />
        </View>
      )}

      {/* 7. Warm Gold Save Payment Button - Reference Screen 5 */}
      <TouchableOpacity
        style={styles.savePaymentBtn}
        onPress={handleSaveReceipt}
        disabled={isSubmitting}
        activeOpacity={0.85}
      >
        <Ionicons name="card" size={18} color="#0B1A30" />
        <Text style={styles.savePaymentBtnText}>Save Payment</Text>
      </TouchableOpacity>

      <View style={{ height: 48 }} />
    </ScrollView>

    {/* MEMBER PICKER MODAL */}
    <Modal
      visible={isMemberPickerOpen}
      animationType="slide"
      transparent={true}
      onRequestClose={() => setIsMemberPickerOpen(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <View>
              <Text style={styles.modalTitle}>Select Member</Text>
              <Text style={styles.modalSubtitle}>Choose a registered member to enter payment</Text>
            </View>
            <TouchableOpacity
              onPress={() => setIsMemberPickerOpen(false)}
              style={styles.modalCloseBtn}
            >
              <Ionicons name="close" size={20} color={Colors.text} />
            </TouchableOpacity>
          </View>

          {/* Search Input */}
          <View style={styles.modalSearchBox}>
            <Ionicons name="search" size={18} color={Colors.textSecondary} />
            <TextInput
              style={styles.modalSearchInput}
              placeholder="Search by name, ID or mobile..."
              placeholderTextColor={Colors.textSecondary}
              value={memberSearchQuery}
              onChangeText={setMemberSearchQuery}
              autoCapitalize="none"
              autoFocus={true}
            />
            {memberSearchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setMemberSearchQuery('')}>
                <Ionicons name="close-circle" size={18} color={Colors.textSecondary} />
              </TouchableOpacity>
            )}
          </View>

          {/* Group Filter Tab / Banner */}
          {chitGroup ? (
            <View style={styles.groupFilterBanner}>
              <TouchableOpacity
                style={[
                  styles.groupFilterChip,
                  filterOnlyThisGroup && styles.groupFilterChipActive,
                ]}
                onPress={() => setFilterOnlyThisGroup(true)}
              >
                <Ionicons
                  name="layers"
                  size={13}
                  color={filterOnlyThisGroup ? '#0B1A30' : Colors.purpleAccent}
                />
                <Text
                  style={[
                    styles.groupFilterChipText,
                    filterOnlyThisGroup && styles.groupFilterChipTextActive,
                  ]}
                  numberOfLines={1}
                >
                  {chitGroup} Members ({customersList.filter((c: any) => Array.isArray(c.chits) && c.chits.some((ch: any) => String(ch.groupId || ch.groupName || '').toLowerCase().includes(chitGroup.toLowerCase()))).length})
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.groupFilterChip,
                  !filterOnlyThisGroup && styles.groupFilterChipActive,
                ]}
                onPress={() => setFilterOnlyThisGroup(false)}
              >
                <Text
                  style={[
                    styles.groupFilterChipText,
                    !filterOnlyThisGroup && styles.groupFilterChipTextActive,
                  ]}
                >
                  All Directory ({customersList.length})
                </Text>
              </TouchableOpacity>
            </View>
          ) : null}

          {/* Members List */}
          <FlatList
            data={filteredMembers}
            keyExtractor={(item) => String(item.id || item.mongoId || item.name)}
            contentContainerStyle={styles.modalList}
            renderItem={({ item }) => {
              const name = item.name || item.fullName || 'Member';
              const phone = item.phone || item.mobile || 'No phone';
              const chitsCount = item.activeChits || (item.chits ? item.chits.length : 0);
              const pending = Number(item.pending || 0);

              return (
                <TouchableOpacity
                  style={styles.memberListItem}
                  activeOpacity={0.7}
                  onPress={() => selectCustomer(item)}
                >
                  <View style={styles.memberAvatar}>
                    <Text style={styles.memberAvatarText}>
                      {name.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={styles.memberNameText}>{name}</Text>
                    <Text style={styles.memberMetaText}>
                      ID: {item.id} • {phone}
                    </Text>
                    {item.chits && item.chits[0]?.groupName && (
                      <Text style={styles.memberGroupTag}>{item.chits[0].groupName}</Text>
                    )}
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    {pending > 0 ? (
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={styles.memberPendingAmt}>{formatCurrency(pending)}</Text>
                        <Text style={styles.memberDueTag}>DUE</Text>
                      </View>
                    ) : (
                      <View style={styles.memberSelectPill}>
                        <Text style={styles.memberSelectText}>Select</Text>
                      </View>
                    )}
                  </View>
                </TouchableOpacity>
              );
            }}
            ListEmptyComponent={
              <View style={styles.modalEmpty}>
                <Ionicons name="people-outline" size={40} color={Colors.border} />
                <Text style={styles.modalEmptyText}>No members found</Text>
                <Text style={styles.modalEmptySub}>Try searching with another name or mobile number</Text>
              </View>
            }
          />
        </View>
      </View>
    </Modal>

    {/* GROUP PICKER MODAL */}
    <Modal
      visible={isGroupPickerOpen}
      animationType="slide"
      transparent={true}
      onRequestClose={() => setIsGroupPickerOpen(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <View>
              <Text style={styles.modalTitle}>Select Chit Group</Text>
              <Text style={styles.modalSubtitle}>Assign payment to a chit scheme group</Text>
            </View>
            <TouchableOpacity
              onPress={() => setIsGroupPickerOpen(false)}
              style={styles.modalCloseBtn}
            >
              <Ionicons name="close" size={20} color={Colors.text} />
            </TouchableOpacity>
          </View>

          {/* Search Input */}
          <View style={styles.modalSearchBox}>
            <Ionicons name="search" size={18} color={Colors.textSecondary} />
            <TextInput
              style={styles.modalSearchInput}
              placeholder="Search group name..."
              placeholderTextColor={Colors.textSecondary}
              value={groupSearchQuery}
              onChangeText={setGroupSearchQuery}
              autoCapitalize="none"
            />
            {groupSearchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setGroupSearchQuery('')}>
                <Ionicons name="close-circle" size={18} color={Colors.textSecondary} />
              </TouchableOpacity>
            )}
          </View>

          {/* Groups List */}
          <FlatList
            data={filteredGroups}
            keyExtractor={(item) => String(item.id || item.name)}
            contentContainerStyle={styles.modalList}
            renderItem={({ item }) => {
              const isSelected = (chitGroup || '').toLowerCase() === (item.name || item.id || '').toLowerCase();
              return (
                <TouchableOpacity
                  style={[styles.groupListItem, isSelected && styles.groupListItemActive]}
                  activeOpacity={0.7}
                  onPress={() => selectGroup(item)}
                >
                  <View style={[styles.groupItemIcon, isSelected && { backgroundColor: Colors.purpleAccent }]}>
                    <Ionicons
                      name="layers"
                      size={18}
                      color={isSelected ? Colors.white : Colors.purpleAccent}
                    />
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={styles.groupItemName}>{item.name}</Text>
                    <Text style={styles.groupItemMeta}>
                      {item.type || 'Chit'} • {formatCurrency(item.value || 100000)} • {item.duration || 20} Mos
                    </Text>
                  </View>
                  {isSelected && (
                    <Ionicons name="checkmark-circle" size={20} color={Colors.success} />
                  )}
                </TouchableOpacity>
              );
            }}
            ListEmptyComponent={
              <View style={styles.modalEmpty}>
                <Ionicons name="layers-outline" size={40} color={Colors.border} />
                <Text style={styles.modalEmptyText}>No chit groups found</Text>
              </View>
            }
          />
        </View>
      </View>
    </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    padding: 20,
    gap: 16,
  },

  // 1. Group Selector Card
  groupCard: {
    backgroundColor: Colors.surface,
    borderRadius: 18,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: Colors.navy.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1,
  },
  groupIconBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: Colors.purpleSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  groupCardTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.text,
  },
  groupCardDue: {
    fontSize: 11,
    fontWeight: '500',
    color: Colors.textSecondary,
    marginTop: 2,
  },

  // 2. Sections & Labels
  fieldSection: {
    gap: 8,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.text,
  },
  selectMemberBox: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: Colors.border,
    height: 50,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  selectMemberText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
  },

  // 3. Amount Field
  amountInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
  },
  currencySymbol: {
    position: 'absolute',
    left: 16,
    zIndex: 2,
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  amountInputField: {
    paddingLeft: 36,
  },

  // 4. Payment Method 3-Tile Row
  paymentMethodsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  methodTile: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    backgroundColor: Colors.surface,
    borderWidth: 1.5,
    borderColor: Colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  methodTileActive: {
    backgroundColor: Colors.gold.primary,
    borderColor: Colors.gold.primary,
  },
  methodTileText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  methodTileTextActive: {
    color: '#0B1A30',
    fontWeight: '800',
  },

  // 5. Payment Date
  datePickerBox: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: Colors.border,
    height: 50,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  datePickerText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
  },

  // 7. Save Payment Button
  savePaymentBtn: {
    backgroundColor: Colors.gold.primary,
    height: 52,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 8,
    shadowColor: Colors.gold.dark,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
  },
  savePaymentBtnText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0B1A30',
    letterSpacing: 0.2,
  },

  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(11, 26, 48, 0.65)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    maxHeight: '82%',
    paddingBottom: 32,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  modalSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  modalCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalSearchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    marginHorizontal: 20,
    marginTop: 14,
    marginBottom: 8,
    paddingHorizontal: 14,
    height: 46,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 10,
  },
  modalSearchInput: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#0F172A',
  },
  groupFilterBanner: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 20,
    marginBottom: 6,
  },
  groupFilterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 6,
  },
  groupFilterChipActive: {
    backgroundColor: Colors.gold.primary,
    borderColor: Colors.gold.dark,
  },
  groupFilterChipText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#475569',
  },
  groupFilterChipTextActive: {
    color: '#0B1A30',
  },
  modalList: {
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  memberListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  memberAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: Colors.navy.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  memberAvatarText: {
    color: Colors.gold.primary,
    fontWeight: '800',
    fontSize: 16,
  },
  memberNameText: {
    fontSize: 14.5,
    fontWeight: '700',
    color: '#0F172A',
  },
  memberMetaText: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  memberGroupTag: {
    fontSize: 11,
    color: Colors.purpleAccent,
    fontWeight: '600',
    marginTop: 2,
  },
  memberPendingAmt: {
    fontSize: 13.5,
    fontWeight: '800',
    color: Colors.danger,
  },
  memberDueTag: {
    fontSize: 9,
    fontWeight: '800',
    color: Colors.danger,
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 2,
    alignSelf: 'flex-end',
  },
  memberSelectPill: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  memberSelectText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.primary[600],
  },
  groupListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 14,
    marginBottom: 6,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  groupListItemActive: {
    backgroundColor: '#F3E8FF',
    borderColor: Colors.purpleAccent,
  },
  groupItemIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#EDE9FE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  groupItemName: {
    fontSize: 14.5,
    fontWeight: '700',
    color: '#0F172A',
  },
  groupItemMeta: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  modalEmpty: {
    paddingVertical: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalEmptyText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#64748B',
    marginTop: 10,
  },
  modalEmptySub: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 4,
    textAlign: 'center',
  },
});
