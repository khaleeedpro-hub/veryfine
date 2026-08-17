import {
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
} from 'firebase/auth';
import { auth } from './client';

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

  // Register through secure backend API endpoint
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
}

/**
 * Log in user helper.
 */
export async function loginUser(email: string, password: string) {
  const cleanEmail = email.trim().toLowerCase();

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
}

/**
 * Log out user helper.
 */
export async function logoutUser() {
  try {
    await signOut(auth);
  } catch (err) {
    console.warn('Firebase signout notice:', err);
  }
  localStorage.removeItem('aurainvest_token');
}

/**
 * Sign in or Register with Google popup via Firebase Auth & OAuth
 */
export async function signInWithGoogle() {
  const provider = new GoogleAuthProvider();
  provider.addScope('https://www.googleapis.com/auth/userinfo.profile');
  provider.addScope('https://www.googleapis.com/auth/userinfo.email');

  const result = await signInWithPopup(auth, provider);
  const user = result.user;
  const uid = user.uid;

  // Exchange with backend API to obtain signed JWT token and sync Firestore
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

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Google authentication failed.');
  }

  if (data.token) {
    localStorage.setItem('aurainvest_token', data.token);
  }

  return {
    user: data.user,
    token: data.token,
  };
}
