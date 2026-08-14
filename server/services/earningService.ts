import { adminDb } from '../firebase/admin';
import { executeFinancialTransaction, createNotification } from './ledgerService';

export async function processDailyEarnings(): Promise<{
  processedCount: number;
  creditedAmount: number;
  completedCount: number;
}> {
  const todayStr = new Date().toISOString().split('T')[0]; // 'YYYY-MM-DD'
  const now = new Date().toISOString();

  let processedCount = 0;
  let creditedAmount = 0;
  let completedCount = 0;

  try {
    const activeSnap = await adminDb
      .collection('investments')
      .where('status', '==', 'active')
      .get();

    for (const doc of activeSnap.docs) {
      const inv = doc.data();
      const investmentId = inv.investmentId || doc.id;
      const userId = inv.userId;
      const dailyAmount = Number(inv.dailyEarning || 0);
      const principalAmount = Number(inv.principalAmount || 0);
      const durationDays = Number(inv.durationDays || 120);
      const daysCompleted = Number(inv.daysCompleted || 0);
      const planName = inv.planName || `VIP Plan ${inv.vipLevel || 1}`;

      // Unique logical identifier for investment + earning date enforces strict idempotency
      const earningDocId = `${investmentId}_${todayStr}`;
      const earningRef = adminDb.collection('investmentEarnings').doc(earningDocId);
      const earningSnap = await earningRef.get();

      if (earningSnap.exists) {
        // Earning for today was already credited, skip!
        continue;
      }

      // Check if investment was already at or reached maturity
      if (daysCompleted >= durationDays) {
        await doc.ref.update({
          status: 'completed',
          updatedAt: now,
        });

        await executeFinancialTransaction({
          userId,
          type: 'INVESTMENT_MATURITY',
          amount: principalAmount,
          referenceId: investmentId,
          description: `Investment Maturity Principal Return: ${planName} ($${principalAmount.toFixed(2)})`,
        });

        await createNotification(
          userId,
          'INVESTMENT',
          'Investment Matured! 🎉',
          `Your investment in ${planName} has completed its ${durationDays}-day period. Principal of $${principalAmount.toFixed(
            2
          )} has been credited to your available balance.`
        );

        completedCount++;
        continue;
      }

      // Record daily earning document atomically
      await earningRef.set({
        earningId: earningDocId,
        investmentId,
        userId,
        amount: dailyAmount,
        earningDate: todayStr,
        status: 'credited',
        createdAt: now,
      });

      // Execute financial ledger transaction
      await executeFinancialTransaction({
        userId,
        type: 'DAILY_EARNING',
        amount: dailyAmount,
        referenceId: earningDocId,
        description: `Daily Return: ${planName} (Day ${daysCompleted + 1}/${durationDays})`,
      });

      const newDaysCompleted = daysCompleted + 1;
      const newTotalEarned = Number(inv.totalEarned || 0) + dailyAmount;
      const isCompletedNow = newDaysCompleted >= durationDays;

      await doc.ref.update({
        daysCompleted: newDaysCompleted,
        totalEarned: newTotalEarned,
        status: isCompletedNow ? 'completed' : 'active',
        updatedAt: now,
      });

      if (isCompletedNow) {
        await executeFinancialTransaction({
          userId,
          type: 'INVESTMENT_MATURITY',
          amount: principalAmount,
          referenceId: investmentId,
          description: `Investment Maturity Principal Return: ${planName} ($${principalAmount.toFixed(2)})`,
        });

        await createNotification(
          userId,
          'INVESTMENT',
          'Investment Completed! 🎉',
          `Your ${planName} investment has reached final maturity. Principal of $${principalAmount.toFixed(
            2
          )} returned.`
        );
        completedCount++;
      } else {
        await createNotification(
          userId,
          'EARNING',
          'Daily Earning Credited! 💵',
          `+$${dailyAmount.toFixed(
            2
          )} daily return credited from ${planName} (Day ${newDaysCompleted}/${durationDays}).`
        );
      }

      processedCount++;
      creditedAmount += dailyAmount;
    }
  } catch (err) {
    console.error('[EarningService] Error processing daily earnings:', err);
  }

  return { processedCount, creditedAmount, completedCount };
}

export function startEarningScheduler(): void {
  // Run on startup
  processDailyEarnings()
    .then((res) => {
      if (res.processedCount > 0) {
        console.log(
          `[EarningScheduler] Processed ${res.processedCount} daily earnings ($${res.creditedAmount.toFixed(
            2
          )} credited).`
        );
      }
    })
    .catch((err) => console.error('[EarningScheduler] Startup error:', err));

  // Hourly check to ensure daily earnings are always current
  setInterval(() => {
    processDailyEarnings().catch((err) =>
      console.error('[EarningScheduler] Interval error:', err)
    );
  }, 3600000);
}
