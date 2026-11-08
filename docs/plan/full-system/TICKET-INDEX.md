# Full-system additive ticket index

Old46 ticket IDs remain unchanged. C=core+memory, PG/MY/MO/FS=native engine, H=HTTP/UI; two OPs max per feature PR. Each same module/layer chunk serialized, disjoint module directories parallel. A complete operation requires ALL assigned layers plus wave integration/security/relations/gate; a core ticket done is not operation done.

|Ticket|Owner|Dependencies|OPs|Layer|
|---|---|---|---|---|
|[FS-FOUNDATION](tickets/fs-foundation.md)|agent-foundation|E2-P2-06|integration|integration|
|[FS-TOOLCHAIN](tickets/fs-toolchain.md)|agent-wire|FS-FOUNDATION, E2-P3A-01|integration|integration|
|[FS-REFERENCE-DATA](tickets/fs-reference-data.md)|agent-data|FS-FOUNDATION|integration|integration|
|[FS-01-C01](tickets/fs-01-c01.md)|agent-account-core|FS-FOUNDATION, E2-P2-09|01,02|core|
|[FS-01-C02](tickets/fs-01-c02.md)|agent-account-core|FS-FOUNDATION, FS-01-C01, E2-P2-09|03,04|core|
|[FS-01-PG01](tickets/fs-01-pg01.md)|agent-account-postgres|FS-01-C01, E2-P3A-04, FS-TOOLCHAIN, E2-P3A-05|01,02|engine/postgres|
|[FS-01-PG02](tickets/fs-01-pg02.md)|agent-account-postgres|FS-01-C02, E2-P3A-04, FS-TOOLCHAIN, FS-01-PG01, E2-P3A-05|03,04|engine/postgres|
|[FS-01-H01](tickets/fs-01-h01.md)|agent-account-ui|FS-01-C01, FS-TOOLCHAIN|01,02|http-ui|
|[FS-01-H02](tickets/fs-01-h02.md)|agent-account-ui|FS-01-C02, FS-TOOLCHAIN, FS-01-H01|03,04|http-ui|
|[FS-02-C01](tickets/fs-02-c01.md)|agent-users-core|FS-FOUNDATION, FS-01-C02|05,06|core|
|[FS-02-PG01](tickets/fs-02-pg01.md)|agent-users-postgres|FS-02-C01, E2-P3A-04, FS-TOOLCHAIN, FS-01-PG02|05,06|engine/postgres|
|[FS-02-H01](tickets/fs-02-h01.md)|agent-users-ui|FS-02-C01, FS-TOOLCHAIN|05,06|http-ui|
|[FS-03-C01](tickets/fs-03-c01.md)|agent-patient-core|FS-FOUNDATION|09,10|core|
|[FS-03-PG01](tickets/fs-03-pg01.md)|agent-patient-postgres|FS-03-C01, E2-P3A-04, FS-TOOLCHAIN|09,10|engine/postgres|
|[FS-03-MY01](tickets/fs-03-my01.md)|agent-patient-mysql|FS-03-C01, E2-P3B-03, FS-TOOLCHAIN|09,10|engine/mysql|
|[FS-03-MO01](tickets/fs-03-mo01.md)|agent-patient-mongodb|FS-03-C01, E2-P4A-03, FS-TOOLCHAIN|09,10|engine/mongodb|
|[FS-03-FS01](tickets/fs-03-fs01.md)|agent-patient-firebase|FS-03-C01, E2-P4B-04, FS-TOOLCHAIN|09,10|engine/firebase|
|[FS-03-H01](tickets/fs-03-h01.md)|agent-patient-ui|FS-03-C01, FS-TOOLCHAIN|09,10|http-ui|
|[FS-04-C01](tickets/fs-04-c01.md)|agent-record-core|FS-FOUNDATION|12,15|core|
|[FS-04-C02](tickets/fs-04-c02.md)|agent-record-core|FS-FOUNDATION, FS-04-C01|16,18|core|
|[FS-04-C03](tickets/fs-04-c03.md)|agent-record-core|FS-FOUNDATION, FS-04-C02|19|core|
|[FS-04-PG01](tickets/fs-04-pg01.md)|agent-record-postgres|FS-04-C01, E2-P3A-04, FS-TOOLCHAIN|12,15|engine/postgres|
|[FS-04-PG02](tickets/fs-04-pg02.md)|agent-record-postgres|FS-04-C02, E2-P3A-04, FS-TOOLCHAIN, FS-04-PG01|16,18|engine/postgres|
|[FS-04-PG03](tickets/fs-04-pg03.md)|agent-record-postgres|FS-04-C03, E2-P3A-04, FS-TOOLCHAIN, FS-04-PG02|19|engine/postgres|
|[FS-04-MY01](tickets/fs-04-my01.md)|agent-record-mysql|FS-04-C01, E2-P3B-03, FS-TOOLCHAIN|12,15|engine/mysql|
|[FS-04-MY02](tickets/fs-04-my02.md)|agent-record-mysql|FS-04-C02, E2-P3B-03, FS-TOOLCHAIN, FS-04-MY01|16,18|engine/mysql|
|[FS-04-MY03](tickets/fs-04-my03.md)|agent-record-mysql|FS-04-C03, E2-P3B-03, FS-TOOLCHAIN, FS-04-MY02|19|engine/mysql|
|[FS-04-MO01](tickets/fs-04-mo01.md)|agent-record-mongodb|FS-04-C01, E2-P4A-03, FS-TOOLCHAIN|12,15|engine/mongodb|
|[FS-04-MO02](tickets/fs-04-mo02.md)|agent-record-mongodb|FS-04-C02, E2-P4A-03, FS-TOOLCHAIN, FS-04-MO01|16,18|engine/mongodb|
|[FS-04-MO03](tickets/fs-04-mo03.md)|agent-record-mongodb|FS-04-C03, E2-P4A-03, FS-TOOLCHAIN, FS-04-MO02|19|engine/mongodb|
|[FS-04-FS01](tickets/fs-04-fs01.md)|agent-record-firebase|FS-04-C01, E2-P4B-04, FS-TOOLCHAIN|12,15|engine/firebase|
|[FS-04-FS02](tickets/fs-04-fs02.md)|agent-record-firebase|FS-04-C02, E2-P4B-04, FS-TOOLCHAIN, FS-04-FS01|16,18|engine/firebase|
|[FS-04-FS03](tickets/fs-04-fs03.md)|agent-record-firebase|FS-04-C03, E2-P4B-04, FS-TOOLCHAIN, FS-04-FS02|19|engine/firebase|
|[FS-04-H01](tickets/fs-04-h01.md)|agent-record-ui|FS-04-C01, FS-TOOLCHAIN|12,15|http-ui|
|[FS-04-H02](tickets/fs-04-h02.md)|agent-record-ui|FS-04-C02, FS-TOOLCHAIN, FS-04-H01|16,18|http-ui|
|[FS-04-H03](tickets/fs-04-h03.md)|agent-record-ui|FS-04-C03, FS-TOOLCHAIN, FS-04-H02|19|http-ui|
|[FS-05-C01](tickets/fs-05-c01.md)|agent-attachments-core|FS-FOUNDATION, FS-04-C03|17|core|
|[FS-05-PG01](tickets/fs-05-pg01.md)|agent-attachments-postgres|FS-05-C01, E2-P3A-04, FS-TOOLCHAIN, FS-04-PG03|17|engine/postgres|
|[FS-05-MY01](tickets/fs-05-my01.md)|agent-attachments-mysql|FS-05-C01, E2-P3B-03, FS-TOOLCHAIN, FS-04-MY03|17|engine/mysql|
|[FS-05-MO01](tickets/fs-05-mo01.md)|agent-attachments-mongodb|FS-05-C01, E2-P4A-03, FS-TOOLCHAIN, FS-04-MO03|17|engine/mongodb|
|[FS-05-FS01](tickets/fs-05-fs01.md)|agent-attachments-firebase|FS-05-C01, E2-P4B-04, FS-TOOLCHAIN, FS-04-FS03|17|engine/firebase|
|[FS-05-H01](tickets/fs-05-h01.md)|agent-attachments-ui|FS-05-C01, FS-TOOLCHAIN|17|http-ui|
|[FS-06-C01](tickets/fs-06-c01.md)|agent-agenda-core|FS-FOUNDATION|20,21|core|
|[FS-06-C02](tickets/fs-06-c02.md)|agent-agenda-core|FS-FOUNDATION, FS-06-C01|22,23|core|
|[FS-06-C03](tickets/fs-06-c03.md)|agent-agenda-core|FS-FOUNDATION, FS-06-C02|24,25|core|
|[FS-06-PG01](tickets/fs-06-pg01.md)|agent-agenda-postgres|FS-06-C01, E2-P3A-04, FS-TOOLCHAIN|20,21|engine/postgres|
|[FS-06-PG02](tickets/fs-06-pg02.md)|agent-agenda-postgres|FS-06-C02, E2-P3A-04, FS-TOOLCHAIN, FS-06-PG01|22,23|engine/postgres|
|[FS-06-PG03](tickets/fs-06-pg03.md)|agent-agenda-postgres|FS-06-C03, E2-P3A-04, FS-TOOLCHAIN, FS-06-PG02|24,25|engine/postgres|
|[FS-06-MY01](tickets/fs-06-my01.md)|agent-agenda-mysql|FS-06-C01, E2-P3B-03, FS-TOOLCHAIN|20,21|engine/mysql|
|[FS-06-MY02](tickets/fs-06-my02.md)|agent-agenda-mysql|FS-06-C02, E2-P3B-03, FS-TOOLCHAIN, FS-06-MY01|22,23|engine/mysql|
|[FS-06-MY03](tickets/fs-06-my03.md)|agent-agenda-mysql|FS-06-C03, E2-P3B-03, FS-TOOLCHAIN, FS-06-MY02|24,25|engine/mysql|
|[FS-06-MO01](tickets/fs-06-mo01.md)|agent-agenda-mongodb|FS-06-C01, E2-P4A-03, FS-TOOLCHAIN|20,21|engine/mongodb|
|[FS-06-MO02](tickets/fs-06-mo02.md)|agent-agenda-mongodb|FS-06-C02, E2-P4A-03, FS-TOOLCHAIN, FS-06-MO01|22,23|engine/mongodb|
|[FS-06-MO03](tickets/fs-06-mo03.md)|agent-agenda-mongodb|FS-06-C03, E2-P4A-03, FS-TOOLCHAIN, FS-06-MO02|24,25|engine/mongodb|
|[FS-06-FS01](tickets/fs-06-fs01.md)|agent-agenda-firebase|FS-06-C01, E2-P4B-04, FS-TOOLCHAIN|20,21|engine/firebase|
|[FS-06-FS02](tickets/fs-06-fs02.md)|agent-agenda-firebase|FS-06-C02, E2-P4B-04, FS-TOOLCHAIN, FS-06-FS01|22,23|engine/firebase|
|[FS-06-FS03](tickets/fs-06-fs03.md)|agent-agenda-firebase|FS-06-C03, E2-P4B-04, FS-TOOLCHAIN, FS-06-FS02|24,25|engine/firebase|
|[FS-06-H01](tickets/fs-06-h01.md)|agent-agenda-ui|FS-06-C01, FS-TOOLCHAIN|20,21|http-ui|
|[FS-06-H02](tickets/fs-06-h02.md)|agent-agenda-ui|FS-06-C02, FS-TOOLCHAIN, FS-06-H01|22,23|http-ui|
|[FS-06-H03](tickets/fs-06-h03.md)|agent-agenda-ui|FS-06-C03, FS-TOOLCHAIN, FS-06-H02|24,25|http-ui|
|[FS-07-C01](tickets/fs-07-c01.md)|agent-consultation-core|FS-FOUNDATION, FS-23-C02, FS-06-C03|26,27|core|
|[FS-07-C02](tickets/fs-07-c02.md)|agent-consultation-core|FS-FOUNDATION, FS-07-C01|28,29|core|
|[FS-07-C03](tickets/fs-07-c03.md)|agent-consultation-core|FS-FOUNDATION, FS-07-C02|30,31|core|
|[FS-07-C04](tickets/fs-07-c04.md)|agent-consultation-core|FS-FOUNDATION, FS-07-C03|32,33|core|
|[FS-07-PG01](tickets/fs-07-pg01.md)|agent-consultation-postgres|FS-07-C01, E2-P3A-04, FS-TOOLCHAIN, FS-23-PG02, FS-06-PG03|26,27|engine/postgres|
|[FS-07-PG02](tickets/fs-07-pg02.md)|agent-consultation-postgres|FS-07-C02, E2-P3A-04, FS-TOOLCHAIN, FS-07-PG01, FS-23-PG02, FS-06-PG03|28,29|engine/postgres|
|[FS-07-PG03](tickets/fs-07-pg03.md)|agent-consultation-postgres|FS-07-C03, E2-P3A-04, FS-TOOLCHAIN, FS-07-PG02, FS-23-PG02, FS-06-PG03|30,31|engine/postgres|
|[FS-07-PG04](tickets/fs-07-pg04.md)|agent-consultation-postgres|FS-07-C04, E2-P3A-04, FS-TOOLCHAIN, FS-07-PG03, FS-23-PG02, FS-06-PG03|32,33|engine/postgres|
|[FS-07-MY01](tickets/fs-07-my01.md)|agent-consultation-mysql|FS-07-C01, E2-P3B-03, FS-TOOLCHAIN, FS-23-MY02, FS-06-MY03|26,27|engine/mysql|
|[FS-07-MY02](tickets/fs-07-my02.md)|agent-consultation-mysql|FS-07-C02, E2-P3B-03, FS-TOOLCHAIN, FS-07-MY01, FS-23-MY02, FS-06-MY03|28,29|engine/mysql|
|[FS-07-MY03](tickets/fs-07-my03.md)|agent-consultation-mysql|FS-07-C03, E2-P3B-03, FS-TOOLCHAIN, FS-07-MY02, FS-23-MY02, FS-06-MY03|30,31|engine/mysql|
|[FS-07-MY04](tickets/fs-07-my04.md)|agent-consultation-mysql|FS-07-C04, E2-P3B-03, FS-TOOLCHAIN, FS-07-MY03, FS-23-MY02, FS-06-MY03|32,33|engine/mysql|
|[FS-07-MO01](tickets/fs-07-mo01.md)|agent-consultation-mongodb|FS-07-C01, E2-P4A-03, FS-TOOLCHAIN, FS-23-MO02, FS-06-MO03|26,27|engine/mongodb|
|[FS-07-MO02](tickets/fs-07-mo02.md)|agent-consultation-mongodb|FS-07-C02, E2-P4A-03, FS-TOOLCHAIN, FS-07-MO01, FS-23-MO02, FS-06-MO03|28,29|engine/mongodb|
|[FS-07-MO03](tickets/fs-07-mo03.md)|agent-consultation-mongodb|FS-07-C03, E2-P4A-03, FS-TOOLCHAIN, FS-07-MO02, FS-23-MO02, FS-06-MO03|30,31|engine/mongodb|
|[FS-07-MO04](tickets/fs-07-mo04.md)|agent-consultation-mongodb|FS-07-C04, E2-P4A-03, FS-TOOLCHAIN, FS-07-MO03, FS-23-MO02, FS-06-MO03|32,33|engine/mongodb|
|[FS-07-FS01](tickets/fs-07-fs01.md)|agent-consultation-firebase|FS-07-C01, E2-P4B-04, FS-TOOLCHAIN, FS-23-FS02, FS-06-FS03|26,27|engine/firebase|
|[FS-07-FS02](tickets/fs-07-fs02.md)|agent-consultation-firebase|FS-07-C02, E2-P4B-04, FS-TOOLCHAIN, FS-07-FS01, FS-23-FS02, FS-06-FS03|28,29|engine/firebase|
|[FS-07-FS03](tickets/fs-07-fs03.md)|agent-consultation-firebase|FS-07-C03, E2-P4B-04, FS-TOOLCHAIN, FS-07-FS02, FS-23-FS02, FS-06-FS03|30,31|engine/firebase|
|[FS-07-FS04](tickets/fs-07-fs04.md)|agent-consultation-firebase|FS-07-C04, E2-P4B-04, FS-TOOLCHAIN, FS-07-FS03, FS-23-FS02, FS-06-FS03|32,33|engine/firebase|
|[FS-07-H01](tickets/fs-07-h01.md)|agent-consultation-ui|FS-07-C01, FS-TOOLCHAIN|26,27|http-ui|
|[FS-07-H02](tickets/fs-07-h02.md)|agent-consultation-ui|FS-07-C02, FS-TOOLCHAIN, FS-07-H01|28,29|http-ui|
|[FS-07-H03](tickets/fs-07-h03.md)|agent-consultation-ui|FS-07-C03, FS-TOOLCHAIN, FS-07-H02|30,31|http-ui|
|[FS-07-H04](tickets/fs-07-h04.md)|agent-consultation-ui|FS-07-C04, FS-TOOLCHAIN, FS-07-H03|32,33|http-ui|
|[FS-08-C01](tickets/fs-08-c01.md)|agent-admission-core|FS-FOUNDATION, FS-07-C04|34,35|core|
|[FS-08-PG01](tickets/fs-08-pg01.md)|agent-admission-postgres|FS-08-C01, E2-P3A-04, FS-TOOLCHAIN, FS-07-PG04|34,35|engine/postgres|
|[FS-08-H01](tickets/fs-08-h01.md)|agent-admission-ui|FS-08-C01, FS-TOOLCHAIN|34,35|http-ui|
|[FS-09-C01](tickets/fs-09-c01.md)|agent-procedure-core|FS-FOUNDATION, FS-08-C01, FS-21-C02, FS-22-C01|36,37|core|
|[FS-09-PG01](tickets/fs-09-pg01.md)|agent-procedure-postgres|FS-09-C01, E2-P3A-04, FS-TOOLCHAIN, FS-08-PG01, FS-21-PG02, FS-22-PG01|36,37|engine/postgres|
|[FS-09-H01](tickets/fs-09-h01.md)|agent-procedure-ui|FS-09-C01, FS-TOOLCHAIN|36,37|http-ui|
|[FS-10-C01](tickets/fs-10-c01.md)|agent-discharge-core|FS-FOUNDATION, FS-08-C01, FS-23-C02|38|core|
|[FS-10-PG01](tickets/fs-10-pg01.md)|agent-discharge-postgres|FS-10-C01, E2-P3A-04, FS-TOOLCHAIN, FS-08-PG01, FS-23-PG02|38|engine/postgres|
|[FS-10-H01](tickets/fs-10-h01.md)|agent-discharge-ui|FS-10-C01, FS-TOOLCHAIN|38|http-ui|
|[FS-11-C01](tickets/fs-11-c01.md)|agent-referral-core|FS-FOUNDATION, FS-07-C04, FS-15-C01|39|core|
|[FS-11-PG01](tickets/fs-11-pg01.md)|agent-referral-postgres|FS-11-C01, E2-P3A-04, FS-TOOLCHAIN, FS-07-PG04|39|engine/postgres|
|[FS-11-MO01](tickets/fs-11-mo01.md)|agent-referral-mongodb|FS-11-C01, E2-P4A-03, FS-TOOLCHAIN, FS-07-MO04, FS-15-MO01|39|engine/mongodb|
|[FS-11-H01](tickets/fs-11-h01.md)|agent-referral-ui|FS-11-C01, FS-TOOLCHAIN|39|http-ui|
|[FS-12-C01](tickets/fs-12-c01.md)|agent-growth-core|FS-FOUNDATION, FS-07-C04, FS-REFERENCE-DATA|40,41|core|
|[FS-12-C02](tickets/fs-12-c02.md)|agent-growth-core|FS-FOUNDATION, FS-12-C01|42|core|
|[FS-12-MY01](tickets/fs-12-my01.md)|agent-growth-mysql|FS-12-C01, E2-P3B-03, FS-TOOLCHAIN, FS-07-MY04|40,41|engine/mysql|
|[FS-12-MY02](tickets/fs-12-my02.md)|agent-growth-mysql|FS-12-C02, E2-P3B-03, FS-TOOLCHAIN, FS-12-MY01, FS-07-MY04|42|engine/mysql|
|[FS-12-H01](tickets/fs-12-h01.md)|agent-growth-ui|FS-12-C01, FS-TOOLCHAIN|40,41|http-ui|
|[FS-12-H02](tickets/fs-12-h02.md)|agent-growth-ui|FS-12-C02, FS-TOOLCHAIN, FS-12-H01|42|http-ui|
|[FS-13-C01](tickets/fs-13-c01.md)|agent-vaccines-core|FS-FOUNDATION, FS-REFERENCE-DATA|43,44|core|
|[FS-13-C02](tickets/fs-13-c02.md)|agent-vaccines-core|FS-FOUNDATION, FS-13-C01, FS-REFERENCE-DATA|45,47|core|
|[FS-13-MY01](tickets/fs-13-my01.md)|agent-vaccines-mysql|FS-13-C01, E2-P3B-03, FS-TOOLCHAIN|43,44|engine/mysql|
|[FS-13-MY02](tickets/fs-13-my02.md)|agent-vaccines-mysql|FS-13-C02, E2-P3B-03, FS-TOOLCHAIN, FS-13-MY01|45,47|engine/mysql|
|[FS-13-H01](tickets/fs-13-h01.md)|agent-vaccines-ui|FS-13-C01, FS-TOOLCHAIN|43,44|http-ui|
|[FS-13-H02](tickets/fs-13-h02.md)|agent-vaccines-ui|FS-13-C02, FS-TOOLCHAIN, FS-13-H01|45,47|http-ui|
|[FS-14-C01](tickets/fs-14-c01.md)|agent-milestones-core|FS-FOUNDATION|46|core|
|[FS-14-MY01](tickets/fs-14-my01.md)|agent-milestones-mysql|FS-14-C01, E2-P3B-03, FS-TOOLCHAIN|46|engine/mysql|
|[FS-14-H01](tickets/fs-14-h01.md)|agent-milestones-ui|FS-14-C01, FS-TOOLCHAIN|46|http-ui|
|[FS-15-C01](tickets/fs-15-c01.md)|agent-lab-intake-core|FS-FOUNDATION|48,49|core|
|[FS-15-MO01](tickets/fs-15-mo01.md)|agent-lab-intake-mongodb|FS-15-C01, E2-P4A-03, FS-TOOLCHAIN|48,49|engine/mongodb|
|[FS-15-H01](tickets/fs-15-h01.md)|agent-lab-intake-ui|FS-15-C01, FS-TOOLCHAIN|48,49|http-ui|
|[FS-16-C01](tickets/fs-16-c01.md)|agent-lab-results-core|FS-FOUNDATION, FS-15-C01|50,51|core|
|[FS-16-C02](tickets/fs-16-c02.md)|agent-lab-results-core|FS-FOUNDATION, FS-16-C01|52,53|core|
|[FS-16-C03](tickets/fs-16-c03.md)|agent-lab-results-core|FS-FOUNDATION, FS-16-C02|54|core|
|[FS-16-MO01](tickets/fs-16-mo01.md)|agent-lab-results-mongodb|FS-16-C01, E2-P4A-03, FS-TOOLCHAIN, FS-15-MO01|50,51|engine/mongodb|
|[FS-16-MO02](tickets/fs-16-mo02.md)|agent-lab-results-mongodb|FS-16-C02, E2-P4A-03, FS-TOOLCHAIN, FS-16-MO01, FS-15-MO01|52,53|engine/mongodb|
|[FS-16-MO03](tickets/fs-16-mo03.md)|agent-lab-results-mongodb|FS-16-C03, E2-P4A-03, FS-TOOLCHAIN, FS-16-MO02, FS-15-MO01|54|engine/mongodb|
|[FS-16-H01](tickets/fs-16-h01.md)|agent-lab-results-ui|FS-16-C01, FS-TOOLCHAIN|50,51|http-ui|
|[FS-16-H02](tickets/fs-16-h02.md)|agent-lab-results-ui|FS-16-C02, FS-TOOLCHAIN, FS-16-H01|52,53|http-ui|
|[FS-16-H03](tickets/fs-16-h03.md)|agent-lab-results-ui|FS-16-C03, FS-TOOLCHAIN, FS-16-H02|54|http-ui|
|[FS-17-C01](tickets/fs-17-c01.md)|agent-dental-chart-core|FS-FOUNDATION|55,56|core|
|[FS-17-FS01](tickets/fs-17-fs01.md)|agent-dental-chart-firebase|FS-17-C01, E2-P4B-04, FS-TOOLCHAIN|55,56|engine/firebase|
|[FS-17-H01](tickets/fs-17-h01.md)|agent-dental-chart-ui|FS-17-C01, FS-TOOLCHAIN|55,56|http-ui|
|[FS-18-C01](tickets/fs-18-c01.md)|agent-dental-plan-core|FS-FOUNDATION, FS-17-C01|57,58|core|
|[FS-18-FS01](tickets/fs-18-fs01.md)|agent-dental-plan-firebase|FS-18-C01, E2-P4B-04, FS-TOOLCHAIN, FS-17-FS01|57,58|engine/firebase|
|[FS-18-H01](tickets/fs-18-h01.md)|agent-dental-plan-ui|FS-18-C01, FS-TOOLCHAIN|57,58|http-ui|
|[FS-19-C01](tickets/fs-19-c01.md)|agent-dental-session-core|FS-FOUNDATION, FS-18-C01, FS-23-C02, FS-25-C02|59,60|core|
|[FS-19-FS01](tickets/fs-19-fs01.md)|agent-dental-session-firebase|FS-19-C01, E2-P4B-04, FS-TOOLCHAIN, FS-18-FS01, FS-23-FS02, FS-25-FS02|59,60|engine/firebase|
|[FS-19-H01](tickets/fs-19-h01.md)|agent-dental-session-ui|FS-19-C01, FS-TOOLCHAIN|59,60|http-ui|
|[FS-20-C01](tickets/fs-20-c01.md)|agent-personnel-core|FS-FOUNDATION|61,62|core|
|[FS-20-PG01](tickets/fs-20-pg01.md)|agent-personnel-postgres|FS-20-C01, E2-P3A-04, FS-TOOLCHAIN|61,62|engine/postgres|
|[FS-20-MY01](tickets/fs-20-my01.md)|agent-personnel-mysql|FS-20-C01, E2-P3B-03, FS-TOOLCHAIN|61,62|engine/mysql|
|[FS-20-MO01](tickets/fs-20-mo01.md)|agent-personnel-mongodb|FS-20-C01, E2-P4A-03, FS-TOOLCHAIN|61,62|engine/mongodb|
|[FS-20-FS01](tickets/fs-20-fs01.md)|agent-personnel-firebase|FS-20-C01, E2-P4B-04, FS-TOOLCHAIN|61,62|engine/firebase|
|[FS-20-H01](tickets/fs-20-h01.md)|agent-personnel-ui|FS-20-C01, FS-TOOLCHAIN|61,62|http-ui|
|[FS-21-C01](tickets/fs-21-c01.md)|agent-honoraria-core|FS-FOUNDATION, FS-20-C01, FS-23-C02|63,64|core|
|[FS-21-C02](tickets/fs-21-c02.md)|agent-honoraria-core|FS-FOUNDATION, FS-21-C01|65|core|
|[FS-21-PG01](tickets/fs-21-pg01.md)|agent-honoraria-postgres|FS-21-C01, E2-P3A-04, FS-TOOLCHAIN, FS-20-PG01, FS-23-PG02|63,64|engine/postgres|
|[FS-21-PG02](tickets/fs-21-pg02.md)|agent-honoraria-postgres|FS-21-C02, E2-P3A-04, FS-TOOLCHAIN, FS-21-PG01, FS-20-PG01, FS-23-PG02|65|engine/postgres|
|[FS-21-MY01](tickets/fs-21-my01.md)|agent-honoraria-mysql|FS-21-C01, E2-P3B-03, FS-TOOLCHAIN, FS-20-MY01, FS-23-MY02|63,64|engine/mysql|
|[FS-21-MY02](tickets/fs-21-my02.md)|agent-honoraria-mysql|FS-21-C02, E2-P3B-03, FS-TOOLCHAIN, FS-21-MY01, FS-20-MY01, FS-23-MY02|65|engine/mysql|
|[FS-21-MO01](tickets/fs-21-mo01.md)|agent-honoraria-mongodb|FS-21-C01, E2-P4A-03, FS-TOOLCHAIN, FS-20-MO01, FS-23-MO02|63,64|engine/mongodb|
|[FS-21-MO02](tickets/fs-21-mo02.md)|agent-honoraria-mongodb|FS-21-C02, E2-P4A-03, FS-TOOLCHAIN, FS-21-MO01, FS-20-MO01, FS-23-MO02|65|engine/mongodb|
|[FS-21-FS01](tickets/fs-21-fs01.md)|agent-honoraria-firebase|FS-21-C01, E2-P4B-04, FS-TOOLCHAIN, FS-20-FS01, FS-23-FS02|63,64|engine/firebase|
|[FS-21-FS02](tickets/fs-21-fs02.md)|agent-honoraria-firebase|FS-21-C02, E2-P4B-04, FS-TOOLCHAIN, FS-21-FS01, FS-20-FS01, FS-23-FS02|65|engine/firebase|
|[FS-21-H01](tickets/fs-21-h01.md)|agent-honoraria-ui|FS-21-C01, FS-TOOLCHAIN|63,64|http-ui|
|[FS-21-H02](tickets/fs-21-h02.md)|agent-honoraria-ui|FS-21-C02, FS-TOOLCHAIN, FS-21-H01|65|http-ui|
|[FS-22-C01](tickets/fs-22-c01.md)|agent-inventory-core|FS-FOUNDATION, FS-23-C02|66,67|core|
|[FS-22-PG01](tickets/fs-22-pg01.md)|agent-inventory-postgres|FS-22-C01, E2-P3A-04, FS-TOOLCHAIN, FS-23-PG02|66,67|engine/postgres|
|[FS-22-MY01](tickets/fs-22-my01.md)|agent-inventory-mysql|FS-22-C01, E2-P3B-03, FS-TOOLCHAIN, FS-23-MY02|66,67|engine/mysql|
|[FS-22-MO01](tickets/fs-22-mo01.md)|agent-inventory-mongodb|FS-22-C01, E2-P4A-03, FS-TOOLCHAIN, FS-23-MO02|66,67|engine/mongodb|
|[FS-22-FS01](tickets/fs-22-fs01.md)|agent-inventory-firebase|FS-22-C01, E2-P4B-04, FS-TOOLCHAIN, FS-23-FS02|66,67|engine/firebase|
|[FS-22-H01](tickets/fs-22-h01.md)|agent-inventory-ui|FS-22-C01, FS-TOOLCHAIN|66,67|http-ui|
|[FS-23-C01](tickets/fs-23-c01.md)|agent-charges-core|FS-FOUNDATION|68,69|core|
|[FS-23-C02](tickets/fs-23-c02.md)|agent-charges-core|FS-FOUNDATION, FS-23-C01|70,71|core|
|[FS-23-PG01](tickets/fs-23-pg01.md)|agent-charges-postgres|FS-23-C01, E2-P3A-04, FS-TOOLCHAIN|68,69|engine/postgres|
|[FS-23-PG02](tickets/fs-23-pg02.md)|agent-charges-postgres|FS-23-C02, E2-P3A-04, FS-TOOLCHAIN, FS-23-PG01|70,71|engine/postgres|
|[FS-23-MY01](tickets/fs-23-my01.md)|agent-charges-mysql|FS-23-C01, E2-P3B-03, FS-TOOLCHAIN|68,69|engine/mysql|
|[FS-23-MY02](tickets/fs-23-my02.md)|agent-charges-mysql|FS-23-C02, E2-P3B-03, FS-TOOLCHAIN, FS-23-MY01|70,71|engine/mysql|
|[FS-23-MO01](tickets/fs-23-mo01.md)|agent-charges-mongodb|FS-23-C01, E2-P4A-03, FS-TOOLCHAIN|68,69|engine/mongodb|
|[FS-23-MO02](tickets/fs-23-mo02.md)|agent-charges-mongodb|FS-23-C02, E2-P4A-03, FS-TOOLCHAIN, FS-23-MO01|70,71|engine/mongodb|
|[FS-23-FS01](tickets/fs-23-fs01.md)|agent-charges-firebase|FS-23-C01, E2-P4B-04, FS-TOOLCHAIN|68,69|engine/firebase|
|[FS-23-FS02](tickets/fs-23-fs02.md)|agent-charges-firebase|FS-23-C02, E2-P4B-04, FS-TOOLCHAIN, FS-23-FS01|70,71|engine/firebase|
|[FS-23-H01](tickets/fs-23-h01.md)|agent-charges-ui|FS-23-C01, FS-TOOLCHAIN|68,69|http-ui|
|[FS-23-H02](tickets/fs-23-h02.md)|agent-charges-ui|FS-23-C02, FS-TOOLCHAIN, FS-23-H01|70,71|http-ui|
|[FS-24-C01](tickets/fs-24-c01.md)|agent-invoicing-core|FS-FOUNDATION, FS-23-C02|72,73|core|
|[FS-24-PG01](tickets/fs-24-pg01.md)|agent-invoicing-postgres|FS-24-C01, E2-P3A-04, FS-TOOLCHAIN, FS-23-PG02|72,73|engine/postgres|
|[FS-24-MY01](tickets/fs-24-my01.md)|agent-invoicing-mysql|FS-24-C01, E2-P3B-03, FS-TOOLCHAIN, FS-23-MY02|72,73|engine/mysql|
|[FS-24-MO01](tickets/fs-24-mo01.md)|agent-invoicing-mongodb|FS-24-C01, E2-P4A-03, FS-TOOLCHAIN, FS-23-MO02|72,73|engine/mongodb|
|[FS-24-FS01](tickets/fs-24-fs01.md)|agent-invoicing-firebase|FS-24-C01, E2-P4B-04, FS-TOOLCHAIN, FS-23-FS02|72,73|engine/firebase|
|[FS-24-H01](tickets/fs-24-h01.md)|agent-invoicing-ui|FS-24-C01, FS-TOOLCHAIN|72,73|http-ui|
|[FS-25-C01](tickets/fs-25-c01.md)|agent-payments-core|FS-FOUNDATION, FS-24-C01|74,75|core|
|[FS-25-C02](tickets/fs-25-c02.md)|agent-payments-core|FS-FOUNDATION, FS-25-C01|76,77|core|
|[FS-25-PG01](tickets/fs-25-pg01.md)|agent-payments-postgres|FS-25-C01, E2-P3A-04, FS-TOOLCHAIN, FS-24-PG01|74,75|engine/postgres|
|[FS-25-PG02](tickets/fs-25-pg02.md)|agent-payments-postgres|FS-25-C02, E2-P3A-04, FS-TOOLCHAIN, FS-25-PG01, FS-24-PG01|76,77|engine/postgres|
|[FS-25-MY01](tickets/fs-25-my01.md)|agent-payments-mysql|FS-25-C01, E2-P3B-03, FS-TOOLCHAIN, FS-24-MY01|74,75|engine/mysql|
|[FS-25-MY02](tickets/fs-25-my02.md)|agent-payments-mysql|FS-25-C02, E2-P3B-03, FS-TOOLCHAIN, FS-25-MY01, FS-24-MY01|76,77|engine/mysql|
|[FS-25-MO01](tickets/fs-25-mo01.md)|agent-payments-mongodb|FS-25-C01, E2-P4A-03, FS-TOOLCHAIN, FS-24-MO01|74,75|engine/mongodb|
|[FS-25-MO02](tickets/fs-25-mo02.md)|agent-payments-mongodb|FS-25-C02, E2-P4A-03, FS-TOOLCHAIN, FS-25-MO01, FS-24-MO01|76,77|engine/mongodb|
|[FS-25-FS01](tickets/fs-25-fs01.md)|agent-payments-firebase|FS-25-C01, E2-P4B-04, FS-TOOLCHAIN, FS-24-FS01|74,75|engine/firebase|
|[FS-25-FS02](tickets/fs-25-fs02.md)|agent-payments-firebase|FS-25-C02, E2-P4B-04, FS-TOOLCHAIN, FS-25-FS01, FS-24-FS01|76,77|engine/firebase|
|[FS-25-H01](tickets/fs-25-h01.md)|agent-payments-ui|FS-25-C01, FS-TOOLCHAIN|74,75|http-ui|
|[FS-25-H02](tickets/fs-25-h02.md)|agent-payments-ui|FS-25-C02, FS-TOOLCHAIN, FS-25-H01|76,77|http-ui|
|[FS-26-C01](tickets/fs-26-c01.md)|agent-history-core|FS-FOUNDATION, FS-05-C01, FS-07-C04, FS-09-C01, FS-10-C01, FS-11-C01, FS-12-C02, FS-13-C02, FS-14-C01, FS-16-C03, FS-19-C01|14|core|
|[FS-26-PG01](tickets/fs-26-pg01.md)|agent-history-postgres|FS-26-C01, E2-P3A-04, FS-TOOLCHAIN, FS-05-PG01, FS-07-PG04, FS-09-PG01, FS-10-PG01, FS-11-PG01|14|engine/postgres|
|[FS-26-MY01](tickets/fs-26-my01.md)|agent-history-mysql|FS-26-C01, E2-P3B-03, FS-TOOLCHAIN, FS-05-MY01, FS-07-MY04, FS-12-MY02, FS-13-MY02, FS-14-MY01|14|engine/mysql|
|[FS-26-MO01](tickets/fs-26-mo01.md)|agent-history-mongodb|FS-26-C01, E2-P4A-03, FS-TOOLCHAIN, FS-05-MO01, FS-07-MO04, FS-11-MO01, FS-16-MO03|14|engine/mongodb|
|[FS-26-FS01](tickets/fs-26-fs01.md)|agent-history-firebase|FS-26-C01, E2-P4B-04, FS-TOOLCHAIN, FS-05-FS01, FS-07-FS04, FS-19-FS01|14|engine/firebase|
|[FS-26-H01](tickets/fs-26-h01.md)|agent-history-ui|FS-26-C01, FS-TOOLCHAIN|14|http-ui|
|[FS-WAVE-01](tickets/fs-wave-01.md)|agent-wire|FS-03-H01, FS-03-PG01, FS-03-MY01, FS-03-MO01, FS-03-FS01, E2-P5-02, E2-P5-04|integration|integration|
|[FS-WAVE-02](tickets/fs-wave-02.md)|agent-wire|FS-04-H03, FS-04-PG03, FS-04-MY03, FS-04-MO03, FS-04-FS03, FS-WAVE-01|integration|integration|
|[FS-WAVE-03](tickets/fs-wave-03.md)|agent-wire|FS-23-H02, FS-23-PG02, FS-23-MY02, FS-23-MO02, FS-23-FS02, FS-WAVE-02|integration|integration|
|[FS-WAVE-04](tickets/fs-wave-04.md)|agent-wire|FS-06-H03, FS-06-PG03, FS-06-MY03, FS-06-MO03, FS-06-FS03, FS-WAVE-03|integration|integration|
|[FS-WAVE-05](tickets/fs-wave-05.md)|agent-wire|FS-01-H02, FS-01-PG02, FS-WAVE-04|integration|integration|
|[FS-WAVE-06](tickets/fs-wave-06.md)|agent-wire|FS-02-H01, FS-02-PG01, FS-WAVE-05|integration|integration|
|[FS-WAVE-07](tickets/fs-wave-07.md)|agent-wire|FS-24-H01, FS-24-PG01, FS-24-MY01, FS-24-MO01, FS-24-FS01, FS-WAVE-06|integration|integration|
|[FS-WAVE-08](tickets/fs-wave-08.md)|agent-wire|FS-25-H02, FS-25-PG02, FS-25-MY02, FS-25-MO02, FS-25-FS02, FS-WAVE-07|integration|integration|
|[FS-WAVE-09](tickets/fs-wave-09.md)|agent-wire|FS-20-H01, FS-20-PG01, FS-20-MY01, FS-20-MO01, FS-20-FS01, FS-WAVE-08|integration|integration|
|[FS-WAVE-10](tickets/fs-wave-10.md)|agent-wire|FS-22-H01, FS-22-PG01, FS-22-MY01, FS-22-MO01, FS-22-FS01, FS-WAVE-09|integration|integration|
|[FS-WAVE-11](tickets/fs-wave-11.md)|agent-wire|FS-21-H02, FS-21-PG02, FS-21-MY02, FS-21-MO02, FS-21-FS02, FS-WAVE-10|integration|integration|
|[FS-WAVE-12](tickets/fs-wave-12.md)|agent-wire|FS-07-H04, FS-07-PG04, FS-07-MY04, FS-07-MO04, FS-07-FS04, FS-WAVE-11|integration|integration|
|[FS-WAVE-13](tickets/fs-wave-13.md)|agent-wire|FS-17-H01, FS-17-FS01, FS-WAVE-12|integration|integration|
|[FS-WAVE-14](tickets/fs-wave-14.md)|agent-wire|FS-18-H01, FS-18-FS01, FS-WAVE-13|integration|integration|
|[FS-WAVE-15](tickets/fs-wave-15.md)|agent-wire|FS-14-H01, FS-14-MY01, FS-WAVE-14|integration|integration|
|[FS-WAVE-16](tickets/fs-wave-16.md)|agent-wire|FS-08-H01, FS-08-PG01, FS-WAVE-15|integration|integration|
|[FS-WAVE-17](tickets/fs-wave-17.md)|agent-wire|FS-10-H01, FS-10-PG01, FS-WAVE-16|integration|integration|
|[FS-WAVE-18](tickets/fs-wave-18.md)|agent-wire|FS-15-H01, FS-15-MO01, FS-WAVE-17|integration|integration|
|[FS-WAVE-19](tickets/fs-wave-19.md)|agent-wire|FS-16-H03, FS-16-MO03, FS-WAVE-18|integration|integration|
|[FS-WAVE-20](tickets/fs-wave-20.md)|agent-wire|FS-11-H01, FS-11-PG01, FS-11-MO01, FS-WAVE-19|integration|integration|
|[FS-WAVE-21](tickets/fs-wave-21.md)|agent-wire|FS-09-H01, FS-09-PG01, FS-WAVE-20|integration|integration|
|[FS-WAVE-22](tickets/fs-wave-22.md)|agent-wire|FS-19-H01, FS-19-FS01, FS-WAVE-21|integration|integration|
|[FS-WAVE-23](tickets/fs-wave-23.md)|agent-wire|FS-05-H01, FS-05-PG01, FS-05-MY01, FS-05-MO01, FS-05-FS01, FS-WAVE-22|integration|integration|
|[FS-WAVE-24](tickets/fs-wave-24.md)|agent-wire|FS-13-H02, FS-13-MY02, FS-WAVE-23|integration|integration|
|[FS-WAVE-25](tickets/fs-wave-25.md)|agent-wire|FS-12-H02, FS-12-MY02, FS-WAVE-24|integration|integration|
|[FS-WAVE-26](tickets/fs-wave-26.md)|agent-wire|FS-26-H01, FS-26-PG01, FS-26-MY01, FS-26-MO01, FS-26-FS01, FS-WAVE-25|integration|integration|
|[FS-RELATIONS](tickets/fs-relations.md)|agent-relations|FS-01-PG02, FS-02-PG01, FS-03-PG01, FS-03-MY01, FS-03-MO01, FS-03-FS01, FS-04-PG03, FS-04-MY03, FS-04-MO03, FS-04-FS03, FS-05-PG01, FS-05-MY01, FS-05-MO01, FS-05-FS01, FS-06-PG03, FS-06-MY03, FS-06-MO03, FS-06-FS03, FS-07-PG04, FS-07-MY04, FS-07-MO04, FS-07-FS04, FS-08-PG01, FS-09-PG01, FS-10-PG01, FS-11-PG01, FS-11-MO01, FS-12-MY02, FS-13-MY02, FS-14-MY01, FS-15-MO01, FS-16-MO03, FS-17-FS01, FS-18-FS01, FS-19-FS01, FS-20-PG01, FS-20-MY01, FS-20-MO01, FS-20-FS01, FS-21-PG02, FS-21-MY02, FS-21-MO02, FS-21-FS02, FS-22-PG01, FS-22-MY01, FS-22-MO01, FS-22-FS01, FS-23-PG02, FS-23-MY02, FS-23-MO02, FS-23-FS02, FS-24-PG01, FS-24-MY01, FS-24-MO01, FS-24-FS01, FS-25-PG02, FS-25-MY02, FS-25-MO02, FS-25-FS02, FS-26-PG01, FS-26-MY01, FS-26-MO01, FS-26-FS01|integration|integration|
|[FS-SEC-PG](tickets/fs-sec-pg.md)|agent-sec-postgres|FS-RELATIONS, FS-TOOLCHAIN|integration|integration|
|[FS-SEC-MY](tickets/fs-sec-my.md)|agent-sec-mysql|FS-RELATIONS, FS-TOOLCHAIN|integration|integration|
|[FS-SEC-MO](tickets/fs-sec-mo.md)|agent-sec-mongodb|FS-RELATIONS, FS-TOOLCHAIN|integration|integration|
|[FS-SEC-FS](tickets/fs-sec-fs.md)|agent-sec-firebase|FS-RELATIONS, FS-TOOLCHAIN|integration|integration|
|[FS-BRIDGE](tickets/fs-bridge.md)|agent-bridge|FS-11-PG01, FS-11-MO01, FS-16-MO03|integration|integration|
|[FS-SECURITY-INTEGRATION](tickets/fs-security-integration.md)|agent-security|FS-01-C02, FS-02-C01, FS-03-C01, FS-04-C03, FS-05-C01, FS-06-C03, FS-07-C04, FS-08-C01, FS-09-C01, FS-10-C01, FS-11-C01, FS-12-C02, FS-13-C02, FS-14-C01, FS-15-C01, FS-16-C03, FS-17-C01, FS-18-C01, FS-19-C01, FS-20-C01, FS-21-C02, FS-22-C01, FS-23-C02, FS-24-C01, FS-25-C02, FS-26-C01, FS-SEC-PG, FS-SEC-MY, FS-SEC-MO, FS-SEC-FS|integration|integration|
|[FS-WIRE](tickets/fs-wire.md)|agent-wire|FS-01-PG02, FS-02-PG01, FS-03-PG01, FS-03-MY01, FS-03-MO01, FS-03-FS01, FS-04-PG03, FS-04-MY03, FS-04-MO03, FS-04-FS03, FS-05-PG01, FS-05-MY01, FS-05-MO01, FS-05-FS01, FS-06-PG03, FS-06-MY03, FS-06-MO03, FS-06-FS03, FS-07-PG04, FS-07-MY04, FS-07-MO04, FS-07-FS04, FS-08-PG01, FS-09-PG01, FS-10-PG01, FS-11-PG01, FS-11-MO01, FS-12-MY02, FS-13-MY02, FS-14-MY01, FS-15-MO01, FS-16-MO03, FS-17-FS01, FS-18-FS01, FS-19-FS01, FS-20-PG01, FS-20-MY01, FS-20-MO01, FS-20-FS01, FS-21-PG02, FS-21-MY02, FS-21-MO02, FS-21-FS02, FS-22-PG01, FS-22-MY01, FS-22-MO01, FS-22-FS01, FS-23-PG02, FS-23-MY02, FS-23-MO02, FS-23-FS02, FS-24-PG01, FS-24-MY01, FS-24-MO01, FS-24-FS01, FS-25-PG02, FS-25-MY02, FS-25-MO02, FS-25-FS02, FS-26-PG01, FS-26-MY01, FS-26-MO01, FS-26-FS01, FS-01-H02, FS-02-H01, FS-03-H01, FS-04-H03, FS-05-H01, FS-06-H03, FS-07-H04, FS-08-H01, FS-09-H01, FS-10-H01, FS-11-H01, FS-12-H02, FS-13-H02, FS-14-H01, FS-15-H01, FS-16-H03, FS-17-H01, FS-18-H01, FS-19-H01, FS-20-H01, FS-21-H02, FS-22-H01, FS-23-H02, FS-24-H01, FS-25-H02, FS-26-H01, FS-WAVE-26, FS-BRIDGE, FS-SECURITY-INTEGRATION|integration|integration|
|[FS-SEED-DEMO](tickets/fs-seed-demo.md)|agent-data|FS-WIRE|integration|integration|
|[FS-GATE](tickets/fs-gate.md)|agent-wire|FS-SEED-DEMO, E2-P5-07|integration|integration|
|[FS-DELIVERY](tickets/fs-delivery.md)|agent-wire|FS-GATE, E2-P6-01|integration|integration|
