import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import { adminDb } from '../firebase/admin';
import { authenticateToken, requireAdmin, AuthenticatedRequest } from '../middleware/auth';
import { executeFinancialTransaction, createNotification, createAuditLog } from '../services/ledgerService';

const router = Router();

// Protect all admin routes
router.use(authenticateToken);
router.use(requireAdmin);

// ==========================================
// 1. OVERVIEW & METRICS DASHBOARD
// ==========================================
router.get('/overview', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const [usersSnap, walletsSnap, depositsSnap, withdrawalsSnap, investmentsSnap, txnsSnap] = await Promise.all([
      adminDb.collection('users').get(),
      adminDb.collection('wallets').get(),
      adminDb.collection('deposits').get(),
      adminDb.collection('withdrawals').get(),
      adminDb.collection('investments').get(),
      adminDb.collection('transactions').orderBy('createdAt', 'desc').limit(20).get(),
    ]);

    let totalUsers = usersSnap.size;
    let activeUsers = 0;
    let suspendedUsers = 0;

    usersSnap.forEach((doc) => {
      const u = doc.data();
      const status = u.accountStatus || u.status || 'active';
      if (status === 'active') activeUsers++;
      else if (status === 'suspended') suspendedUsers++;
    });

    let totalAvailableBalance = 0;
    let totalInvestedBalance = 0;
    let totalEarnings = 0;
    let totalPlatformDeposits = 0;
    let totalPlatformWithdrawals = 0;

    walletsSnap.forEach((doc) => {
      const w = doc.data();
      totalAvailableBalance += Number(w.availableBalance || 0);
      totalInvestedBalance += Number(w.investedBalance || 0);
      totalEarnings += Number(w.totalEarnings || 0);
      totalPlatformDeposits += Number(w.totalDeposits || 0);
      totalPlatformWithdrawals += Number(w.totalWithdrawals || 0);
    });

    let pendingDepositsCount = 0;
    let pendingDepositsAmount = 0;
    depositsSnap.forEach((doc) => {
      const d = doc.data();
      if (d.status === 'pending') {
        pendingDepositsCount++;
        pendingDepositsAmount += Number(d.amount || 0);
      }
    });

    let pendingWithdrawalsCount = 0;
    let pendingWithdrawalsAmount = 0;
    withdrawalsSnap.forEach((doc) => {
      const w = doc.data();
      if (w.status === 'pending') {
        pendingWithdrawalsCount++;
        pendingWithdrawalsAmount += Number(w.amount || 0);
      }
    });

    let activeInvestmentsCount = 0;
    investmentsSnap.forEach((doc) => {
      const inv = doc.data();
      if (inv.status === 'active') activeInvestmentsCount++;
    });

    const recentTransactions = txnsSnap.docs.map((doc) => {
      const t = doc.data();
      return {
        id: t.transactionId || doc.id,
        userId: t.userId,
        type: t.type,
        amount: Number(t.amount || 0),
        status: t.status,
        description: t.description,
        createdAt: t.createdAt,
      };
    });

    res.json({
      metrics: {
        totalUsers,
        activeUsers,
        suspendedUsers,
        totalAvailableBalance,
        totalInvestedBalance,
        totalEarnings,
        totalPlatformDeposits,
        totalPlatformWithdrawals,
        pendingDepositsCount,
        pendingDepositsAmount,
        pendingWithdrawalsCount,
        pendingWithdrawalsAmount,
        activeInvestmentsCount,
      },
      recentTransactions,
    });
  } catch (err: any) {
    console.error('Admin overview error:', err);
    res.status(500).json({ error: 'Failed to fetch admin overview statistics.' });
  }
});

