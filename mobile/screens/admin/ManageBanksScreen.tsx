import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../theme/colors';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { formatCurrency } from '../../utils/format';
import { DataSyncManager } from '../../services/dataSync';

interface BankItem {
  id: string;
  bankName: string;
  accountHolder: string;
  accountNumber: string;
  ifsc: string;
  branch: string;
  upiId: string;
  isDefault: boolean;
}

export const ManageBanksScreen: React.FC = () => {
  const [banks, setBanks] = useState<BankItem[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const loadBanks = async () => {
    try {
      const companyBanks = await DataSyncManager.getBankAccounts();
      const mapped: BankItem[] = companyBanks.map((b: any) => ({
        id: b.id,
        bankName: b.bankName,
        accountHolder: b.accountHolderName || b.accountHolder || 'Jenista Chits Pvt Ltd',
        accountNumber: b.accountNumber,
        ifsc: b.ifscCode || b.ifsc,
        branch: b.branch,
        upiId: b.upiId,
        isDefault: !!b.isDefault,
      }));
      setBanks(mapped);
    } catch (e) {
      console.warn('Failed to load company banks:', e);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadBanks();
  }, []);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [bankName, setBankName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [ifsc, setIfsc] = useState('');
  const [branch, setBranch] = useState('');
  const [upiId, setUpiId] = useState('');

  const handleAddBank = async () => {
    if (!bankName.trim() || !accountNumber.trim()) {
      Alert.alert('Required', 'Please enter Bank Name and Account Number');
      return;
    }

    const newBank: BankItem = {
      id: `BANK-${Date.now().toString().slice(-4)}`,
      bankName: bankName.trim(),
      accountHolder: 'Jenista Chits Pvt Ltd',
      accountNumber: accountNumber.trim(),
      ifsc: ifsc.trim().toUpperCase(),
      branch: branch.trim(),
      upiId: upiId.trim(),
      isDefault: banks.length === 0,
    };

    const updated = [...banks, newBank];
    setBanks(updated);
    await DataSyncManager.saveBankAccounts(updated);
    setIsModalOpen(false);
    setBankName('');
    setAccountNumber('');
    setIfsc('');
    setBranch('');
    setUpiId('');
    Alert.alert('Success', 'Bank account registered successfully');
  };

  const setDefaultBank = async (id: string) => {
    const updated = banks.map((b) => ({ ...b, isDefault: b.id === id }));
    setBanks(updated);
    await DataSyncManager.saveBankAccounts(updated);
  };

  const deleteBank = (id: string) => {
    Alert.alert('Delete Bank', 'Are you sure you want to remove this bank account?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const updated = banks.filter((b) => b.id !== id);
          setBanks(updated);
          await DataSyncManager.saveBankAccounts(updated);
        },
      },
    ]);
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadBanks} tintColor={Colors.gold.primary} />}
    >
      <View style={styles.topHeader}>
        <View>
          <Text style={styles.title}>Company Bank Accounts</Text>
          <Text style={styles.subtitle}>Configure collection bank accounts and UPI IDs</Text>
        </View>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => setIsModalOpen(!isModalOpen)}
        >
          <Ionicons name={isModalOpen ? 'close' : 'add'} size={20} color={Colors.secondary[900]} />
          <Text style={styles.addBtnText}>{isModalOpen ? 'Cancel' : 'Add Bank'}</Text>
        </TouchableOpacity>
      </View>

      {isModalOpen && (
        <View style={styles.formCard}>
          <Text style={styles.formTitle}>Register New Bank Account</Text>
          <Input label="Bank Name *" placeholder="e.g. ICICI Bank" value={bankName} onChangeText={setBankName} />
          <Input label="Account Number *" placeholder="e.g. 1029384756" keyboardType="number-pad" value={accountNumber} onChangeText={setAccountNumber} />
          <Input label="IFSC Code" placeholder="e.g. ICIC0000123" autoCapitalize="characters" value={ifsc} onChangeText={setIfsc} />
          <Input label="Branch Name" placeholder="e.g. Madurai" value={branch} onChangeText={setBranch} />
          <Input label="UPI VPA ID" placeholder="e.g. jenista@icici" autoCapitalize="none" value={upiId} onChangeText={setUpiId} />
          <Button title="Save Bank Account" onPress={handleAddBank} style={{ marginTop: 10 }} />
        </View>
      )}

      <View style={styles.bankList}>
        {banks.map((bank, idx) => (
          <View key={`${bank.id || 'bank'}-${idx}`} style={styles.bankCard}>
            <View style={styles.bankCardHeader}>
              <View style={styles.bankIconCircle}>
                <Ionicons name="business" size={20} color={Colors.primary[900]} />
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={styles.bankNameText}>{bank.bankName}</Text>
                  {bank.isDefault && (
                    <View style={styles.defaultBadge}>
                      <Text style={styles.defaultBadgeText}>DEFAULT</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.branchText}>{bank.branch || 'Branch'}</Text>
              </View>
              <TouchableOpacity onPress={() => deleteBank(bank.id)}>
                <Ionicons name="trash-outline" size={20} color={Colors.danger} />
              </TouchableOpacity>
            </View>

            <View style={styles.bankDetailsGrid}>
              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>A/C NUMBER</Text>
                <Text style={styles.detailValue}>{bank.accountNumber}</Text>
              </View>
              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>IFSC CODE</Text>
                <Text style={styles.detailValue}>{bank.ifsc}</Text>
              </View>
              <View style={styles.detailItemFull}>
                <Text style={styles.detailLabel}>UPI VPA</Text>
                <Text style={styles.detailValueHighlight}>{bank.upiId}</Text>
              </View>
            </View>

            {!bank.isDefault && (
              <TouchableOpacity
                style={styles.setDefaultBtn}
                onPress={() => setDefaultBank(bank.id)}
              >
                <Text style={styles.setDefaultText}>Set as Default Collection Bank</Text>
              </TouchableOpacity>
            )}
          </View>
        ))}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.secondary[50],
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  topHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.secondary[900],
  },
  subtitle: {
    fontSize: 12,
    color: Colors.secondary[500],
    marginTop: 2,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary[400],
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 4,
  },
  addBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.secondary[900],
  },
  formCard: {
    backgroundColor: Colors.white,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.secondary[200],
    marginBottom: 16,
  },
  formTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.secondary[900],
    marginBottom: 12,
  },
  bankList: {
    gap: 12,
  },
  bankCard: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.secondary[200],
  },
  bankCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  bankIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primary[100],
    alignItems: 'center',
    justifyContent: 'center',
  },
  bankNameText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.secondary[900],
  },
  branchText: {
    fontSize: 12,
    color: Colors.secondary[500],
    marginTop: 1,
  },
  defaultBadge: {
    backgroundColor: Colors.successLight,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  defaultBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: Colors.success,
  },
  bankDetailsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    backgroundColor: Colors.secondary[50],
    padding: 12,
    borderRadius: 8,
    gap: 12,
  },
  detailItem: {
    width: '45%',
  },
  detailItemFull: {
    width: '100%',
  },
  detailLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.secondary[400],
  },
  detailValue: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.secondary[900],
    marginTop: 2,
  },
  detailValueHighlight: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.primary[700],
    marginTop: 2,
  },
  setDefaultBtn: {
    marginTop: 12,
    alignItems: 'center',
    paddingVertical: 6,
  },
  setDefaultText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.primary[700],
  },
});
