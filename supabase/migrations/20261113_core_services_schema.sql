-- ==============================================================================
-- MediTrust Core Services Schema (Task 6)
-- Implements tables: scan_events, reports, flags, participants_cache
-- Enforces Row Level Security (RLS) according to SRS & privacy invariants.
-- ==============================================================================

-- 1. Scan Events Table (Public can INSERT, only service_role can SELECT raw scans)
CREATE TABLE IF NOT EXISTS scan_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_id BIGINT NOT NULL,
    batch_number TEXT,
    gtin TEXT,
    status TEXT NOT NULL CHECK (status IN ('genuine', 'sold', 'recalled', 'expired', 'clone_suspected', 'unknown')),
    channel TEXT NOT NULL DEFAULT 'web' CHECK (channel IN ('web', 'telegram', 'sms')),
    device_hash TEXT, -- Salted HMAC-SHA256 device footprint (no raw IMEI or personal ID)
    lat_center NUMERIC(6, 3), -- Binned to ~1 km centroid (~0.01 deg) for privacy
    lng_center NUMERIC(6, 3), -- Binned to ~1 km centroid
    cell_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_scan_events_batch ON scan_events(batch_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_scan_events_status ON scan_events(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_scan_events_cell ON scan_events(cell_id, created_at DESC);

-- Enable RLS on scan_events
ALTER TABLE scan_events ENABLE ROW LEVEL SECURITY;

-- Policy: The public can insert scan events (e.g. from PWA or Bot verification)
CREATE POLICY "Allow public insert to scan_events"
    ON scan_events
    FOR INSERT
    TO anon, authenticated
    WITH CHECK (true);

-- Policy: Only server / service_role can read raw scan logs (Privacy invariant)
CREATE POLICY "Allow service_role full access to scan_events"
    ON scan_events
    FOR ALL
    TO service_role
    USING (true);


-- 2. Reports Table (Public can submit reports, only service_role can read/triage)
CREATE TABLE IF NOT EXISTS reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_id BIGINT,
    batch_number TEXT,
    pharmacy_address TEXT,
    reporter_type TEXT NOT NULL DEFAULT 'anonymous' CHECK (reporter_type IN ('patient', 'pharmacy', 'inspector', 'anonymous')),
    issue_type TEXT NOT NULL CHECK (issue_type IN ('counterfeit', 'packaging_defect', 'adverse_reaction', 'unregistered_dispense', 'other')),
    description TEXT NOT NULL,
    evidence_cid TEXT, -- IPFS CID of uploaded photo/PDF evidence
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'investigating', 'confirmed', 'dismissed')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_reports_pharmacy ON reports(pharmacy_address, status);
CREATE INDEX IF NOT EXISTS idx_reports_created ON reports(created_at DESC);

-- Enable RLS on reports
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

-- Policy: Public can insert reports
CREATE POLICY "Allow public insert to reports"
    ON reports
    FOR INSERT
    TO anon, authenticated
    WITH CHECK (true);

-- Policy: Only service_role can read or update reports
CREATE POLICY "Allow service_role full access to reports"
    ON reports
    FOR ALL
    TO service_role
    USING (true);


-- 3. Flags Table (Automated Early-Warning Anomaly Flags, Server-only)
CREATE TABLE IF NOT EXISTS flags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rule_name TEXT NOT NULL CHECK (rule_name IN ('R4_UNKNOWN_SPIKE', 'R5_GEO_CLUSTER', 'R6_CLONE_ATTACK')),
    batch_id BIGINT,
    batch_number TEXT,
    severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    details JSONB NOT NULL DEFAULT '{}'::jsonb,
    resolved BOOLEAN NOT NULL DEFAULT false,
    resolved_by TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_flags_unresolved ON flags(resolved, created_at DESC);

-- Enable RLS on flags
ALTER TABLE flags ENABLE ROW LEVEL SECURITY;

-- Policy: Only service_role can read and manage anomaly flags
CREATE POLICY "Allow service_role full access to flags"
    ON flags
    FOR ALL
    TO service_role
    USING (true);


-- 4. Participants Cache Table (On-Chain Synced Registry & Trust Score Cache)
CREATE TABLE IF NOT EXISTS participants_cache (
    address TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('Regulator', 'Manufacturer', 'Distributor', 'Pharmacy')),
    license_number TEXT,
    region TEXT,
    trust_score NUMERIC(5, 2) NOT NULL DEFAULT 50.00,
    badge TEXT NOT NULL DEFAULT 'Bronze' CHECK (badge IN ('Bronze', 'Silver', 'Gold')),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Enable RLS on participants_cache
ALTER TABLE participants_cache ENABLE ROW LEVEL SECURITY;

-- Policy: Public can read active verified participants & trust badges
CREATE POLICY "Allow public read of participants_cache"
    ON participants_cache
    FOR SELECT
    TO anon, authenticated
    USING (true);

-- Policy: Only service_role can insert or update cache from chain events
CREATE POLICY "Allow service_role write to participants_cache"
    ON participants_cache
    FOR ALL
    TO service_role
    USING (true);
