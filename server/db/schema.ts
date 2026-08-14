import { dbExec, dbGet, dbRun } from './database';
import bcrypt from 'bcryptjs';

export async function initSchema(): Promise<void> {
  // Create tables
  const schemaSql = `
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      withdrawal_pin_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user',
      is_suspended INTEGER NOT NULL DEFAULT 0,
      is_email_verified INTEGER NOT NULL DEFAULT 1,
      two_factor_enabled INTEGER NOT NULL DEFAULT 0,
      two_factor_secret TEXT,
      pin_reset_cooldown_until TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS user_profiles (
      user_id TEXT PRIMARY KEY,
      full_name TEXT NOT NULL DEFAULT 'Investor',
      country TEXT NOT NULL DEFAULT 'United States',
      address TEXT,
      date_of_birth TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS wallets (
      id TEXT PRIMARY KEY,
      user_id TEXT UNIQUE NOT NULL,
      wallet_address TEXT UNIQUE NOT NULL,
      available_balance REAL NOT NULL DEFAULT 0.00,
      invested_balance REAL NOT NULL DEFAULT 0.00,
      total_earnings REAL NOT NULL DEFAULT 0.00,
      total_deposits REAL NOT NULL DEFAULT 0.00,
      total_withdrawals REAL NOT NULL DEFAULT 0.00,
      total_transfers_sent REAL NOT NULL DEFAULT 0.00,
      total_transfers_received REAL NOT NULL DEFAULT 0.00,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS vip_plans (
      id TEXT PRIMARY KEY,
      level INTEGER UNIQUE NOT NULL,
      name TEXT NOT NULL,
      investment_amount REAL NOT NULL,
      daily_earning REAL NOT NULL,
      duration_days INTEGER NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1,
      display_order INTEGER NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS investments (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      vip_plan_id TEXT NOT NULL,
      vip_level INTEGER NOT NULL,
      plan_name TEXT NOT NULL,
      investment_amount REAL NOT NULL,
      daily_earning REAL NOT NULL,
      duration_days INTEGER NOT NULL,
      total_earned REAL NOT NULL DEFAULT 0.00,
      days_credited INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'active',
      start_date TEXT NOT NULL,
      maturity_date TEXT NOT NULL,
      next_earning_date TEXT NOT NULL,
      last_earning_date TEXT
    );

    CREATE TABLE IF NOT EXISTS investment_earnings (
      id TEXT PRIMARY KEY,
      investment_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      earning_date TEXT NOT NULL,
      amount REAL NOT NULL,
      created_at TEXT NOT NULL,
      UNIQUE(investment_id, earning_date)
    );

    CREATE TABLE IF NOT EXISTS ledger_entries (
      id TEXT PRIMARY KEY,
      transaction_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      account_type TEXT NOT NULL,
      entry_type TEXT NOT NULL,
      amount REAL NOT NULL,
      balance_after REAL NOT NULL,
      reference TEXT NOT NULL,
      description TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      type TEXT NOT NULL,
      amount REAL NOT NULL,
      fee REAL NOT NULL DEFAULT 0.00,
      balance_before REAL NOT NULL,
      balance_after REAL NOT NULL,
      status TEXT NOT NULL DEFAULT 'completed',
      reference_id TEXT,
      description TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS deposits (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      amount REAL NOT NULL,
      payment_method TEXT NOT NULL,
      payment_details TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      transaction_id TEXT,
      created_at TEXT NOT NULL,
      processed_at TEXT
    );

    CREATE TABLE IF NOT EXISTS withdrawals (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      amount REAL NOT NULL,
      fee REAL NOT NULL DEFAULT 0.00,
      net_amount REAL NOT NULL,
      payment_method TEXT NOT NULL,
      payment_details TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      rejection_reason TEXT,
      created_at TEXT NOT NULL,
      processed_at TEXT
    );

    CREATE TABLE IF NOT EXISTS internal_transfers (
      id TEXT PRIMARY KEY,
      sender_user_id TEXT NOT NULL,
      recipient_user_id TEXT NOT NULL,
      recipient_wallet_address TEXT NOT NULL,
      amount REAL NOT NULL,
      status TEXT NOT NULL DEFAULT 'completed',
      transaction_id TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      is_read INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      actor_email TEXT,
      event_type TEXT NOT NULL,
      ip_address TEXT,
      details TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS system_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `;

  await dbExec(schemaSql);
  await seedDefaults();
}

