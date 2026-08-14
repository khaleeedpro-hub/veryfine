import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import { adminDb } from '../firebase/admin';
import {
  authenticateToken,
  AuthenticatedRequest,
  generateToken,
  loginRateLimiter,
  resetLoginRateLimit,
} from '../middleware/auth';
import { createAuditLog, createNotification } from '../services/ledgerService';

const router = Router();

// 1. REGISTER
router.post('/register', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { email, password, withdrawalPin, fullName, username, country } = req.body;

    if (!email || typeof email !== 'string' || !email.includes('@')) {
      res.status(400).json({ error: 'Please provide a valid email address.' });
      return;
    }

    if (!password || typeof password !== 'string' || password.length < 6) {
      res.status(400).json({ error: 'Password must be at least 6 characters long.' });
      return;
    }

    if (!withdrawalPin || typeof withdrawalPin !== 'string' || !/^\d{4}$/.test(withdrawalPin)) {
      res.status(400).json({ error: 'Withdrawal PIN must consist of exactly 4 numeric digits.' });
      return;
    }

    const cleanEmail = email.toLowerCase().trim();

    // Check if email already exists in Firestore
    const existingEmailSnap = await adminDb
      .collection('users')
      .where('email', '==', cleanEmail)
      .limit(1)
      .get();

    if (!existingEmailSnap.empty) {
      res.status(400).json({ error: 'An account with this email address already exists.' });
      return;
    }

    // Determine and normalize username
    let rawUsername = username;
    if (!rawUsername || typeof rawUsername !== 'string' || !rawUsername.trim()) {
      // Auto-generate username from email prefix
      rawUsername = cleanEmail.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '_');
    }
    const cleanUsername = rawUsername.trim();
    const cleanUsernameLower = cleanUsername.toLowerCase();

    if (cleanUsernameLower.length < 3 || cleanUsernameLower.length > 30 || !/^[a-z0-9_]+$/.test(cleanUsernameLower)) {
      res.status(400).json({ error: 'Username must be 3-30 characters long and contain only letters, numbers, and underscores.' });
      return;
    }

    // Check username availability in usernames collection
    const usernameDoc = await adminDb.collection('usernames').doc(cleanUsernameLower).get();
    if (usernameDoc.exists) {
      res.status(400).json({ error: 'This username is already taken. Please choose another one.' });
      return;
    }

    const uid = `usr-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const walletId = `wlt-${uid}`;
    const walletAddress = `WALLET-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
    const passwordHash = await bcrypt.hash(password, 10);
    const withdrawalPinHash = await bcrypt.hash(withdrawalPin, 10);
    const now = new Date().toISOString();

    const nameParts = (fullName || cleanUsername).trim().split(' ');
    const firstName = nameParts[0] || cleanUsername;
    const lastName = nameParts.slice(1).join(' ') || '';

    // Atomic creation
    const batch = adminDb.batch();

    // 1. Reserve username
    const usernameRef = adminDb.collection('usernames').doc(cleanUsernameLower);
    batch.set(usernameRef, {
      username: cleanUsername,
      usernameLowercase: cleanUsernameLower,
      uid,
      createdAt: now,
    });

    // 2. Create User Doc
    const userRef = adminDb.collection('users').doc(uid);
    batch.set(userRef, {
      uid,
      username: cleanUsername,
      usernameLowercase: cleanUsernameLower,
      email: cleanEmail,
      displayName: fullName || cleanUsername,
      passwordHash,
      withdrawalPinHash,
      role: 'user',
      status: 'active',
      accountStatus: 'active',
      vipLevel: 0,
      walletId,
      country: country || 'United States',
      emailVerified: true,
      twoFactorEnabled: false,
      createdAt: now,
      updatedAt: now,
      lastLoginAt: now,
    });

    // 3. Create User Profile Doc
    const profileRef = adminDb.collection('userProfiles').doc(uid);
    batch.set(profileRef, {
      uid,
      firstName,
      lastName,
      phone: '',
      country: country || 'United States',
      dateOfBirth: '',
      address: '',
      profileImage: '',
      createdAt: now,
      updatedAt: now,
    });

    // 4. Create Wallet Doc ($0 initial balance)
    const walletRef = adminDb.collection('wallets').doc(walletId);
    batch.set(walletRef, {
      walletId,
      uid,
      walletAddress,
      currency: 'USD',
      availableBalance: 0.0,
      investedBalance: 0.0,
      totalEarnings: 0.0,
      totalDeposits: 0.0,
      totalWithdrawals: 0.0,
      totalTransfers: 0.0,
      status: 'active',
      createdAt: now,
      updatedAt: now,
    });

    await batch.commit();

    await createAuditLog(uid, 'user', 'REGISTER_SUCCESS', 'user', uid, req.ip || '127.0.0.1', req.headers['user-agent'] as string, { username: cleanUsername });
    await createNotification(
      uid,
      'SYSTEM',
      'Welcome to VeryFineInvest USD! 🚀',
      `Your account @${cleanUsername} and secure USD wallet have been created.`
    );

    const token = generateToken({ id: uid, email: cleanEmail, role: 'user' });

    res.status(201).json({
      token,
      user: {
        id: uid,
        uid,
        username: cleanUsername,
        email: cleanEmail,
        role: 'user',
        accountStatus: 'active',
        vipLevel: 0,
        fullName: fullName || cleanUsername,
        walletAddress,
        walletId,
      },
    });
  } catch (err: any) {
    console.error('Registration error:', err);
    res.status(500).json({ error: 'Server error during registration.' });
  }
});

