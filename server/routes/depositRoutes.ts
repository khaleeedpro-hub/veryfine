import { Router, Response } from 'express';
import { adminDb } from '../firebase/admin';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import { executeFinancialTransaction, createNotification } from '../services/ledgerService';

const router = Router();

// GET /api/deposits/history - Get user deposit history
router.get('/history', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const snap = await adminDb
      .collection('deposits')
      .where('userId', '==', userId)
      .get();

    const history = snap.docs
      .map((doc) => {
        const d = doc.data();
        return {
          id: d.depositId || doc.id,
          user_id: d.userId,
          amount: d.amount,
          payment_method: d.paymentProvider || 'USD Gateway',
          status: d.status,
          created_at: d.createdAt,
        };
      })
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    res.json(history);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch deposit history.' });
  }
});

// POST /api/deposits/create - Initiate USD deposit
router.post('/create', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { amount, paymentMethod } = req.body;
    const userId = req.user!.id;

    const depositAmount = Number(amount);
    if (isNaN(depositAmount) || depositAmount < 10) {
      res.status(400).json({ error: 'Minimum deposit amount is $10.00 USD.' });
      return;
    }

    const depositId = `DEP-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const now = new Date().toISOString();

    await adminDb.collection('deposits').doc(depositId).set({
      depositId,
      userId,
      amount: depositAmount,
      currency: 'USD',
      paymentProvider: paymentMethod || 'USD Bank Transfer / Crypto Gateway',
      providerReference: `MOCK-REF-${Date.now()}`,
      status: 'pending',
      fee: 0.0,
      createdAt: now,
      updatedAt: now,
    });

    res.status(201).json({
      depositId,
      amount: depositAmount,
      status: 'pending',
      paymentInstructions: `Please transfer $${depositAmount.toFixed(
        2
      )} USD using reference code ${depositId}`,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to initiate deposit.' });
  }
});

// POST /api/deposits/complete - Process deposit completion (Mock Gateway / Webhook)
router.post('/complete', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { depositId } = req.body;
    const userId = req.user!.id;

    if (!depositId) {
      res.status(400).json({ error: 'Deposit ID is required.' });
      return;
    }

    const depRef = adminDb.collection('deposits').doc(depositId);
    const depSnap = await depRef.get();

    if (!depSnap.exists) {
      res.status(404).json({ error: 'Deposit record not found.' });
      return;
    }

    const deposit = depSnap.data()!;
    if (deposit.userId !== userId && req.user!.role !== 'admin') {
      res.status(403).json({ error: 'Unauthorized.' });
      return;
    }

    if (deposit.status === 'completed') {
      res.status(400).json({ error: 'This deposit has already been processed.' });
      return;
    }

    const now = new Date().toISOString();

    // Execute Ledger Transaction
    const txnResult = await executeFinancialTransaction({
      userId: deposit.userId,
      type: 'DEPOSIT',
      amount: Number(deposit.amount),
      referenceId: depositId,
      description: `USD Deposit via ${deposit.paymentProvider || 'USD Gateway'}`,
    });

    // Update Deposit Doc
    await depRef.update({
      status: 'completed',
      transactionId: txnResult.transactionId,
      updatedAt: now,
    });

    await createNotification(
      deposit.userId,
      'DEPOSIT',
      'Deposit Credited! 💵',
      `+$${Number(deposit.amount).toFixed(2)} USD deposit completed successfully.`
    );

    res.json({
      message: `Deposit of $${Number(deposit.amount).toFixed(2)} credited!`,
      depositId,
      transactionId: txnResult.transactionId,
      newAvailableBalance: txnResult.balanceAfter,
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Failed to complete deposit.' });
  }
});

export default router;
