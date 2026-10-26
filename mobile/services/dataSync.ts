import { secureStorage } from './storage';
import { Customer, ChitGroup, PaymentRequest, LedgerTransaction } from '../types';
import { isMockCustomer, isMockGroup } from './cleanMockData';

/**
 * DataSyncManager:
 * Synchronizes and unifies live backend MongoDB records with persistent mobile storage,
 * reproducing the exact state used by the Web Application (Customers, Active Chits, Groups,
 * Ledger entries, Payment Requests, and Bank Accounts).
 */

const LIVE_RENDER_API = 'https://jenista-chits.onrender.com/api/v1';
const LOCAL_API = 'http://192.168.1.39:3000/api/v1'; // Local Wi-Fi address for physical phones & emulators

export const getActiveBaseUrl = async (): Promise<string> => {
  // Test if local backend is reachable first, else fallback smoothly to live Render API
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 1200);
    const res = await fetch(`${LOCAL_API.replace('/api/v1', '')}/health`, {
      signal: controller.signal,
    }).catch(() => null);
    clearTimeout(timeout);
    if (res && res.status === 200) {
      return LOCAL_API;
    }
  } catch {}
  return LIVE_RENDER_API;
};

// Initial Seed Data matching the Web App when backend collections are being initialized
const DEFAULT_COMPANY_BANKS = [
  {
    id: 'BANK-001',
    bankName: 'HDFC Bank',
    accountHolderName: 'Jenista Chits Pvt Ltd',
    accountNumber: '50200084729104',
    ifscCode: 'HDFC0000123',
    branch: 'Thoothukudi Branch',
    accountType: 'CURRENT',
    upiId: 'jenistachits@hdfcbank',
    isDefault: true,
    status: 'ACTIVE',
    totalReceived: 0,
    transactionsCount: 0,
  },
  {
    id: 'BANK-002',
    bankName: 'ICICI Bank',
    accountHolderName: 'Jenista Chits Pvt Ltd',
    accountNumber: '001105023948',
    ifscCode: 'ICIC0000011',
    branch: 'Hosur Branch',
    accountType: 'CURRENT',
    upiId: 'jenistachits@icici',
    isDefault: false,
    status: 'ACTIVE',
    totalReceived: 0,
    transactionsCount: 0,
  },
  {
    id: 'BANK-003',
    bankName: 'State Bank of India',
    accountHolderName: 'Jenista Chits Pvt Ltd',
    accountNumber: '39482019384',
    ifscCode: 'SBIN0001234',
    branch: 'Pudukkottai Branch',
    accountType: 'CURRENT',
    upiId: 'jenistachits@sbi',
    isDefault: false,
    status: 'ACTIVE',
    totalReceived: 0,
    transactionsCount: 0,
  },
];

