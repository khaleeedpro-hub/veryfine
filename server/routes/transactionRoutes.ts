import { Router, Response } from 'express';
import { adminDb } from '../firebase/admin';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';

const router = Router();

// GET /api/transactions - Fetch user transaction history & ledger entries
router.get('/', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { type, status, limit = 50, search } = req.query;

    const txnSnap = await adminDb
      .collection('transactions')
      .where('userId', '==', userId)
      .get();

    let txns = txnSnap.docs.map((doc) => {
      const d = doc.data();
      return {
        id: d.transactionId || doc.id,
        user_id: d.userId,
        type: d.type,
        amount: d.amount,
        fee: d.fee || 0,
        balance_before: d.balanceBefore,
        balance_after: d.balanceAfter,
        status: d.status,
        reference_id: d.reference,
        description: d.description,
        created_at: d.createdAt,
      };
    });

    if (type && typeof type === 'string' && type !== 'ALL') {
      txns = txns.filter((t) => t.type === type);
    }

    if (status && typeof status === 'string' && status !== 'ALL') {
      txns = txns.filter((t) => t.status === status);
    }

    if (search && typeof search === 'string' && search.trim() !== '') {
      const term = search.toLowerCase();
      txns = txns.filter(
        (t) =>
          (t.description && t.description.toLowerCase().includes(term)) ||
          (t.id && t.id.toLowerCase().includes(term))
      );
    }

    txns = txns
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, Number(limit));

    // Fetch ledger entries for double-entry audit
    const ledgerSnap = await adminDb
      .collection('ledgerEntries')
      .where('userId', '==', userId)
      .get();

    const ledgerEntries = ledgerSnap.docs
      .map((doc) => {
        const d = doc.data();
        return {
          id: d.entryId || doc.id,
          transaction_id: d.transactionId,
          user_id: d.userId,
          account_type: d.sourceAccount || 'USER_AVAILABLE',
          entry_type: d.type,
          amount: d.amount,
          balance_after: d.amount,
          reference: d.reference,
          description: d.metadata?.description || d.type,
          created_at: d.createdAt,
        };
      })
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 50);

    res.json({
      transactions: txns,
      ledgerEntries,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch transaction history.' });
  }
});

export default router;