async function seedDefaults(): Promise<void> {
  const now = new Date().toISOString();

  // 1. Seed VIP Plans if not existing
  const existingVip = await dbGet('SELECT COUNT(*) as count FROM vip_plans');
  if (!existingVip || existingVip.count === 0) {
    const defaultVips = [
      { id: 'vip-plan-1', level: 1, name: 'VIP 1', investment_amount: 20, daily_earning: 1.0, duration_days: 120, is_active: 1, display_order: 1 },
      { id: 'vip-plan-2', level: 2, name: 'VIP 2', investment_amount: 50, daily_earning: 2.5, duration_days: 120, is_active: 1, display_order: 2 },
      { id: 'vip-plan-3', level: 3, name: 'VIP 3', investment_amount: 100, daily_earning: 5.0, duration_days: 120, is_active: 1, display_order: 3 },
      { id: 'vip-plan-4', level: 4, name: 'VIP 4', investment_amount: 200, daily_earning: 10.0, duration_days: 120, is_active: 1, display_order: 4 },
      { id: 'vip-plan-5', level: 5, name: 'VIP 5 Premium', investment_amount: 500, daily_earning: 25.0, duration_days: 120, is_active: 0, display_order: 5 }, // Disabled initially
      { id: 'vip-plan-6', level: 6, name: 'VIP 6 Institutional', investment_amount: 1000, daily_earning: 50.0, duration_days: 120, is_active: 0, display_order: 6 }, // Disabled initially
    ];

    for (const v of defaultVips) {
      await dbRun(
        `INSERT INTO vip_plans (id, level, name, investment_amount, daily_earning, duration_days, is_active, display_order, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [v.id, v.level, v.name, v.investment_amount, v.daily_earning, v.duration_days, v.is_active, v.display_order, now]
      );
    }
  }

  // 2. Seed System Settings if not existing
  const defaultSettings: [string, string][] = [
    ['MIN_DEPOSIT', '20'],
    ['MAX_DEPOSIT', '10000'],
    ['INTERNAL_TRANSFER_DAILY_LIMIT', '50'],
    ['INTERNAL_TRANSFER_DAILY_COUNT', '2'],
    ['WITHDRAWAL_MIN', '10'],
    ['WITHDRAWAL_MAX', '5000'],
    ['WITHDRAWAL_FEE_PERCENT', '1.5'],
    ['MAINTENANCE_MODE', 'false'],
    ['RESTRICTED_COUNTRIES', 'North Korea,Iran,Syria,Cuba'],
  ];

  for (const [key, val] of defaultSettings) {
    const existing = await dbGet('SELECT key FROM system_settings WHERE key = ?', [key]);
    if (!existing) {
      await dbRun('INSERT INTO system_settings (key, value, updated_at) VALUES (?, ?, ?)', [key, val, now]);
    }
  }

  // 3. Seed Admin User if not existing
  const adminUser = await dbGet("SELECT id FROM users WHERE role = 'admin'");
  if (!adminUser) {
    const adminId = 'usr-admin-001';
    const passwordHash = await bcrypt.hash('AdminPassword123!', 10);
    const pinHash = await bcrypt.hash('9999', 10);

    await dbRun(
      `INSERT INTO users (id, email, password_hash, withdrawal_pin_hash, role, is_suspended, is_email_verified, two_factor_enabled, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [adminId, 'admin@aurainvest.com', passwordHash, pinHash, 'admin', 0, 1, 0, now, now]
    );

    await dbRun(
      `INSERT INTO user_profiles (user_id, full_name, country, created_at)
       VALUES (?, ?, ?, ?)`,
      [adminId, 'System Administrator', 'United States', now]
    );

    await dbRun(
      `INSERT INTO wallets (id, user_id, wallet_address, available_balance, invested_balance, total_earnings, total_deposits, total_withdrawals, total_transfers_sent, total_transfers_received, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ['wlt-admin-001', adminId, 'WALLET-ADMIN001', 1000.0, 0, 0, 1000.0, 0, 0, 0, now]
    );
  }
}
