import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { errorHandler } from './middleware/errorHandler';

import authRoutes from './modules/auth/auth.routes';
import userRoutes from './modules/users/user.routes';
import roleRoutes from './modules/roles/role.routes';
import companyRoutes from './modules/companies/company.routes';
import branchRoutes from './modules/branches/branch.routes';
import customerRoutes from './modules/customers/customer.routes';
import agentRoutes from './modules/agents/agent.routes';
import staffRoutes from './modules/staff/staff.routes';
import chitPlanRoutes from './modules/chit-plans/chit-plan.routes';
import chitGroupRoutes from './modules/chit-groups/chit-group.routes';
import installmentRoutes from './modules/installments/installment.routes';
import paymentRoutes from './modules/payments/payment.routes';
import receiptRoutes from './modules/receipts/receipt.routes';
import fixedPlanRoutes from './modules/fixed-plans/fixed-plan.routes';
import auctionRoutes from './modules/auctions/auction.routes';
import ledgerRoutes from './modules/ledgers/ledger.routes';
import documentRoutes from './modules/documents/document.routes';
import notificationRoutes from './modules/notifications/notification.routes';
import analyticsRoutes from './modules/analytics/analytics.routes';
import reportsRoutes from './modules/reports/reports.routes';
import payoutRoutes from './modules/payouts/payout.routes';

const app = express();

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Logging
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({ success: true, message: 'Server is healthy' });
});

// API Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/roles', roleRoutes);
app.use('/api/v1/companies', companyRoutes);
app.use('/api/v1/branches', branchRoutes);
app.use('/api/v1/customers', customerRoutes);
app.use('/api/v1/agents', agentRoutes);
app.use('/api/v1/staff', staffRoutes);
app.use('/api/v1/plans', chitPlanRoutes);
app.use('/api/v1/chit-groups', chitGroupRoutes);
app.use('/api/v1/installments', installmentRoutes);
app.use('/api/v1/payments', paymentRoutes);
app.use('/api/v1/receipts', receiptRoutes);
app.use('/api/v1/fixed-plans', fixedPlanRoutes);
app.use('/api/v1/auctions', auctionRoutes);
app.use('/api/v1/ledgers', ledgerRoutes);
app.use('/api/v1/documents', documentRoutes);
app.use('/api/v1/notifications', notificationRoutes);
app.use('/api/v1/analytics', analyticsRoutes);
app.use('/api/v1/reports', reportsRoutes);
app.use('/api/v1/payouts', payoutRoutes);

// Fallback aliases for root paths
app.use('/customers', customerRoutes);
app.use('/auth', authRoutes);

// Error Handler
app.use(errorHandler);

export default app;
