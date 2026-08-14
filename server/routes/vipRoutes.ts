import { Router, Response } from 'express';
import { adminDb } from '../firebase/admin';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import { executeFinancialTransaction, createNotification } from '../services/ledgerService';

const router = Router();

// GET /api/vip/plans - Get available VIP Plans
router.get('/plans', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const snap = await adminDb
      .collection('vipPlans')
      .where('status', '==', 'active')
      .get();

    const plans = snap.docs
      .map((doc) => {
        const d = doc.data();
        return {
          id: d.planId || doc.id,
          level: d.vipLevel,
          name: d.name,
          investment_amount: d.investmentAmount,
          daily_earning: d.dailyEarning,
          duration_days: d.durationDays,
          is_active: d.status === 'active' ? 1 : 0,
          display_order: d.displayOrder,
        };
      })
      .sort((a, b) => a.display_order - b.display_order);

    res.json(plans);
  } catch (err) {
    console.error('Error fetching VIP plans:', err);
    res.status(500).json({ error: 'Failed to fetch VIP plans.' });
  }
});

// GET /api/vip/my-investments - Get user active and past investments
router.get('/my-investments', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const snap = await adminDb
      .collection('investments')
      .where('userId', '==', userId)
      .get();

    const investments = snap.docs
      .map((doc) => {
        const d = doc.data();
        return {
          id: d.investmentId || doc.id,
          user_id: d.userId,
          vip_plan_id: d.vipPlanId,
          vip_level: d.vipLevel,
          plan_name: d.planName,
          investment_amount: d.principalAmount,
          daily_earning: d.dailyEarning,
          duration_days: d.durationDays,
          total_earned: d.totalEarned || 0,
          days_credited: d.daysCompleted || 0,
          status: d.status,
          start_date: d.startDate,
          maturity_date: d.maturityDate,
        };
      })
      .sort((a, b) => new Date(b.start_date).getTime() - new Date(a.start_date).getTime());

    res.json(investments);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch investments.' });
  }
});

// POST /api/vip/purchase - Purchase a VIP Plan
router.post('/purchase', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { planId } = req.body;
    const userId = req.user!.id;

    if (!planId) {
      res.status(400).json({ error: 'Please select a VIP Plan to purchase.' });
      return;
    }

    // 1. Fetch Plan
    const planDoc = await adminDb.collection('vipPlans').doc(planId).get();
    if (!planDoc.exists) {
      res.status(404).json({ error: 'Selected VIP Plan not found.' });
      return;
    }

    const plan = planDoc.data()!;
    if (plan.status !== 'active') {
      res.status(400).json({ error: 'This VIP Plan is currently disabled or unavailable.' });
      return;
    }

    const principalAmount = Number(plan.investmentAmount);
    const dailyEarning = Number(plan.dailyEarning);
    const durationDays = Number(plan.durationDays || 120);
    const planName = plan.name || `VIP Plan ${plan.vipLevel}`;

    // 2. Execute Financial Transaction via Ledger
    const result = await executeFinancialTransaction({
      userId,
      type: 'INVESTMENT',
      amount: principalAmount,
      referenceId: planId,
      description: `Purchased ${planName} ($${principalAmount.toFixed(2)})`,
    });

    // 3. Create Investment Record
    const investmentId = `INV-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const now = new Date();
    const startDate = now.toISOString();
    const maturityDate = new Date(now.getTime() + durationDays * 86400000).toISOString();

    await adminDb.collection('investments').doc(investmentId).set({
      investmentId,
      userId,
      vipPlanId: planId,
      vipLevel: plan.vipLevel,
      planName,
      principalAmount,
      dailyEarning,
      durationDays,
      daysCompleted: 0,
      totalEarned: 0.0,
      status: 'active',
      startDate,
      maturityDate,
      createdAt: startDate,
      updatedAt: startDate,
    });

    await createNotification(
      userId,
      'INVESTMENT',
      `${planName} Activated! 🚀`,
      `Your investment of $${principalAmount.toFixed(2)} in ${planName} is active. Daily returns of $${dailyEarning.toFixed(2)} will credit automatically.`
    );

    res.status(201).json({
      message: `Successfully activated ${planName}!`,
      investmentId,
      transactionId: result.transactionId,
      availableBalance: result.balanceAfter,
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Failed to purchase VIP plan.' });
  }
});

export default router;
