import React, { useMemo, useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  StatusBar,
} from 'react-native';
import { Colors } from '../../theme/colors';
import { buildCustomerChitSchedule, DueInstallmentRow } from '../../utils/customerChitSchedule';
import { formatCurrency } from '../../utils/format';
import { DataSyncManager } from '../../services/dataSync';

export const CustomerScheduleScreen: React.FC<{ route: any }> = ({ route }) => {
  const customer = route.params?.customer || {};
  const chit = route.params?.chit || customer.chits?.[0] || {
    groupId: route.params?.groupId || 'CHIT-SCHEME',
    groupName: route.params?.groupName || 'Chit Scheme',
    chitValue: customer.chitValue || 100000,
    duration: 20,
    scheme: 'Auction',
  };

  const [ledgerTransactions, setLedgerTransactions] = useState<any[]>([]);

  useEffect(() => {
    DataSyncManager.getLedgerTransactions().then((txs) => {
      setLedgerTransactions(txs || []);
    });
  }, []);

  const scheduleSummary = useMemo(() => {
    return buildCustomerChitSchedule({
      customer,
      chit,
      ledgerTransactions,
    });
  }, [customer, chit, ledgerTransactions]);

  const renderMonthItem = ({ item }: { item: DueInstallmentRow }) => {
    const isPaid = item.status === 'PAID';
    const isPartial = item.status === 'PARTIALLY_PAID';
    const isOverdue = item.status === 'OVERDUE';

    return (
      <View style={styles.rowCard}>
        <View style={styles.monthHeader}>
          <View style={styles.monthPill}>
            <Text style={styles.monthPillText}>Month {item.monthNumber}</Text>
          </View>
          <Text style={styles.dueDateText}>Due: {item.dueDate}</Text>
          <View
            style={[
              styles.statusPill,
              isPaid
                ? styles.pillSuccess
                : isPartial
                ? styles.pillWarning
                : isOverdue
                ? styles.pillDanger
                : styles.pillNeutral,
            ]}
          >
            <Text
              style={[
                styles.statusText,
                isPaid
                  ? styles.textSuccess
                  : isPartial
                  ? styles.textWarning
                  : isOverdue
                  ? styles.textDanger
                  : styles.textNeutral,
              ]}
            >
              {item.status}
            </Text>
          </View>
        </View>

        <View style={styles.cardDivider} />

        <View style={styles.rowDetails}>
          <View style={styles.col}>
            <Text style={styles.colLabel}>Monthly Due</Text>
            <Text style={styles.colValue}>{formatCurrency(item.revisedDue)}</Text>
          </View>
          <View style={styles.col}>
            <Text style={styles.colLabel}>Amount Paid</Text>
            <Text
              style={[
                styles.colValue,
                { color: isPaid ? Colors.success : Colors.text },
              ]}
            >
              {formatCurrency(item.amountPaid)}
            </Text>
          </View>
          <View style={styles.col}>
            <Text style={styles.colLabel}>Eligible Prize</Text>
            <Text style={[styles.colValue, { color: Colors.gold.text }]}>
              {formatCurrency(item.eligiblePayout)}
            </Text>
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Summary Header */}
      <View style={styles.summaryBox}>
        <Text style={styles.schemeName}>
          {scheduleSummary.groupName} • {scheduleSummary.scheme} Chit
        </Text>
        <Text style={styles.chitValueText}>
          Total Chit Value: {formatCurrency(scheduleSummary.chitValue)}
        </Text>

        <View style={styles.summaryGrid}>
          <View style={styles.sumCol}>
            <Text style={styles.sumLabel}>COMPLETED</Text>
            <Text style={styles.sumVal}>
              {scheduleSummary.completedMonthsCount}/{scheduleSummary.totalDurationMonths} M
            </Text>
          </View>
          <View style={styles.vLine} />
          <View style={styles.sumCol}>
            <Text style={styles.sumLabel}>TOTAL PAID</Text>
            <Text style={[styles.sumVal, { color: '#34D399' }]}>
              {formatCurrency(scheduleSummary.totalPaidAmount)}
            </Text>
          </View>
          <View style={styles.vLine} />
          <View style={styles.sumCol}>
            <Text style={styles.sumLabel}>BALANCE DUES</Text>
            <Text style={[styles.sumVal, { color: '#F87171' }]}>
              {formatCurrency(scheduleSummary.remainingBalanceDue)}
            </Text>
          </View>
        </View>
      </View>

      {/* Schedule Rows */}
      <FlatList
        data={scheduleSummary.schedule}
        keyExtractor={(item) => String(item.monthNumber)}
        renderItem={renderMonthItem}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  summaryBox: {
    backgroundColor: Colors.navy.primary,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 24,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  schemeName: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.white,
    letterSpacing: 0.2,
  },
  chitValueText: {
    fontSize: 13,
    color: Colors.gold.primary,
    marginTop: 2,
    fontWeight: '600',
  },
  summaryGrid: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 18,
    paddingTop: 14,
    borderTopWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  sumCol: {
    flex: 1,
    alignItems: 'center',
  },
  sumLabel: {
    fontSize: 10,
    color: 'rgba(255, 255, 255, 0.65)',
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  sumVal: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.white,
    marginTop: 2,
  },
  vLine: {
    width: 1,
    height: 30,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
  },
  listContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 32,
    gap: 12,
  },
  rowCard: {
    backgroundColor: Colors.surface,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: Colors.navy.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  monthHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  monthPill: {
    backgroundColor: Colors.blueSubtle,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  monthPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.blueAccent,
  },
  dueDateText: {
    fontSize: 11,
    fontWeight: '500',
    color: Colors.textSecondary,
  },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  pillSuccess: { backgroundColor: Colors.successLight },
  pillWarning: { backgroundColor: Colors.warningLight },
  pillDanger: { backgroundColor: Colors.dangerLight },
  pillNeutral: { backgroundColor: Colors.borderLight },
  statusText: { fontSize: 10, fontWeight: '700' },
  textSuccess: { color: Colors.success },
  textWarning: { color: Colors.warning },
  textDanger: { color: Colors.danger },
  textNeutral: { color: Colors.textMuted },
  cardDivider: {
    height: 1,
    backgroundColor: Colors.borderLight,
    marginVertical: 10,
  },
  rowDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  col: {
    flex: 1,
  },
  colLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
  },
  colValue: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.text,
    marginTop: 2,
  },
});