// ==========================================
// 2. USER MANAGEMENT
// ==========================================
router.get('/users', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      q,
      status,
      vipLevel,
      role,
      email,
      username: targetUsername,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      page,
      limit,
    } = req.query;

    const userSnap = await adminDb.collection('users').get();
    let users: any[] = [];

    const searchQuery = q ? String(q).toLowerCase().trim() : '';
    const emailQuery = email ? String(email).toLowerCase().trim() : '';
    const usernameQuery = targetUsername ? String(targetUsername).toLowerCase().trim().replace(/^@/, '') : '';

    for (const doc of userSnap.docs) {
      const u = doc.data();
      const uid = u.uid || doc.id;

      const profileSnap = await adminDb.collection('userProfiles').doc(uid).get();
      const profile = profileSnap.exists ? profileSnap.data() : null;

      const walletSnap = await adminDb.collection('wallets').doc(u.walletId || `wlt-${uid}`).get();
      const wallet = walletSnap.exists ? walletSnap.data() : null;

      const username = u.username || u.email?.split('@')[0] || 'investor';
      const fullName = profile
        ? `${profile.firstName || ''} ${profile.lastName || ''}`.trim() || u.displayName || username
        : u.displayName || username;
      const accountStatus = u.accountStatus || u.status || 'active';
      const userVipLevel = Number(u.vipLevel || 0);
      const userRole = u.role || 'user';

      // Filters
      if (status && status !== 'all' && accountStatus !== status) continue;
      if (role && role !== 'all' && userRole.toLowerCase() !== String(role).toLowerCase()) continue;
      if (vipLevel && vipLevel !== 'all' && userVipLevel !== Number(vipLevel)) continue;
      if (emailQuery && !(u.email || '').toLowerCase().includes(emailQuery)) continue;
      if (usernameQuery && !username.toLowerCase().includes(usernameQuery)) continue;

      if (searchQuery) {
        const matchesUid = uid.toLowerCase().includes(searchQuery);
        const matchesUsername = username.toLowerCase().includes(searchQuery);
        const matchesEmail = (u.email || '').toLowerCase().includes(searchQuery);
        const matchesFullName = fullName.toLowerCase().includes(searchQuery);
        const matchesWallet = (wallet?.walletAddress || '').toLowerCase().includes(searchQuery);
        const matchesWalletId = (u.walletId || '').toLowerCase().includes(searchQuery);

        if (!matchesUid && !matchesUsername && !matchesEmail && !matchesFullName && !matchesWallet && !matchesWalletId) {
          continue;
        }
      }

      users.push({
        id: uid,
        uid,
        username,
        email: u.email,
        role: userRole,
        accountStatus,
        status: accountStatus,
        is_suspended: accountStatus === 'suspended' ? 1 : 0,
        vipLevel: userVipLevel,
        full_name: fullName,
        firstName: profile?.firstName || '',
        lastName: profile?.lastName || '',
        phone: profile?.phone || '',
        country: u.country || profile?.country || 'United States',
        wallet_address: wallet?.walletAddress || '',
        walletAddress: wallet?.walletAddress || '',
        walletId: u.walletId || `wlt-${uid}`,
        available_balance: Number(wallet?.availableBalance || 0),
        availableBalance: Number(wallet?.availableBalance || 0),
        invested_balance: Number(wallet?.investedBalance || 0),
        investedBalance: Number(wallet?.investedBalance || 0),
        total_earnings: Number(wallet?.totalEarnings || 0),
        totalEarnings: Number(wallet?.totalEarnings || 0),
        total_deposits: Number(wallet?.totalDeposits || 0),
        totalDeposits: Number(wallet?.totalDeposits || 0),
        total_withdrawals: Number(wallet?.totalWithdrawals || 0),
        totalWithdrawals: Number(wallet?.totalWithdrawals || 0),
        walletStatus: wallet?.status || 'active',
        created_at: u.createdAt || new Date().toISOString(),
        createdAt: u.createdAt || new Date().toISOString(),
        lastLoginAt: u.lastLoginAt || null,
      });
    }

    // Server-side Sorting
    const sortField = String(sortBy);
    const order = String(sortOrder).toLowerCase() === 'asc' ? 1 : -1;

    users.sort((a, b) => {
      let aVal: any;
      let bVal: any;

      switch (sortField) {
        case 'username':
          aVal = (a.username || '').toLowerCase();
          bVal = (b.username || '').toLowerCase();
          break;
        case 'email':
          aVal = (a.email || '').toLowerCase();
          bVal = (b.email || '').toLowerCase();
          break;
        case 'role':
          aVal = (a.role || '').toLowerCase();
          bVal = (b.role || '').toLowerCase();
          break;
        case 'vipLevel':
          aVal = Number(a.vipLevel || 0);
          bVal = Number(b.vipLevel || 0);
          break;
        case 'availableBalance':
        case 'available_balance':
          aVal = Number(a.availableBalance || 0);
          bVal = Number(b.availableBalance || 0);
          break;
        case 'investedBalance':
        case 'invested_balance':
          aVal = Number(a.investedBalance || 0);
          bVal = Number(b.investedBalance || 0);
          break;
        case 'totalEarnings':
        case 'total_earnings':
          aVal = Number(a.totalEarnings || 0);
          bVal = Number(b.totalEarnings || 0);
          break;
        case 'accountStatus':
        case 'status':
          aVal = (a.accountStatus || '').toLowerCase();
          bVal = (b.accountStatus || '').toLowerCase();
          break;
        case 'createdAt':
        case 'created_at':
        default:
          aVal = new Date(a.createdAt || a.created_at || 0).getTime();
          bVal = new Date(b.createdAt || b.created_at || 0).getTime();
          break;
      }

      if (aVal < bVal) return -1 * order;
      if (aVal > bVal) return 1 * order;
      return 0;
    });

    const totalCount = users.length;

    // Optional Server-side Pagination
    if (page && limit) {
      const pageNum = Math.max(1, parseInt(String(page), 10));
      const limitNum = Math.max(1, parseInt(String(limit), 10));
      const startIndex = (pageNum - 1) * limitNum;
      const paginatedUsers = users.slice(startIndex, startIndex + limitNum);

      return res.json({
        users: paginatedUsers,
        total: totalCount,
        pagination: {
          total: totalCount,
          page: pageNum,
          limit: limitNum,
          totalPages: Math.ceil(totalCount / limitNum),
        },
      });
    }

    res.json({ users, total: totalCount });
  } catch (err: any) {
    console.error('Fetch users error:', err);
    res.status(500).json({ error: 'Failed to fetch admin user list.' });
  }
});

// GET SINGLE USER FULL DETAIL
router.get('/users/:userId', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { userId } = req.params;

    const userSnap = await adminDb.collection('users').doc(userId).get();
    if (!userSnap.exists) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }

    const u = userSnap.data()!;
    const profileSnap = await adminDb.collection('userProfiles').doc(userId).get();
    const profile = profileSnap.exists ? profileSnap.data() : null;

    const walletSnap = await adminDb.collection('wallets').doc(u.walletId || `wlt-${userId}`).get();
    const wallet = walletSnap.exists ? walletSnap.data() : null;

    // Fetch user investments
    const invSnap = await adminDb.collection('investments').where('userId', '==', userId).get();
    const investments = invSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

    // Fetch user transactions
    const txnSnap = await adminDb.collection('transactions').where('userId', '==', userId).orderBy('createdAt', 'desc').limit(20).get();
    const transactions = txnSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

    // Fetch user ledger entries
    const ledgerSnap = await adminDb.collection('ledgerEntries').where('userId', '==', userId).orderBy('createdAt', 'desc').limit(20).get();
    const ledgerEntries = ledgerSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

    // Fetch audit logs targeting this user
    const auditSnap = await adminDb.collection('auditLogs').where('targetId', '==', userId).orderBy('createdAt', 'desc').limit(20).get();
    const auditLogs = auditSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

    res.json({
      user: {
        uid: userId,
        username: u.username || u.email?.split('@')[0],
        usernameLowercase: u.usernameLowercase,
        email: u.email,
        role: u.role || 'user',
        accountStatus: u.accountStatus || u.status || 'active',
        vipLevel: Number(u.vipLevel || 0),
        country: u.country || profile?.country || 'United States',
        walletId: u.walletId || `wlt-${userId}`,
        emailVerified: Boolean(u.emailVerified),
        twoFactorEnabled: Boolean(u.twoFactorEnabled),
        pinCooldownUntil: u.pinResetCooldownUntil || null,
        createdAt: u.createdAt,
        updatedAt: u.updatedAt,
        lastLoginAt: u.lastLoginAt || null,
      },
      profile: profile || {
        firstName: '',
        lastName: '',
        phone: '',
        country: u.country || 'United States',
        address: '',
        dateOfBirth: '',
      },
      wallet: wallet ? {
        walletId: wallet.walletId,
        walletAddress: wallet.walletAddress,
        currency: wallet.currency || 'USD',
        availableBalance: Number(wallet.availableBalance || 0),
        investedBalance: Number(wallet.investedBalance || 0),
        totalEarnings: Number(wallet.totalEarnings || 0),
        totalDeposits: Number(wallet.totalDeposits || 0),
        totalWithdrawals: Number(wallet.totalWithdrawals || 0),
        totalTransfers: Number(wallet.totalTransfers || 0),
        status: wallet.status || 'active',
      } : null,
      investments,
      transactions,
      ledgerEntries,
      auditLogs,
    });
  } catch (err: any) {
    console.error('Fetch user detail error:', err);
    res.status(500).json({ error: 'Failed to fetch user profile details.' });
  }
});

