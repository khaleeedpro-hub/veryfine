import { Router, Response } from 'express';
import { adminDb } from '../firebase/admin';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import { executeFinancialTransaction, createNotification } from '../services/ledgerService';
import {
  PLATFORM_RECEIVING_ADDRESS,
  verifyBscTransaction,
  DepositAssetConfig,
} from '../services/bscVerifier';

const router = Router();

/**
 * GET /api/deposits/config
 * Public / Authenticated configuration endpoint returning the platform receiving wallet,
 * network specifications, and active deposit assets.
 */
router.get('/config', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const assetsSnap = await adminDb.collection('depositAssets').get();
    const assets: DepositAssetConfig[] = [];

    assetsSnap.forEach((doc) => {
      const data = doc.data();
      if (data && data.enabled !== false) {
        assets.push(data as DepositAssetConfig);
      }
    });

    // Sort: USDT first, BNB second, USDC third
    assets.sort((a, b) => {
      const order = ['USDT', 'BNB', 'USDC'];
      const indexA = order.indexOf(a.symbol);
      const indexB = order.indexOf(b.symbol);
      if (indexA !== -1 && indexB !== -1) return indexA - indexB;
      if (indexA !== -1) return -1;
      if (indexB !== -1) return 1;
      return a.symbol.localeCompare(b.symbol);
    });

    res.json({
      network: 'BNB Smart Chain (BEP-20)',
      chainId: 56,
      receivingAddress: PLATFORM_RECEIVING_ADDRESS,
      assets,
    });
  } catch (err: any) {
    console.error('[DepositRoutes] Error fetching deposit config:', err);
    res.status(500).json({ error: 'Failed to retrieve deposit configuration.' });
  }
});

/**
 * GET /api/deposits/history
 * Returns full deposit transaction history for the authenticated user
 */
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
          depositId: d.depositId || doc.id,
          userId: d.userId,
          username: d.username,
          walletId: d.walletId,
          network: d.network || 'BNB Smart Chain (BEP-20)',
          asset: d.asset || 'USDT',
          contractAddress: d.contractAddress || '',
          amount: Number(d.amount || 0),
          amountUsd: Number(d.amountUsd || d.amount || 0),
          decimals: d.decimals || 18,
          transactionHash: d.transactionHash || '',
          receivingAddress: d.receivingAddress || PLATFORM_RECEIVING_ADDRESS,
          status: d.status || 'pending',
          confirmations: Number(d.confirmations || 0),
          requiredConfirmations: Number(d.requiredConfirmations || 3),
          blockNumber: d.blockNumber || null,
          fromAddress: d.fromAddress || null,
          toAddress: d.toAddress || null,
          createdAt: d.createdAt,
          verifiedAt: d.verifiedAt || null,
          creditedAt: d.creditedAt || null,
          failureReason: d.failureReason || null,
        };
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    res.json({ deposits: history });
  } catch (err) {
    console.error('[DepositRoutes] Error fetching user deposit history:', err);
    res.status(500).json({ error: 'Failed to fetch deposit history.' });
  }
});

/**
 * GET /api/deposits/:id/status
 * Returns real-time status and confirmation count of a deposit
 */
router.get('/:id/status', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    const depRef = adminDb.collection('deposits').doc(id);
    const depSnap = await depRef.get();

    if (!depSnap.exists) {
      res.status(404).json({ error: 'Deposit record not found.' });
      return;
    }

    const deposit = depSnap.data()!;
    if (deposit.userId !== userId && req.user!.role !== 'admin') {
      res.status(403).json({ error: 'Unauthorized to view this deposit.' });
      return;
    }

    res.json({
      depositId: deposit.depositId || id,
      status: deposit.status,
      confirmations: deposit.confirmations || 0,
      requiredConfirmations: deposit.requiredConfirmations || 3,
      amount: deposit.amount,
      amountUsd: deposit.amountUsd || deposit.amount,
      asset: deposit.asset,
      transactionHash: deposit.transactionHash,
      verifiedAt: deposit.verifiedAt,
      creditedAt: deposit.creditedAt,
      failureReason: deposit.failureReason,
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to retrieve deposit status.' });
  }
});

/**
 * POST /api/deposits/submit-tx
 * User submits a transaction hash from their Web3 wallet.
 * Backend verifies the transaction directly on BNB Smart Chain.
 */
