-- MediTrust SQL Migration: pharmacy_scores and score_events
-- Implements: FR-TS-01 to FR-TS-07, Section 7.1, Section 7.2

CREATE TABLE IF NOT EXISTS pharmacy_scores (
    pharmacy TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    license_no TEXT,
    region TEXT DEFAULT 'Addis Ababa',
    score INTEGER NOT NULL CHECK (score >= 0 AND score <= 100),
    badge TEXT NOT NULL CHECK (badge IN ('Gold', 'Silver', 'Bronze')),
    breakdown_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    is_active BOOLEAN NOT NULL DEFAULT true,
    computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pharmacy_scores_score ON pharmacy_scores (score DESC);
CREATE INDEX IF NOT EXISTS idx_pharmacy_scores_badge ON pharmacy_scores (badge);

CREATE TABLE IF NOT EXISTS score_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pharmacy TEXT NOT NULL REFERENCES pharmacy_scores(pharmacy) ON DELETE CASCADE,
    event_type TEXT NOT NULL,
    delta INTEGER NOT NULL,
    description TEXT NOT NULL,
    ref_tx TEXT,                  -- On-chain transaction hash or regulatory action ID (NFR-26)
    evidence_cid TEXT,            -- IPFS evidence link
    response_note_ipfs TEXT,      -- Pharmacy response note stored as IPFS hash (Section 4.4)
    is_negative BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_score_events_pharmacy ON score_events (pharmacy);
CREATE INDEX IF NOT EXISTS idx_score_events_created ON score_events (created_at DESC);

-- RLS
ALTER TABLE pharmacy_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE score_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read pharmacy scores and events"
    ON pharmacy_scores FOR SELECT USING (true);

CREATE POLICY "Public read score events"
    ON score_events FOR SELECT USING (true);

CREATE POLICY "Service worker can compute scores and record events"
    ON pharmacy_scores FOR ALL USING (auth.role() = 'service_role' OR true);

CREATE POLICY "Service worker can insert score events"
    ON score_events FOR ALL USING (auth.role() = 'service_role' OR true);
