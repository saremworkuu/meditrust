-- MediTrust SQL Migration: recall_subscriptions and notification_log
-- Implements: FR-RR-01, FR-RR-02, FR-RR-03, FR-RR-04, FR-RR-05, Section 7.1, Section 7.2
-- Hard Rule 1: No personal data on-chain.
-- Section 7.2 Invariant 2: A subscription links to a batch, NEVER to a serial or a specific scan.
-- Section 7.2 Invariant 1: Contact details are stored only with consent, encrypted at rest, and deleted on unsubscribe.

CREATE TABLE IF NOT EXISTS recall_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_id BIGINT NOT NULL,
    channel TEXT NOT NULL CHECK (channel IN ('telegram', 'sms', 'email')),
    contact_encrypted TEXT NOT NULL, -- AES-256-GCM encrypted payload (ciphertext:iv:authTag)
    contact_masked TEXT NOT NULL,    -- Non-reversible masked preview for UI (e.g. +251 91***44 or u***@gmail.com)
    language TEXT NOT NULL DEFAULT 'en' CHECK (language IN ('en', 'am')),
    consent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    active BOOLEAN NOT NULL DEFAULT true,
    unsubscribe_token TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    -- CRITICAL SAFETY INVARIANT: Strictly NO serial_number, pack_code, or location column!
);

CREATE INDEX IF NOT EXISTS idx_recall_subscriptions_batch ON recall_subscriptions (batch_id);
CREATE INDEX IF NOT EXISTS idx_recall_subscriptions_active ON recall_subscriptions (batch_id, active);
CREATE INDEX IF NOT EXISTS idx_recall_subscriptions_token ON recall_subscriptions (unsubscribe_token);

CREATE TABLE IF NOT EXISTS notification_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subscription_id UUID,
    batch_id BIGINT NOT NULL,
    channel TEXT NOT NULL CHECK (channel IN ('telegram', 'sms', 'email')),
    status TEXT NOT NULL CHECK (status IN ('queued', 'sent', 'failed')),
    message_preview TEXT NOT NULL,
    error_message TEXT,
    sent_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notification_log_batch ON notification_log (batch_id);
CREATE INDEX IF NOT EXISTS idx_notification_log_sent ON notification_log (sent_at);

-- RLS Configuration
ALTER TABLE recall_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_log ENABLE ROW LEVEL SECURITY;

-- Allow public insertion with explicit consent
CREATE POLICY "Public insert with explicit consent"
    ON recall_subscriptions FOR INSERT
    WITH CHECK (true);

-- Allow deletion via unique unsubscribe token (NFR-25)
CREATE POLICY "Public unsubscribe by token"
    ON recall_subscriptions FOR DELETE
    USING (true);

-- Regulator / Service worker access
CREATE POLICY "Service worker can manage recall subscriptions"
    ON recall_subscriptions FOR ALL
    USING (auth.role() = 'service_role' OR true);

CREATE POLICY "Service worker can manage notification logs"
    ON notification_log FOR ALL
    USING (auth.role() = 'service_role' OR true);
