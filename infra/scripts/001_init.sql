-- REBIS Secure Platform - init schema (FASE 1)

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ENUMS
DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('client','admin','staff');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE booking_status AS ENUM ('draft','held','confirmed','cancelled','completed','no_show');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE project_status AS ENUM ('open','in_progress','on_hold','completed','cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE session_status AS ENUM ('planned','confirmed','done','cancelled','no_show');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE payment_provider AS ENUM ('stripe');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE payment_status AS ENUM (
    'requires_payment_method','requires_confirmation','requires_action',
    'processing','succeeded','canceled','failed'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- USERS
CREATE TABLE IF NOT EXISTS users (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  role          user_role NOT NULL,
  email         text UNIQUE,
  phone         text UNIQUE,
  first_name    text,
  last_name     text,
  is_active     boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CHECK (email IS NOT NULL OR phone IS NOT NULL)
);

-- STAFF PROFILE
CREATE TABLE IF NOT EXISTS staff_profiles (
  user_id       uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  display_name  text NOT NULL,
  bio           text,
  is_artist     boolean NOT NULL DEFAULT true
);

-- AVAILABILITY RULES (placeholder FASE 2)
CREATE TABLE IF NOT EXISTS availability_rules (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  staff_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  weekday       int  NOT NULL CHECK (weekday BETWEEN 1 AND 7), -- 1=Mon .. 7=Sun
  start_time    time NOT NULL,
  end_time      time NOT NULL,
  timezone      text NOT NULL DEFAULT 'Europe/Rome',
  valid_from    date,
  valid_to      date,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- BOOKINGS
CREATE TABLE IF NOT EXISTS bookings (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  artist_user_id  uuid NOT NULL REFERENCES users(id),
  client_user_id  uuid NOT NULL REFERENCES users(id),
  start_at        timestamptz NOT NULL,
  end_at          timestamptz NOT NULL,
  duration_minutes int NOT NULL CHECK (duration_minutes > 0),
  buffer_minutes   int NOT NULL DEFAULT 0 CHECK (buffer_minutes >= 0),
  status          booking_status NOT NULL DEFAULT 'draft',
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CHECK (end_at > start_at)
);

CREATE INDEX IF NOT EXISTS idx_bookings_artist_start ON bookings (artist_user_id, start_at);

-- PROJECTS
CREATE TABLE IF NOT EXISTS projects (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  artist_user_id  uuid NOT NULL REFERENCES users(id),
  client_user_id  uuid NOT NULL REFERENCES users(id),
  booking_id      uuid REFERENCES bookings(id) ON DELETE SET NULL,
  title           text NOT NULL,
  description     text,
  status          project_status NOT NULL DEFAULT 'open',
  budget_estimate integer,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- SESSIONS
CREATE TABLE IF NOT EXISTS sessions (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id      uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  artist_user_id  uuid NOT NULL REFERENCES users(id),
  client_user_id  uuid NOT NULL REFERENCES users(id),
  start_at        timestamptz NOT NULL,
  end_at          timestamptz NOT NULL,
  duration_minutes int NOT NULL CHECK (duration_minutes > 0),
  buffer_minutes   int NOT NULL DEFAULT 0 CHECK (buffer_minutes >= 0),
  status          session_status NOT NULL DEFAULT 'planned',
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CHECK (end_at > start_at)
);

CREATE INDEX IF NOT EXISTS idx_sessions_artist_start ON sessions (artist_user_id, start_at);

-- BOOKING HOLDS (FASE 2)
CREATE TABLE IF NOT EXISTS booking_holds (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  artist_user_id  uuid NOT NULL REFERENCES users(id),
  client_user_id  uuid REFERENCES users(id) ON DELETE SET NULL,
  start_at        timestamptz NOT NULL,
  end_at          timestamptz NOT NULL,
  expires_at      timestamptz NOT NULL,
  token           text UNIQUE NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  CHECK (end_at > start_at),
  CHECK (expires_at > now() - interval '1 day') -- sanity
);

CREATE INDEX IF NOT EXISTS idx_holds_expires ON booking_holds (expires_at);

-- PAYMENTS
CREATE TABLE IF NOT EXISTS payments (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  provider        payment_provider NOT NULL DEFAULT 'stripe',
  status          payment_status NOT NULL,
  amount_cents    int NOT NULL CHECK (amount_cents > 0),
  currency        char(3) NOT NULL DEFAULT 'EUR',
  booking_id      uuid REFERENCES bookings(id) ON DELETE SET NULL,
  session_id      uuid REFERENCES sessions(id) ON DELETE SET NULL,
  stripe_intent_id text UNIQUE,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CHECK (booking_id IS NOT NULL OR session_id IS NOT NULL)
);

-- PAYMENT EVENTS (idempotenza webhook)
CREATE TABLE IF NOT EXISTS payment_events (
  id                uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  provider          payment_provider NOT NULL DEFAULT 'stripe',
  provider_event_id text NOT NULL UNIQUE,
  event_type        text NOT NULL,
  received_at       timestamptz NOT NULL DEFAULT now(),
  raw_json          jsonb
);

-- AUDIT LOG
CREATE TABLE IF NOT EXISTS audit_log (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  actor_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  action        text NOT NULL,
  entity_type   text NOT NULL,
  entity_id     uuid,
  before_json   jsonb,
  after_json    jsonb,
  ip            inet,
  user_agent    text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_log(entity_type, entity_id);
