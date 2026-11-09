-- Idempotent lane A module storage. Contract rows remain separate from professionals.
CREATE TABLE IF NOT EXISTS lane_a_professionals (institution INTEGER NOT NULL, row_key VARCHAR(200) NOT NULL, data JSON NOT NULL, PRIMARY KEY (institution,row_key)) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS lane_a_contracts (institution INTEGER NOT NULL, row_key VARCHAR(200) NOT NULL, data JSON NOT NULL, PRIMARY KEY (institution,row_key)) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS lane_a_personnel_types (institution INTEGER NOT NULL, row_key VARCHAR(200) NOT NULL, data JSON NOT NULL, PRIMARY KEY (institution,row_key)) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS lane_a_tariffs (institution INTEGER NOT NULL, row_key VARCHAR(200) NOT NULL, data JSON NOT NULL, PRIMARY KEY (institution,row_key)) ENGINE=InnoDB;
