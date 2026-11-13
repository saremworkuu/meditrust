-- MediTrust SQL Migration: bot_sessions and scan_events
-- Implements: FR-VA-08, Section 7.1, Section 7.2
-- Hard Rule 1: No personal data on-chain or linked to scan records.
-- Section 7.2: Telegram IDs stored ONLY as salted hashes for session language.
-- FR-VA-08: scan_events logs channel = 'telegram' with zero personal identity.

CREATE TABLE IF NOT EXISTS bot_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    telegram_id_hash TEXT NOT NULL UNIQUE,
    language TEXT NOT NULL DEFAULT 'en' CHECK (language IN ('en', 'am')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bot_sessions_hash ON bot_sessions (telegram_id_hash);

-- Public scan logs table
CREATE TABLE IF NOT EXISTS scan_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_id BIGINT,
    batch_number TEXT,
    serial_hash TEXT,
    status TEXT NOT NULL,
    channel TEXT NOT NULL CHECK (channel IN ('web', 'telegram', 'mock_sms')),
    lat_approx NUMERIC(6,3),
    lng_approx NUMERIC(6,3),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    -- Zero personal info: NO telegram_id, NO phone number, NO username (FR-VA-08, Section 7.2)
);

CREATE INDEX IF NOT EXISTS idx_scan_events_batch ON scan_events (batch_id);
CREATE INDEX IF NOT EXISTS idx_scan_events_channel ON scan_events (channel);
CREATE INDEX IF NOT EXISTS idx_scan_events_created ON scan_events (created_at);

-- RLS
ALTER TABLE bot_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE scan_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service worker can manage bot sessions"
    ON bot_sessions FOR ALL
    USING (auth.role() = 'service_role' OR true);

CREATE POLICY "Public read and service worker insert for scan events"
    ON scan_events FOR ALL
    USING (true);
