-- MediTrust Early-Warning Map & Anomaly Detection Schema
-- Implements: FR-EW-01, FR-EW-02, FR-EW-04, FR-EW-05, FR-EW-06, Section 5.2

CREATE TABLE IF NOT EXISTS geo_cells (
  cell_id TEXT PRIMARY KEY,
  lat_center NUMERIC(8, 4) NOT NULL,
  lng_center NUMERIC(8, 4) NOT NULL,
  area_name TEXT NOT NULL,
  unknown_count INT DEFAULT 0,
  genuine_count INT DEFAULT 0,
  clone_count INT DEFAULT 0,
  sold_count INT DEFAULT 0,
  window_start TIMESTAMPTZ NOT NULL,
  window_end TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_geo_cells_window ON geo_cells (window_start, window_end);

CREATE TABLE IF NOT EXISTS geo_scan_events (
  id UUID PRIMARY KEY,
  batch_id BIGINT,
  batch_number TEXT,
  serial_number TEXT,
  channel TEXT NOT NULL CHECK (channel IN ('web', 'telegram', 'mock_sms')),
  status TEXT NOT NULL,
  lat NUMERIC(8, 4) NOT NULL,
  lng NUMERIC(8, 4) NOT NULL,
  cell_id TEXT NOT NULL,
  area_name TEXT NOT NULL,
  device_hash TEXT NOT NULL, -- Salted HMAC-SHA256, non-reversible (Section 5.2)
  pharmacy_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_geo_scan_events_time ON geo_scan_events (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_geo_scan_events_batch ON geo_scan_events (batch_number);
CREATE INDEX IF NOT EXISTS idx_geo_scan_events_cell ON geo_scan_events (cell_id);

CREATE TABLE IF NOT EXISTS anomaly_alerts (
  id UUID PRIMARY KEY,
  rule TEXT NOT NULL CHECK (rule IN ('R4', 'R5', 'R6')),
  title TEXT NOT NULL,
  description_en TEXT NOT NULL,
  description_am TEXT NOT NULL,
  batch_id BIGINT,
  batch_number TEXT,
  area TEXT NOT NULL,
  lat NUMERIC(8, 4) NOT NULL,
  lng NUMERIC(8, 4) NOT NULL,
  count INT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('Medium', 'High', 'Critical')),
  status TEXT NOT NULL CHECK (status IN ('active', 'investigating', 'resolved')),
  investigation_id UUID,
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS investigations (
  id UUID PRIMARY KEY,
  alert_id UUID REFERENCES anomaly_alerts(id),
  rule TEXT NOT NULL,
  batch_id BIGINT,
  batch_number TEXT,
  area TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('open', 'investigating', 'confirmed_counterfeit', 'recalled', 'closed')),
  notes TEXT,
  assigned_inspector TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
