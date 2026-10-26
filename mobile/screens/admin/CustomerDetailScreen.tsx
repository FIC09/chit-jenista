import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  StatusBar,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../theme/colors';
import { Button } from '../../components/common/Button';
import { apiClient } from '../../services/api';
import { formatCurrency } from '../../utils/format';
import { Customer } from '../../types';
import { DataSyncManager } from '../../services/dataSync';

export const CustomerDetailScreen: React.FC<{ route: any; navigation: any }> = ({
  route,
  navigation,
}) => {
  const initialCustomer: Customer = route.params?.customer || {};
  const [customer, setCustomer] = useState<Customer>(initialCustomer);
  const [currentStatus, setCurrentStatus] = useState<string>(customer.status || 'ACTIVE');
  const [loadingStatus, setLoadingStatus] = useState(false);

  const refreshCustomer = async () => {
    try {
      const customers = await DataSyncManager.getCustomers();
      const targetPhoneClean = (customer.phone || customer.mobile || '').replace(/\D/g, '');
      const found = customers.find((c) => {
        const cPhoneClean = (c.phone || c.mobile || '').replace(/\D/g, '');
        return (
          c.id === customer.id ||
          (customer.mongoId && c.mongoId === customer.mongoId) ||
          (targetPhoneClean && cPhoneClean && targetPhoneClean === cPhoneClean) ||
          (c.name && customer.name && c.name.toLowerCase() === customer.name.toLowerCase())
        );
      });
      if (found) {
        setCustomer(found);
        if (found.status) setCurrentStatus(found.status);
      }
    } catch (e) {
      console.warn('Error refreshing customer details:', e);
    }
  };

  useFocusEffect(
    useCallback(() => {
      refreshCustomer();
    }, [customer.id, customer.mongoId])
  );

  const displayName = customer.name || customer.fullName || 'Member';
  const initial = displayName.charAt(0).toUpperCase();

  const toggleStatus = async (newStatus: 'ACTIVE' | 'INACTIVE') => {
    Alert.alert(
      newStatus === 'INACTIVE' ? 'Deactivate Customer' : 'Reactivate Customer',
      `Are you sure you want to ${newStatus === 'INACTIVE' ? 'restrict' : 'restore'} app access for this customer?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          style: newStatus === 'INACTIVE' ? 'destructive' : 'default',
          onPress: async () => {
            setLoadingStatus(true);
            try {
              const targetId = customer.mongoId || customer.id;
              await apiClient(`/customers/${targetId}/status`, {
                method: 'PATCH',
                body: JSON.stringify({ status: newStatus }),
              });
              setCurrentStatus(newStatus);
              Alert.alert('Updated', `Customer is now ${newStatus}`);
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Status update failed');
            } finally {
              setLoadingStatus(false);
            }
          },
        },
      ]
    );
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <StatusBar barStyle="light-content" />

      {/* 1. Deep Navy Profile Header Card (Reference Screen 9) */}
      <View style={styles.navyHeader}>
        <View style={styles.headerProfileRow}>
          <View style={styles.avatarBubble}>
            <Text style={styles.avatarText}>{initial}</Text>
          </View>
          <View style={{ flex: 1, marginLeft: 14 }}>
            <Text style={styles.headerCustomerName}>{displayName}</Text>
            <Text style={styles.headerCustomerId}>Member ID: {customer.id || 'JC00123'}</Text>
          </View>
          <TouchableOpacity style={styles.editIconBtn} activeOpacity={0.7}>
            <Ionicons name="pencil" size={16} color={Colors.white} />
          </TouchableOpacity>
        </View>
      </View>

      {/* 2. Contact & Scheme Details Card (Phone, Email, Group) */}
      <View style={styles.contactCardWrapper}>
        <View style={styles.contactCard}>
          <View style={styles.contactRow}>
            <Ionicons name="call-outline" size={18} color={Colors.navy.primary} />
            <Text style={styles.contactRowText}>{customer.phone || customer.mobile || '+91 9988998899'}</Text>
          </View>

          <View style={styles.cardDivider} />

          <View style={styles.contactRow}>
            <Ionicons name="mail-outline" size={18} color={Colors.navy.primary} />
            <Text style={styles.contactRowText}>{displayName.toLowerCase().replace(/\s+/g, '')}@gmail.com</Text>
          </View>

          <View style={styles.cardDivider} />

          <View style={styles.contactRow}>
            <Ionicons name="people-outline" size={18} color={Colors.navy.primary} />
            <Text style={styles.contactRowText}>{customer.chits?.[0]?.groupName || 'Group A'}</Text>
          </View>
        </View>
      </View>

      {/* 3. Account Navigation Links (My Contributions, Payment History, Receipts, Settings) */}
      <View style={styles.navLinksCard}>
        <TouchableOpacity
          style={styles.navLinkRow}
          onPress={() =>
            navigation.navigate('CustomerSchedule', {
              customer,
              chit: customer.chits?.[0],
            })
          }
          activeOpacity={0.7}
        >
          <View style={[styles.navLinkIconBox, { backgroundColor: '#FFF8EB' }]}>
            <Ionicons name="people" size={18} color={Colors.gold.dark} />
          </View>
          <Text style={styles.navLinkTitle}>My Contributions & Schedule</Text>
          <Ionicons name="chevron-forward" size={18} color={Colors.border} />
        </TouchableOpacity>

        <View style={styles.cardDivider} />

        <TouchableOpacity
          style={styles.navLinkRow}
          onPress={() => navigation.navigate('Ledger')}
          activeOpacity={0.7}
        >
          <View style={[styles.navLinkIconBox, { backgroundColor: Colors.blueSubtle }]}>
            <Ionicons name="card-outline" size={18} color={Colors.blueAccent} />
          </View>
          <Text style={styles.navLinkTitle}>Payment History</Text>
          <Ionicons name="chevron-forward" size={18} color={Colors.border} />
        </TouchableOpacity>

        <View style={styles.cardDivider} />

        <TouchableOpacity
          style={styles.navLinkRow}
          onPress={() =>
            navigation.navigate('ReceiptEntry', {
              customerId: customer.id,
              customerName: customer.name,
              mobile: customer.phone,
            })
          }
          activeOpacity={0.7}
        >
          <View style={[styles.navLinkIconBox, { backgroundColor: Colors.successLight }]}>
            <Ionicons name="receipt-outline" size={18} color={Colors.success} />
          </View>
          <Text style={styles.navLinkTitle}>Receipts</Text>
          <Ionicons name="chevron-forward" size={18} color={Colors.border} />
        </TouchableOpacity>

        <View style={styles.cardDivider} />

        <TouchableOpacity
          style={styles.navLinkRow}
          onPress={() => navigation.navigate('Settings')}
          activeOpacity={0.7}
        >
          <View style={[styles.navLinkIconBox, { backgroundColor: '#F1F5F9' }]}>
            <Ionicons name="settings-outline" size={18} color={Colors.navy.primary} />
          </View>
          <Text style={styles.navLinkTitle}>Settings</Text>
          <Ionicons name="chevron-forward" size={18} color={Colors.border} />
        </TouchableOpacity>
      </View>

      {/* 4. Financial Account Summary */}
      <View style={styles.summaryCard}>
        <Text style={styles.cardHeaderTitle}>Account Overview</Text>
        <View style={styles.summaryRow}>
          <View style={styles.summaryCol}>
            <Text style={styles.summaryLabel}>TOTAL PAID</Text>
            <Text style={[styles.summaryVal, { color: Colors.success }]}>
              {formatCurrency(customer.totalPaid || 0)}
            </Text>
          </View>
          <View style={styles.vLine} />
          <View style={styles.summaryCol}>
            <Text style={styles.summaryLabel}>PENDING DUES</Text>
            <Text style={[styles.summaryVal, { color: Colors.danger }]}>
              {formatCurrency(customer.pending || 0)}
            </Text>
          </View>
        </View>
      </View>

      {/* 5. Primary Action Buttons */}
      <View style={styles.actionsWrap}>
        <Button
          title="Collect Installment / Issue Receipt"
          onPress={() =>
            navigation.navigate('ReceiptEntry', {
              customerId: customer.id,
              customerName: customer.name,
              mobile: customer.phone,
              amount: customer.pending || 5000,
            })
          }
          style={styles.primaryActionBtn}
        />

        {currentStatus === 'ACTIVE' ? (
          <Button
            title="Deactivate Customer Account"
            variant="danger"
            isLoading={loadingStatus}
            onPress={() => toggleStatus('INACTIVE')}
          />
        ) : (
          <Button
            title="Activate / Approve Customer Account"
            variant="secondary"
            isLoading={loadingStatus}
            onPress={() => toggleStatus('ACTIVE')}
          />
        )}
      </View>

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
    paddingBottom: 24,
  },

  // 1. Navy Profile Header Card
  navyHeader: {
    backgroundColor: Colors.navy.primary,
    paddingTop: 16,
    paddingHorizontal: 20,
    paddingBottom: 36,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  headerProfileRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarBubble: {
    width: 52,
    height: 52,
    borderRadius: 18,
    backgroundColor: Colors.gold.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0B1A30',
  },
  headerCustomerName: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.white,
    letterSpacing: 0.3,
  },
  headerCustomerId: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.65)',
    fontWeight: '500',
    marginTop: 2,
  },
  editIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // 2. Overlapping Contact Card
  contactCardWrapper: {
    paddingHorizontal: 20,
    marginTop: -20,
  },
  contactCard: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: Colors.navy.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
    gap: 12,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  contactRowText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
  },
  cardDivider: {
    height: 1,
    backgroundColor: Colors.borderLight,
  },

  // 3. Account Navigation Links
  navLinksCard: {
    backgroundColor: Colors.surface,
    marginHorizontal: 20,
    marginTop: 16,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1,
  },
  navLinkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  navLinkIconBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  navLinkTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
  },

  // 4. Financial Account Summary
  summaryCard: {
    backgroundColor: Colors.surface,
    marginHorizontal: 20,
    marginTop: 16,
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cardHeaderTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.text,
    marginBottom: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  summaryCol: {
    flex: 1,
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.textSecondary,
    letterSpacing: 0.5,
  },
  summaryVal: {
    fontSize: 18,
    fontWeight: '800',
    marginTop: 4,
  },
  vLine: {
    width: 1,
    height: 36,
    backgroundColor: Colors.borderLight,
  },

  // 5. Actions
  actionsWrap: {
    marginHorizontal: 20,
    marginTop: 20,
    gap: 12,
  },
  primaryActionBtn: {
    backgroundColor: Colors.gold.primary,
  },
});
