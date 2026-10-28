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
      <StatusBar barStyle="dark-content" />

      {/* Summary Header - Funds Genie Teal Banner */}
      <View style={styles.summaryBox}>
        <View style={styles.summaryTopRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.schemeName}>
              {scheduleSummary.groupName}
            </Text>
            <Text style={styles.schemeSub}>
              {scheduleSummary.scheme || 'Auction'} Scheme • 20 Months Cycle
            </Text>
          </View>
          <View style={styles.chitValueBadge}>
            <Text style={styles.chitValueLabel}>CHIT VALUE</Text>
            <Text style={styles.chitValueText}>{formatCurrency(scheduleSummary.chitValue)}</Text>
          </View>
        </View>

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
            <Text style={styles.sumValGreen}>
              {formatCurrency(scheduleSummary.totalPaidAmount)}
            </Text>
          </View>
          <View style={styles.vLine} />
          <View style={styles.sumCol}>
            <Text style={styles.sumLabel}>BALANCE DUES</Text>
            <Text style={styles.sumValOrange}>
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
    backgroundColor: '#F9FBFB',
  },
  summaryBox: {
    backgroundColor: '#0C8A7D',
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 8,
    borderRadius: 18,
    padding: 18,
    shadowColor: '#0C8A7D',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 3,
  },
  summaryTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  schemeName: {
    fontSize: 17,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.2,
  },
  schemeSub: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 2,
    fontWeight: '600',
  },
  chitValueBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    alignItems: 'flex-end',
  },
  chitValueLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: 'rgba(255, 255, 255, 0.85)',
  },
  chitValueText: {
    fontSize: 13,
    color: '#FFFFFF',
    fontWeight: '800',
    marginTop: 1,
  },
  summaryGrid: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.18)',
  },
  sumCol: {
    flex: 1,
    alignItems: 'center',
  },
  sumLabel: {
    fontSize: 10,
    color: 'rgba(255, 255, 255, 0.75)',
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  sumVal: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
    marginTop: 2,
  },
  sumValGreen: {
    fontSize: 14,
    fontWeight: '800',
    color: '#D1FAE5',
    marginTop: 2,
  },
  sumValOrange: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FEF3C7',
    marginTop: 2,
  },
  vLine: {
    width: 1,
    height: 26,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 32,
    gap: 10,
  },
  rowCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#D8E4E5',
  },
  monthHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  monthPill: {
    backgroundColor: '#E8F5F3',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  monthPillText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0C8A7D',
  },
  dueDateText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#7E9596',
  },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  pillSuccess: { backgroundColor: '#D1FAE5' },
  pillWarning: { backgroundColor: '#FEF3C7' },
  pillDanger: { backgroundColor: '#FEE2E2' },
  pillNeutral: { backgroundColor: '#F1F5F9' },
  statusText: { fontSize: 10, fontWeight: '800' },
  textSuccess: { color: '#065F46' },
  textWarning: { color: '#92400E' },
  textDanger: { color: '#991B1B' },
  textNeutral: { color: '#64748B' },
  cardDivider: {
    height: 1,
    backgroundColor: '#F0F5F5',
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
    fontWeight: '700',
    color: '#7E9596',
    textTransform: 'uppercase',
  },
  colValue: {
    fontSize: 13,
    fontWeight: '800',
    color: '#133336',
    marginTop: 2,
  },
});