// UPDATE USER PROFILE BY ADMIN
router.post('/users/:userId/update', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { userId } = req.params;
    const { firstName, lastName, phone, country, address, dateOfBirth } = req.body;

    const userRef = adminDb.collection('users').doc(userId);
    const profileRef = adminDb.collection('userProfiles').doc(userId);

    const now = new Date().toISOString();

    const fullName = `${firstName || ''} ${lastName || ''}`.trim();
    if (fullName) {
      await userRef.update({
        displayName: fullName,
        country: country || 'United States',
        updatedAt: now,
      });
    }

    await profileRef.set(
      {
        uid: userId,
        firstName: firstName || '',
        lastName: lastName || '',
        phone: phone || '',
        country: country || 'United States',
        address: address || '',
        dateOfBirth: dateOfBirth || '',
        updatedAt: now,
      },
      { merge: true }
    );

    await createAuditLog(
      req.user!.id,
      req.user!.role,
      'USER_PROFILE_UPDATED',
      'user',
      userId,
      req.ip || '127.0.0.1',
      req.headers['user-agent'] as string,
      { firstName, lastName, country }
    );

    res.json({ message: 'User profile updated successfully.' });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to update user profile.' });
  }
});

// CHANGE USERNAME (ATOMIC RESERVATION)
router.post('/users/:userId/change-username', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { userId } = req.params;
    const { newUsername } = req.body;

    if (!newUsername || typeof newUsername !== 'string') {
      res.status(400).json({ error: 'New username is required.' });
      return;
    }

    const cleanUsername = newUsername.trim();
    const cleanLower = cleanUsername.toLowerCase();

    if (cleanLower.length < 3 || cleanLower.length > 30 || !/^[a-z0-9_]+$/.test(cleanLower)) {
      res.status(400).json({ error: 'Username must be 3-30 characters long and contain only alphanumeric characters and underscores.' });
      return;
    }

    const userRef = adminDb.collection('users').doc(userId);
    const userSnap = await userRef.get();
    if (!userSnap.exists) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }

    const user = userSnap.data()!;
    const oldUsername = user.username || '';
    const oldLower = (user.usernameLowercase || oldUsername).toLowerCase();

    if (oldLower === cleanLower) {
      res.status(400).json({ error: 'New username is identical to the current username.' });
      return;
    }

    const now = new Date().toISOString();

    await adminDb.runTransaction(async (t) => {
      // Check if new username is taken
      const targetDocRef = adminDb.collection('usernames').doc(cleanLower);
      const targetDoc = await t.get(targetDocRef);

      if (targetDoc.exists && targetDoc.data()?.uid !== userId) {
        throw new Error(`Username @${cleanUsername} is already registered by another account.`);
      }

      // Delete old username if exists
      if (oldLower) {
        const oldDocRef = adminDb.collection('usernames').doc(oldLower);
        t.delete(oldDocRef);
      }

      // Reserve new username
      t.set(targetDocRef, {
        username: cleanUsername,
        usernameLowercase: cleanLower,
        uid: userId,
        createdAt: now,
      });

      // Update user doc
      t.update(userRef, {
        username: cleanUsername,
        usernameLowercase: cleanLower,
        updatedAt: now,
      });
    });

    await createAuditLog(
      req.user!.id,
      req.user!.role,
      'USERNAME_CHANGED',
      'user',
      userId,
      req.ip || '127.0.0.1',
      req.headers['user-agent'] as string,
      { oldUsername, newUsername: cleanUsername }
    );

    await createNotification(
      userId,
      'ACCOUNT',
      'Username Updated 👤',
      `Your account username has been updated to @${cleanUsername} by administration.`
    );

    res.json({ message: `Username updated to @${cleanUsername} successfully.` });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Failed to update username.' });
  }
});

// SET ACCOUNT STATUS (ACTIVE / SUSPENDED / RESTRICTED / PENDING / CLOSED)
router.post('/users/:userId/status', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { userId } = req.params;
    const { status, reason } = req.body;

    const allowedStatuses = ['active', 'suspended', 'restricted', 'pending', 'closed'];
    if (!status || !allowedStatuses.includes(status)) {
      res.status(400).json({ error: `Invalid status. Allowed values: ${allowedStatuses.join(', ')}` });
      return;
    }

    const userRef = adminDb.collection('users').doc(userId);
    const userSnap = await userRef.get();

    if (!userSnap.exists) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }

    const user = userSnap.data()!;
    if (user.role === 'admin' && status === 'suspended') {
      res.status(400).json({ error: 'Cannot suspend a primary administrator.' });
      return;
    }

    const now = new Date().toISOString();
    await userRef.update({
      accountStatus: status,
      status: status === 'suspended' ? 'suspended' : 'active',
      statusReason: reason || '',
      updatedAt: now,
    });

    const isSuspension = status === 'suspended';
    await createAuditLog(
      req.user!.id,
      req.user!.role,
      isSuspension ? 'ACCOUNT_SUSPENDED' : 'ACCOUNT_STATUS_CHANGED',
      'user',
      userId,
      req.ip || '127.0.0.1',
      req.headers['user-agent'] as string,
      { status, previousStatus: user.accountStatus || user.status, reason }
    );

    await createNotification(
      userId,
      'SECURITY',
      `Account Status Updated: ${status.toUpperCase()}`,
      `Your account status is now ${status.toUpperCase()}.${reason ? ` Reason: ${reason}` : ''}`
    );

    res.json({ message: `Account status updated to ${status}.` });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to update account status.' });
  }
});

// CHANGE ROLE
router.post('/users/:userId/role', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { userId } = req.params;
    const { role } = req.body;

    if (!role || !['user', 'support', 'admin'].includes(role)) {
      res.status(400).json({ error: 'Role must be user, support, or admin.' });
      return;
    }

    const userRef = adminDb.collection('users').doc(userId);
    const userSnap = await userRef.get();
    if (!userSnap.exists) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }

    const user = userSnap.data()!;
    await userRef.update({
      role,
      updatedAt: new Date().toISOString(),
    });

    await createAuditLog(
      req.user!.id,
      req.user!.role,
      'ROLE_CHANGED',
      'user',
      userId,
      req.ip || '127.0.0.1',
      req.headers['user-agent'] as string,
      { previousRole: user.role, newRole: role }
    );

    res.json({ message: `User role changed to ${role}.` });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to change user role.' });
  }
});

