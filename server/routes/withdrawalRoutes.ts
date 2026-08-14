import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import { adminDb } from '../firebase/admin';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import { executeFinancialTransaction, createNotification } from '../services/ledgerService';

const router = Router();

// GET /api/withdrawals/history - Get user withdrawal history
router.get('/history', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const snap = await adminDb
      .collection('withdrawals')
      .where('userId', '==', userId)
      .get();

    const history = snap.docs
      .map((doc) => {
        const d = doc.data();
        return {
          id: d.withdrawalId || doc.id,
          user_id: d.userId,
          amount: d.amount,
          fee: d.fee || 0,
          net_amount: d.netAmount || d.amount,
          payment_method: d.method,
          payment_details: JSON.stringify(d.paymentDetails || {}),
          status: d.status,
          rejection_reason: d.reviewReason || null,
          created_at: d.createdAt,
        };
      })
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    res.json(history);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch withdrawal history.' });
  }
});

// POST /api/withdrawals/request - Request USD withdrawal
router.post('/request', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { amount, paymentMethod, paymentDetails, pin } = req.body;
    const userId = req.user!.id;

    const requestedAmount = Number(amount);
    if (isNaN(requestedAmount) || requestedAmount < 10) {
      res.status(400).json({ error: 'Minimum withdrawal amount is $10.00 USD.' });
      return;
    }

    if (!paymentMethod || !paymentDetails) {
      res.status(400).json({ error: 'Payment method and account details are required.' });
      return;
    }

    if (!pin || typeof pin !== 'string') {
      res.status(400).json({ error: '4-digit withdrawal PIN is required.' });
      return;
    }

    // 1. Verify User and PIN server-side
    const userSnap = await adminDb.collection('users').doc(userId).get();
    if (!userSnap.exists) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }

    const user = userSnap.data()!;

    // Check PIN cooldown
    if (user.pinResetCooldownUntil) {
      const cooldownEnd = new Date(user.pinResetCooldownUntil).getTime();
      if (Date.now() < cooldownEnd) {
        const remainingHours = Math.ceil((cooldownEnd - Date.now()) / (1000 * 60 * 60));
        res.status(403).json({
          error: `Withdrawals are temporarily locked due to a recent PIN reset cooldown (${remainingHours} hours remaining).`,
        });
        return;
      }
    }

    const isPinMatch = await bcrypt.compare(pin, user.withdrawalPinHash || '');
    if (!isPinMatch) {
      res.status(401).json({ error: 'Incorrect 4-digit withdrawal PIN.' });
      return;
    }

    // 2. Calculate fee (1.5%) & Net
    const fee = Math.round(requestedAmount * 0.015 * 100) / 100;
    const netAmount = Math.round((requestedAmount - fee) * 100) / 100;

    // 3. Execute Ledger Transaction to Reserve Funds
    const txnResult = await executeFinancialTransaction({
      userId,
      type: 'WITHDRAWAL',
      amount: netAmount,
      fee,
      description: `USD Withdrawal Request (${paymentMethod})`,
    });

    // 4. Create Withdrawal Record
    const withdrawalId = `WTD-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const now = new Date().toISOString();

    await adminDb.collection('withdrawals').doc(withdrawalId).set({
      withdrawalId,
      userId,
      amount: requestedAmount,
      currency: 'USD',
      method: paymentMethod,
      paymentDetails,
      status: 'pending',
      fee,
      netAmount,
      riskStatus: 'cleared',
      reviewReason: null,
      createdAt: now,
      updatedAt: now,
    });

    await createNotification(
      userId,
      'WITHDRAWAL',
      'Withdrawal Submitted ⏳',
      `Your withdrawal request of $${requestedAmount.toFixed(
        2
      )} via ${paymentMethod} is being processed.`
    );

    res.status(201).json({
      message: 'Withdrawal request submitted successfully!',
      withdrawalId,
      transactionId: txnResult.transactionId,
      remainingAvailableBalance: txnResult.balanceAfter,
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Failed to submit withdrawal request.' });
  }
});

export default router;
