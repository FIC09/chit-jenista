import { Request, Response, NextFunction } from 'express';
import { WithdrawalRequestModel } from './withdrawal-request.model';

export class PayoutController {
  // Public/Customer endpoints for prize claims
  static async createWithdrawalRequest(req: Request, res: Response, next: NextFunction) {
    try {
      const data = req.body;
      if (!data.id) {
        data.id = `WDR-${Date.now().toString().slice(-6)}`;
      }
      const created = await WithdrawalRequestModel.findOneAndUpdate(
        { id: data.id },
        { $set: data },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
      res.status(201).json({ success: true, data: created });
    } catch (error) {
      next(error);
    }
  }

  static async getWithdrawalRequests(req: Request, res: Response, next: NextFunction) {
    try {
      const { customerId, status } = req.query;
      const query: any = {};
      if (customerId) query.customerId = customerId;
      if (status) query.status = status;
      const list = await WithdrawalRequestModel.find(query).sort({ createdAt: -1 });
      res.status(200).json({ success: true, data: list });
    } catch (error) {
      next(error);
    }
  }

  static async updateWithdrawalRequestStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const updated = await WithdrawalRequestModel.findOneAndUpdate(
        { id },
        { $set: req.body },
        { new: true }
      );
      res.status(200).json({ success: true, data: updated });
    } catch (error) {
      next(error);
    }
  }
}