// CHANGE / ASSIGN VIP LEVEL
router.post('/users/:userId/change-vip', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { userId } = req.params;
    const { vipLevel } = req.body;

    const level = Number(vipLevel);
    if (isNaN(level) || level < 0 || level > 6) {
      res.status(400).json({ error: 'VIP level must be between 0 and 6.' });
      return;
    }

    const userRef = adminDb.collection('users').doc(userId);
    const userSnap = await userRef.get();
    if (!userSnap.exists) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }

    const user = userSnap.data()!;
    await userRef.update({
      vipLevel: level,
      updatedAt: new Date().toISOString(),
    });

    await createAuditLog(
      req.user!.id,
      req.user!.role,
      'VIP_CHANGED',
      'user',
      userId,
      req.ip || '127.0.0.1',
      req.headers['user-agent'] as string,
      { previousVip: user.vipLevel || 0, newVip: level }
    );

    await createNotification(
      userId,
      'VIP',
      'VIP Tier Updated ⭐',
      `Your account VIP tier has been set to VIP ${level} by administration.`
    );

    res.json({ message: `VIP Level set to ${level} successfully.` });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to change VIP level.' });
  }
});

// FREEZE / UNFREEZE WALLET
router.post('/users/:userId/freeze-wallet', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { userId } = req.params;
    const { freeze, reason } = req.body;

    const userSnap = await adminDb.collection('users').doc(userId).get();
    if (!userSnap.exists) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }

    const user = userSnap.data()!;
    const walletId = user.walletId || `wlt-${userId}`;
    const walletRef = adminDb.collection('wallets').doc(walletId);

    const newStatus = freeze ? 'frozen' : 'active';
    await walletRef.update({
      status: newStatus,
      updatedAt: new Date().toISOString(),
    });

    await createAuditLog(
      req.user!.id,
      req.user!.role,
      freeze ? 'WALLET_FROZEN' : 'WALLET_UNFROZEN',
      'wallet',
      walletId,
      req.ip || '127.0.0.1',
      req.headers['user-agent'] as string,
      { targetUserId: userId, reason: reason || 'Administrative action' }
    );

    await createNotification(
      userId,
      'SECURITY',
      freeze ? 'Wallet Frozen ⚠️' : 'Wallet Unfrozen ✅',
      freeze
        ? `Your wallet has been temporarily frozen. Reason: ${reason || 'Security review'}`
        : 'Your wallet has been unfrozen and is fully active.'
    );

    res.json({ message: `Wallet has been ${freeze ? 'frozen' : 'unfrozen'} successfully.` });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to toggle wallet freeze state.' });
  }
});

