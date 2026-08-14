import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  updateProfile,
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from './client';

export interface RegisterParams {
  username?: string;
  email: string;
  password: string;
  fullName: string;
  withdrawalPin: string;
  country?: string;
  phone?: string;
}

export interface RegisterResult {
  user: {
    id: string;
    uid?: string;
    username?: string;
    email: string;
    fullName: string;
    role: string;
    walletAddress?: string;
  };
  token?: string;
}

/**
 * Validates registration input parameters.
 */
export function validateRegistrationData(params: RegisterParams): string | null {
  const { email, password, fullName, withdrawalPin } = params;

  if (!email || !email.trim() || !/\S+@\S+\.\S+/.test(email.trim())) {
    return 'Please provide a valid email address.';
  }

  if (!password || password.length < 6) {
    return 'Password must be at least 6 characters long.';
  }

  if (!fullName || !fullName.trim()) {
    return 'Full name is required.';
  }

  if (!withdrawalPin || !/^\d{4}$/.test(withdrawalPin)) {
    return 'Withdrawal PIN must be exactly 4 numeric digits.';
  }

  return null;
}

/**
 * Implements user registration flow.
 * Collects user profile details, sends request to backend auth route
 * (which hashes password & PIN and provisions Firestore collections),
 * with a Firebase client SDK fallback if needed.
 */
