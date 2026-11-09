-- Idempotent lane A module storage. Contract rows remain separate from professionals.
CREATE TABLE IF NOT EXISTS lane_a_supplies (institution INTEGER NOT NULL, row_key VARCHAR(200) NOT NULL, data JSON NOT NULL, PRIMARY KEY (institution,row_key)) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS lane_a_consumptions (institution INTEGER NOT NULL, row_key VARCHAR(200) NOT NULL, data JSON NOT NULL, PRIMARY KEY (institution,row_key)) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS lane_a_metadata (institution INTEGER NOT NULL, row_key VARCHAR(200) NOT NULL, data JSON NOT NULL, PRIMARY KEY (institution,row_key)) ENGINE=InnoDB;