// 2. LOGIN
router.post('/login', loginRateLimiter, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { email, username, password } = req.body;
    const identifier = (email || username || '').toString().toLowerCase().trim();

    if (!identifier || !password) {
      res.status(400).json({ error: 'Email/username and password are required.' });
      return;
    }

    let userDoc: any = null;

    if (identifier.includes('@')) {
      const userSnap = await adminDb
        .collection('users')
        .where('email', '==', identifier)
        .limit(1)
        .get();
      if (!userSnap.empty) {
        userDoc = userSnap.docs[0];
      }
    } else {
      const usernameSnap = await adminDb.collection('usernames').doc(identifier).get();
      if (usernameSnap.exists) {
        const uid = usernameSnap.data()?.uid;
        if (uid) {
          const uSnap = await adminDb.collection('users').doc(uid).get();
          if (uSnap.exists) {
            userDoc = uSnap;
          }
        }
      }
    }

    if (!userDoc) {
      res.status(401).json({ error: 'Invalid credentials.' });
      return;
    }

    const user = userDoc.data();

    if (user.accountStatus === 'suspended' || user.status === 'suspended') {
      res.status(403).json({
        error: 'Your account has been suspended. Please contact administrative support.',
      });
      return;
    }

    if (user.accountStatus === 'closed') {
      res.status(403).json({
        error: 'This account has been closed.',
      });
      return;
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash || '');
    if (!isMatch) {
      await createAuditLog(
        user.uid,
        user.role,
        'LOGIN_FAILED',
        'user',
        user.uid,
        req.ip || '127.0.0.1'
      );
      res.status(401).json({ error: 'Invalid email or password.' });
      return;
    }

    const now = new Date().toISOString();
    await adminDb.collection('users').doc(user.uid).update({
      lastLoginAt: now,
      updatedAt: now,
    });

    resetLoginRateLimit(req.ip || '127.0.0.1');
    await createAuditLog(
      user.uid,
      user.role,
      'LOGIN_SUCCESS',
      'user',
      user.uid,
      req.ip || '127.0.0.1'
    );

    const token = generateToken({ id: user.uid, email: user.email, role: user.role });

    const walletId = user.walletId || `wlt-${user.uid}`;
    let profileSnap = await adminDb.collection('userProfiles').doc(user.uid).get();
    let walletSnap = await adminDb.collection('wallets').doc(walletId).get();

    // Auto-create wallet if missing
    if (!walletSnap.exists) {
      const walletAddress = `WALLET-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
      await adminDb.collection('wallets').doc(walletId).set({
        walletId,
        uid: user.uid,
        walletAddress,
        currency: 'USD',
        availableBalance: 0.0,
        investedBalance: 0.0,
        totalEarnings: 0.0,
        totalDeposits: 0.0,
        totalWithdrawals: 0.0,
        totalTransfers: 0,
        status: 'active',
        createdAt: now,
        updatedAt: now,
      });
      walletSnap = await adminDb.collection('wallets').doc(walletId).get();
    }

    const profile = profileSnap.exists ? profileSnap.data() : null;
    const wallet = walletSnap.exists ? walletSnap.data() : null;

    const fullName = profile
      ? `${profile.firstName || ''} ${profile.lastName || ''}`.trim() || user.displayName
      : user.displayName || user.username || 'Investor';

    res.json({
      token,
      user: {
        id: user.uid,
        uid: user.uid,
        username: user.username || user.email.split('@')[0],
        email: user.email,
        role: user.role,
        accountStatus: user.accountStatus || user.status || 'active',
        vipLevel: user.vipLevel || 0,
        fullName,
        country: user.country || 'United States',
        walletAddress: wallet?.walletAddress || '',
        walletId,
        twoFactorEnabled: Boolean(user.twoFactorEnabled),
      },
    });
  } catch (err: any) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Server error during login.' });
  }
});

// 2.5 GOOGLE AUTH / TOKEN EXCHANGE
router.post('/google', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { uid, email, displayName, photoURL } = req.body;

    if (!uid || !email) {
      res.status(400).json({ error: 'UID and Email are required for Google authentication.' });
      return;
    }

    const cleanEmail = email.toLowerCase().trim();
    const now = new Date().toISOString();

    let userSnap = await adminDb.collection('users').doc(uid).get();
    let actualUid = uid;

    if (!userSnap.exists) {
      // Check if user exists with matching email
      const existingByEmail = await adminDb
        .collection('users')
        .where('email', '==', cleanEmail)
        .limit(1)
        .get();

      if (!existingByEmail.empty) {
        const existingDoc = existingByEmail.docs[0];
        actualUid = existingDoc.id;
        userSnap = existingDoc;
      }
    }

    const walletId = `wlt-${actualUid}`;
    let user = userSnap.exists ? userSnap.data()! : null;

    if (!user) {
      // Provision brand new Google account
      const walletAddress = `WALLET-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
      const nameParts = (displayName || 'Google Investor').trim().split(' ');
      const firstName = nameParts[0] || 'Investor';
      const lastName = nameParts.slice(1).join(' ') || '';

      const baseUsername = cleanEmail.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase();
      let chosenUsername = baseUsername;
      let counter = 1;
      while ((await adminDb.collection('usernames').doc(chosenUsername).get()).exists) {
        chosenUsername = `${baseUsername}${counter}`;
        counter++;
      }

      await adminDb.collection('usernames').doc(chosenUsername).set({
        username: chosenUsername,
        usernameLowercase: chosenUsername,
        uid: actualUid,
        createdAt: now,
      });

      user = {
        uid: actualUid,
        username: chosenUsername,
        usernameLowercase: chosenUsername,
        email: cleanEmail,
        displayName: displayName || chosenUsername,
        role: 'user',
        status: 'active',
        accountStatus: 'active',
        vipLevel: 0,
        walletId,
        country: 'United States',
        emailVerified: true,
        twoFactorEnabled: false,
        authProvider: 'google',
        createdAt: now,
        updatedAt: now,
        lastLoginAt: now,
      };

      await adminDb.collection('users').doc(actualUid).set(user);

      await adminDb.collection('userProfiles').doc(actualUid).set({
        uid: actualUid,
        firstName,
        lastName,
        phone: '',
        country: 'United States',
        profileImage: photoURL || '',
        createdAt: now,
        updatedAt: now,
      });

      await adminDb.collection('wallets').doc(walletId).set({
        walletId,
        uid: actualUid,
        walletAddress,
        currency: 'USD',
        availableBalance: 0.0,
        investedBalance: 0.0,
        totalEarnings: 0.0,
        totalDeposits: 0.0,
        totalWithdrawals: 0.0,
        totalTransfers: 0,
        status: 'active',
        createdAt: now,
        updatedAt: now,
      });
    }

    if (user.accountStatus === 'suspended' || user.status === 'suspended') {
      res.status(403).json({
        error: 'Your account has been suspended by compliance. Please contact support.',
      });
      return;
    }

    const token = generateToken({ id: actualUid, email: user.email, role: user.role || 'user' });

    let profileSnap = await adminDb.collection('userProfiles').doc(actualUid).get();
    let walletSnap = await adminDb.collection('wallets').doc(user.walletId || walletId).get();

    if (!walletSnap.exists) {
      const walletAddress = `WALLET-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
      await adminDb.collection('wallets').doc(walletId).set({
        walletId,
        uid: actualUid,
        walletAddress,
        currency: 'USD',
        availableBalance: 0.0,
        investedBalance: 0.0,
        totalEarnings: 0.0,
        totalDeposits: 0.0,
        totalWithdrawals: 0.0,
        totalTransfers: 0,
        status: 'active',
        createdAt: now,
        updatedAt: now,
      });
      walletSnap = await adminDb.collection('wallets').doc(walletId).get();
    }

    const profile = profileSnap.exists ? profileSnap.data() : null;
    const wallet = walletSnap.exists ? walletSnap.data() : null;

    const fullName = profile
      ? `${profile.firstName || ''} ${profile.lastName || ''}`.trim() || user.displayName
      : user.displayName || user.username || 'Google Investor';

    res.json({
      token,
      user: {
        id: actualUid,
        uid: actualUid,
        username: user.username || user.email.split('@')[0],
        email: user.email,
        role: user.role || 'user',
        accountStatus: user.accountStatus || user.status || 'active',
        vipLevel: user.vipLevel || 0,
        fullName,
        country: user.country || 'United States',
        walletAddress: wallet?.walletAddress || '',
        walletId: user.walletId || walletId,
        twoFactorEnabled: Boolean(user.twoFactorEnabled),
      },
    });
  } catch (err: any) {
    console.error('Google login route error:', err);
    res.status(500).json({ error: 'Server error during Google login.' });
  }
});

// 3. ME (Current User Info)
router.get('/me', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const uid = req.user!.id;
    const userSnap = await adminDb.collection('users').doc(uid).get();

    if (!userSnap.exists) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }

    const user = userSnap.data()!;
    const walletId = user.walletId || `wlt-${uid}`;
    let profileSnap = await adminDb.collection('userProfiles').doc(uid).get();
    let walletSnap = await adminDb.collection('wallets').doc(walletId).get();

    // Auto-create wallet if missing
    if (!walletSnap.exists) {
      const now = new Date().toISOString();
      const walletAddress = `WALLET-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
      await adminDb.collection('wallets').doc(walletId).set({
        walletId,
        uid,
        walletAddress,
        currency: 'USD',
        availableBalance: 0.0,
        investedBalance: 0.0,
        totalEarnings: 0.0,
        totalDeposits: 0.0,
        totalWithdrawals: 0.0,
        totalTransfers: 0,
        status: 'active',
        createdAt: now,
        updatedAt: now,
      });
      walletSnap = await adminDb.collection('wallets').doc(walletId).get();
    }

    const profile = profileSnap.exists ? profileSnap.data() : null;
    const wallet = walletSnap.exists ? walletSnap.data() : null;

    res.json({
      user: {
        id: user.uid || uid,
        uid: user.uid || uid,
        username: user.username || user.email.split('@')[0],
        email: user.email,
        role: user.role || 'user',
        accountStatus: user.accountStatus || user.status || 'active',
        vipLevel: user.vipLevel || 0,
        pinCooldownUntil: user.pinResetCooldownUntil || null,
        twoFactorEnabled: Boolean(user.twoFactorEnabled),
      },
      profile: {
        user_id: uid,
        full_name: profile
          ? `${profile.firstName || ''} ${profile.lastName || ''}`.trim() || user.displayName
          : user.displayName || user.username || 'Investor',
        country: user.country || profile?.country || 'United States',
      },
      wallet: wallet
        ? {
            id: wallet.walletId,
            walletId: wallet.walletId,
            user_id: uid,
            wallet_address: wallet.walletAddress,
            walletAddress: wallet.walletAddress,
            available_balance: Number(wallet.availableBalance || 0),
            availableBalance: Number(wallet.availableBalance || 0),
            invested_balance: Number(wallet.investedBalance || 0),
            investedBalance: Number(wallet.investedBalance || 0),
            total_earnings: Number(wallet.totalEarnings || 0),
            totalEarnings: Number(wallet.totalEarnings || 0),
            total_deposits: Number(wallet.totalDeposits || 0),
            totalDeposits: Number(wallet.totalDeposits || 0),
            total_withdrawals: Number(wallet.totalWithdrawals || 0),
            totalWithdrawals: Number(wallet.totalWithdrawals || 0),
            total_transfers_sent: Number(wallet.totalTransfers || 0),
            total_transfers_received: Number(wallet.totalTransfers || 0),
            status: wallet.status || 'active',
          }
        : null,
    });
  } catch (err: any) {
    console.error('Fetch /me error:', err);
    res.status(500).json({ error: 'Failed to fetch user context.' });
  }
});

