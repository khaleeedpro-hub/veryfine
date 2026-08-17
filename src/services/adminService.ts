import { getIdTokenResult } from 'firebase/auth';
import { auth } from '../lib/firebase/client';
import { AuditLogItem, UserRole } from '../types';

export interface AdminClaimsResult {
  isAdmin: boolean;
  role: UserRole | string;
  uid: string | null;
  email: string | null;
  claims: Record<string, any>;
}

export interface ManagedUser {
  id: string;
  email: string;
  role: string;
  is_suspended: number;
  status: 'active' | 'suspended' | 'pending' | 'restricted';
  created_at: string;
  full_name: string;
  country: string;
  wallet_address: string;
  available_balance: number;
  invested_balance: number;
  total_earnings: number;
  total_deposits: number;
  total_withdrawals: number;
}

/**
 * Validates whether the currently authenticated Firebase user possesses
 * custom admin claims or an administrative role.
 */
export async function getAdminClaims(forceRefresh = true): Promise<AdminClaimsResult> {
  const token = localStorage.getItem('aurainvest_token') || localStorage.getItem('auth_token');
  const currentUser = auth.currentUser;

  // 1. Try Firebase Auth Custom Token Claims if user is present
  if (currentUser) {
    try {
      const tokenResult = await getIdTokenResult(currentUser, forceRefresh);
      const claims = tokenResult.claims || {};

      const hasAdminClaim = Boolean(
        claims.admin === true ||
        claims.role === 'admin' ||
        claims.isAdmin === true
      );

      if (hasAdminClaim) {
        return {
          isAdmin: true,
          role: (claims.role as string) || 'admin',
          uid: currentUser.uid,
          email: currentUser.email,
          claims,
        };
      }
    } catch (err) {
      console.warn('Error checking Firebase custom claims:', err);
    }
  }

  // 2. Check via /api/auth/me using token
  if (token) {
    try {
      const res = await fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        const user = data.user;
        const isAdmin = user?.role === 'admin';
        return {
          isAdmin,
          role: user?.role || 'user',
          uid: user?.id || user?.uid || null,
          email: user?.email || null,
          claims: { role: user?.role },
        };
      }
    } catch (apiErr) {
      console.warn('Error fetching /api/auth/me for admin claims:', apiErr);
    }
  }

  return {
    isAdmin: false,
    role: 'user',
    uid: currentUser?.uid || null,
    email: currentUser?.email || null,
    claims: {},
  };
}

/**
 * Asserts that the active user possesses custom admin claims.
 * Throws an explicit error if custom admin claim check fails.
 */
export async function requireAdminClaims(): Promise<AdminClaimsResult> {
  const result = await getAdminClaims(true);
  if (!result.isAdmin) {
    throw new Error('Access denied: Action requires custom admin claims or administrator privileges.');
  }
  return result;
}

/**
 * Admin action: Toggles user account suspension state.
 * Strictly verifies custom admin claims before proceeding.
 */
export async function toggleUserSuspension(
  targetUserId: string,
  isSuspended: boolean,
  reason = 'Administrative action'
): Promise<{ success: boolean; message: string }> {
  // 1. Custom admin claim verification
  const adminInfo = await requireAdminClaims();

  // Prevent suspending self or administrative accounts
  if (targetUserId === adminInfo.uid) {
    throw new Error('Action rejected: Cannot suspend your own administrative account.');
  }

  const token = localStorage.getItem('aurainvest_token');

  // Try server API first
  if (token) {
    try {
      const res = await fetch(`/api/admin/users/${targetUserId}/suspend`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ isSuspended, reason }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update user suspension state.');
      }

      return { success: true, message: data.message || 'User status updated successfully.' };
    } catch (apiError: any) {
      throw new Error(apiError?.message || 'Failed to update user suspension state.');
    }
  }

  throw new Error('Authentication token required to modify user accounts.');
}

/**
 * Admin action: Updates user account status ('active' | 'suspended' | 'pending' | 'restricted').
 * Requires custom admin claims check.
 */
export async function updateUserAccountStatus(
  targetUserId: string,
  newStatus: 'active' | 'suspended' | 'pending' | 'restricted',
  reason?: string
): Promise<{ success: boolean; message: string }> {
  await requireAdminClaims();

  const token = localStorage.getItem('aurainvest_token');
  if (!token) {
    throw new Error('Authentication token required.');
  }

  const res = await fetch(`/api/admin/users/${targetUserId}/status`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ status: newStatus, reason }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to update user account status.');
  }

  return {
    success: true,
    message: data.message || `User account status updated to ${newStatus}.`,
  };
}

/**
 * Admin action: Resets a user's password.
 * Checks for custom admin claims before processing request.
 */
export async function adminResetPassword(
  targetUserId: string,
  newPassword: string
): Promise<{ success: boolean; message: string }> {
  await requireAdminClaims();

  if (!newPassword || newPassword.length < 6) {
    throw new Error('New password must be at least 6 characters long.');
  }

  const token = localStorage.getItem('aurainvest_token');
  if (!token) {
    throw new Error('Authentication token required for password reset.');
  }

  const res = await fetch(`/api/admin/users/${targetUserId}/reset-password`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ newPassword }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to reset user password.');
  }

  return { success: true, message: data.message };
}

/**
 * Admin action: Resets a user's 4-digit security withdrawal PIN.
 * Checks custom admin claims before processing.
 */
export async function adminResetWithdrawalPin(
  targetUserId: string,
  newPin: string
): Promise<{ success: boolean; message: string }> {
  await requireAdminClaims();

  if (!newPin || !/^\d{4}$/.test(newPin)) {
    throw new Error('New withdrawal PIN must consist of exactly 4 numeric digits.');
  }

  const token = localStorage.getItem('aurainvest_token');
  if (!token) {
    throw new Error('Authentication token required for PIN reset.');
  }

  const res = await fetch(`/api/admin/users/${targetUserId}/reset-pin`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ newPin }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to reset withdrawal PIN.');
  }

  return { success: true, message: data.message };
}

/**
 * Fetches the user directory with balances and status for admin management.
 * Verifies custom admin claims prior to data delivery.
 */
export async function fetchManagedUsers(): Promise<ManagedUser[]> {
  await requireAdminClaims();

  const token = localStorage.getItem('aurainvest_token');
  if (!token) {
    throw new Error('Authentication token required.');
  }

  const res = await fetch('/api/admin/users', {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to fetch user list.');
  }

  const userList = data.users || [];
  return userList.map((u: any) => ({
    ...u,
    status: u.is_suspended === 1 ? 'suspended' : u.status || 'active',
  }));
}

/**
 * Fetches system audit log records for compliance review.
 * Strictly requires custom admin claims.
 */
export async function fetchAdminAuditLogs(): Promise<AuditLogItem[]> {
  await requireAdminClaims();

  const token = localStorage.getItem('aurainvest_token');
  if (!token) {
    throw new Error('Authentication token required.');
  }

  const res = await fetch('/api/admin/audit-logs', {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to fetch audit logs.');
  }

  return data.logs || [];
}
