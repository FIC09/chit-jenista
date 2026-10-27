import mongoose, { Schema, Document } from 'mongoose';

export interface IWithdrawalRequest extends Document {
  id: string;
  customerId: string;
  customerName: string;
  mobile?: string;
  groupId: string;
  groupName?: string;
  ticketNumber?: string;
  chitValue?: number;
  eligibleAmount: number;
  payoutMethod: 'Bank Transfer' | 'UPI';
  payoutDetails?: {
    bankName?: string;
    accountNumber?: string;
    ifsc?: string;
    accountHolderName?: string;
    upiId?: string;
  };
  requestedAt: string;
  status: 'PENDING_ADMIN_DISBURSAL' | 'DISBURSED' | 'REJECTED';
  adminNotes?: string;
  disbursedAt?: string;
  createdAt: Date;
  updatedAt: Date;
}

const WithdrawalRequestSchema: Schema = new Schema(
  {
    id: { type: String, required: true, unique: true },
    customerId: { type: String, required: true },
    customerName: { type: String, required: true },
    mobile: { type: String },
    groupId: { type: String, required: true },
    groupName: { type: String },
    ticketNumber: { type: String },
    chitValue: { type: Number },
    eligibleAmount: { type: Number, required: true },
    payoutMethod: { type: String, enum: ['Bank Transfer', 'UPI'], default: 'Bank Transfer' },
    payoutDetails: {
      bankName: { type: String },
      accountNumber: { type: String },
      ifsc: { type: String },
      accountHolderName: { type: String },
      upiId: { type: String },
    },
    requestedAt: { type: String, default: () => new Date().toISOString() },
    status: {
      type: String,
      enum: ['PENDING_ADMIN_DISBURSAL', 'DISBURSED', 'REJECTED'],
      default: 'PENDING_ADMIN_DISBURSAL',
    },
    adminNotes: { type: String },
    disbursedAt: { type: String },
  },
  { timestamps: true }
);

WithdrawalRequestSchema.index({ id: 1 });
WithdrawalRequestSchema.index({ customerId: 1 });
WithdrawalRequestSchema.index({ status: 1 });

export const WithdrawalRequestModel = mongoose.model<IWithdrawalRequest>('WithdrawalRequest', WithdrawalRequestSchema);
