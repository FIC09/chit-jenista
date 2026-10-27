"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const morgan_1 = __importDefault(require("morgan"));
const errorHandler_1 = require("./middleware/errorHandler");
const auth_routes_1 = __importDefault(require("./modules/auth/auth.routes"));
const user_routes_1 = __importDefault(require("./modules/users/user.routes"));
const role_routes_1 = __importDefault(require("./modules/roles/role.routes"));
const company_routes_1 = __importDefault(require("./modules/companies/company.routes"));
const branch_routes_1 = __importDefault(require("./modules/branches/branch.routes"));
const customer_routes_1 = __importDefault(require("./modules/customers/customer.routes"));
const agent_routes_1 = __importDefault(require("./modules/agents/agent.routes"));
const staff_routes_1 = __importDefault(require("./modules/staff/staff.routes"));
const chit_plan_routes_1 = __importDefault(require("./modules/chit-plans/chit-plan.routes"));
const chit_group_routes_1 = __importDefault(require("./modules/chit-groups/chit-group.routes"));
const installment_routes_1 = __importDefault(require("./modules/installments/installment.routes"));
const payment_routes_1 = __importDefault(require("./modules/payments/payment.routes"));
const receipt_routes_1 = __importDefault(require("./modules/receipts/receipt.routes"));
const fixed_plan_routes_1 = __importDefault(require("./modules/fixed-plans/fixed-plan.routes"));
const auction_routes_1 = __importDefault(require("./modules/auctions/auction.routes"));
const ledger_routes_1 = __importDefault(require("./modules/ledgers/ledger.routes"));
const document_routes_1 = __importDefault(require("./modules/documents/document.routes"));
const notification_routes_1 = __importDefault(require("./modules/notifications/notification.routes"));
const analytics_routes_1 = __importDefault(require("./modules/analytics/analytics.routes"));
const reports_routes_1 = __importDefault(require("./modules/reports/reports.routes"));
const payout_routes_1 = __importDefault(require("./modules/payouts/payout.routes"));
const app = (0, express_1.default)();
// Middleware
app.use((0, helmet_1.default)());
app.use((0, cors_1.default)());
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true }));
// Logging
if (process.env.NODE_ENV === 'development') {
    app.use((0, morgan_1.default)('dev'));
}
// Health check
app.get('/health', (req, res) => {
    res.status(200).json({ success: true, message: 'Server is healthy' });
});
// API Routes
app.use('/api/v1/auth', auth_routes_1.default);
app.use('/api/v1/users', user_routes_1.default);
app.use('/api/v1/roles', role_routes_1.default);
app.use('/api/v1/companies', company_routes_1.default);
app.use('/api/v1/branches', branch_routes_1.default);
app.use('/api/v1/customers', customer_routes_1.default);
app.use('/api/v1/agents', agent_routes_1.default);
app.use('/api/v1/staff', staff_routes_1.default);
app.use('/api/v1/plans', chit_plan_routes_1.default);
app.use('/api/v1/chit-groups', chit_group_routes_1.default);
app.use('/api/v1/installments', installment_routes_1.default);
app.use('/api/v1/payments', payment_routes_1.default);
app.use('/api/v1/receipts', receipt_routes_1.default);
app.use('/api/v1/fixed-plans', fixed_plan_routes_1.default);
app.use('/api/v1/auctions', auction_routes_1.default);
app.use('/api/v1/ledgers', ledger_routes_1.default);
app.use('/api/v1/documents', document_routes_1.default);
app.use('/api/v1/notifications', notification_routes_1.default);
app.use('/api/v1/analytics', analytics_routes_1.default);
app.use('/api/v1/reports', reports_routes_1.default);
app.use('/api/v1/payouts', payout_routes_1.default);
// Fallback aliases for root paths
app.use('/customers', customer_routes_1.default);
app.use('/auth', auth_routes_1.default);
// Error Handler
app.use(errorHandler_1.errorHandler);
exports.default = app;