// SEND PASSWORD RESET LINK / TRIGGER
router.post('/users/:userId/send-password-reset', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { userId } = req.params;
    const userSnap = await adminDb.collection('users').doc(userId).get();
    if (!userSnap.exists) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }

    const user = userSnap.data()!;
    const resetToken = `RST-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;

    await adminDb.collection('passwordResets').doc(resetToken).set({
      token: resetToken,
      userId,
      email: user.email,
      requestedByAdmin: req.user!.id,
      status: 'pending',
      expiresAt: new Date(Date.now() + 3600 * 1000).toISOString(),
      createdAt: new Date().toISOString(),
    });

    await createAuditLog(
      req.user!.id,
      req.user!.role,
      'PASSWORD_RESET_DISPATCHED',
      'user',
      userId,
      req.ip || '127.0.0.1',
      req.headers['user-agent'] as string,
      { email: user.email, resetToken }
    );

    await createNotification(
      userId,
      'SECURITY',
      'Password Reset Initiated 🔑',
      'A secure password reset was initiated for your account. Check your registered email for instructions.'
    );

    res.json({
      message: `Password reset dispatched for ${user.email}.`,
      resetToken,
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to trigger password reset.' });
  }
});

// DELETE / REMOVE USER PERMANENTLY (ADMIN ONLY)
router.delete('/users/:userId', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { userId } = req.params;
    const adminUid = req.user!.id;

    if (userId === adminUid) {
      res.status(400).json({ error: 'Administrators cannot delete their own account from the admin portal.' });
      return;
    }

    const userDocRef = adminDb.collection('users').doc(userId);
    const userSnap = await userDocRef.get();

    if (!userSnap.exists) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }

    const userData = userSnap.data()!;
    if (userData.role === 'admin') {
      res.status(400).json({ error: 'Cannot delete an account with the Admin role.' });
      return;
    }

    const usernameLower = (userData.usernameLowercase || userData.username || '').toLowerCase();
    const walletId = userData.walletId || `wlt-${userId}`;

    // 1. Delete associated collections: investments, deposits, withdrawals, ledgerEntries, notifications, transactions
    const [invSnap, depSnap, wdrSnap, notifSnap, ledgerSnap, txSnap] = await Promise.all([
      adminDb.collection('investments').where('userId', '==', userId).get(),
      adminDb.collection('deposits').where('userId', '==', userId).get(),
      adminDb.collection('withdrawals').where('userId', '==', userId).get(),
      adminDb.collection('notifications').where('userId', '==', userId).get(),
      adminDb.collection('ledgerEntries').where('userId', '==', userId).get(),
      adminDb.collection('transactions').where('userId', '==', userId).get(),
    ]);

    const batch = adminDb.batch();

    // Delete user doc
    batch.delete(userDocRef);

    // Delete user profile doc
    const profileDocRef = adminDb.collection('userProfiles').doc(userId);
    batch.delete(profileDocRef);

    // Delete wallet doc
    const walletDocRef = adminDb.collection('wallets').doc(walletId);
    batch.delete(walletDocRef);

    // Free up username reservation
    if (usernameLower) {
      const usernameDocRef = adminDb.collection('usernames').doc(usernameLower);
      batch.delete(usernameDocRef);
    }

    // Clean up sub-records
    invSnap.forEach((doc) => batch.delete(doc.ref));
    depSnap.forEach((doc) => batch.delete(doc.ref));
    wdrSnap.forEach((doc) => batch.delete(doc.ref));
    notifSnap.forEach((doc) => batch.delete(doc.ref));
    ledgerSnap.forEach((doc) => batch.delete(doc.ref));
    txSnap.forEach((doc) => batch.delete(doc.ref));

    await batch.commit();

    // Log the deletion in system audit trail
    await createAuditLog(
      adminUid,
      req.user!.role,
      'USER_DELETED_PERMANENTLY',
      'user',
      userId,
      req.ip || '127.0.0.1',
      req.headers['user-agent'] as string,
      {
        deletedUserId: userId,
        deletedEmail: userData.email,
        deletedUsername: userData.username,
        walletId,
      }
    );

    res.json({
      success: true,
      message: `User ${userData.email || userData.username || userId} has been permanently deleted along with associated records.`,
    });
  } catch (err: any) {
    console.error('Delete user error:', err);
    res.status(500).json({ error: err.message || 'Failed to remove user account.' });
  }
});

// ==========================================
// 3. CONTROLLED FINANCIAL BALANCE ADJUSTMENTS
// ==========================================
router.post('/adjust-balance', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { userId, type, amount, currency = 'USD', reason, reference } = req.body;
    const adminUid = req.user!.id;
    const adminEmail = req.user!.email;

    if (!userId) {
      res.status(400).json({ error: 'Target User ID is required.' });
      return;
    }

    if (!type || !['adjustment_credit', 'adjustment_debit', 'ADJUSTMENT_CREDIT', 'ADJUSTMENT_DEBIT'].includes(type)) {
      res.status(400).json({ error: 'Type must be adjustment_credit or adjustment_debit.' });
      return;
    }

    const parsedAmount = Number(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      res.status(400).json({ error: 'Adjustment amount must be a positive number greater than 0.' });
      return;
    }

    if (!reason || typeof reason !== 'string' || reason.trim().length < 5) {
      res.status(400).json({ error: 'A valid mandatory reason (minimum 5 characters) is required for all balance adjustments.' });
      return;
    }

    const cleanReference = (reference || `ADJ-REF-${Date.now()}`).trim();
    const isCredit = type.toLowerCase().includes('credit');
    const now = new Date().toISOString();

    const adjustmentId = `ADJ-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const transactionId = `TXN-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const ledgerEntryId1 = `LEDGER-${Date.now()}-1`;
    const ledgerEntryId2 = `LEDGER-${Date.now()}-2`;

    let previousBalance = 0;
    let newBalance = 0;
    let targetUsername = '';

    await adminDb.runTransaction(async (transaction) => {
      // 1. Fetch user doc
      const userRef = adminDb.collection('users').doc(userId);
      const userDoc = await transaction.get(userRef);
      if (!userDoc.exists) {
        throw new Error('Target user account not found.');
      }
      const userData = userDoc.data()!;
      targetUsername = userData.username || userData.email;

      // 2. Fetch wallet doc
      const walletId = userData.walletId || `wlt-${userId}`;
      const walletRef = adminDb.collection('wallets').doc(walletId);
      const walletDoc = await transaction.get(walletRef);
      if (!walletDoc.exists) {
        throw new Error('Target wallet not found.');
      }

      const walletData = walletDoc.data()!;
      if (walletData.status === 'frozen') {
        throw new Error('Cannot adjust balance: target wallet is currently frozen.');
      }

      previousBalance = Number(walletData.availableBalance || 0);
      newBalance = isCredit ? previousBalance + parsedAmount : previousBalance - parsedAmount;

      if (!isCredit && newBalance < 0) {
        throw new Error(`Insufficient funds: User only has $${previousBalance.toFixed(2)} available. Cannot debit $${parsedAmount.toFixed(2)}.`);
      }

      // 3. Update Wallet
      transaction.update(walletRef, {
        availableBalance: newBalance,
        updatedAt: now,
      });

      // 4. Create Transaction Record
      const txnRef = adminDb.collection('transactions').doc(transactionId);
      transaction.set(txnRef, {
        transactionId,
        userId,
        username: targetUsername,
        type: isCredit ? 'ADJUSTMENT_CREDIT' : 'ADJUSTMENT_DEBIT',
        amount: parsedAmount,
        fee: 0,
        currency,
        balanceBefore: previousBalance,
        balanceAfter: newBalance,
        status: 'completed',
        reference: cleanReference,
        description: `Admin Balance Adjustment: ${reason}`,
        adminUid,
        adminEmail,
        createdAt: now,
        updatedAt: now,
      });

      // 5. Append Double-Entry Immutable Ledger
      const ledgerRef1 = adminDb.collection('ledgerEntries').doc(ledgerEntryId1);
      transaction.set(ledgerRef1, {
        entryId: ledgerEntryId1,
        transactionId,
        userId,
        username: targetUsername,
        sourceAccount: isCredit ? 'SYSTEM_ADJUSTMENT_RESERVE' : 'USER_AVAILABLE',
        destinationAccount: isCredit ? 'USER_AVAILABLE' : 'SYSTEM_ADJUSTMENT_RESERVE',
        amount: parsedAmount,
        currency,
        type: isCredit ? 'CREDIT' : 'DEBIT',
        status: 'completed',
        reference: cleanReference,
        reason,
        createdBy: adminEmail,
        description: `Balance adjustment: ${reason}`,
        createdAt: now,
      });

      const ledgerRef2 = adminDb.collection('ledgerEntries').doc(ledgerEntryId2);
      transaction.set(ledgerRef2, {
        entryId: ledgerEntryId2,
        transactionId,
        userId,
        username: targetUsername,
        sourceAccount: isCredit ? 'USER_AVAILABLE' : 'SYSTEM_ADJUSTMENT_RESERVE',
        destinationAccount: isCredit ? 'SYSTEM_ADJUSTMENT_RESERVE' : 'USER_AVAILABLE',
        amount: parsedAmount,
        currency,
        type: isCredit ? 'DEBIT' : 'CREDIT',
        status: 'completed',
        reference: cleanReference,
        reason,
        createdBy: adminEmail,
        description: `Counterpart adjustment: ${reason}`,
        createdAt: now,
      });

      // 6. Record Balance Adjustment entity
      const adjRef = adminDb.collection('balanceAdjustments').doc(adjustmentId);
      transaction.set(adjRef, {
        adjustmentId,
        userId,
        username: targetUsername,
        adminUid,
        adminEmail,
        type: isCredit ? 'adjustment_credit' : 'adjustment_debit',
        amount: parsedAmount,
        currency,
        reason,
        reference: cleanReference,
        previousBalance,
        newBalance,
        status: 'completed',
        createdAt: now,
      });
    });

    // Write audit log
    await createAuditLog(
      adminUid,
      req.user!.role,
      isCredit ? 'BALANCE_CREDITED' : 'BALANCE_DEBITED',
      'user',
      userId,
      req.ip || '127.0.0.1',
      req.headers['user-agent'] as string,
      {
        targetUsername,
        adjustmentId,
        transactionId,
        type: isCredit ? 'credit' : 'debit',
        amount: parsedAmount,
        currency,
        previousBalance,
        newBalance,
        reason,
        reference: cleanReference,
      }
    );

    // Notify user
    await createNotification(
      userId,
      'FINANCIAL',
      isCredit ? 'Balance Credited 💰' : 'Balance Debited 💳',
      `Your available balance has been ${isCredit ? 'credited' : 'debited'} by $${parsedAmount.toFixed(2)} USD. New balance: $${newBalance.toFixed(2)} USD. Note: ${reason}`
    );

    res.json({
      success: true,
      adjustmentId,
      transactionId,
      userId,
      previousBalance,
      newBalance,
      amount: parsedAmount,
      type: isCredit ? 'credit' : 'debit',
      message: `Successfully ${isCredit ? 'credited' : 'debited'} $${parsedAmount.toFixed(2)} USD for @${targetUsername}. New balance: $${newBalance.toFixed(2)} USD.`,
    });
  } catch (err: any) {
    console.error('Balance adjustment error:', err);
    res.status(400).json({ error: err.message || 'Failed to execute balance adjustment.' });
  }
});

// GET BALANCE ADJUSTMENTS HISTORY
router.get('/adjustments', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const snap = await adminDb.collection('balanceAdjustments').orderBy('createdAt', 'desc').limit(100).get();
    const adjustments = snap.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
    res.json({ adjustments });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch adjustments history.' });
  }
});

// ==========================================
// 4. VIP PLANS MANAGEMENT
// ==========================================
router.get('/vip-plans', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const snap = await adminDb.collection('vipPlans').get();
    const plans = snap.docs
      .map((doc) => {
        const d = doc.data();
        return {
          id: d.planId || doc.id,
          planId: d.planId || doc.id,
          level: d.vipLevel,
          vipLevel: d.vipLevel,
          name: d.name,
          investment_amount: d.investmentAmount,
          investmentAmount: d.investmentAmount,
          daily_earning: d.dailyEarning,
          dailyEarning: d.dailyEarning,
          duration_days: d.durationDays,
          durationDays: d.durationDays,
          status: d.status || (d.isActive ? 'active' : 'disabled'),
          is_active: d.status === 'active' ? 1 : 0,
          display_order: d.displayOrder || 1,
          displayOrder: d.displayOrder || 1,
          createdAt: d.createdAt,
          updatedAt: d.updatedAt,
        };
      })
      .sort((a, b) => a.display_order - b.display_order);

    res.json({ plans });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch VIP plans.' });
  }
});

router.post('/vip-plans/update', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id, level, name, investmentAmount, dailyEarning, durationDays, isActive, status, displayOrder } = req.body;

    if (!id || !name || Number(investmentAmount) <= 0 || Number(dailyEarning) <= 0 || Number(durationDays) <= 0) {
      res.status(400).json({ error: 'Invalid VIP plan parameters.' });
      return;
    }

    const planRef = adminDb.collection('vipPlans').doc(id);
    const now = new Date().toISOString();

    const planStatus = status || (isActive ? 'active' : 'disabled');

    await planRef.set(
      {
        planId: id,
        vipLevel: Number(level || 1),
        name,
        investmentAmount: Number(investmentAmount),
        dailyEarning: Number(dailyEarning),
        durationDays: Number(durationDays),
        status: planStatus,
        isActive: planStatus === 'active',
        displayOrder: Number(displayOrder || 1),
        updatedAt: now,
      },
      { merge: true }
    );

    await createAuditLog(
      req.user!.id,
      req.user!.role,
      'VIP_PLAN_UPDATED',
      'vipPlan',
      id,
      req.ip || '127.0.0.1',
      req.headers['user-agent'] as string,
      { name, investmentAmount, dailyEarning, durationDays, status: planStatus }
    );

    res.json({ message: `VIP Plan ${name} updated successfully.` });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to update VIP plan.' });
  }
});

router.post('/vip-plans/create', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { level, name, investmentAmount, dailyEarning, durationDays, status = 'active', displayOrder } = req.body;

    if (!name || Number(investmentAmount) <= 0 || Number(dailyEarning) <= 0 || Number(durationDays) <= 0) {
      res.status(400).json({ error: 'Invalid VIP plan parameters.' });
      return;
    }

    const planId = `vip-plan-${Date.now()}`;
    const now = new Date().toISOString();

    await adminDb.collection('vipPlans').doc(planId).set({
      planId,
      vipLevel: Number(level || 1),
      name,
      investmentAmount: Number(investmentAmount),
      dailyEarning: Number(dailyEarning),
      durationDays: Number(durationDays),
      status,
      isActive: status === 'active',
      displayOrder: Number(displayOrder || 1),
      createdAt: now,
      updatedAt: now,
    });

    await createAuditLog(
      req.user!.id,
      req.user!.role,
      'VIP_PLAN_CREATED',
      'vipPlan',
      planId,
      req.ip || '127.0.0.1',
      req.headers['user-agent'] as string,
      { name, investmentAmount, dailyEarning }
    );

    res.status(201).json({ message: `VIP Plan ${name} created successfully.`, planId });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to create VIP plan.' });
  }
});

// ==========================================
// 5. DEPOSITS & RECONCILIATION
// ==========================================
router.get('/deposits', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const snap = await adminDb.collection('deposits').get();
    const deposits: any[] = [];

    for (const doc of snap.docs) {
      const d = doc.data();
      const userSnap = await adminDb.collection('users').doc(d.userId).get();
      const user = userSnap.exists ? userSnap.data() : null;

      deposits.push({
        id: d.depositId || doc.id,
        depositId: d.depositId || doc.id,
        user_id: d.userId,
        userId: d.userId,
        username: user?.username || user?.email?.split('@')[0] || 'N/A',
        email: user?.email || 'N/A',
        amount: Number(d.amount || 0),
        currency: d.currency || 'USD',
        payment_method: d.paymentProvider || 'USD Gateway',
        paymentProvider: d.paymentProvider || 'USD Gateway',
        providerReference: d.providerReference || '',
        status: d.status,
        fee: Number(d.fee || 0),
        created_at: d.createdAt,
        createdAt: d.createdAt,
      });
    }

    deposits.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    res.json({ deposits });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch deposits.' });
  }
});

router.post('/deposits/:id/reconcile', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { notes } = req.body;

    const depRef = adminDb.collection('deposits').doc(id);
    const depSnap = await depRef.get();

    if (!depSnap.exists) {
      res.status(404).json({ error: 'Deposit record not found.' });
      return;
    }

    const deposit = depSnap.data()!;
    if (deposit.status === 'completed') {
      res.status(400).json({ error: 'Deposit has already been reconciled and completed.' });
      return;
    }

    const now = new Date().toISOString();

    // 1. Credit wallet via double-entry financial ledger
    const txnResult = await executeFinancialTransaction({
      userId: deposit.userId,
      type: 'DEPOSIT',
      amount: Number(deposit.amount),
      referenceId: id,
      description: `USD Deposit Reconciled (#${id}): ${notes || 'Manual admin bank wire reconciliation'}`,
    });

    // 2. Mark deposit completed
    await depRef.update({
      status: 'completed',
      reconciledBy: req.user!.id,
      reconciliationNotes: notes || 'Admin verified',
      transactionId: txnResult.transactionId,
      updatedAt: now,
    });

    await createAuditLog(
      req.user!.id,
      req.user!.role,
      'DEPOSIT_RECONCILED',
      'deposit',
      id,
      req.ip || '127.0.0.1',
      req.headers['user-agent'] as string,
      { amount: deposit.amount, userId: deposit.userId, transactionId: txnResult.transactionId }
    );

    await createNotification(
      deposit.userId,
      'DEPOSIT',
      'Deposit Credited ✅',
      `Your deposit of $${Number(deposit.amount).toFixed(2)} USD has been approved and credited to your available balance.`
    );

    res.json({
      message: `Deposit #${id} reconciled and credited successfully.`,
      transactionId: txnResult.transactionId,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to reconcile deposit.' });
  }
});

