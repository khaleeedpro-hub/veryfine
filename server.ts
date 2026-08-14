import express from 'express';
import path from 'path';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';

import { initFirebaseData } from './server/db/firebaseInit';
import { startEarningScheduler } from './server/services/earningService';

import authRoutes from './server/routes/authRoutes';
import vipRoutes from './server/routes/vipRoutes';
import transferRoutes from './server/routes/transferRoutes';
import depositRoutes from './server/routes/depositRoutes';
import withdrawalRoutes from './server/routes/withdrawalRoutes';
import transactionRoutes from './server/routes/transactionRoutes';
import aiRoutes from './server/routes/aiRoutes';
import adminRoutes from './server/routes/adminRoutes';

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Middleware
  app.use(cors({ origin: true, credentials: true }));
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());

  // Initialize Firebase Firestore seed data & Schedulers
  console.log('[Server] Initializing Firestore default data...');
  await initFirebaseData();
  console.log('[Server] Firestore initialized successfully.');

  console.log('[Server] Starting daily earning engine...');
  startEarningScheduler();

  // API Routes FIRST
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  app.use('/api/auth', authRoutes);
  app.use('/api/vip', vipRoutes);
  app.use('/api/transfers', transferRoutes);
  app.use('/api/deposits', depositRoutes);
  app.use('/api/withdrawals', withdrawalRoutes);
  app.use('/api/transactions', transactionRoutes);
  app.use('/api/ai', aiRoutes);
  app.use('/api/admin', adminRoutes);

  // Vite Middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 VeryFineInvest USD Server running on http://0.0.0.0:${PORT}`);
  });

  server.on('error', (err: any) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`[Server] Port ${PORT} is already in use.`);
    } else {
      console.error('[Server] Express server error:', err);
    }
  });
}

startServer().catch((err) => {
  console.error('[Server] Fatal startup error:', err);
  process.exit(1);
});