router.post('/submit-tx', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { transactionHash, assetSymbol } = req.body;
    const userId = req.user!.id;

    if (!transactionHash || typeof transactionHash !== 'string') {
      res.status(400).json({ error: 'Valid transaction hash is required.' });
      return;
    }

    const normalizedTxHash = transactionHash.trim().toLowerCase();

    if (!/^0x[0-9a-f]{64}$/.test(normalizedTxHash)) {
      res.status(400).json({
        error: 'Invalid transaction hash format. Must be a 66-character hex string starting with 0x.',
      });
      return;
    }

    // 1. Double-crediting & deduplication check
    const existingSnap = await adminDb
      .collection('deposits')
      .where('transactionHash', '==', normalizedTxHash)
      .limit(1)
      .get();

    if (!existingSnap.empty) {
      const existingDoc = existingSnap.docs[0].data();
      if (existingDoc.userId !== userId) {
        res.status(400).json({
          error: 'This transaction hash has already been submitted by another user.',
        });
        return;
      }

      if (existingDoc.status === 'completed') {
        res.status(400).json({
          error: 'This transaction has already been verified and credited to your balance.',
          deposit: existingDoc,
        });
        return;
      }
    }

    // 2. Fetch configured deposit assets
    const assetsSnap = await adminDb.collection('depositAssets').get();
    const configuredAssets: DepositAssetConfig[] = [];
    assetsSnap.forEach((d) => {
      const data = d.data();
      if (data && data.enabled !== false) configuredAssets.push(data as DepositAssetConfig);
    });

    // 3. Query user profile & wallet for record fields
    const [userSnap, walletSnap] = await Promise.all([
      adminDb.collection('users').doc(userId).get(),
      adminDb.collection('wallets').where('uid', '==', userId).limit(1).get(),
    ]);

    const userData = userSnap.data() || {};
    const username = userData.username || req.user!.email?.split('@')[0] || 'investor';
    const walletId = userData.walletId || (!walletSnap.empty ? walletSnap.docs[0].id : `wlt-${userId}`);

    // 4. Verify transaction on BNB Smart Chain
    const verification = await verifyBscTransaction(normalizedTxHash, configuredAssets, assetSymbol);
    const now = new Date().toISOString();
    const depositId = existingSnap.empty
      ? `DEP-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`
      : existingSnap.docs[0].id;

    const depositDoc = {
      depositId,
      userId,
      username,
      walletId,
      network: verification.network || 'BNB Smart Chain (BEP-20)',
      asset: verification.asset || assetSymbol || 'USDT',
      contractAddress: verification.contractAddress || '',
      amount: verification.amount || 0,
      amountUsd: verification.amountUsd || verification.amount || 0,
      decimals: verification.decimals || 18,
      transactionHash: normalizedTxHash,
      receivingAddress: PLATFORM_RECEIVING_ADDRESS,
      status: verification.status,
      confirmations: verification.confirmations || 0,
      requiredConfirmations: verification.requiredConfirmations || 3,
      blockNumber: verification.blockNumber || null,
      fromAddress: verification.fromAddress || null,
      toAddress: verification.toAddress || PLATFORM_RECEIVING_ADDRESS,
      createdAt: existingSnap.empty ? now : existingSnap.docs[0].data()?.createdAt || now,
      verifiedAt: verification.valid ? now : null,
      creditedAt: verification.status === 'completed' ? now : null,
      failureReason: verification.valid ? null : verification.reason || null,
      updatedAt: now,
    };

    const depRef = adminDb.collection('deposits').doc(depositId);
    await depRef.set(depositDoc, { merge: true });

    // 5. If fully confirmed on first check, immediately credit balance
    if (verification.status === 'completed') {
      const creditedAmount = verification.amountUsd || verification.amount;

      const txnResult = await executeFinancialTransaction({
        userId,
        type: 'CRYPTO_DEPOSIT',
        amount: creditedAmount,
        referenceId: depositId,
        description: `BNB Smart Chain Deposit: ${verification.amount.toFixed(4)} ${verification.asset} ($${creditedAmount.toFixed(2)} USD)`,
      });

      await createNotification(
        userId,
        'DEPOSIT',
        'Deposit Credited! 🚀',
        `+$${creditedAmount.toFixed(2)} USD deposited via BNB Smart Chain (${verification.amount.toFixed(4)} ${verification.asset}) has completed confirmation and is now in your balance.`
      );

      res.status(200).json({
        message: `Deposit verified and credited! +$${creditedAmount.toFixed(2)} USD added to your balance.`,
        status: 'completed',
        deposit: depositDoc,
        transactionId: txnResult.transactionId,
        newBalance: txnResult.balanceAfter,
      });
      return;
    }

    if (verification.status === 'confirming') {
      res.status(200).json({
        message: `Transaction detected! Confirming block ${verification.confirmations}/${verification.requiredConfirmations}. It will be auto-credited once confirmations reach ${verification.requiredConfirmations}.`,
        status: 'confirming',
        deposit: depositDoc,
      });
      return;
    }

    if (verification.status === 'detecting') {
      res.status(200).json({
        message: verification.reason || 'Transaction submitted. Our node is detecting it on BNB Smart Chain...',
        status: 'detecting',
        deposit: depositDoc,
      });
      return;
    }

    // Rejected / Failed
    res.status(400).json({
      error: verification.reason || 'Transaction verification failed on BNB Smart Chain.',
      status: verification.status,
      deposit: depositDoc,
    });
  } catch (err: any) {
    console.error('[DepositRoutes] Error in submit-tx:', err);
    res.status(500).json({ error: err.message || 'Failed to verify transaction on blockchain.' });
  }
});