// ==========================================
// 7. WITHDRAWALS APPROVAL QUEUE
// ==========================================
router.get('/withdrawals', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const snap = await adminDb.collection('withdrawals').get();
    const withdrawals: any[] = [];

    for (const doc of snap.docs) {
      const w = doc.data();
      const userSnap = await adminDb.collection('users').doc(w.userId).get();
      const user = userSnap.exists ? userSnap.data() : null;

      const profileSnap = await adminDb.collection('userProfiles').doc(w.userId).get();
      const profile = profileSnap.exists ? profileSnap.data() : null;

      withdrawals.push({
        id: w.withdrawalId || doc.id,
        withdrawalId: w.withdrawalId || doc.id,
        user_id: w.userId,
        userId: w.userId,
        username: user?.username || user?.email?.split('@')[0] || 'N/A',
        email: user?.email || 'N/A',
        full_name: profile ? `${profile.firstName || ''} ${profile.lastName || ''}`.trim() : user?.displayName || 'Investor',
        amount: Number(w.amount || 0),
        fee: Number(w.fee || 0),
        net_amount: Number(w.netAmount || w.amount || 0),
        netAmount: Number(w.netAmount || w.amount || 0),
        payment_method: w.method || 'Bank Transfer',
        method: w.method || 'Bank Transfer',
        payment_details: typeof w.paymentDetails === 'string' ? w.paymentDetails : JSON.stringify(w.paymentDetails || {}),
        paymentDetails: w.paymentDetails || {},
        status: w.status,
        riskStatus: w.riskStatus || 'low',
        rejection_reason: w.reviewReason || null,
        reviewReason: w.reviewReason || null,
        created_at: w.createdAt,
        createdAt: w.createdAt,
      });
    }

    withdrawals.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    res.json({ withdrawals });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch withdrawal queue.' });
  }
});