export const DataSyncManager = {
  /**
   * Sync all customers from MongoDB + local persistent cache
   */
  async getCustomers(): Promise<Customer[]> {
    let mongoCustomers: any[] = [];
    try {
      const baseUrl = await getActiveBaseUrl();
      const res = await fetch(`${baseUrl}/customers`);
      if (res.ok) {
        const json = await res.json();
        if (json && Array.isArray(json.data)) {
          mongoCustomers = json.data;
        }
      }
    } catch (e) {
      console.warn('Backend fetch customers failed, loading from local cache:', e);
    }

    const localSavedStr = await secureStorage.getItem('synced_customers');
    const localSaved: any[] = localSavedStr ? JSON.parse(localSavedStr) : [];

    // Map MongoDB records
    const mappedMongo: Customer[] = mongoCustomers.map((c) => {
      const cPhoneClean = (c.phone || c.mobile || '').replace(/\D/g, '');
      const existing = localSaved.find((l) => {
        const lPhoneClean = (l.phone || l.mobile || '').replace(/\D/g, '');
        return (
          l.id === (c.customerCode || c._id) ||
          l.id === c._id ||
          l.mongoId === c._id ||
          (l.mongoId && c.mongoId && l.mongoId === c.mongoId) ||
          (c.customerCode && l.id === c.customerCode) ||
          (cPhoneClean && lPhoneClean && lPhoneClean === cPhoneClean)
        );
      });

      // Combine MongoDB chits and local chits, preventing duplicate memberships
      const combinedChitsMap = new Map<string, any>();
      // Combine MongoDB chits and local chits, giving precedence to paid statuses
      if (Array.isArray(c.chits)) {
        c.chits.forEach((ch: any) => {
          const key = `${ch.groupId || ch.groupName || ''}-${ch.ticketNumber || ''}`;
          combinedChitsMap.set(key, ch);
        });
      }
      if (Array.isArray(existing?.chits)) {
        existing.chits.forEach((ch: any) => {
          const key = `${ch.groupId || ch.groupName || ''}-${ch.ticketNumber || ''}`;
          const current = combinedChitsMap.get(key) || {};
          // If local or mongo has updated paymentStatus to PAID or higher paidAmount, preserve it
          const localPaidAmt = Number(ch.paidAmount || ch.totalPaid || 0);
          const currentPaidAmt = Number(current.paidAmount || current.totalPaid || 0);
          const isPaid = ch.paymentStatus === 'PAID' || current.paymentStatus === 'PAID';
          const monthly = Number(ch.monthlyInstallment || current.monthlyInstallment || 0);
          const pendingCandidate = Math.min(
            Number(ch.pending !== undefined ? ch.pending : (monthly || 0)),
            Number(current.pending !== undefined ? current.pending : (monthly || 0))
          );
          combinedChitsMap.set(key, {
            ...current,
            ...ch,
            monthlyInstallment: monthly,
            paidAmount: Math.max(localPaidAmt, currentPaidAmt),
            totalPaid: Math.max(localPaidAmt, currentPaidAmt),
            paymentStatus: isPaid ? 'PAID' : (ch.paymentStatus || current.paymentStatus || 'DUE'),
            pending: isPaid ? 0 : (pendingCandidate > 0 ? pendingCandidate : monthly),
          });
        });
      }
      const chits = Array.from(combinedChitsMap.values());

      // Calculate total paid & pending from actual chits
      const calculatedPaidFromChits = chits.reduce(
        (acc: number, ch: any) => acc + Number(ch.totalPaid || ch.paidAmount || 0),
        0
      );
      const totalPaid = Math.max(
        Number(c.totalPaid || 0),
        Number(existing?.totalPaid || 0),
        calculatedPaidFromChits
      );

      const calculatedPendingFromChits = chits.reduce(
        (acc: number, ch: any) =>
          acc + Number(ch.pending !== undefined ? ch.pending : (ch.paymentStatus === 'DUE' ? ch.monthlyInstallment : 0) || 0),
        0
      );
      const pending = chits.length > 0
        ? calculatedPendingFromChits
        : (c.pending !== undefined ? c.pending : (existing?.pending ?? 0));

      return {
        id: c.customerCode || c._id,
        mongoId: c._id,
        name: c.fullName || c.name || 'Member',
        fullName: c.fullName || c.name,
        phone: c.phone || c.mobile || '',
        mobile: c.phone || c.mobile || '',
        aadhar: c.aadhar || existing?.aadhar || '—',
        pan: c.pan || existing?.pan || '—',
        address: c.address || existing?.address || '',
        branch: c.branchId?.branchName || c.branch || 'Head Office',
        pending: Number(pending),
        totalPaid: Number(totalPaid),
        activeChits: chits.length,
        chits,
        status: c.status || 'ACTIVE',
      };
    });

    // Merge any locally added customers that haven't reached mongo yet
    const unmergedLocal = localSaved.filter((loc) => {
      const locPhoneClean = (loc.phone || loc.mobile || '').replace(/\D/g, '');
      return !mappedMongo.some((m) => {
        const mPhoneClean = (m.phone || m.mobile || '').replace(/\D/g, '');
        return (
          m.id === loc.id ||
          (loc.mongoId && m.mongoId === loc.mongoId) ||
          (locPhoneClean && mPhoneClean && locPhoneClean === mPhoneClean)
        );
      });
    });

    const merged = [...mappedMongo, ...unmergedLocal]
      .filter((c) => !isMockCustomer(c))
      .map((c) => ({
        ...c,
        chits: Array.isArray(c.chits) ? c.chits.filter((ch: any) => !isMockGroup(ch)) : [],
      }));

    await secureStorage.setItem('synced_customers', JSON.stringify(merged));
    return merged;
  },

  /**
   * Save or register new customer across backend and persistent mobile cache
   */
  async saveCustomer(customerData: Partial<Customer>): Promise<Customer> {
    let mongoSaved: any = null;
    try {
      const baseUrl = await getActiveBaseUrl();
      const res = await fetch(`${baseUrl}/customers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(customerData),
      });
      if (res.ok) {
        const json = await res.json();
        mongoSaved = json.data;
      }
    } catch (e) {
      console.warn('Backend save customer error:', e);
    }

    const newCustomer: Customer = {
      id: mongoSaved?.customerCode || mongoSaved?._id || `TC-${Math.floor(10000 + Math.random() * 90000)}`,
      mongoId: mongoSaved?._id,
      name: customerData.name || customerData.fullName || 'Member',
      fullName: customerData.fullName || customerData.name,
      phone: customerData.phone || customerData.mobile || '',
      mobile: customerData.mobile || customerData.phone || '',
      aadhar: customerData.aadhar || '—',
      pan: customerData.pan || '—',
      address: customerData.address || '',
      city: customerData.city || '',
      pending: 0,
      totalPaid: 0,
      chits: [],
      status: 'ACTIVE',
    };

    const existing = await this.getCustomers();
    const updated = [newCustomer, ...existing.filter((c) => c.id !== newCustomer.id)];
    await secureStorage.setItem('synced_customers', JSON.stringify(updated));
    return newCustomer;
  },

  /**
   * Sync and discover Chit Groups from all sources
   */
  async getChitGroups(): Promise<ChitGroup[]> {
    const customers = await this.getCustomers();
    const groupMap = new Map<string, ChitGroup>();

    // 1. Discover all active groups populated by enrolled members
    customers.forEach((c) => {
      if (Array.isArray(c.chits)) {
        c.chits.forEach((ch: any) => {
          const gId = String(ch.groupId || ch.groupName || '').trim();
          const gName = String(ch.groupName || ch.groupId || gId).trim();
          if (gId) {
            const existing = groupMap.get(gId.toLowerCase());
            const monthly = Number(ch.monthlyInstallment || 0);
            const val = Number(ch.chitValue || (monthly > 0 ? monthly * 20 : 100000));
            const dur = Number(ch.duration || 20);

            if (!existing) {
              groupMap.set(gId.toLowerCase(), {
                id: gId,
                name: gName,
                type: ch.scheme || (gName.toLowerCase().includes('fix') ? 'Fixed' : 'Auction'),
                value: val,
                duration: dur,
                currentMonth: Number(ch.ticketNumber || 1),
                members: 20,
                filled: 1,
                status: 'ACTIVE',
              });
            } else {
              existing.filled = (existing.filled || 0) + 1;
            }
          }
        });
      }
    });

    // 2. Fetch live groups from MongoDB backend if available
    try {
      const baseUrl = await getActiveBaseUrl();
      const res = await fetch(`${baseUrl}/chit-groups`);
      if (res.ok) {
        const json = await res.json();
        if (json && Array.isArray(json.data)) {
          json.data.forEach((bg: any) => {
            const gId = String(bg.groupCode || bg._id || '').trim();
            const gName = String(bg.groupName || gId).trim();
            if (gId && !isMockGroup({ id: gId, name: gName })) {
              const existing = groupMap.get(gId.toLowerCase());
              if (!existing) {
                groupMap.set(gId.toLowerCase(), {
                  id: gId,
                  name: gName,
                  type: bg.planType || 'Auction',
                  value: Number(bg.value || 100000),
                  duration: Number(bg.duration || 20),
                  currentMonth: 1,
                  members: Number(bg.members || 20),
                  filled: 0,
                  status: bg.status || 'ACTIVE',
                });
              }
            }
          });
        }
      }
    } catch (e) {
      console.warn('Backend fetch chit-groups error:', e);
    }

    // 3. Add saved custom groups from local storage
    const customStored = await secureStorage.getItem('custom_chit_groups');
    if (customStored) {
      try {
        const customGroups: ChitGroup[] = JSON.parse(customStored);
        if (Array.isArray(customGroups)) {
          customGroups.forEach((cg) => {
            if (cg.id && !isMockGroup(cg)) {
              const low = cg.id.toLowerCase();
              if (!groupMap.has(low)) {
                groupMap.set(low, cg);
              }
            }
          });
        }
      } catch {}
    }

    // Filter all groups to ensure no mock groups exist
    const finalGroups = Array.from(groupMap.values()).filter((g) => !isMockGroup(g));
    return finalGroups;
  },

  /**
   * Create and persist a new Chit Group
   */
  async createChitGroup(groupData: Partial<ChitGroup>): Promise<ChitGroup> {
    const newGroup: ChitGroup = {
      id: groupData.id || `CG-${Date.now().toString().slice(-4)}`,
      name: groupData.name || 'New Chit Group',
      type: groupData.type || 'Auction',
      value: Number(groupData.value || 100000),
      duration: Number(groupData.duration || 20),
      currentMonth: 1,
      members: Number(groupData.members || 20),
      filled: 0,
      status: 'ACTIVE',
    };

    let existingCustom: ChitGroup[] = [];
    const customStored = await secureStorage.getItem('custom_chit_groups');
    if (customStored) {
      try {
        existingCustom = JSON.parse(customStored);
      } catch {}
    }

    const updatedCustom = [newGroup, ...existingCustom.filter((g) => g.id !== newGroup.id)];
    await secureStorage.setItem('custom_chit_groups', JSON.stringify(updatedCustom));
    return newGroup;
  },

  /**
   * Enroll a member / customer into a Chit Group
   */
  async enrollMemberToGroup(params: {
    customerId: string;
    groupId: string;
    groupName: string;
    scheme: 'Regular' | 'Fixed' | 'Auction' | string;
    chitValue: number;
    duration: number;
    monthlyInstallment: number;
    customerPhone?: string;
    customerMongoId?: string;
    customerName?: string;
    dueDate?: string;
  }): Promise<void> {
    const customers = await this.getCustomers();
    const targetCleanPhone = (params.customerPhone || '').replace(/\D/g, '');
    let matchedCustomer: Customer | null = null;
    let newChitRecorded: any = null;

    // Normalize scheme to CustomerChit format
    const schemeUpper = (params.scheme || 'Regular').toUpperCase();
    const normalizedScheme: 'Regular' | 'Fixed' | 'Auction' = schemeUpper.includes('FIX')
      ? 'Fixed'
      : schemeUpper.includes('AUC')
      ? 'Auction'
      : 'Regular';

    const updatedCusts = customers.map((c) => {
      const cCleanPhone = (c.phone || c.mobile || '').replace(/\D/g, '');
      const isMatch =
        c.id === params.customerId ||
        c.mongoId === params.customerId ||
        (params.customerMongoId && (c.mongoId === params.customerMongoId || c.id === params.customerMongoId)) ||
        (c as any).customerCode === params.customerId ||
        (targetCleanPhone && cCleanPhone && cCleanPhone === targetCleanPhone);

      if (isMatch) {
        const existingChits = Array.isArray(c.chits) ? c.chits : [];
        const nextTicket = (existingChits.length + 1).toString();
        const effectiveDueDate =
          params.dueDate ||
          new Date(Date.now() + 15 * 86400000).toISOString().split('T')[0];

        const newChit = {
          groupId: params.groupId,
          groupName: params.groupName,
          scheme: normalizedScheme,
          chitValue: params.chitValue,
          duration: params.duration,
          monthlyInstallment: params.monthlyInstallment,
          ticketNumber: nextTicket,
          paymentStatus: 'DUE',
          joinedDate: new Date().toISOString(),
          dueDate: effectiveDueDate,
        };

        newChitRecorded = newChit;
        const updated = {
          ...c,
          pending: (Number(c.pending) || 0) + params.monthlyInstallment,
          chits: [...existingChits, newChit as any],
          activeChits: existingChits.length + 1,
        };
        matchedCustomer = updated;
        return updated;
      }
      return c;
    });

    // If customer wasn't matched in existing customer list, add them
    if (!matchedCustomer) {
      const effectiveDueDate =
        params.dueDate ||
        new Date(Date.now() + 15 * 86400000).toISOString().split('T')[0];

      const newChit = {
        groupId: params.groupId,
        groupName: params.groupName,
        scheme: normalizedScheme,
        chitValue: params.chitValue,
        duration: params.duration,
        monthlyInstallment: params.monthlyInstallment,
        ticketNumber: '1',
        paymentStatus: 'DUE',
        joinedDate: new Date().toISOString(),
        dueDate: effectiveDueDate,
      };
      newChitRecorded = newChit;

      const freshCust: Customer = {
        id: params.customerId,
        mongoId: params.customerMongoId,
        name: params.customerName || 'Member',
        fullName: params.customerName || 'Member',
        phone: params.customerPhone || '',
        mobile: params.customerPhone || '',
        aadhar: '—',
        pan: '—',
        address: '',
        branch: 'Head Office',
        pending: params.monthlyInstallment,
        totalPaid: 0,
        activeChits: 1,
        chits: [newChit as any],
        status: 'ACTIVE',
      };
      matchedCustomer = freshCust;
      updatedCusts.push(freshCust);
    }

    // 1. Save updated customer list to local secureStorage
    await secureStorage.setItem('synced_customers', JSON.stringify(updatedCusts));

    // 2. Ensure group is registered in custom_chit_groups with updated filled count
    try {
      const customStored = await secureStorage.getItem('custom_chit_groups');
      const customGroups: ChitGroup[] = customStored ? JSON.parse(customStored) : [];
      const gIndex = customGroups.findIndex(
        (g) =>
          g.id.toLowerCase() === params.groupId.toLowerCase() ||
          g.name.toLowerCase() === params.groupName.toLowerCase()
      );

      if (gIndex >= 0) {
        customGroups[gIndex].filled = (customGroups[gIndex].filled || 0) + 1;
      } else {
        customGroups.push({
          id: params.groupId,
          name: params.groupName,
          type: (params.scheme as any) || 'Regular',
          value: params.chitValue,
          duration: params.duration,
          currentMonth: 1,
          members: 20,
          filled: 1,
          status: 'ACTIVE',
        });
      }
      await secureStorage.setItem('custom_chit_groups', JSON.stringify(customGroups));
    } catch (e) {
      console.warn('Failed to update custom_chit_groups:', e);
    }

    // 3. Sync to backend MongoDB if customer has a valid MongoDB ID or customerCode
    const targetMongoId =
      (matchedCustomer as any)?.mongoId ||
      (params.customerMongoId && params.customerMongoId.length === 24 ? params.customerMongoId : null) ||
      (params.customerId && params.customerId.length === 24 ? params.customerId : null);

    if (targetMongoId) {
      try {
        const baseUrl = await getActiveBaseUrl();
        const payload = {
          chits: (matchedCustomer as any)?.chits || (newChitRecorded ? [newChitRecorded] : []),
          pending: (matchedCustomer as any)?.pending,
        };
        await fetch(`${baseUrl}/customers/${targetMongoId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } catch (err) {
        console.warn('Backend sync chit to customer PATCH failed (saved locally):', err);
      }
    }
  },

  /**
   * Get and persist Ledger Transactions
   */
  async getLedgerTransactions(): Promise<LedgerTransaction[]> {
    const raw = await secureStorage.getItem('synced_ledger');
    if (raw) {
      try {
        return JSON.parse(raw);
      } catch {}
    }

    const emptyLedger: LedgerTransaction[] = [];
    return emptyLedger;
  },

  /**
   * Record new receipt / installment payment into Ledger
   */
  async recordReceipt(receiptData: {
    receiptNo: string;
    customerId: string;
    customerName: string;
    chitGroup: string;
    amount: number;
    paymentMode: string;
    referenceNo?: string;
    executive?: string;
  }): Promise<void> {
    const ledger = await this.getLedgerTransactions();
    // Update customer's paid & pending balances and chit payment status
    const customers = await this.getCustomers();
    const cleanReceiptPhone = (receiptData.customerId || '').replace(/\D/g, '');
    let targetMongoId: string | null = null;
    let customerPayload: any = null;

    // Resolve matched customer & group names
    let resolvedCustomerName = receiptData.customerName || '';
    let resolvedCustomerId = receiptData.customerId || '';
    let resolvedGroupName = receiptData.chitGroup || '';
    let resolvedGroupId = receiptData.chitGroup || '';

    const matchedCust = customers.find((c) => {
      const cPhone = (c.phone || c.mobile || '').replace(/\D/g, '');
      return (
        c.id === receiptData.customerId ||
        c.mongoId === receiptData.customerId ||
        (cleanReceiptPhone && cPhone && cleanReceiptPhone === cPhone) ||
        (c.name && receiptData.customerName && c.name.toLowerCase() === receiptData.customerName.toLowerCase()) ||
        (c.fullName && receiptData.customerName && c.fullName.toLowerCase() === receiptData.customerName.toLowerCase())
      );
    });

    if (matchedCust) {
      resolvedCustomerName = matchedCust.name || matchedCust.fullName || resolvedCustomerName;
      resolvedCustomerId = matchedCust.id || matchedCust.mongoId || resolvedCustomerId;

      // Match group name from customer's chits if receiptData.chitGroup is empty or matches
      if (Array.isArray(matchedCust.chits) && matchedCust.chits.length > 0) {
        const matchingChit = receiptData.chitGroup
          ? matchedCust.chits.find(
              (ch: any) =>
                String(ch.groupId || '').toLowerCase() === receiptData.chitGroup.toLowerCase() ||
                String(ch.groupName || '').toLowerCase() === receiptData.chitGroup.toLowerCase()
            ) || matchedCust.chits[0]
          : matchedCust.chits[0];

        if (matchingChit) {
          resolvedGroupName = matchingChit.groupName || matchingChit.groupId || resolvedGroupName;
          resolvedGroupId = matchingChit.groupId || resolvedGroupId;
        }
      }
    }

    if (!resolvedCustomerName || resolvedCustomerName === 'Member' || /^\d+$/.test(resolvedCustomerName)) {
      if (matchedCust?.name) resolvedCustomerName = matchedCust.name;
    }
    if (!resolvedGroupName) {
      resolvedGroupName = 'Chit Group';
    }

    const entry: LedgerTransaction = {
      id: receiptData.receiptNo,
      date: new Date().toISOString(),
      type: 'CREDIT',
      category: 'INSTALLMENT',
      amount: Number(receiptData.amount),
      reference: `${resolvedCustomerId || receiptData.customerId} / ${resolvedGroupName}`,
      description: `Collection Voucher #${receiptData.receiptNo} - ${resolvedCustomerName}`,
      collectedBy: receiptData.executive || 'Staff Executive',
      paymentMode: receiptData.paymentMode,
      customerId: resolvedCustomerId || receiptData.customerId,
      customerName: resolvedCustomerName,
      groupId: resolvedGroupId,
      groupName: resolvedGroupName,
    };

    const updatedLedger = [entry, ...ledger];
    await secureStorage.setItem('synced_ledger', JSON.stringify(updatedLedger));

    const updatedCusts = customers.map((c) => {
      const cPhone = (c.phone || c.mobile || '').replace(/\D/g, '');
      const isTarget =
        c.id === receiptData.customerId ||
        c.mongoId === receiptData.customerId ||
        (cleanReceiptPhone && cPhone && cleanReceiptPhone === cPhone) ||
        (c.name && receiptData.customerName && c.name.toLowerCase() === receiptData.customerName.toLowerCase()) ||
        (c.fullName && receiptData.customerName && c.fullName.toLowerCase() === receiptData.customerName.toLowerCase());

      if (isTarget) {
        targetMongoId = c.mongoId || c.id;
        const newPaid = Number(c.totalPaid || 0) + Number(receiptData.amount);
        const newPending = Math.max(0, Number(c.pending || 0) - Number(receiptData.amount));

        const updatedChits = Array.isArray(c.chits)
          ? c.chits.map((ch: any) => {
              const matchesGroup =
                !receiptData.chitGroup ||
                String(ch.groupId || '').toLowerCase() === receiptData.chitGroup.toLowerCase() ||
                String(ch.groupName || '').toLowerCase() === receiptData.chitGroup.toLowerCase();

              if (matchesGroup) {
                const chPaid = Number(ch.paidAmount || ch.totalPaid || 0) + Number(receiptData.amount);
                const chPending = Math.max(0, Number(ch.pending || ch.monthlyInstallment || 0) - Number(receiptData.amount));
                return {
                  ...ch,
                  paidAmount: chPaid,
                  totalPaid: chPaid,
                  pending: chPending,
                  paymentStatus: chPending === 0 ? 'PAID' : 'DUE',
                };
              }
              return ch;
            })
          : [];

        customerPayload = {
          totalPaid: newPaid,
          pending: newPending,
          chits: updatedChits,
        };

        return {
          ...c,
          totalPaid: newPaid,
          pending: newPending,
          chits: updatedChits,
        };
      }
      return c;
    });

    await secureStorage.setItem('synced_customers', JSON.stringify(updatedCusts));

    // Persist to backend MongoDB
    if (targetMongoId && customerPayload) {
      try {
        const baseUrl = await getActiveBaseUrl();
        await fetch(`${baseUrl}/customers/${targetMongoId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(customerPayload),
        });
      } catch (err) {
        console.warn('Could not sync customer payment update to backend:', err);
      }
    }
  },

  /**
   * Get and manage Company Banks
   */
  async getBankAccounts() {
    const raw = await secureStorage.getItem('company_banks');
    if (raw) {
      try {
        return JSON.parse(raw);
      } catch {}
    }
    await secureStorage.setItem('company_banks', JSON.stringify(DEFAULT_COMPANY_BANKS));
    return DEFAULT_COMPANY_BANKS;
  },

  async saveBankAccounts(banks: any[]) {
    await secureStorage.setItem('company_banks', JSON.stringify(banks));
  },
};
