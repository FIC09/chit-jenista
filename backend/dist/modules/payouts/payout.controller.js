"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PayoutController = void 0;
const withdrawal_request_model_1 = require("./withdrawal-request.model");
class PayoutController {
    // Public/Customer endpoints for prize claims
    static async createWithdrawalRequest(req, res, next) {
        try {
            const data = req.body;
            if (!data.id) {
                data.id = `WDR-${Date.now().toString().slice(-6)}`;
            }
            const created = await withdrawal_request_model_1.WithdrawalRequestModel.findOneAndUpdate({ id: data.id }, { $set: data }, { upsert: true, new: true, setDefaultsOnInsert: true });
            res.status(201).json({ success: true, data: created });
        }
        catch (error) {
            next(error);
        }
    }
    static async getWithdrawalRequests(req, res, next) {
        try {
            const { customerId, status } = req.query;
            const query = {};
            if (customerId)
                query.customerId = customerId;
            if (status)
                query.status = status;
            const list = await withdrawal_request_model_1.WithdrawalRequestModel.find(query).sort({ createdAt: -1 });
            res.status(200).json({ success: true, data: list });
        }
        catch (error) {
            next(error);
        }
    }
    static async updateWithdrawalRequestStatus(req, res, next) {
        try {
            const { id } = req.params;
            const updated = await withdrawal_request_model_1.WithdrawalRequestModel.findOneAndUpdate({ id }, { $set: req.body }, { new: true });
            res.status(200).json({ success: true, data: updated });
        }
        catch (error) {
            next(error);
        }
    }
}
exports.PayoutController = PayoutController;