router.post('/withdrawals/:id/approve', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const wRef = adminDb.collection('withdrawals').doc(id);
    const wSnap = await wRef.get();

    if (!wSnap.exists) {
      res.status(404).json({ error: 'Withdrawal request not found.' });
      return;
    }

    const w = wSnap.data()!;
    if (w.status !== 'pending' && w.status !== 'processing') {
      res.status(400).json({ error: `Cannot approve withdrawal with status: ${w.status}.` });
      return;
    }

    const now = new Date().toISOString();
    await wRef.update({
      status: 'completed',
      processedBy: req.user!.id,
      updatedAt: now,
    });

    await createNotification(
      w.userId,
      'WITHDRAWAL',
      'Withdrawal Approved & Sent ✅',
      `Your withdrawal request of $${Number(w.netAmount || w.amount).toFixed(2)} USD via ${w.method || 'selected payout gateway'} has been approved and completed.`
    );

    await createAuditLog(
      req.user!.id,
      req.user!.role,
      'WITHDRAWAL_APPROVED',
      'withdrawal',
      id,
      req.ip || '127.0.0.1',
      req.headers['user-agent'] as string,
      { amount: w.amount, netAmount: w.netAmount, method: w.method, userId: w.userId }
    );

    res.json({ message: `Withdrawal #${id} approved and marked completed.` });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to approve withdrawal.' });
  }
});

router.post('/withdrawals/:id/reject', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const wRef = adminDb.collection('withdrawals').doc(id);
    const wSnap = await wRef.get();

    if (!wSnap.exists) {
      res.status(404).json({ error: 'Withdrawal request not found.' });
      return;
    }

    const w = wSnap.data()!;
    if (w.status !== 'pending' && w.status !== 'processing') {
      res.status(400).json({ error: `Cannot reject withdrawal with status: ${w.status}.` });
      return;
    }

    const now = new Date().toISOString();
    await wRef.update({
      status: 'rejected',
      reviewReason: reason || 'Administrative compliance rejection',
      reviewedBy: req.user!.id,
      updatedAt: now,
    });

    // Refund full deduction (net amount + fee) via Ledger Adjustment
    const refundAmount = Number(w.amount || 0);
    await executeFinancialTransaction({
      userId: w.userId,
      type: 'ADJUSTMENT',
      amount: refundAmount,
      referenceId: id,
      description: `Withdrawal Rejection Refund (#${id}): ${reason || 'Administrative compliance rejection'}`,
    });

    await createNotification(
      w.userId,
      'WITHDRAWAL',
      'Withdrawal Rejected & Refunded ❌',
      `Your withdrawal request of $${refundAmount.toFixed(2)} was rejected. The funds have been refunded to your available balance. Reason: ${reason || 'N/A'}`
    );

    await createAuditLog(
      req.user!.id,
      req.user!.role,
      'WITHDRAWAL_REJECTED',
      'withdrawal',
      id,
      req.ip || '127.0.0.1',
      req.headers['user-agent'] as string,
      { amount: refundAmount, userId: w.userId, reason }
    );

    res.json({ message: `Withdrawal rejected and $${refundAmount.toFixed(2)} refunded to user balance.` });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to reject withdrawal.' });
  }
});

// ==========================================
// 8. TRANSACTIONS & DOUBLE-ENTRY LEDGER
// ==========================================
router.get('/transactions', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { userId, type, status, limit = 100 } = req.query;
    let query: any = adminDb.collection('transactions').orderBy('createdAt', 'desc').limit(Number(limit));

    const snap = await query.get();
    let transactions = snap.docs.map((doc: any) => ({
      id: doc.id,
      ...doc.data(),
    }));

    if (userId) {
      transactions = transactions.filter((t: any) => t.userId === userId);
    }
    if (type && type !== 'all') {
      transactions = transactions.filter((t: any) => t.type === type);
    }
    if (status && status !== 'all') {
      transactions = transactions.filter((t: any) => t.status === status);
    }

    res.json({ transactions });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch transactions.' });
  }
});

