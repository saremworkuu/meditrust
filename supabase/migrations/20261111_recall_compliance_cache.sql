-- MediTrust SQL Migration: recall_compliance_cache
-- Implements: Section 7.1, FR-RR-08, FR-RR-09, FR-RR-10
-- Hard rule 1: No personal data on-chain or in off-chain compliance logs

CREATE TABLE IF NOT EXISTS recall_compliance_cache (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_id BIGINT NOT NULL,
    batch_number TEXT NOT NULL,
    product_name TEXT NOT NULL,
    gtin TEXT NOT NULL,
    holder TEXT NOT NULL,
    holder_name TEXT,
    holder_role TEXT NOT NULL CHECK (holder_role IN ('distributor', 'pharmacy', 'hospital')),
    status TEXT NOT NULL CHECK (status IN ('Pending', 'Acknowledged', 'Overdue')),
    qty_held INTEGER NOT NULL DEFAULT 0 CHECK (qty_held >= 0),
    qty_quarantined INTEGER NOT NULL DEFAULT 0 CHECK (qty_quarantined >= 0),
    evidence_cid TEXT,
    severity TEXT NOT NULL DEFAULT 'ClassII' CHECK (severity IN ('ClassI', 'ClassII', 'ClassIII')),
    recall_reason TEXT NOT NULL,
    recalled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deadline_at TIMESTAMPTZ NOT NULL,
    acked_at TIMESTAMPTZ,
    overdue_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_batch_holder UNIQUE (batch_id, holder)
);

-- Indexing for high-performance compliance filtering and regulator dashboard views
CREATE INDEX IF NOT EXISTS idx_recall_compliance_batch ON recall_compliance_cache (batch_id);
CREATE INDEX IF NOT EXISTS idx_recall_compliance_holder ON recall_compliance_cache (holder);
CREATE INDEX IF NOT EXISTS idx_recall_compliance_status ON recall_compliance_cache (status);
CREATE INDEX IF NOT EXISTS idx_recall_compliance_deadline ON recall_compliance_cache (deadline_at);

-- Row Level Security (RLS) policies
ALTER TABLE recall_compliance_cache ENABLE ROW LEVEL SECURITY;

-- Public read-only policy for transparency (verified pharmacies & patients can view compliance status)
CREATE POLICY "Public read recall compliance cache"
    ON recall_compliance_cache FOR SELECT
    USING (true);

-- Regulator / Service Role update policy
CREATE POLICY "Regulator and service worker can manage recall compliance"
    ON recall_compliance_cache FOR ALL
    USING (auth.jwt() ->> 'role' = 'regulator' OR auth.role() = 'service_role');