// 4. VERIFY PIN
router.post('/verify-pin', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { pin } = req.body;
    const uid = req.user!.id;

    if (!pin || typeof pin !== 'string') {
      res.status(400).json({ error: 'Withdrawal PIN is required.' });
      return;
    }

    const userSnap = await adminDb.collection('users').doc(uid).get();
    if (!userSnap.exists) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }

    const user = userSnap.data()!;

    if (user.pinResetCooldownUntil) {
      const cooldownEnd = new Date(user.pinResetCooldownUntil).getTime();
      if (Date.now() < cooldownEnd) {
        const remainingHours = Math.ceil((cooldownEnd - Date.now()) / (1000 * 60 * 60));
        res.status(403).json({
          error: `Withdrawals are locked due to a recent PIN reset cooldown (${remainingHours} hours remaining).`,
        });
        return;
      }
    }

    const isMatch = await bcrypt.compare(pin, user.withdrawalPinHash || '');
    if (!isMatch) {
      await createAuditLog(
        uid,
        req.user!.role,
        'PIN_VERIFICATION_FAILED',
        'user',
        uid,
        req.ip || '127.0.0.1'
      );
      res.status(401).json({ error: 'Incorrect 4-digit withdrawal PIN.' });
      return;
    }

    res.json({ verified: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to verify PIN.' });
  }
});

