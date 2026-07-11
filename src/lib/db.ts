import { Pool } from "pg";

const connectionString =
  process.env.POSTGRES_URL ?? process.env.DATABASE_URL ?? process.env.PRISMA_DATABASE_URL;

declare global {
  var __pgPool: Pool | undefined;
}

export const pool =
  global.__pgPool ??
  new Pool({
    connectionString,
    ssl: connectionString?.includes("sslmode=require") ? { rejectUnauthorized: false } : undefined,
    // Ambiente serverless: ogni istanza calda riusa questo pool (è un singleton a livello di
    // modulo), ma con molte istanze concorrenti un max alto può esaurire i collegamenti
    // disponibili lato Neon. Un pool piccolo per istanza, con chiusura rapida delle
    // connessioni inattive, è più sicuro qui.
    max: 3,
    idleTimeoutMillis: 10_000,
  });

if (process.env.NODE_ENV !== "production") {
  global.__pgPool = pool;
}

let initialized = false;

export async function ensureSchema() {
  if (initialized) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS bookings (
      id SERIAL PRIMARY KEY,
      code TEXT UNIQUE NOT NULL,
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT NOT NULL,
      locale TEXT NOT NULL DEFAULT 'it',
      guests INTEGER NOT NULL,
      checkin DATE NOT NULL,
      checkout DATE NOT NULL,
      total_price NUMERIC,
      message TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      rejection_reason TEXT,
      payment_method TEXT,
      paid_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  // Migrazioni per tabelle create prima dell'introduzione di queste colonne.
  await pool.query(`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS locale TEXT NOT NULL DEFAULT 'it';`);
  await pool.query(`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS archived BOOLEAN NOT NULL DEFAULT false;`);
  await pool.query(`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS deposit_amount NUMERIC;`);
  await pool.query(`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS balance_due NUMERIC;`);
  await pool.query(`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS city_tax NUMERIC;`);
  await pool.query(`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS stripe_payment_intent_id TEXT;`);
  await pool.query(`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS refunded_at TIMESTAMPTZ;`);
  await pool.query(`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS balance_reminder_sent_at TIMESTAMPTZ;`);
  await pool.query(`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS balance_reminder_2_sent_at TIMESTAMPTZ;`);
  await pool.query(`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS balance_paid_at TIMESTAMPTZ;`);
  await pool.query(`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS balance_payment_intent_id TEXT;`);
  await pool.query(`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS custom_price NUMERIC;`);
  await pool.query(`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS deposit_rate NUMERIC;`);
  // Opzione A tassa di soggiorno online: flag per prenotazione che governa OVUNQUE la scelta
  // tra il comportamento nuovo (tassa inclusa nel pagamento online come voce separata) e quello
  // vecchio (tassa riscossa al check-in). true = online. Le prenotazioni create prima di questa
  // colonna restano NULL = vecchio comportamento (tassa al check-in), invariato.
  await pool.query(`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS city_tax_online BOOLEAN;`);
  // Struttura con camere: a quale unità (appartamento intero o singola camera) si
  // riferisce la prenotazione. NULL = prenotazioni antecedenti / struttura a unità
  // singola → trattate come l'unità radice (vedi rootUnitId()).
  await pool.query(`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS unit_id TEXT;`);
  initialized = true;
}

let totpInitialized = false;

// Tabella a riga singola (id=1) per il secret TOTP che protegge la pagina di
// configurazione Stripe (switch test↔produzione). Idempotente.
export async function ensureStripeAdminSchema() {
  if (totpInitialized) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS stripe_admin_totp (
      id INTEGER PRIMARY KEY DEFAULT 1,
      secret TEXT,
      confirmed BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      confirmed_at TIMESTAMPTZ,
      last_used_step BIGINT,
      CONSTRAINT stripe_admin_totp_singleton CHECK (id = 1)
    );
  `);
  // Migrazione idempotente per tabelle già esistenti: single-use anti-replay del TOTP.
  await pool.query(`ALTER TABLE stripe_admin_totp ADD COLUMN IF NOT EXISTS last_used_step BIGINT`);
  totpInitialized = true;
}

let authInitialized = false;

// Tabelle richieste da @auth/pg-adapter (login admin GitHub + magic-link email).
// Con sessione JWT la tabella `sessions` non viene usata, ma la creiamo comunque
// per completezza dello schema dell'adapter. Idempotente come ensureSchema().
export async function ensureAuthSchema() {
  if (authInitialized) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255),
      email VARCHAR(255),
      "emailVerified" TIMESTAMPTZ,
      image TEXT
    );
    CREATE TABLE IF NOT EXISTS accounts (
      id SERIAL PRIMARY KEY,
      "userId" INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type VARCHAR(255) NOT NULL,
      provider VARCHAR(255) NOT NULL,
      "providerAccountId" VARCHAR(255) NOT NULL,
      refresh_token TEXT,
      access_token TEXT,
      expires_at BIGINT,
      id_token TEXT,
      scope TEXT,
      session_state TEXT,
      token_type TEXT
    );
    CREATE TABLE IF NOT EXISTS sessions (
      id SERIAL PRIMARY KEY,
      "userId" INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires TIMESTAMPTZ NOT NULL,
      "sessionToken" VARCHAR(255) NOT NULL
    );
    CREATE TABLE IF NOT EXISTS verification_token (
      identifier TEXT NOT NULL,
      expires TIMESTAMPTZ NOT NULL,
      token TEXT NOT NULL,
      PRIMARY KEY (identifier, token)
    );
  `);
  authInitialized = true;
}

export interface Booking {
  id: number;
  code: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  locale: string;
  guests: number;
  checkin: string;
  checkout: string;
  total_price: number | null;
  message: string | null;
  status: "pending" | "approved" | "rejected" | "completed" | "cancelled";
  rejection_reason: string | null;
  payment_method: string | null;
  paid_at: string | null;
  created_at: string;
  archived: boolean;
  deposit_amount: number | null;
  balance_due: number | null;
  city_tax: number | null;
  stripe_payment_intent_id: string | null;
  refunded_at: string | null;
  balance_reminder_sent_at: string | null;
  balance_reminder_2_sent_at: string | null;
  balance_paid_at: string | null;
  balance_payment_intent_id: string | null;
  custom_price: number | null;
  deposit_rate: number | null;
  // true = tassa di soggiorno inclusa nel pagamento online (voce separata); false/null = vecchio
  // comportamento, tassa riscossa al check-in. NULL = prenotazioni antecedenti al flag.
  city_tax_online: boolean | null;
  // Unità prenotata (appartamento intero o singola camera). NULL = unità radice.
  unit_id: string | null;
}
