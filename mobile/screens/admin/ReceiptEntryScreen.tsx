import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../theme/colors';
import { Input } from '../../components/common/Input';
import { useAuth } from '../../store/AuthContext';
import { DataSyncManager } from '../../services/dataSync';
import { generateAndShareReceipt } from '../../services/receiptService';

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
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <StatusBar barStyle="light-content" />

      {/* 1. Group Selector Card (Reference Screen 5) */}
      <View style={styles.groupCard}>
        <View style={styles.groupIconBox}>
          <Ionicons name="hammer-outline" size={20} color={Colors.purpleAccent} />
        </View>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={styles.groupCardTitle}>{chitGroup}</Text>
          <Text style={styles.groupCardDue}>Next Due: 12 Nov 2025</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={Colors.border} />
      </View>

      {/* 2. Member Selector Field */}
      <View style={styles.fieldSection}>
        <Text style={styles.fieldLabel}>Member</Text>
        <TouchableOpacity style={styles.selectMemberBox} activeOpacity={0.8}>
          <Text style={styles.selectMemberText}>{customerName || 'Select member'}</Text>
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
});
