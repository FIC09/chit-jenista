import {
  calculateFixedPlanSchedule,
  calculateAuctionPlanSchedule,
  calculateRegularPlanSchedule,
} from './chitCalculations';

export interface DueInstallmentRow {
  monthNumber: number;
  monthName: string;
  dueDate: string;
  dueDateIso: string;
  grossDue: number;
  revisedDue: number;
  eligiblePayout: number;
  isWithdrawn: boolean;
  status: 'PAID' | 'DUE' | 'PARTIALLY_PAID' | 'OVERDUE';
  amountPaid: number;
  paidOn?: string;
  paymentMode?: string;
  receiptNo?: string;
  referenceNo?: string;
  dividend?: number;
  notes?: string;
}

export interface CustomerChitScheduleSummary {
  customerId: string;
  customerName: string;
  mobile: string;
  groupId: string;
  groupName: string;
  ticketNumber: string;
  scheme: 'Regular' | 'Fixed' | 'Auction';
  chitValue: number;
  totalDurationMonths: number;
  joiningDate: string;
  dueDayOfMonth: number;
  totalDueAmount: number;
  totalPaidAmount: number;
  remainingBalanceDue: number;
  completedMonthsCount: number;
  currentDueMonthIndex: number;
  isWithdrawn: boolean;
  withdrawnAmount?: number;
  withdrawnAt?: string;
  withdrawnRef?: string;
  currentEligiblePrizeAmount: number;
  schedule: DueInstallmentRow[];
}