/**
 * POST /api/deposits/:id/verify
 * User or system triggers explicit re-verification of a pending deposit
 */
router.post('/:id/verify', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    const depRef = adminDb.collection('deposits').doc(id);
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
      res.json({
        message: 'Deposit has already completed and credited.',
        status: 'completed',
        deposit,
      });
      return;
    }

    const txHash = deposit.transactionHash;
    if (!txHash) {
      res.status(400).json({ error: 'Deposit has no transaction hash associated.' });
      return;
    }

    const assetsSnap = await adminDb.collection('depositAssets').get();
    const configuredAssets: DepositAssetConfig[] = [];
    assetsSnap.forEach((d) => {
      const data = d.data();
      if (data && data.enabled !== false) configuredAssets.push(data as DepositAssetConfig);
    });

    const verification = await verifyBscTransaction(txHash, configuredAssets, deposit.asset);
    const now = new Date().toISOString();

    if (verification.valid) {
      if (verification.status === 'completed') {
        const creditedAmount = verification.amountUsd || verification.amount || deposit.amount;

        const txnResult = await executeFinancialTransaction({
          userId: deposit.userId,
          type: 'CRYPTO_DEPOSIT',
          amount: creditedAmount,
          referenceId: id,
          description: `BNB Smart Chain Deposit: ${verification.amount.toFixed(4)} ${verification.asset} ($${creditedAmount.toFixed(2)} USD)`,
        });

        const updatedDoc = {
          ...deposit,
          status: 'completed',
          confirmations: verification.confirmations,
          blockNumber: verification.blockNumber,
          fromAddress: verification.fromAddress,
          toAddress: verification.toAddress,
          verifiedAt: deposit.verifiedAt || now,
          creditedAt: now,
          failureReason: null,
          updatedAt: now,
        };

        await depRef.update(updatedDoc);

        await createNotification(
          deposit.userId,
          'DEPOSIT',
          'Deposit Confirmed & Credited! 🚀',
          `+$${creditedAmount.toFixed(2)} USD from your BNB Smart Chain deposit has been credited to your available balance.`
        );

        res.json({
          message: 'Deposit confirmed and credited successfully!',
          status: 'completed',
          deposit: updatedDoc,
          newBalance: txnResult.balanceAfter,
        });
        return;
      } else {
        const updatedDoc = {
          ...deposit,
          status: verification.status,
          confirmations: verification.confirmations,
          blockNumber: verification.blockNumber,
          fromAddress: verification.fromAddress,
          toAddress: verification.toAddress,
          verifiedAt: deposit.verifiedAt || now,
          failureReason: null,
          updatedAt: now,
        };

        await depRef.update(updatedDoc);

        res.json({
          message: `Confirming... ${verification.confirmations}/${verification.requiredConfirmations} blocks confirmed.`,
          status: verification.status,
          deposit: updatedDoc,
        });
        return;
      }
    } else {
      if (verification.status === 'failed' || verification.status === 'rejected') {
        await depRef.update({
          status: verification.status,
          failureReason: verification.reason,
          updatedAt: now,
        });
      }

      res.status(400).json({
        error: verification.reason || 'Verification failed on BNB Smart Chain.',
        status: verification.status,
      });
    }
  } catch (err: any) {
    console.error('[DepositRoutes] Error in re-verify:', err);
    res.status(500).json({ error: err.message || 'Failed to re-verify deposit.' });
  }
});

export default router;
