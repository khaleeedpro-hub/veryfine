import { adminDb } from '../firebase/admin';
import bcrypt from 'bcryptjs';

export async function initFirebaseData(): Promise<void> {
  console.log('[FirebaseInit] Verifying Firestore default data...');
  const now = new Date().toISOString();

  // 1. VIP Plans
  const vipRef = adminDb.collection('vipPlans');
  const vipSnap = await vipRef.get();

  if (vipSnap.empty) {
    console.log('[FirebaseInit] Seeding default VIP plans into Firestore...');
    const defaultPlans = [
      {
        planId: 'vip-plan-1',
        name: 'VIP 1',
        vipLevel: 1,
        investmentAmount: 20,
        dailyEarning: 1.0,
        durationDays: 120,
        status: 'active',
        displayOrder: 1,
        createdAt: now,
        updatedAt: now,
      },
      {
        planId: 'vip-plan-2',
        name: 'VIP 2',
        vipLevel: 2,
        investmentAmount: 50,
        dailyEarning: 2.5,
        durationDays: 120,
        status: 'active',
        displayOrder: 2,
        createdAt: now,
        updatedAt: now,
      },
      {
        planId: 'vip-plan-3',
        name: 'VIP 3',
        vipLevel: 3,
        investmentAmount: 100,
        dailyEarning: 5.0,
        durationDays: 120,
        status: 'active',
        displayOrder: 3,
        createdAt: now,
        updatedAt: now,
      },
      {
        planId: 'vip-plan-4',
        name: 'VIP 4',
        vipLevel: 4,
        investmentAmount: 200,
        dailyEarning: 10.0,
        durationDays: 120,
        status: 'active',
        displayOrder: 4,
        createdAt: now,
        updatedAt: now,
      },
      {
        planId: 'vip-plan-5',
        name: 'VIP 5',
        vipLevel: 5,
        investmentAmount: 500,
        dailyEarning: 25.0,
        durationDays: 120,
        status: 'disabled',
        displayOrder: 5,
        createdAt: now,
        updatedAt: now,
      },
      {
        planId: 'vip-plan-6',
        name: 'VIP 6',
        vipLevel: 6,
        investmentAmount: 1000,
        dailyEarning: 50.0,
        durationDays: 120,
        status: 'disabled',
        displayOrder: 6,
        createdAt: now,
        updatedAt: now,
      },
    ];

    for (const plan of defaultPlans) {
      await vipRef.doc(plan.planId).set(plan);
    }
  }

  // 2. Admin User
  const usersRef = adminDb.collection('users');
  const adminSnap = await usersRef.where('role', '==', 'admin').limit(1).get();

  if (adminSnap.empty) {
    console.log('[FirebaseInit] Seeding default admin account into Firestore...');
    const adminUid = 'usr-admin-001';
    const passwordHash = await bcrypt.hash('AdminPassword123!', 10);
    const pinHash = await bcrypt.hash('9999', 10);
    const walletId = 'wlt-admin-001';
    const walletAddress = 'WALLET-ADMIN001';

    await usersRef.doc(adminUid).set({
      uid: adminUid,
      username: 'admin',
      usernameLowercase: 'admin',
      email: 'admin@aurainvest.com',
      passwordHash,
      withdrawalPinHash: pinHash,
      role: 'admin',
      status: 'active',
      accountStatus: 'active',
      vipLevel: 4,
      walletId,
      country: 'United States',
      emailVerified: true,
      twoFactorEnabled: false,
      createdAt: now,
      updatedAt: now,
      lastLoginAt: now,
    });

    await adminDb.collection('usernames').doc('admin').set({
      username: 'admin',
      usernameLowercase: 'admin',
      uid: adminUid,
      createdAt: now,
    });

    await adminDb.collection('userProfiles').doc(adminUid).set({
      uid: adminUid,
      firstName: 'System',
      lastName: 'Administrator',
      phone: '+10000000000',
      country: 'United States',
      dateOfBirth: '1990-01-01',
      address: '100 Financial Way',
      profileImage: '',
      createdAt: now,
      updatedAt: now,
    });

    await adminDb.collection('wallets').doc(walletId).set({
      walletId,
      uid: adminUid,
      walletAddress,
      currency: 'USD',
      availableBalance: 1000.0,
      investedBalance: 0.0,
      totalEarnings: 0.0,
      totalDeposits: 1000.0,
      totalWithdrawals: 0.0,
      totalTransfers: 0.0,
      status: 'active',
      createdAt: now,
      updatedAt: now,
    });
  }

  console.log('[FirebaseInit] Firestore initialization completed successfully.');
}
