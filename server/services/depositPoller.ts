import { adminDb } from '../firebase/admin';
import { verifyBscTransaction, DepositAssetConfig } from './bscVerifier';
import { executeFinancialTransaction, createNotification } from './ledgerService';

/**
 * Background worker that continuously monitors pending, detecting, and confirming
 * deposits against BNB Smart Chain and advances their confirmation state until completed.
 */
let isPolling = false;

export async function checkUnconfirmedDeposits(): Promise<void> {
  if (isPolling) return;
  isPolling = true;

  try {
    // 1. Fetch enabled deposit assets
    const assetsSnap = await adminDb.collection('depositAssets').get();
    const configuredAssets: DepositAssetConfig[] = [];
    assetsSnap.forEach((doc) => {
      const data = doc.data();
      if (data && data.enabled !== false) {
        configuredAssets.push(data as DepositAssetConfig);
      }
    });

    // 2. Fetch deposits in non-final states
    const [pendingSnap, detectingSnap, confirmingSnap] = await Promise.all([
      adminDb.collection('deposits').where('status', '==', 'pending').get(),
      adminDb.collection('deposits').where('status', '==', 'detecting').get(),
      adminDb.collection('deposits').where('status', '==', 'confirming').get(),
    ]);

    const activeDocs = [...pendingSnap.docs, ...detectingSnap.docs, ...confirmingSnap.docs];

    for (const doc of activeDocs) {
      const deposit = doc.data();
      const txHash = deposit.transactionHash;
      if (!txHash) continue;

      try {
        const result = await verifyBscTransaction(txHash, configuredAssets, deposit.asset);
        const now = new Date().toISOString();

        if (result.valid) {
          if (result.status === 'completed' && deposit.status !== 'completed') {
            // Transaction has reached required confirmations! Atomically credit user balance
            const creditedAmount = result.amountUsd || deposit.amount;

            await executeFinancialTransaction({
              userId: deposit.userId,
              type: 'CRYPTO_DEPOSIT',
              amount: creditedAmount,
              referenceId: deposit.depositId || doc.id,
              description: `BNB Smart Chain Deposit: ${result.amount.toFixed(4)} ${result.asset} ($${creditedAmount.toFixed(2)} USD)`,
            });

            await doc.ref.update({
              status: 'completed',
              confirmations: result.confirmations || deposit.requiredConfirmations || 3,
              blockNumber: result.blockNumber || deposit.blockNumber || null,
              fromAddress: result.fromAddress || deposit.fromAddress || null,
              toAddress: result.toAddress || deposit.toAddress || null,
              verifiedAt: deposit.verifiedAt || now,
              creditedAt: now,
              failureReason: null,
              updatedAt: now,
            });

            await createNotification(
              deposit.userId,
              'DEPOSIT',
              'Crypto Deposit Credited! 🚀',
              `+$${creditedAmount.toFixed(2)} USD deposited via BNB Smart Chain (${result.amount.toFixed(4)} ${result.asset}) has completed confirmation and is available in your balance.`
            );

            console.log(`[DepositPoller] Successfully confirmed & credited deposit ${doc.id} for user ${deposit.userId}`);
          } else if (result.status === 'confirming') {
            await doc.ref.update({
              status: 'confirming',
              confirmations: result.confirmations,
              blockNumber: result.blockNumber,
              fromAddress: result.fromAddress,
              toAddress: result.toAddress,
              verifiedAt: deposit.verifiedAt || now,
              failureReason: null,
              updatedAt: now,
            });
          }
        } else if (result.status === 'failed' || result.status === 'rejected') {
          // Only update if it's explicitly failed on-chain or rejected
          if (result.status === 'failed') {
            await doc.ref.update({
              status: 'failed',
              failureReason: result.reason || 'Blockchain execution reverted on BNB Smart Chain',
              updatedAt: now,
            });
          }
        }
      } catch (docErr) {
        console.warn(`[DepositPoller] Error verifying tx ${txHash}:`, docErr);
      }
    }
  } catch (err) {
    console.error('[DepositPoller] Error checking unconfirmed deposits:', err);
  } finally {
    isPolling = false;
  }
}

export function startDepositPoller(): void {
  // Run on startup
  setTimeout(() => {
    checkUnconfirmedDeposits().catch((err) =>
      console.error('[DepositPoller] Initial run error:', err)
    );
  }, 5000);

  // Poll every 15 seconds
  setInterval(() => {
    checkUnconfirmedDeposits().catch((err) =>
      console.error('[DepositPoller] Interval run error:', err)
    );
  }, 15000);

  console.log('[DepositPoller] Real-time BNB Smart Chain deposit poller started (15s cycle).');
}
