import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { adminDb } from '../firebase/admin';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
    isSuspended: boolean;
  };
}

const JWT_SECRET = process.env.JWT_SECRET || 'aurainvest-jwt-production-secret-key-982137';

export function generateToken(payload: { id: string; email: string; role: string }): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
}

export async function authenticateToken(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    let token: string | undefined;

    const authHeader = req.headers['authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    } else if (req.cookies && req.cookies.token) {
      token = req.cookies.token;
    }

    if (!token) {
      res.status(401).json({ error: 'Authentication required. Please log in.' });
      return;
    }

    const decoded = jwt.verify(token, JWT_SECRET) as { id: string; email: string; role: string };

    // Fetch fresh user status from Firestore
    const userSnap = await adminDb.collection('users').doc(decoded.id).get();
    if (!userSnap.exists) {
      res.status(401).json({ error: 'User account no longer exists.' });
      return;
    }

    const userData = userSnap.data()!;
    if (userData.status === 'suspended') {
      res.status(403).json({ error: 'Your account has been suspended by compliance. Please contact support.' });
      return;
    }

    req.user = {
      id: decoded.id,
      email: userData.email || decoded.email,
      role: userData.role || decoded.role || 'user',
      isSuspended: userData.status === 'suspended',
    };

    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid or expired authentication token.' });
  }
}

export function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  if (!req.user || req.user.role !== 'admin') {
    res.status(403).json({ error: 'Access denied. Administrative privileges required.' });
    return;
  }
  next();
}

// In-memory simple rate limiting for brute force protection
const loginAttempts: Record<string, { count: number; lastAttempt: number }> = {};

export function loginRateLimiter(req: Request, res: Response, next: NextFunction): void {
  const ip = req.ip || '127.0.0.1';
  const now = Date.now();
  const record = loginAttempts[ip] || { count: 0, lastAttempt: now };

  if (now - record.lastAttempt > 15 * 60 * 1000) {
    // Reset window every 15 minutes
    record.count = 0;
  }

  if (record.count >= 10) {
    res.status(429).json({ error: 'Too many failed login attempts. Please try again after 15 minutes.' });
    return;
  }

  loginAttempts[ip] = { count: record.count + 1, lastAttempt: now };
  next();
}

export function resetLoginRateLimit(ip: string): void {
  delete loginAttempts[ip];
}
