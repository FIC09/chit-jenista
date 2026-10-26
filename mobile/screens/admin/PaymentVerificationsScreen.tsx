import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  RefreshControl,
  Image,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../theme/colors';
import { formatCurrency, formatDate } from '../../utils/format';
import { PaymentRequest } from '../../types';
import { secureStorage } from '../../services/storage';
import { DataSyncManager } from '../../services/dataSync';

export const PaymentVerificationsScreen: React.FC = () => {
  const [requests, setRequests] = useState<PaymentRequest[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [viewingProof, setViewingProof] = useState<PaymentRequest | null>(null);

  const loadRequests = async () => {
    try {
      const raw = await secureStorage.getItem('payment_requests');
      if (raw) {
        const parsed: PaymentRequest[] = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          // Filter out dummy static mock IDs like PAY-78201
          const clean = parsed.filter(
            (p) => !['PAY-78201', 'PAY-78202', 'PAY-78203', 'PAY-78190'].includes(p.id)
          );
          setRequests(clean);
          return;
        }
      }
      setRequests([]);
    } catch (e) {
      console.warn('Failed to load payment requests:', e);
      setRequests([]);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadRequests();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    loadRequests();
  };

  const approvePayment = (id: string) => {
    const target = requests.find((r) => r.id === id);
    if (!target) return;

    Alert.alert('Approve Payment', 'Confirm verification of this online payment?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Approve & Credit Ledger',
        onPress: async () => {
          const updated = requests.map((r) =>
            r.id === id ? { ...r, status: 'APPROVED' as const, approvedAt: new Date().toISOString() } : r
          );
          setRequests(updated);
          await secureStorage.setItem('payment_requests', JSON.stringify(updated));

          // Record in real ledger
          await DataSyncManager.recordReceipt({
            receiptNo: `REC-ONLINE-${Date.now().toString().slice(-5)}`,
            customerId: target.customerId,
            customerName: target.customerName,
            chitGroup: target.groupName || 'Chit Group',
            amount: Number(target.amount),
            paymentMode: target.paymentMode,
            referenceNo: target.referenceNumber,
            executive: 'Online Verification',
          });

          Alert.alert('Approved', 'Payment approved and ledger credited.');
        },
      },
    ]);
  };

  const rejectPayment = (id: string) => {
    Alert.alert('Reject Payment', 'Are you sure you want to reject this transaction proof?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reject',
        style: 'destructive',
        onPress: async () => {
          const updated = requests.map((r) => (r.id === id ? { ...r, status: 'REJECTED' as const } : r));
          setRequests(updated);
          await secureStorage.setItem('payment_requests', JSON.stringify(updated));
        },
      },
    ]);
  };

  const renderReq = ({ item }: { item: PaymentRequest }) => {
    const isPending = item.status === 'PENDING';

    return (
      <View style={styles.card}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.custName}>{item.customerName}</Text>
            <Text style={styles.metaText}>{item.customerId} • {item.customerMobile}</Text>
          </View>
          <View
            style={[
              styles.statusBadge,
              item.status === 'APPROVED'
                ? styles.badgeApproved
                : item.status === 'REJECTED'
                ? styles.badgeRejected
                : styles.badgePending,
            ]}
          >
            <Text
              style={[
                styles.statusText,
                item.status === 'APPROVED'
                  ? styles.textApproved
                  : item.status === 'REJECTED'
                  ? styles.textRejected
                  : styles.textPending,
              ]}
            >
              {item.status}
            </Text>
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.infoGrid}>
          <View style={styles.infoCol}>
            <Text style={styles.label}>Scheme Group</Text>
            <Text style={styles.val}>{item.groupName}</Text>
          </View>
          <View style={styles.infoCol}>
            <Text style={styles.label}>Mode / Ref</Text>
            <Text style={styles.valHighlight}>{item.paymentMode}</Text>
            <Text style={styles.refText}>{item.referenceNumber}</Text>
          </View>
        </View>

        {/* Screenshot Proof Preview Button */}
        {(item.paymentScreenshot || item.screenshotUrl) ? (
          <TouchableOpacity
            style={styles.proofBtn}
            onPress={() => setViewingProof(item)}
            activeOpacity={0.8}
          >
            <Image
              source={{ uri: item.paymentScreenshot || item.screenshotUrl }}
              style={styles.proofThumb}
            />
            <View style={{ flex: 1, marginLeft: 8 }}>
              <Text style={styles.proofBtnTitle}>Payment Screenshot Attached</Text>
              <Text style={styles.proofBtnSub}>Tap to view proof in full size</Text>
            </View>
            <Ionicons name="eye-outline" size={16} color={Colors.navy.primary} />
          </TouchableOpacity>
        ) : (
          <View style={styles.noProofBadge}>
            <Ionicons name="document-outline" size={13} color={Colors.neutral[400]} />
            <Text style={styles.noProofText}>No screenshot uploaded</Text>
          </View>
        )}

        <View style={styles.bottomRow}>
          <View>
            <Text style={styles.amountLabel}>Paid Amount</Text>
            <Text style={styles.amountVal}>{formatCurrency(item.amount)}</Text>
          </View>

          {isPending ? (
            <View style={styles.btnRow}>
              <TouchableOpacity
                style={styles.rejectBtn}
                onPress={() => rejectPayment(item.id)}
              >
                <Text style={styles.rejectBtnText}>Reject</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.approveBtn}
                onPress={() => approvePayment(item.id)}
              >
                <Text style={styles.approveBtnText}>Approve</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <Text style={styles.verifiedText}>
              {item.status === 'APPROVED' ? '✓ Verified in Ledger' : '✕ Rejected'}
            </Text>
          )}
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={requests}
        keyExtractor={(item) => item.id}
        renderItem={renderReq}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.gold.primary} />}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <View style={styles.listHeader}>
            <Text style={styles.headerTitle}>Online Payment Verifications</Text>
            <Text style={styles.headerSub}>
              Review UTR and transaction references submitted by customers
            </Text>
          </View>
        }
        ListEmptyComponent={
          <View style={{ alignItems: 'center', justifyContent: 'center', padding: 40 }}>
            <Ionicons name="shield-checkmark-outline" size={48} color={Colors.neutral[400]} />
            <Text style={{ marginTop: 12, fontSize: 15, fontWeight: '700', color: Colors.textSecondary }}>
              No Pending Payment Requests
            </Text>
            <Text style={{ marginTop: 4, fontSize: 13, color: Colors.textMuted, textAlign: 'center' }}>
              When members submit online UPI or bank deposit proofs, they will appear here for verification.
            </Text>
          </View>
        }
      />

      {/* Screenshot Preview Modal */}
      {viewingProof && (
        <Modal visible transparent animationType="fade" onRequestClose={() => setViewingProof(null)}>
          <View style={styles.modalOverlay}>
            <View style={styles.proofModalCard}>
              <View style={styles.proofModalHeader}>
                <View>
                  <Text style={styles.proofModalTitle}>Payment Proof</Text>
                  <Text style={styles.proofModalSub}>
                    {viewingProof.customerName} • {formatCurrency(viewingProof.amount)}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => setViewingProof(null)}>
                  <Ionicons name="close-circle" size={24} color={Colors.neutral[600]} />
                </TouchableOpacity>
              </View>

              <View style={styles.proofImageWrapper}>
                <Image
                  source={{ uri: viewingProof.paymentScreenshot || viewingProof.screenshotUrl }}
                  style={styles.fullProofImage}
                  resizeMode="contain"
                />
              </View>

              <View style={styles.proofDetailsRow}>
                <Text style={styles.proofMetaText}>Ref: {viewingProof.referenceNumber}</Text>
                <Text style={styles.proofMetaText}>Mode: {viewingProof.paymentMode}</Text>
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
    backgroundColor: Colors.secondary[50],
  },
  listContent: {
    padding: 16,
    gap: 12,
  },
  listHeader: {
    marginBottom: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.secondary[900],
  },
  headerSub: {
    fontSize: 12,
    color: Colors.secondary[500],
    marginTop: 2,
  },
  card: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.secondary[200],
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  custName: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.secondary[900],
  },
  metaText: {
    fontSize: 12,
    color: Colors.secondary[500],
    marginTop: 1,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  badgePending: { backgroundColor: Colors.warningLight },
  badgeApproved: { backgroundColor: Colors.successLight },
  badgeRejected: { backgroundColor: Colors.dangerLight },
  statusText: { fontSize: 10, fontWeight: '700' },
  textPending: { color: Colors.warning },
  textApproved: { color: Colors.success },
  textRejected: { color: Colors.danger },
  divider: {
    height: 1,
    backgroundColor: Colors.secondary[100],
    marginVertical: 12,
  },
  infoGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  infoCol: {
    flex: 1,
  },
  label: {
    fontSize: 10,
    color: Colors.secondary[400],
    textTransform: 'uppercase',
    fontWeight: '700',
  },
  val: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.secondary[800],
    marginTop: 2,
  },
  valHighlight: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.primary[700],
    marginTop: 2,
  },
  refText: {
    fontSize: 11,
    color: Colors.secondary[500],
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingTop: 8,
    borderTopWidth: 1,
    borderColor: Colors.secondary[100],
  },
  amountLabel: {
    fontSize: 10,
    color: Colors.secondary[500],
    textTransform: 'uppercase',
  },
  amountVal: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.success,
  },
  btnRow: {
    flexDirection: 'row',
    gap: 8,
  },
  rejectBtn: {
    backgroundColor: Colors.dangerLight,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  rejectBtnText: {
    color: Colors.danger,
    fontSize: 12,
    fontWeight: '700',
  },
  approveBtn: {
    backgroundColor: Colors.success,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 6,
  },
  approveBtnText: {
    color: Colors.white,
    fontSize: 12,
    fontWeight: '700',
  },
  verifiedText: {
    fontSize: 12,
    color: Colors.secondary[500],
    fontWeight: '600',
  },
  proofBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#bbf7d0',
    borderRadius: 8,
    padding: 8,
    marginVertical: 10,
  },
  proofThumb: {
    width: 38,
    height: 38,
    borderRadius: 6,
    backgroundColor: '#e2e8f0',
  },
  proofBtnTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#166534',
  },
  proofBtnSub: {
    fontSize: 10,
    color: '#15803d',
    marginTop: 1,
  },
  noProofBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    marginVertical: 4,
  },
  noProofText: {
    fontSize: 11,
    color: Colors.neutral[400],
    fontStyle: 'italic',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  proofModalCard: {
    width: '100%',
    maxHeight: '85%',
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 8,
  },
  proofModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderColor: Colors.neutral[200],
  },
  proofModalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.neutral[900],
  },
  proofModalSub: {
    fontSize: 12,
    color: Colors.neutral[500],
    marginTop: 2,
  },
  proofImageWrapper: {
    width: '100%',
    height: 380,
    backgroundColor: '#0f172a',
    borderRadius: 10,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullProofImage: {
    width: '100%',
    height: '100%',
  },
  proofDetailsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingTop: 8,
    borderTopWidth: 1,
    borderColor: Colors.neutral[200],
  },
  proofMetaText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.neutral[600],
  },
});