export async function registerUserWithDetails(params: RegisterParams): Promise<RegisterResult> {
  const validationError = validateRegistrationData(params);
  if (validationError) {
    throw new Error(validationError);
  }

  // Primary flow: Register through secure backend API endpoint
  try {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        username: params.username ? params.username.trim().toLowerCase() : undefined,
        email: params.email.trim().toLowerCase(),
        password: params.password,
        fullName: params.fullName.trim(),
        withdrawalPin: params.withdrawalPin,
        country: params.country || 'United States',
        phone: params.phone || '',
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || 'Registration failed.');
    }

    if (data.token) {
      localStorage.setItem('aurainvest_token', data.token);
    }

    return {
      user: data.user,
      token: data.token,
    };
  } catch (apiError: any) {
    // If backend API error occurs or client-only mode, fallback to Firebase Client SDK
    console.warn('API registration route fallback to Client SDK:', apiError?.message);

    try {
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        params.email.trim().toLowerCase(),
        params.password
      );

      const firebaseUser = userCredential.user;
      await updateProfile(firebaseUser, { displayName: params.fullName.trim() });

      const uid = firebaseUser.uid;
      const walletId = `wlt-${uid}`;
      const walletAddress = `WALLET-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;

      const nameParts = params.fullName.trim().split(' ');
      const firstName = nameParts[0] || 'Investor';
      const lastName = nameParts.slice(1).join(' ') || '';
      const now = new Date().toISOString();

      // Initialize user document in Firestore
      await setDoc(doc(db, 'users', uid), {
        uid,
        email: params.email.trim().toLowerCase(),
        displayName: params.fullName.trim(),
        role: 'user',
        status: 'active',
        walletId,
        country: params.country || 'United States',
        emailVerified: false,
        twoFactorEnabled: false,
        createdAt: now,
        updatedAt: now,
      });

      // Initialize user profile document in Firestore
      await setDoc(doc(db, 'userProfiles', uid), {
        uid,
        firstName,
        lastName,
        phone: params.phone || '',
        country: params.country || 'United States',
        dateOfBirth: '',
        address: '',
        profileImage: '',
        createdAt: now,
        updatedAt: now,
      });

      // Initialize wallet document in Firestore
      await setDoc(doc(db, 'wallets', walletId), {
        walletId,
        uid,
        walletAddress,
        currency: 'USD',
        availableBalance: 0,
        investedBalance: 0,
        totalEarnings: 0,
        totalDeposits: 0,
        totalWithdrawals: 0,
        status: 'active',
        createdAt: now,
        updatedAt: now,
      });

      return {
        user: {
          id: uid,
          email: firebaseUser.email || params.email,
          fullName: params.fullName.trim(),
          role: 'user',
          walletAddress,
        },
      };
    } catch (firebaseErr: any) {
      throw new Error(firebaseErr?.message || apiError?.message || 'Failed to complete registration.');
    }
  }
}

/**
 * Log in user helper.
 */
export async function loginUser(email: string, password: string) {
  const cleanEmail = email.trim().toLowerCase();

  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: cleanEmail, password }),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Login failed.');
    }

    if (data.token) {
      localStorage.setItem('aurainvest_token', data.token);
    }

    return data;
  } catch (err: any) {
    // Client SDK fallback for login if needed
    try {
      const userCredential = await signInWithEmailAndPassword(auth, cleanEmail, password);
      return {
        user: {
          id: userCredential.user.uid,
          email: userCredential.user.email,
          fullName: userCredential.user.displayName || 'Investor',
          role: 'user',
        },
      };
    } catch (fallbackErr: any) {
      throw new Error(err?.message || fallbackErr?.message || 'Invalid login credentials.');
    }
  }
}

/**
 * Log out user helper.
 */
export async function logoutUser() {
  try {
    await signOut(auth);
  } catch (err) {
    console.error('Firebase signout error:', err);
  }
  localStorage.removeItem('aurainvest_token');
}

/**
 * Sign in or Register with Google popup via Firebase Auth & OAuth
 */
export async function signInWithGoogle() {
  try {
    const provider = new GoogleAuthProvider();
    provider.addScope('https://www.googleapis.com/auth/userinfo.profile');
    provider.addScope('https://www.googleapis.com/auth/userinfo.email');

    const result = await signInWithPopup(auth, provider);
    const user = result.user;
    const uid = user.uid;

    // Exchange with backend API to obtain signed JWT token and sync Firestore
    try {
      const res = await fetch('/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uid,
          email: user.email,
          displayName: user.displayName || 'Google Investor',
          photoURL: user.photoURL || '',
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.token) {
          localStorage.setItem('aurainvest_token', data.token);
        }
        return {
          user: data.user,
          token: data.token,
        };
      }
    } catch (apiErr) {
      console.warn('Backend /api/auth/google call failed, using client Firestore fallback:', apiErr);
    }

    // Client fallback if backend is unreachable
    const now = new Date().toISOString();
    const userRef = doc(db, 'users', uid);
    const userSnap = await getDoc(userRef);
    let walletAddress = `WALLET-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;

    if (!userSnap.exists()) {
      const walletId = `wlt-${uid}`;
      const nameParts = (user.displayName || 'Google Investor').split(' ');
      const firstName = nameParts[0] || 'Investor';
      const lastName = nameParts.slice(1).join(' ') || '';

      await setDoc(userRef, {
        uid,
        email: user.email || '',
        displayName: user.displayName || 'Google User',
        role: 'user',
        status: 'active',
        walletId,
        country: 'United States',
        emailVerified: user.emailVerified || true,
        twoFactorEnabled: false,
        authProvider: 'google',
        createdAt: now,
        updatedAt: now,
      });

      await setDoc(doc(db, 'userProfiles', uid), {
        uid,
        firstName,
        lastName,
        phone: user.phoneNumber || '',
        country: 'United States',
        profileImage: user.photoURL || '',
        createdAt: now,
        updatedAt: now,
      });

      await setDoc(doc(db, 'wallets', walletId), {
        walletId,
        uid,
        walletAddress,
        currency: 'USD',
        availableBalance: 0,
        investedBalance: 0,
        totalEarnings: 0,
        totalDeposits: 0,
        totalWithdrawals: 0,
        status: 'active',
        createdAt: now,
        updatedAt: now,
      });
    }

    return {
      user: {
        id: uid,
        email: user.email || '',
        fullName: user.displayName || 'Google User',
        role: 'user',
        walletAddress,
      },
    };
  } catch (err: any) {
    console.error('Google Auth Error:', err);
    throw new Error(err?.message || 'Google sign-in failed.');
  }
}