router.get('/ledger', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { userId, type, limit = 100 } = req.query;
    let query: any = adminDb.collection('ledgerEntries').orderBy('createdAt', 'desc').limit(Number(limit));

    const snap = await query.get();
    let entries = snap.docs.map((doc: any) => ({
      id: doc.id,
      ...doc.data(),
    }));

    if (userId) {
      entries = entries.filter((e: any) => e.userId === userId);
    }
    if (type && type !== 'all') {
      entries = entries.filter((e: any) => e.type === type);
    }

    res.json({ entries });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch double-entry ledger.' });
  }
});

// ==========================================
// 9. AUDIT LOGS
// ==========================================
router.get('/audit-logs', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { action, actorUid, limit = 100 } = req.query;
    const snap = await adminDb.collection('auditLogs').orderBy('createdAt', 'desc').limit(Number(limit)).get();

    let logs = snap.docs.map((doc) => {
      const d = doc.data();
      return {
        id: d.logId || doc.id,
        logId: d.logId || doc.id,
        actorUid: d.actorUid,
        actorRole: d.actorRole,
        action: d.action || d.event_type,
        event_type: d.action || d.event_type,
        targetType: d.targetType,
        targetId: d.targetId,
        ipAddress: d.ipAddress,
        ip_address: d.ipAddress,
        userAgent: d.userAgent,
        metadata: d.metadata || {},
        details: JSON.stringify(d.metadata || {}),
        createdAt: d.createdAt,
        created_at: d.createdAt,
      };
    });

    if (action && action !== 'all') {
      logs = logs.filter((l) => l.action === action);
    }
    if (actorUid) {
      logs = logs.filter((l) => l.actorUid === actorUid);
    }

    res.json({ logs });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch audit logs.' });
  }
});

// ==========================================
// 10. GLOBAL SEARCH
// ==========================================
router.get('/search', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { q } = req.query;
    if (!q || typeof q !== 'string' || !q.trim()) {
      res.json({ users: [], transactions: [], deposits: [], withdrawals: [] });
      return;
    }

    const term = q.trim().toLowerCase();

    // 1. Search Users
    const usersSnap = await adminDb.collection('users').get();
    const matchedUsers: any[] = [];
    usersSnap.forEach((doc) => {
      const u = doc.data();
      const uid = u.uid || doc.id;
      const username = (u.username || '').toLowerCase();
      const email = (u.email || '').toLowerCase();
      const walletId = (u.walletId || '').toLowerCase();
      if (uid.toLowerCase().includes(term) || username.includes(term) || email.includes(term) || walletId.includes(term)) {
        matchedUsers.push({
          uid,
          username: u.username || email.split('@')[0],
          email: u.email,
          role: u.role,
          accountStatus: u.accountStatus || u.status || 'active',
          vipLevel: u.vipLevel || 0,
        });
      }
    });

    // 2. Search Transactions
    const txnsSnap = await adminDb.collection('transactions').limit(50).get();
    const matchedTxns: any[] = [];
    txnsSnap.forEach((doc) => {
      const t = doc.data();
      const txnId = (t.transactionId || doc.id).toLowerCase();
      const ref = (t.reference || '').toLowerCase();
      const desc = (t.description || '').toLowerCase();
      if (txnId.includes(term) || ref.includes(term) || desc.includes(term)) {
        matchedTxns.push({ id: doc.id, ...t });
      }
    });

    res.json({
      users: matchedUsers.slice(0, 10),
      transactions: matchedTxns.slice(0, 10),
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to perform global search.' });
  }
});

// ==========================================
// 11. PROCESS DAILY RETURNS (CRON TRIGGER)
// ==========================================
router.post('/process-daily-returns', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const now = new Date().toISOString();

    const invSnap = await adminDb.collection('investments').where('status', '==', 'active').get();
    let processedCount = 0;
    let totalCredited = 0;

    for (const doc of invSnap.docs) {
      const inv = doc.data();
      const lastEarningDate = inv.lastEarningDate || '';

      if (lastEarningDate.startsWith(today)) {
        continue;
      }

      const dailyEarning = Number(inv.dailyEarning || 0);
      if (dailyEarning <= 0) continue;

      // Credit daily earning via double-entry ledger
      await executeFinancialTransaction({
        userId: inv.userId,
        type: 'DAILY_EARNING',
        amount: dailyEarning,
        referenceId: inv.investmentId || doc.id,
        description: `Daily Returns Credit for ${inv.planName || 'VIP Plan'} (#${inv.investmentId || doc.id})`,
      });

      const newDaysCredited = Number(inv.daysCredited || 0) + 1;
      const newTotalEarned = Number(inv.totalEarned || 0) + dailyEarning;
      const isMatured = newDaysCredited >= Number(inv.durationDays || 120);

      const updatePayload: any = {
        daysCredited: newDaysCredited,
        totalEarned: newTotalEarned,
        lastEarningDate: now,
        updatedAt: now,
      };

      if (isMatured) {
        updatePayload.status = 'completed';
        // Return principal back to user available balance
        await executeFinancialTransaction({
          userId: inv.userId,
          type: 'INVESTMENT_MATURITY',
          amount: Number(inv.investmentAmount || 0),
          referenceId: inv.investmentId || doc.id,
          description: `Investment Principal Maturity Payout: ${inv.planName || 'VIP Plan'} (#${inv.investmentId || doc.id})`,
        });
      }

      await doc.ref.update(updatePayload);

      await createNotification(
        inv.userId,
        'DAILY_EARNING',
        'Daily Returns Credited! 💵',
        `You received $${dailyEarning.toFixed(2)} USD from your active ${inv.planName || 'VIP Investment'}.`
      );

      processedCount++;
      totalCredited += dailyEarning;
    }

    await createAuditLog(
      req.user!.id,
      req.user!.role,
      'DAILY_RETURNS_PROCESSED',
      'system',
      'cron',
      req.ip || '127.0.0.1',
      req.headers['user-agent'] as string,
      { processedCount, totalCredited, date: today }
    );

    res.json({
      success: true,
      processedCount,
      totalCredited,
      message: `Processed daily returns: ${processedCount} active investment(s) credited with total $${totalCredited.toFixed(2)} USD.`,
    });
  } catch (err: any) {
    console.error('Process daily returns error:', err);
    res.status(500).json({ error: err.message || 'Failed to process daily returns.' });
  }
});

export default router;
