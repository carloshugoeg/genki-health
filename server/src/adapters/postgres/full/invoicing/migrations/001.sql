-- Idempotent lane A module storage. Contract rows remain separate from professionals.
CREATE TABLE IF NOT EXISTS lane_a_invoices (institution INTEGER NOT NULL, row_key VARCHAR(200) NOT NULL, data JSONB NOT NULL, PRIMARY KEY (institution,row_key));
CREATE TABLE IF NOT EXISTS lane_a_invoice_lines (institution INTEGER NOT NULL, row_key VARCHAR(200) NOT NULL, data JSONB NOT NULL, PRIMARY KEY (institution,row_key));