export const buildCustomerChitSchedule = (params: {
  customer: any;
  chit: any;
  group?: any;
  ledgerTransactions?: any[];
}): CustomerChitScheduleSummary => {
  const { customer, chit, group, ledgerTransactions = [] } = params;

  const customerId = customer?.id || customer?.customerCode || customer?.mongoId || 'CUST';
  const customerName = customer?.name || customer?.fullName || 'Customer';
  const mobile = customer?.mobile || customer?.phone || '—';

  const groupId = chit?.groupId || group?.id || group?.code || 'GROUP';
  const groupName = chit?.groupName || group?.name || groupId;
  const ticketNumber = String(chit?.ticketNumber || '1');

  const chitValue = Number(chit?.chitValue || chit?.amount || group?.value || 100000);
  const totalDurationMonths = Number(chit?.duration || chit?.months || group?.duration || group?.months || 20);

  const rawScheme = String(chit?.scheme || group?.type || 'Auction').toLowerCase();
  const scheme: 'Regular' | 'Fixed' | 'Auction' = rawScheme.includes('fix')
    ? 'Fixed'
    : rawScheme.includes('reg')
    ? 'Regular'
    : 'Auction';

  const isWithdrawn = Boolean(chit?.isWithdrawn || chit?.withdrawn || false);
  const withdrawnAmount = chit?.withdrawnAmount ? Number(chit?.withdrawnAmount) : undefined;
  const withdrawnAt = chit?.withdrawnAt;
  const withdrawnRef = chit?.withdrawnRef;

  const dueDayOfMonth = Number(group?.dueDay || chit?.dueDay || 15);
  const joiningDate = chit?.joiningDate || group?.startDate || new Date().toISOString().split('T')[0];

  let calculatedRows: {
    monthNumber: number;
    grossDue: number;
    revisedDue: number;
    eligiblePayout: number;
    dividend: number;
  }[] = [];

  if (scheme === 'Fixed') {
    const fixedDetails = calculateFixedPlanSchedule(chitValue, totalDurationMonths);
    calculatedRows = fixedDetails.schedule.map((r) => {
      const revisedDue = isWithdrawn ? fixedDetails.postDrawTotalDue : r.due;
      return {
        monthNumber: r.month,
        grossDue: r.due,
        revisedDue,
        eligiblePayout: r.payout,
        dividend: 0,
      };
    });
  } else if (scheme === 'Regular') {
    const regDetails = calculateRegularPlanSchedule(chitValue, totalDurationMonths);
    calculatedRows = regDetails.schedule.map((r) => {
      const revisedDue = isWithdrawn ? regDetails.grossDue : r.due;
      return {
        monthNumber: r.month,
        grossDue: regDetails.grossDue,
        revisedDue,
        eligiblePayout: r.payment,
        dividend: r.dividend,
      };
    });
  } else {
    const auctionDetails = calculateAuctionPlanSchedule(chitValue, totalDurationMonths);
    calculatedRows = auctionDetails.schedule.map((r) => {
      const revisedDue = isWithdrawn ? auctionDetails.grossDue : r.netDue;
      return {
        monthNumber: r.month,
        grossDue: auctionDetails.grossDue,
        revisedDue,
        eligiblePayout: r.payout,
        dividend: r.dividend,
      };
    });
  }

  // Filter ledger transactions for this customer & chit
  const cleanMobile = (mobile || '').replace(/\D/g, '');
  const cName = (customerName || '').toLowerCase();
  const cId = String(customerId).toLowerCase();
  const gId = String(groupId || '').toLowerCase();
  const gName = String(groupName || '').toLowerCase();

  const relevantCredits = ledgerTransactions.filter((tx: any) => {
    if (tx.type !== 'CREDIT') return false;
    const ref = String(tx.reference || '').toLowerCase();
    const desc = String(tx.description || '').toLowerCase();
    const txCustId = String(tx.customerId || '').toLowerCase();
    const txGroupId = String(tx.groupId || '').toLowerCase();

    const matchesCust =
      (cId && (ref.includes(cId) || desc.includes(cId) || txCustId === cId)) ||
      (cName && (ref.includes(cName) || desc.includes(cName))) ||
      (cleanMobile && (ref.includes(cleanMobile) || desc.includes(cleanMobile)));

    const matchesGroup =
      !groupId ||
      (gId && (ref.includes(gId) || desc.includes(gId) || txGroupId === gId)) ||
      (gName && (ref.includes(gName) || desc.includes(gName)));

    return matchesCust && matchesGroup;
  });

  const ledgerCreditSum = relevantCredits.reduce((s, tx) => s + Number(tx.amount || 0), 0);
  const chitPaid = Number(chit?.paidAmount || chit?.totalPaid || 0);
  const custTotalPaid = Number(customer?.totalPaid || 0);

  // If chit is marked PAID or has paid amount, or ledger has records, use the highest recorded paid sum
  let totalPaidInLedger = Math.max(ledgerCreditSum, chitPaid);
  if (totalPaidInLedger === 0 && chit?.paymentStatus === 'PAID') {
    totalPaidInLedger = Number(chit?.monthlyInstallment || calculatedRows[0]?.revisedDue || Math.round(chitValue / totalDurationMonths));
  } else if (totalPaidInLedger === 0 && custTotalPaid > 0 && (!customer?.chits || customer.chits.length <= 1)) {
    totalPaidInLedger = custTotalPaid;
  }

  let creditPool = totalPaidInLedger;
  const now = new Date();
  let completedMonthsCount = 0;
  let firstUnpaidIndex = -1;

  const scheduleRows: DueInstallmentRow[] = calculatedRows.map((item, idx) => {
    const monthIndex = idx;
    const dateObj = new Date(joiningDate);
    dateObj.setMonth(dateObj.getMonth() + monthIndex);
    dateObj.setDate(dueDayOfMonth);

    const dueDateIso = dateObj.toISOString().split('T')[0];
    const dueDate = dateObj.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
    const monthName = dateObj.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });

    let status: 'PAID' | 'DUE' | 'PARTIALLY_PAID' | 'OVERDUE' = 'DUE';
    let amountPaid = 0;

    if (creditPool >= item.revisedDue) {
      status = 'PAID';
      amountPaid = item.revisedDue;
      creditPool -= item.revisedDue;
      completedMonthsCount++;
    } else if (creditPool > 0) {
      status = 'PARTIALLY_PAID';
      amountPaid = creditPool;
      creditPool = 0;
      if (firstUnpaidIndex === -1) firstUnpaidIndex = item.monthNumber;
    } else {
      amountPaid = 0;
      if (dateObj < now) {
        status = 'OVERDUE';
      } else {
        status = 'DUE';
      }
      if (firstUnpaidIndex === -1) firstUnpaidIndex = item.monthNumber;
    }

    return {
      monthNumber: item.monthNumber,
      monthName,
      dueDate,
      dueDateIso,
      grossDue: item.grossDue,
      revisedDue: item.revisedDue,
      eligiblePayout: item.eligiblePayout,
      isWithdrawn,
      status,
      amountPaid,
      dividend: item.dividend,
    };
  });

  const totalDueAmount = scheduleRows.reduce((sum, r) => sum + r.revisedDue, 0);
  const remainingBalanceDue = Math.max(0, totalDueAmount - totalPaidInLedger);
  const currentDueMonthIndex = firstUnpaidIndex === -1 ? totalDurationMonths : firstUnpaidIndex;

  const currentEligiblePrizeAmount =
    scheduleRows.find((r) => r.monthNumber === currentDueMonthIndex)?.eligiblePayout ||
    calculatedRows[0]?.eligiblePayout ||
    Math.round(chitValue * 0.95);

  return {
    customerId,
    customerName,
    mobile,
    groupId,
    groupName,
    ticketNumber,
    scheme,
    chitValue,
    totalDurationMonths,
    joiningDate,
    dueDayOfMonth,
    totalDueAmount,
    totalPaidAmount: totalPaidInLedger,
    remainingBalanceDue,
    completedMonthsCount,
    currentDueMonthIndex,
    isWithdrawn,
    withdrawnAmount,
    withdrawnAt,
    withdrawnRef,
    currentEligiblePrizeAmount,
    schedule: scheduleRows,
  };
};