// 5. RESET PIN
router.post('/reset-pin', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { password, newPin } = req.body;
    const uid = req.user!.id;

    if (!password || !newPin || !/^\d{4}$/.test(newPin)) {
      res.status(400).json({ error: 'Password and a new 4-digit numeric PIN are required.' });
      return;
    }

    const userSnap = await adminDb.collection('users').doc(uid).get();
    if (!userSnap.exists) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }

    const user = userSnap.data()!;
    const isMatch = await bcrypt.compare(password, user.passwordHash || '');
    if (!isMatch) {
      res.status(401).json({ error: 'Incorrect account password provided.' });
      return;
    }

    const newPinHash = await bcrypt.hash(newPin, 10);
    const cooldownUntil = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const now = new Date().toISOString();

    await adminDb.collection('users').doc(uid).update({
      withdrawalPinHash: newPinHash,
      pinResetCooldownUntil: cooldownUntil,
      updatedAt: now,
    });

    await createAuditLog(
      uid,
      req.user!.role,
      'PIN_RESET_SUCCESS',
      'user',
      uid,
      req.ip || '127.0.0.1'
    );
    await createNotification(
      uid,
      'SECURITY',
      'Withdrawal PIN Updated 🔒',
      'Your withdrawal PIN has been updated. A 24-hour security cooldown on withdrawals is now active.'
    );

    res.json({
      message:
        'Withdrawal PIN reset successfully. A 24-hour withdrawal cooldown is active for account protection.',
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to reset PIN.' });
  }
});

