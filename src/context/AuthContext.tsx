import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, Wallet, UserProfile, NotificationItem } from '../types';
import { registerUserWithDetails, loginUser, logoutUser, signInWithGoogle } from '../lib/firebase/auth';

interface AuthContextType {
  token: string | null;
  user: User | null;
  wallet: Wallet | null;
  profile: UserProfile | null;
  notifications: NotificationItem[];
  unreadNotificationCount: number;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  register: (
    email: string,
    password: string,
    fullName: string,
    withdrawalPin: string,
    country?: string,
    phone?: string,
    username?: string
  ) => Promise<void>;
  loginWithToken: (newToken: string, newUser: User) => void;
  logout: () => void;
  refreshUserContext: () => Promise<void>;
  verifyPin: (pin: string) => Promise<boolean>;
  markNotificationsRead: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('aurainvest_token'));
  const [user, setUser] = useState<User | null>(null);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const refreshUserContext = async (overrideToken?: string) => {
    const activeToken = overrideToken || token || localStorage.getItem('aurainvest_token');
    if (!activeToken) {
      setUser(null);
      setWallet(null);
      setProfile(null);
      setIsLoading(false);
      return;
    }

    try {
      const [res, notifRes] = await Promise.all([
        fetch('/api/auth/me', {
          headers: {
            Authorization: `Bearer ${activeToken}`,
          },
        }).catch((err) => {
          console.warn('Network issue reaching /api/auth/me:', err?.message);
          return null;
        }),
        fetch('/api/auth/notifications', {
          headers: {
            Authorization: `Bearer ${activeToken}`,
          },
        }).catch(() => null),
      ]);

      if (res && res.ok) {
        const data = await res.json();
        setUser({
          id: data.user.id || data.user.uid,
          uid: data.user.uid || data.user.id,
          username: data.user.username || data.user.email?.split('@')[0],
          email: data.user.email,
          role: data.user.role,
          accountStatus: data.user.accountStatus || 'active',
          vipLevel: data.user.vipLevel || 0,
          fullName: data.profile?.full_name || 'Investor',
          country: data.profile?.country || 'United States',
          walletAddress: data.wallet?.wallet_address || data.wallet?.walletAddress || '',
          walletId: data.wallet?.id || data.wallet?.walletId || `wlt-${data.user.id}`,
          pinCooldownUntil: data.user.pinCooldownUntil,
          twoFactorEnabled: data.user.twoFactorEnabled,
        });
        setWallet(data.wallet);
        setProfile(data.profile);

        if (notifRes && notifRes.ok) {
          const notifData = await notifRes.json();
          setNotifications(Array.isArray(notifData) ? notifData : []);
        }
      } else if (res && (res.status === 401 || res.status === 403)) {
        // Token invalid or expired
        localStorage.removeItem('aurainvest_token');
        setToken(null);
        setUser(null);
        setWallet(null);
        setProfile(null);
      }
    } catch (err: any) {
      console.warn('Could not refresh user context:', err?.message || err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refreshUserContext();
  }, [token]);

  // Periodic wallet balance refresh every 10 seconds
  useEffect(() => {
    if (!token) return;
    const interval = setInterval(() => {
      refreshUserContext();
    }, 10000);
    return () => clearInterval(interval);
  }, [token]);

  const login = async (email: string, password: string) => {
    const data = await loginUser(email, password);
    if (data.token) {
      setToken(data.token);
      await refreshUserContext(data.token);
    }
  };

  const loginWithGoogle = async () => {
    const result = await signInWithGoogle();
    if (result.token) {
      setToken(result.token);
      await refreshUserContext(result.token);
    } else if (result.user) {
      const gUser: User = {
        id: result.user.id,
        uid: result.user.id,
        username: result.user.username || result.user.email?.split('@')[0] || 'investor',
        email: result.user.email,
        fullName: result.user.fullName,
        role: (result.user.role as any) || 'user',
        accountStatus: 'active',
        vipLevel: 0,
        walletAddress: result.user.walletAddress || '',
      };
      setUser(gUser);
    }
  };

  const register = async (
    email: string,
    password: string,
    fullName: string,
    withdrawalPin: string,
    country?: string,
    phone?: string,
    username?: string
  ) => {
    const data = await registerUserWithDetails({
      username,
      email,
      password,
      fullName,
      withdrawalPin,
      country,
      phone,
    });
    if (data.token) {
      setToken(data.token);
      await refreshUserContext(data.token);
    }
  };

  const loginWithToken = (newToken: string, newUser: User) => {
    localStorage.setItem('aurainvest_token', newToken);
    setToken(newToken);
    setUser(newUser);
    refreshUserContext(newToken);
  };

  const logout = () => {
    logoutUser();
    setToken(null);
    setUser(null);
    setWallet(null);
    setProfile(null);
  };

  const verifyPin = async (pin: string): Promise<boolean> => {
    if (!token) return false;
    try {
      const res = await fetch('/api/auth/verify-pin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ pin }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Incorrect PIN');
      }
      return true;
    } catch (err: any) {
      throw err;
    }
  };

  const markNotificationsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: 1 })));
  };

  const unreadNotificationCount = notifications.filter((n) => n.is_read === 0).length;

  return (
    <AuthContext.Provider
      value={{
        token,
        user,
        wallet,
        profile,
        notifications,
        unreadNotificationCount,
        isLoading,
        isAuthenticated: Boolean(user && token),
        login,
        loginWithGoogle,
        register,
        loginWithToken,
        logout,
        refreshUserContext,
        verifyPin,
        markNotificationsRead,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
