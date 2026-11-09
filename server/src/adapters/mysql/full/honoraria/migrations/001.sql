-- Idempotent lane A module storage. Contract rows remain separate from professionals.
CREATE TABLE IF NOT EXISTS lane_a_participations (institution INTEGER NOT NULL, row_key VARCHAR(200) NOT NULL, data JSON NOT NULL, PRIMARY KEY (institution,row_key)) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS lane_a_roles (institution INTEGER NOT NULL, row_key VARCHAR(200) NOT NULL, data JSON NOT NULL, PRIMARY KEY (institution,row_key)) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS lane_a_honoraria_snapshots (institution INTEGER NOT NULL, row_key VARCHAR(200) NOT NULL, data JSON NOT NULL, PRIMARY KEY (institution,row_key)) ENGINE=InnoDB;
