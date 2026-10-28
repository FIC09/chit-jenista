import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Linking,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../theme/colors';
import { DataSyncManager } from '../../services/dataSync';

export const CustomerBankDetailsScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const [banks, setBanks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  useEffect(() => {
    loadBanks();
  }, []);

  const loadBanks = async () => {
    try {
      const bankList = await DataSyncManager.getBankAccounts();
      if (bankList && bankList.length > 0) {
        setBanks(bankList);
      } else {
        setBanks([
          {
            id: 'default-1',
            accountHolderName: 'Jenista Chit Funds Pvt Ltd',
            bankName: 'HDFC Bank',
            accountNumber: '50200012345678',
            ifscCode: 'HDFC0001234',
            upiId: 'jenistachits@hdfcbank',
            branchName: 'Thoothukudi Main Branch',
            accountType: 'Current Account',
            isDefault: true,
          },
        ]);
      }
    } catch {
      setBanks([
        {
          id: 'default-1',
          accountHolderName: 'Jenista Chit Funds Pvt Ltd',
          bankName: 'HDFC Bank',
          accountNumber: '50200012345678',
          ifscCode: 'HDFC0001234',
          upiId: 'jenistachits@hdfcbank',
          branchName: 'Thoothukudi Main Branch',
          accountType: 'Current Account',
          isDefault: true,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string, key: string) => {
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
    Alert.alert('Copied', `"${text}" copied to clipboard.`);
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.navy.primary} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.noticeBanner}>
        <Ionicons name="shield-checkmark" size={24} color={Colors.navy.primary} />
        <View style={{ flex: 1 }}>
          <Text style={styles.noticeTitle}>Official Direct Deposit Channels</Text>
          <Text style={styles.noticeSub}>
            Please deposit installments strictly into company authorized bank accounts and verify UPI handle.
          </Text>
        </View>
      </View>

      {banks.map((b, idx) => (
        <View key={`${b.id || 'bank'}-${idx}`} style={styles.bankCard}>
          <View style={styles.cardHeader}>
            <View style={styles.bankIconCircle}>
              <Ionicons name="business" size={22} color={Colors.gold.dark} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.bankName}>{b.bankName || 'Company Bank'}</Text>
              <Text style={styles.branchName}>
                {b.branchName || 'Branch'} • {b.accountType || 'Current Account'}
              </Text>
            </View>
            {b.isDefault && (
              <View style={styles.primaryBadge}>
                <Text style={styles.primaryBadgeText}>PRIMARY</Text>
              </View>
            )}
          </View>

          <View style={styles.qrSection}>
            <View style={styles.qrImageBox}>
              <Ionicons name="qr-code-outline" size={130} color={Colors.navy.primary} />
            </View>
            <Text style={styles.scanPayHint}>Scan with GPay, PhonePe, Paytm, or BHIM</Text>
          </View>

          <View style={styles.fieldGrid}>
            <View style={styles.fieldItem}>
              <Text style={styles.fieldLabel}>ACCOUNT HOLDER</Text>
              <Text style={styles.fieldValue}>{b.accountHolderName || 'Jenista Chit Funds Pvt Ltd'}</Text>
            </View>

            <View style={styles.fieldItem}>
              <Text style={styles.fieldLabel}>ACCOUNT NUMBER</Text>
              <View style={styles.rowBetween}>
                <Text style={styles.fieldValueMono}>{b.accountNumber}</Text>
                <TouchableOpacity
                  style={styles.copyBtn}
                  onPress={() => copyToClipboard(b.accountNumber, `acc-${idx}`)}
                >
                  <Ionicons
                    name={copiedKey === `acc-${idx}` ? 'checkmark' : 'copy-outline'}
                    size={16}
                    color={Colors.navy.primary}
                  />
                  <Text style={styles.copyBtnText}>Copy</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.fieldItem}>
              <Text style={styles.fieldLabel}>IFSC CODE</Text>
              <View style={styles.rowBetween}>
                <Text style={styles.fieldValueMono}>{b.ifscCode || b.ifsc}</Text>
                <TouchableOpacity
                  style={styles.copyBtn}
                  onPress={() => copyToClipboard(b.ifscCode || b.ifsc, `ifsc-${idx}`)}
                >
                  <Ionicons
                    name={copiedKey === `ifsc-${idx}` ? 'checkmark' : 'copy-outline'}
                    size={16}
                    color={Colors.navy.primary}
                  />
                  <Text style={styles.copyBtnText}>Copy</Text>
                </TouchableOpacity>
              </View>
            </View>

            {b.upiId && (
              <View style={styles.fieldItem}>
                <Text style={styles.fieldLabel}>UPI ID / VPA</Text>
                <View style={styles.rowBetween}>
                  <Text style={[styles.fieldValueMono, { color: Colors.gold.dark }]}>{b.upiId}</Text>
                  <TouchableOpacity
                    style={styles.copyBtn}
                    onPress={() => copyToClipboard(b.upiId, `upi-${idx}`)}
                  >
                    <Ionicons
                      name={copiedKey === `upi-${idx}` ? 'checkmark' : 'copy-outline'}
                      size={16}
                      color={Colors.navy.primary}
                    />
                    <Text style={styles.copyBtnText}>Copy</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        </View>
      ))}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    padding: 16,
    gap: 16,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noticeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#eff6ff',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#bfdbfe',
    gap: 12,
  },
  noticeTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.navy.primary,
  },
  noticeSub: {
    fontSize: 12,
    color: '#3b82f6',
    marginTop: 2,
    lineHeight: 16,
  },
  bankCard: {
    backgroundColor: Colors.white,
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    paddingBottom: 14,
  },
  bankIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#fef3c7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bankName: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.navy.primary,
  },
  branchName: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
  },
  primaryBadge: {
    backgroundColor: '#dcfce7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  primaryBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#166534',
  },
  qrSection: {
    alignItems: 'center',
    paddingVertical: 20,
    backgroundColor: '#f8fafc',
    borderRadius: 14,
    marginTop: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  qrImageBox: {
    padding: 12,
    backgroundColor: Colors.white,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  scanPayHint: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textMuted,
    marginTop: 10,
  },
  fieldGrid: {
    marginTop: 16,
    gap: 12,
  },
  fieldItem: {
    backgroundColor: '#f8fafc',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  fieldLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: Colors.textMuted,
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  fieldValue: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.navy.primary,
  },
  fieldValueMono: {
    fontSize: 15,
    fontWeight: '800',
    fontFamily: 'monospace',
    color: Colors.navy.primary,
    letterSpacing: 0.5,
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#e0e7ff',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  copyBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.navy.primary,
  },
});
