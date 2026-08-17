import { adminDb } from '../firebase/admin';

export interface PostTransactionParams {
  userId: string;
  type:
    | 'DEPOSIT'
    | 'CRYPTO_DEPOSIT'
    | 'INVESTMENT'
    | 'DAILY_EARNING'
    | 'INVESTMENT_MATURITY'
    | 'TRANSFER_SENT'
    | 'TRANSFER_RECEIVED'
    | 'WITHDRAWAL'
    | 'WITHDRAWAL_FEE'
    | 'ADJUSTMENT';
  amount: number;
  fee?: number;
  referenceId?: string;
  description: string;
}

export async function executeFinancialTransaction(
  params: PostTransactionParams
): Promise<{ transactionId: string; balanceBefore: number; balanceAfter: number }> {
  const { userId, type, amount, fee = 0.0, referenceId, description } = params;

  if (amount < 0) {
    throw new Error('Transaction amount must be positive.');
  }

  const now = new Date().toISOString();
  const transactionId = `TXN-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
  const ledgerEntryIdDebit = `LEDGER-${Date.now()}-1`;
  const ledgerEntryIdCredit = `LEDGER-${Date.now()}-2`;

  let balanceBefore = 0;
  let balanceAfter = 0;

  await adminDb.runTransaction(async (transaction) => {
    // 1. Fetch wallet doc
    const walletQuery = await adminDb
      .collection('wallets')
      .where('uid', '==', userId)
      .limit(1)
      .get();

    if (walletQuery.empty) {
      throw new Error(`Wallet not found in Firestore for user: ${userId}`);
    }

    const walletDoc = walletQuery.docs[0];
    const walletRef = walletDoc.ref;
    const walletData = walletDoc.data();

    const currentAvailable = Number(walletData.availableBalance || 0);
    const currentInvested = Number(walletData.investedBalance || 0);
    const currentTotalEarnings = Number(walletData.totalEarnings || 0);
    const currentTotalDeposits = Number(walletData.totalDeposits || 0);
    const currentTotalWithdrawals = Number(walletData.totalWithdrawals || 0);
    const currentTotalTransfers = Number(walletData.totalTransfers || 0);

    let newAvailable = currentAvailable;
    let newInvested = currentInvested;
    let newTotalEarnings = currentTotalEarnings;
    let newTotalDeposits = currentTotalDeposits;
    let newTotalWithdrawals = currentTotalWithdrawals;
    let newTotalTransfers = currentTotalTransfers;

    switch (type) {
      case 'DEPOSIT':
      case 'CRYPTO_DEPOSIT':
        newAvailable += amount;
        newTotalDeposits += amount;
        break;

      case 'INVESTMENT':
        if (currentAvailable < amount) {
          throw new Error(
            `Insufficient available balance for investment. Available: $${currentAvailable.toFixed(
              2
            )}, Required: $${amount.toFixed(2)}`
          );
        }
        newAvailable -= amount;
        newInvested += amount;
        break;

      case 'DAILY_EARNING':
        newAvailable += amount;
        newTotalEarnings += amount;
        break;

      case 'INVESTMENT_MATURITY':
        newInvested = Math.max(0, currentInvested - amount);
        newAvailable += amount;
        break;

      case 'TRANSFER_SENT':
        if (currentAvailable < amount + fee) {
          throw new Error(
            `Insufficient available balance for transfer. Required: $${(amount + fee).toFixed(
              2
            )}, Available: $${currentAvailable.toFixed(2)}`
          );
        }
        newAvailable -= amount + fee;
        newTotalTransfers += amount;
        break;

      case 'TRANSFER_RECEIVED':
        newAvailable += amount;
        newTotalTransfers += amount;
        break;

      case 'WITHDRAWAL': {
        const totalDeduction = amount + fee;
        if (currentAvailable < totalDeduction) {
          throw new Error(
            `Insufficient available balance for withdrawal. Required: $${totalDeduction.toFixed(
              2
            )}, Available: $${currentAvailable.toFixed(2)}`
          );
        }
        newAvailable -= totalDeduction;
        newTotalWithdrawals += amount;
        break;
      }

      case 'ADJUSTMENT':
        newAvailable += amount;
        if (newAvailable < 0) {
          throw new Error('Adjustment would result in negative balance.');
        }
        break;

      default:
        throw new Error(`Unknown transaction type: ${type}`);
    }

    balanceBefore = currentAvailable;
    balanceAfter = newAvailable;

    // 2. Transaction Record
    const txnRef = adminDb.collection('transactions').doc(transactionId);
    transaction.set(txnRef, {
      transactionId,
      userId,
      type,
      amount,
      fee,
      balanceBefore,
      balanceAfter,
      status: 'completed',
      reference: referenceId || null,
      description,
      createdAt: now,
      updatedAt: now,
    });

    // 3. Ledger Entries (Double-Entry Append-Only)
    const isIncrease = newAvailable > currentAvailable;
    const ledgerRefDebit = adminDb.collection('ledgerEntries').doc(ledgerEntryIdDebit);
    transaction.set(ledgerRefDebit, {
      entryId: ledgerEntryIdDebit,
      transactionId,
      userId,
      sourceAccount: 'USER_AVAILABLE',
      destinationAccount: 'PLATFORM_SYSTEM',
      amount: Math.abs(newAvailable - currentAvailable),
      currency: 'USD',
      type: isIncrease ? 'CREDIT' : 'DEBIT',
      status: 'completed',
      reference: referenceId || transactionId,
      metadata: { description },
      createdAt: now,
    });

    const counterpartAccount =
      type === 'DEPOSIT'
        ? 'PLATFORM_BANK'
        : type === 'INVESTMENT'
        ? 'USER_INVESTED_POOL'
        : type === 'DAILY_EARNING'
        ? 'SYSTEM_EARNINGS_RESERVE'
        : type === 'WITHDRAWAL'
        ? 'SYSTEM_WITHDRAWAL_ESCROW'
        : 'SYSTEM_TRANSFER_SETTLEMENT';

    const ledgerRefCredit = adminDb.collection('ledgerEntries').doc(ledgerEntryIdCredit);
    transaction.set(ledgerRefCredit, {
      entryId: ledgerEntryIdCredit,
      transactionId,
      userId,
      sourceAccount: counterpartAccount,
      destinationAccount: 'USER_AVAILABLE',
      amount: Math.abs(newAvailable - currentAvailable),
      currency: 'USD',
      type: isIncrease ? 'DEBIT' : 'CREDIT',
      status: 'completed',
      reference: referenceId || transactionId,
      metadata: { description },
      createdAt: now,
    });

    // 4. Wallet Snapshot Update
    transaction.update(walletRef, {
      availableBalance: newAvailable,
      investedBalance: newInvested,
      totalEarnings: newTotalEarnings,
      totalDeposits: newTotalDeposits,
      totalWithdrawals: newTotalWithdrawals,
      totalTransfers: newTotalTransfers,
      updatedAt: now,
    });
  });

  return { transactionId, balanceBefore, balanceAfter };
}

export async function createNotification(
  userId: string,
  type: string,
  title: string,
  message: string
): Promise<void> {
  const notificationId = `NTF-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;
  const now = new Date().toISOString();
  await adminDb.collection('notifications').doc(notificationId).set({
    notificationId,
    userId,
    type,
    title,
    message,
    read: false,
    createdAt: now,
  });
}

export async function createAuditLog(
  actorUid: string | null,
  actorRole: string | null,
  action: string,
  targetType: string,
  targetId: string,
  ipAddress?: string | null,
  userAgent?: string | null,
  metadata?: any
): Promise<void> {
  const logId = `AUDIT-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;
  const now = new Date().toISOString();
  await adminDb.collection('auditLogs').doc(logId).set({
    logId,
    actorUid: actorUid || 'system',
    actorRole: actorRole || 'system',
    action,
    targetType,
    targetId,
    ipAddress: ipAddress || '127.0.0.1',
    userAgent: userAgent || 'server',
    metadata: metadata || {},
    createdAt: now,
  });
}
