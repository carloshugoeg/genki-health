-- Idempotent lane A module storage. Contract rows remain separate from professionals.
CREATE TABLE IF NOT EXISTS lane_a_locks (institution INTEGER NOT NULL, row_key VARCHAR(200) NOT NULL, data JSON NOT NULL, PRIMARY KEY (institution,row_key)) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS lane_a_charges (institution INTEGER NOT NULL, row_key VARCHAR(200) NOT NULL, data JSON NOT NULL, PRIMARY KEY (institution,row_key)) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS lane_a_services (institution INTEGER NOT NULL, row_key VARCHAR(200) NOT NULL, data JSON NOT NULL, PRIMARY KEY (institution,row_key)) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS lane_a_charge_events (institution INTEGER NOT NULL, row_key VARCHAR(200) NOT NULL, data JSON NOT NULL, PRIMARY KEY (institution,row_key)) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS lane_a_audit (institution INTEGER NOT NULL, row_key VARCHAR(200) NOT NULL, data JSON NOT NULL, PRIMARY KEY (institution,row_key)) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS lane_a_counters (institution INTEGER NOT NULL, row_key VARCHAR(200) NOT NULL, data JSON NOT NULL, PRIMARY KEY (institution,row_key)) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS lane_a_commands (institution INTEGER NOT NULL, row_key VARCHAR(200) NOT NULL, data JSON NOT NULL, PRIMARY KEY (institution,row_key)) ENGINE=InnoDB;
