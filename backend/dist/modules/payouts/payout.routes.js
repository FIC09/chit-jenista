"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const payout_controller_1 = require("./payout.controller");
const router = (0, express_1.Router)();
// Public/Customer accessible routes for withdrawal requests
router.post('/requests', payout_controller_1.PayoutController.createWithdrawalRequest);
router.get('/requests', payout_controller_1.PayoutController.getWithdrawalRequests);
router.patch('/requests/:id', payout_controller_1.PayoutController.updateWithdrawalRequestStatus);
exports.default = router;
