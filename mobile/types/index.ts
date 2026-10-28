export type UserRole =
  | 'SUPER_ADMIN'
  | 'ADMIN'
  | 'BRANCH_MANAGER'
  | 'STAFF'
  | 'COLLECTION_AGENT'
  | 'ACCOUNTANT'
  | 'CUSTOMER';

export interface AuthUser {
  id: string;
  name: string;
  role: UserRole;
  email?: string;
  phone?: string;
  mobile?: string;
  permissions: string[];
  branchId?: string;
  branch?: string;
  status?: string;
}

export interface ChitPlan {
  id: string;
  title: string;
  type: 'REGULAR' | 'FIXED' | 'AUCTION';
  categories: { id: number; value: number }[];
}

export interface CustomerChit {
  id?: string;
  groupId: string;
  groupName: string;
  chitValue: number;
  duration: number;
  ticketNumber: string;
  scheme: 'Regular' | 'Fixed' | 'Auction';
  monthlyInstallment?: number;
  totalPaid?: number;
  pendingDue?: number;
  paymentStatus?: string;
  joiningDate?: string;
  isWithdrawn?: boolean;
}

export interface Customer {
  id: string;
  mongoId?: string;
  name: string;
  fullName?: string;
  phone?: string;
  mobile?: string;
  aadhar?: string;
  pan?: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  dob?: string;
  gender?: string;
  branch?: string;
  agent?: string;
  referredBy?: string;
  pending: number;
  totalPaid: number;
  activeChits?: number;
  chits: CustomerChit[];
  status: 'ACTIVE' | 'PENDING_APPROVAL' | 'REJECTED' | 'INACTIVE' | 'DEACTIVATED';
  photoUrl?: string;
  aadharUrl?: string;
  panUrl?: string;
}

export interface ChitGroup {
  id: string;
  name: string;
  type: string;
  value: number;
  duration: number;
  currentMonth: number;
  members: number;
  filled: number;
  status: string;
}

export interface LedgerTransaction {
  id: string;
  date: string;
  type: 'CREDIT' | 'DEBIT';
  category: 'INSTALLMENT' | 'DISBURSAL' | 'EXPENSE' | 'COMMISSION';
  amount: number;
  reference: string;
  description: string;
  collectedBy: string;
  paymentMode: string;
  customerId?: string;
  customerName?: string;
  groupId?: string;
  groupName?: string;
}

export interface StaffReceipt {
  receiptNo: string;
  date: string;
  timestamp: string;
  customerId: string;
  customerName: string;
  mobileNumber?: string;
  chitGroup: string;
  monthNumber?: string;
  amount: number;
  mode: string;
  referenceNo?: string;
  executive: string;
  status: 'COLLECTED' | 'HANDED_OVER';
  type: 'COLLECTION' | 'DISBURSAL';
}

export interface PaymentRequest {
  id: string;
  customerId: string;
  customerName: string;
  customerMobile?: string;
  groupId: string;
  groupName?: string;
  ticketNumber?: string;
  amount: number;
  paymentMode: 'UPI' | 'Bank Transfer' | 'Cash';
  referenceNumber: string;
  paymentScreenshot?: string;
  screenshotUrl?: string;
  requestedAt: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  adminNotes?: string;
  approvedAt?: string;
}

export interface CustomerGoal {
  id: string;
  customerId: string;
  title: string; // e.g. "Child's Education", "Child's Marriage", "Buy a Car", "House Construction"
  category: 'EDUCATION' | 'MARRIAGE' | 'HOME' | 'VEHICLE' | 'WEALTH' | 'RETIREMENT' | 'BUSINESS' | 'OTHER';
  targetAmount: number; // e.g. 500000 (5 Lac)
  targetMonths: number; // e.g. 20 Months
  savedAmount?: number; // e.g. 250000
  completedMonths?: number; // e.g. 10
  associatedGroupId?: string;
  iconName?: string;
  notes?: string;
  createdAt: string;
}