// 6. UPDATE PIN (Current PIN -> New PIN)
router.post('/update-pin', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { currentPin, newPin } = req.body;
    const uid = req.user!.id;

    if (!newPin || !/^\d{4}$/.test(newPin)) {
      res.status(400).json({ error: 'New PIN must be exactly 4 numeric digits.' });
      return;
    }

    const userSnap = await adminDb.collection('users').doc(uid).get();
    if (!userSnap.exists) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }

    const user = userSnap.data()!;
    if (user.withdrawalPinHash && currentPin) {
      const isMatch = await bcrypt.compare(currentPin, user.withdrawalPinHash);
      if (!isMatch) {
        res.status(401).json({ error: 'Current 4-digit PIN is incorrect.' });
        return;
      }
    }

    const newPinHash = await bcrypt.hash(newPin, 10);
    const cooldownUntil = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const now = new Date().toISOString();

    await adminDb.collection('users').doc(uid).update({
      withdrawalPinHash: newPinHash,
      pinResetCooldownUntil: cooldownUntil,
      updatedAt: now,
    });

    await createNotification(
      uid,
      'SECURITY',
      'Withdrawal PIN Updated 🔒',
      'Your withdrawal PIN has been updated successfully.'
    );

    res.json({ message: 'Security PIN updated successfully.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update PIN.' });
  }
});

