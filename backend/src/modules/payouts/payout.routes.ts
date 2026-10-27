import { Router } from 'express';
import { PayoutController } from './payout.controller';

const router = Router();

// Public/Customer accessible routes for withdrawal requests
router.post('/requests', PayoutController.createWithdrawalRequest);
router.get('/requests', PayoutController.getWithdrawalRequests);
router.patch('/requests/:id', PayoutController.updateWithdrawalRequestStatus);

export default router;
