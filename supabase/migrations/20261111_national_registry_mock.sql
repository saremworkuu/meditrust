-- MediTrust Mock National Interoperability Registry (FR-IO-01 to FR-IO-05)
-- Label: SIMULATED (Hard rule 6)

CREATE TABLE IF NOT EXISTS registry_mock (
  gtin TEXT NOT NULL,
  batch_number TEXT NOT NULL,
  expiry TEXT NOT NULL,
  product_name TEXT NOT NULL,
  manufacturer TEXT NOT NULL,
  national_drug_code TEXT NOT NULL,
  registration_status TEXT NOT NULL DEFAULT 'Active',
  registered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (gtin, batch_number)
);

-- Seed initial EFDA registered essential medicines
INSERT INTO registry_mock (gtin, batch_number, expiry, product_name, manufacturer, national_drug_code, registration_status)
VALUES
  ('07612345678900', 'ET-2026-MED01', '2028-12-31', 'Amoxicillin 500mg Capsules', 'EPHARM (Ethiopian Pharmaceuticals)', 'EFDA-ET-REG-2026-001', 'Active'),
  ('07612345678900', 'ET-AMOX-001', '2027-06-30', 'Amoxicillin 500mg Capsules', 'EPHARM (Ethiopian Pharmaceuticals)', 'EFDA-ET-REG-2026-002', 'Active'),
  ('07612345678900', 'ET-AMOX-002', '2027-08-31', 'Amoxicillin 500mg Capsules', 'EPHARM (Ethiopian Pharmaceuticals)', 'EFDA-ET-REG-2026-003', 'Active'),
  ('07612345678911', 'ET-PARA-001', '2028-01-15', 'Paracetamol 500mg Tablets', 'Cadila Pharmaceuticals Ethiopia', 'EFDA-ET-REG-2026-044', 'Active')
ON CONFLICT (gtin, batch_number) DO NOTHING;