// 7. UPDATE PASSWORD
router.post('/update-password', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const uid = req.user!.id;

    if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 6) {
      res.status(400).json({ error: 'New password must be at least 6 characters long.' });
      return;
    }

    const userSnap = await adminDb.collection('users').doc(uid).get();
    if (!userSnap.exists) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }

    const user = userSnap.data()!;
    if (user.passwordHash && currentPassword) {
      const isMatch = await bcrypt.compare(currentPassword, user.passwordHash);
      if (!isMatch) {
        res.status(401).json({ error: 'Current password is incorrect.' });
        return;
      }
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    const now = new Date().toISOString();

    await adminDb.collection('users').doc(uid).update({
      passwordHash,
      updatedAt: now,
    });

    await createNotification(
      uid,
      'SECURITY',
      'Account Password Updated 🔑',
      'Your account password was updated successfully.'
    );

    res.json({ message: 'Password updated successfully.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update password.' });
  }
});

// 8. GET NOTIFICATIONS
router.get('/notifications', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const uid = req.user!.id;
    const snap = await adminDb
      .collection('notifications')
      .where('userId', '==', uid)
      .limit(30)
      .get();

    const notifications = snap.docs
      .map((doc) => {
        const d = doc.data();
        return {
          id: doc.id,
          title: d.title,
          message: d.message,
          type: d.type,
          is_read: d.isRead ? 1 : 0,
          created_at: d.createdAt,
        };
      })
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    res.json(notifications);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch notifications.' });
  }
});

export default router;
