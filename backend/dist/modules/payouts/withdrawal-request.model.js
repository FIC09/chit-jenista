"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.WithdrawalRequestModel = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const WithdrawalRequestSchema = new mongoose_1.Schema({
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
}, { timestamps: true });
WithdrawalRequestSchema.index({ id: 1 });
WithdrawalRequestSchema.index({ customerId: 1 });
WithdrawalRequestSchema.index({ status: 1 });
exports.WithdrawalRequestModel = mongoose_1.default.model('WithdrawalRequest', WithdrawalRequestSchema);
