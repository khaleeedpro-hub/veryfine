import { Router, Response } from 'express';
import { adminDb } from '../firebase/admin';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import { executeFinancialTransaction, createNotification } from '../services/ledgerService';

const router = Router();

// GET /api/transfers/vip-check - Check transfer VIP eligibility
router.get('/vip-check', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    if (req.user!.role === 'admin') {
      res.json({ isEligible: true, vipLevel: 99, planName: 'Admin Override' });
      return;
    }

    const invSnap = await adminDb
      .collection('investments')
      .where('userId', '==', userId)
      .where('vipLevel', '>=', 1)
      .get();

    const activeVip = invSnap.docs
      .map((doc) => doc.data())
      .filter((inv) => inv.status === 'active' || inv.status === 'completed')
      .sort((a, b) => (b.vipLevel || 0) - (a.vipLevel || 0))[0];

    res.json({
      isEligible: Boolean(activeVip),
      vipLevel: activeVip?.vipLevel || 0,
      planName: activeVip?.planName || null,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to verify VIP status.' });
  }
});

// GET /api/transfers/history - Get user transfer history
router.get('/history', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const snap = await adminDb.collection('internalTransfers').get();

    const history = snap.docs
      .map((doc) => doc.data())
      .filter((t) => t.senderUid === userId || t.recipientUid === userId)
      .map((t) => ({
        id: t.transferId || t.id,
        sender_user_id: t.senderUid,
        recipient_user_id: t.recipientUid,
        recipient_wallet_address: t.recipientWalletId,
        amount: t.amount,
        status: t.status,
        created_at: t.createdAt,
        direction: t.senderUid === userId ? 'SENT' : 'RECEIVED',
      }))
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    res.json(history);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch transfer history.' });
  }
});

// POST /api/transfers - Send internal USD transfer
router.post('/', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { recipientWalletAddress, amount } = req.body;
    const senderId = req.user!.id;

    if (!recipientWalletAddress || typeof recipientWalletAddress !== 'string') {
      res.status(400).json({ error: 'Recipient Wallet Address is required.' });
      return;
    }

    const transferAmount = Number(amount);
    if (isNaN(transferAmount) || transferAmount <= 0) {
      res.status(400).json({ error: 'Transfer amount must be greater than zero.' });
      return;
    }

    // 1. VIP Check
    if (req.user!.role !== 'admin') {
      const invSnap = await adminDb
        .collection('investments')
        .where('userId', '==', senderId)
        .where('vipLevel', '>=', 1)
        .get();

      const hasVip = invSnap.docs.some(
        (doc) => doc.data().status === 'active' || doc.data().status === 'completed'
      );

      if (!hasVip) {
        res.status(403).json({
          error:
            'VIP Registration Required: You must be registered to at least VIP 1 before you can perform internal transfers. Please purchase a VIP Plan first.',
        });
        return;
      }
    }

    // 2. Daily Limits Check ($50 max per day, max 2 transfers per day)
    const todayStr = new Date().toISOString().split('T')[0];
    const todayTransfersSnap = await adminDb
      .collection('internalTransfers')
      .where('senderUid', '==', senderId)
      .get();

    const todayTransfers = todayTransfersSnap.docs
      .map((d) => d.data())
      .filter((d) => d.createdAt && d.createdAt.startsWith(todayStr));

    const totalTodayAmount = todayTransfers.reduce((sum, t) => sum + Number(t.amount || 0), 0);

    if (todayTransfers.length >= 2) {
      res.status(400).json({
        error: 'Daily Transfer Limit Reached: Maximum 2 internal transfers per day.',
      });
      return;
    }

    if (totalTodayAmount + transferAmount > 50) {
      res.status(400).json({
        error: `Daily Limit Exceeded: Maximum $50 total per day. You have already transferred $${totalTodayAmount.toFixed(
          2
        )} today.`,
      });
      return;
    }

    // 3. Find Recipient Wallet
    const cleanAddress = recipientWalletAddress.trim().toUpperCase();
    let recipientWalletSnap = await adminDb
      .collection('wallets')
      .where('walletAddress', '==', cleanAddress)
      .limit(1)
      .get();

    // Also support finding by recipient email if wallet address wasn't matched
    if (recipientWalletSnap.empty && cleanAddress.includes('@')) {
      const recipientUserSnap = await adminDb
        .collection('users')
        .where('email', '==', cleanAddress.toLowerCase())
        .limit(1)
        .get();

      if (!recipientUserSnap.empty) {
        const recipientUser = recipientUserSnap.docs[0].data();
        recipientWalletSnap = await adminDb
          .collection('wallets')
          .where('uid', '==', recipientUser.uid)
          .limit(1)
          .get();
      }
    }

    if (recipientWalletSnap.empty) {
      res.status(404).json({ error: 'Recipient wallet address or email not found.' });
      return;
    }

    const recipientWallet = recipientWalletSnap.docs[0].data();
    const recipientUid = recipientWallet.uid;

    if (recipientUid === senderId) {
      res.status(400).json({ error: 'Cannot transfer funds to your own wallet.' });
      return;
    }

    // 4. Execute Sender Debit
    const senderTxn = await executeFinancialTransaction({
      userId: senderId,
      type: 'TRANSFER_SENT',
      amount: transferAmount,
      description: `Internal Transfer Sent to ${cleanAddress}`,
    });

    // 5. Execute Recipient Credit
    const recipientTxn = await executeFinancialTransaction({
      userId: recipientUid,
      type: 'TRANSFER_RECEIVED',
      amount: transferAmount,
      description: `Internal Transfer Received from ${req.user!.email}`,
    });

    // 6. Record Transfer Document
    const transferId = `TRF-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const now = new Date().toISOString();

    await adminDb.collection('internalTransfers').doc(transferId).set({
      transferId,
      senderUid: senderId,
      recipientUid,
      senderWalletId: `wlt-${senderId}`,
      recipientWalletId: recipientWallet.walletId,
      amount: transferAmount,
      currency: 'USD',
      status: 'completed',
      createdAt: now,
      completedAt: now,
    });

    await createNotification(
      senderId,
      'TRANSFER',
      'Transfer Sent 💸',
      `You sent $${transferAmount.toFixed(2)} to wallet ${cleanAddress}.`
    );

    await createNotification(
      recipientUid,
      'TRANSFER',
      'Transfer Received! 💰',
      `You received $${transferAmount.toFixed(2)} internal USD transfer.`
    );

    res.json({
      message: `Successfully transferred $${transferAmount.toFixed(2)}!`,
      transferId,
      transactionId: senderTxn.transactionId,
      remainingAvailableBalance: senderTxn.balanceAfter,
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Failed to process internal transfer.' });
  }
});

export default router;
