# F4 — Statechart transition/e2e matrix

Exact future test path: `web/e2e/full/<module>.spec.ts`, one named test per row. Each test runs actual page action+HTTP status assertion against assigned physical engine; independently scoped fake fixture, no parallel shared identifiers. Mutations add failure-in-transaction test as below, not HTTP mock. Existing C3.4 17-case suite remains additional and unchanged. Read rows are self-loop transitions; asserts response matches actual native stored state, not only visible text. App starts with no memory fallback.

|OP|Transition/event|HTTP outcome|Named e2e|Owner module|
|---|---|---|---|---|
|OP-01|anonymous>authenticated; valid event|200|op01_transition_1_persists|account|
|OP-01|any; domain error keeps original state|401 invalid_credentials|op01_error_domain_unchanged|account|
|OP-01|any; schema error keeps original state|400 invalid_body|op01_error_schema_unchanged|account|
|OP-01|any; store error keeps original state|503 store_unavailable|op01_error_store_unchanged|account|
|OP-02|authenticated>anonymous; valid event|204|op02_transition_1_persists|account|
|OP-02|any; domain error keeps original state|401 invalid_token|op02_error_domain_unchanged|account|
|OP-02|any; schema error keeps original state|400 invalid_body|op02_error_schema_unchanged|account|
|OP-02|any; store error keeps original state|503 store_unavailable|op02_error_store_unchanged|account|
|OP-03|active>active; valid event|204|op03_transition_1_persists|account|
|OP-03|any; domain error keeps original state|401 invalid_credentials|op03_error_domain_unchanged|account|
|OP-03|any; schema error keeps original state|400 invalid_body|op03_error_schema_unchanged|account|
|OP-03|any; role error keeps original state|403 forbidden|op03_error_role_unchanged|account|
|OP-03|any; foreign error keeps original state|404 not_found|op03_error_foreign_unchanged|account|
|OP-03|any; store error keeps original state|503 store_unavailable|op03_error_store_unchanged|account|
|OP-04|blocked>active; valid event|200|op04_transition_1_persists|account|
|OP-04|any; domain error keeps original state|404 not_found|op04_error_domain_unchanged|account|
|OP-04|any; schema error keeps original state|400 invalid_body|op04_error_schema_unchanged|account|
|OP-04|any; role error keeps original state|403 forbidden|op04_error_role_unchanged|account|
|OP-04|any; foreign error keeps original state|404 not_found|op04_error_foreign_unchanged|account|
|OP-04|any; store error keeps original state|503 store_unavailable|op04_error_store_unchanged|account|
|OP-05|absent>active; valid event|200|op05_transition_1_persists|users|
|OP-05|active>inactive; valid event|200|op05_transition_2_persists|users|
|OP-05|inactive>active; valid event|200|op05_transition_3_persists|users|
|OP-05|any; domain error keeps original state|409 conflict|op05_error_domain_unchanged|users|
|OP-05|any; schema error keeps original state|400 invalid_body|op05_error_schema_unchanged|users|
|OP-05|any; role error keeps original state|403 forbidden|op05_error_role_unchanged|users|
|OP-05|any; foreign error keeps original state|404 not_found|op05_error_foreign_unchanged|users|
|OP-05|any; store error keeps original state|503 store_unavailable|op05_error_store_unchanged|users|
|OP-06|audit>audit; valid event|200|op06_transition_1_persists|users|
|OP-06|any; domain error keeps original state|403 forbidden|op06_error_domain_unchanged|users|
|OP-06|any; schema error keeps original state|400 invalid_query|op06_error_schema_unchanged|users|
|OP-06|any; role error keeps original state|403 forbidden|op06_error_role_unchanged|users|
|OP-06|any; foreign error keeps original state|404 not_found|op06_error_foreign_unchanged|users|
|OP-06|any; store error keeps original state|503 store_unavailable|op06_error_store_unchanged|users|
|OP-07|records>records; valid event|200|op07_transition_1_persists|patient|
|OP-07|any; domain error keeps original state|400 invalid_query|op07_error_domain_unchanged|patient|
|OP-07|any; schema error keeps original state|400 invalid_query|op07_error_schema_unchanged|patient|
|OP-07|any; role error keeps original state|403 forbidden|op07_error_role_unchanged|patient|
|OP-07|any; foreign error keeps original state|404 not_found|op07_error_foreign_unchanged|patient|
|OP-07|any; store error keeps original state|503 store_unavailable|op07_error_store_unchanged|patient|
|OP-08|absent>active; valid event|201|op08_transition_1_persists|patient|
|OP-08|any; domain error keeps original state|409 duplicate_document|op08_error_domain_unchanged|patient|
|OP-08|any; schema error keeps original state|400 invalid_body|op08_error_schema_unchanged|patient|
|OP-08|any; role error keeps original state|403 forbidden|op08_error_role_unchanged|patient|
|OP-08|any; foreign error keeps original state|404 not_found|op08_error_foreign_unchanged|patient|
|OP-08|any; store error keeps original state|503 store_unavailable|op08_error_store_unchanged|patient|
|OP-08|valid state; injected native mid-write failure|500 internal_error; all writes rollback|op08_midwrite_rolls_back|patient|
|OP-09|active>active; valid event|200|op09_transition_1_persists|patient|
|OP-09|any; domain error keeps original state|409 duplicate_document|op09_error_domain_unchanged|patient|
|OP-09|any; schema error keeps original state|400 invalid_body|op09_error_schema_unchanged|patient|
|OP-09|any; role error keeps original state|403 forbidden|op09_error_role_unchanged|patient|
|OP-09|any; foreign error keeps original state|404 not_found|op09_error_foreign_unchanged|patient|
|OP-09|any; store error keeps original state|503 store_unavailable|op09_error_store_unchanged|patient|
|OP-09|valid state; injected native mid-write failure|500 internal_error; all writes rollback|op09_midwrite_rolls_back|patient|
|OP-10|active>active; valid event|201|op10_transition_1_persists|patient|
|OP-10|any; domain error keeps original state|409 conflict|op10_error_domain_unchanged|patient|
|OP-10|any; schema error keeps original state|400 invalid_body|op10_error_schema_unchanged|patient|
|OP-10|any; role error keeps original state|403 forbidden|op10_error_role_unchanged|patient|
|OP-10|any; foreign error keeps original state|404 not_found|op10_error_foreign_unchanged|patient|
|OP-10|any; store error keeps original state|503 store_unavailable|op10_error_store_unchanged|patient|
|OP-10|valid state; injected native mid-write failure|500 internal_error; all writes rollback|op10_midwrite_rolls_back|patient|
|OP-11|absent>active; valid event|200|op11_transition_1_persists|patient|
|OP-11|any; domain error keeps original state|422 guardian_required|op11_error_domain_unchanged|patient|
|OP-11|any; schema error keeps original state|400 invalid_body|op11_error_schema_unchanged|patient|
|OP-11|any; role error keeps original state|403 forbidden|op11_error_role_unchanged|patient|
|OP-11|any; foreign error keeps original state|404 not_found|op11_error_foreign_unchanged|patient|
|OP-11|any; store error keeps original state|503 store_unavailable|op11_error_store_unchanged|patient|
|OP-11|valid state; injected native mid-write failure|500 internal_error; all writes rollback|op11_midwrite_rolls_back|patient|
|OP-12|active>active; valid event|200|op12_transition_1_persists|record|
|OP-12|archived>archived; valid event|200|op12_transition_2_persists|record|
|OP-12|any; domain error keeps original state|404 not_found|op12_error_domain_unchanged|record|
|OP-12|any; schema error keeps original state|400 invalid_query|op12_error_schema_unchanged|record|
|OP-12|any; role error keeps original state|403 forbidden|op12_error_role_unchanged|record|
|OP-12|any; foreign error keeps original state|404 not_found|op12_error_foreign_unchanged|record|
|OP-12|any; store error keeps original state|503 store_unavailable|op12_error_store_unchanged|record|
|OP-13|absent>active; valid event|201|op13_transition_1_persists|patient|
|OP-13|any; domain error keeps original state|409 duplicate_document|op13_error_domain_unchanged|patient|
|OP-13|any; schema error keeps original state|400 invalid_body|op13_error_schema_unchanged|patient|
|OP-13|any; role error keeps original state|403 forbidden|op13_error_role_unchanged|patient|
|OP-13|any; foreign error keeps original state|404 not_found|op13_error_foreign_unchanged|patient|
|OP-13|any; store error keeps original state|503 store_unavailable|op13_error_store_unchanged|patient|
|OP-13|valid state; injected native mid-write failure|500 internal_error; all writes rollback|op13_midwrite_rolls_back|patient|
|OP-14|active>active; valid event|200|op14_transition_1_persists|history|
|OP-14|archived>archived; valid event|200|op14_transition_2_persists|history|
|OP-14|any; domain error keeps original state|404 not_found|op14_error_domain_unchanged|history|
|OP-14|any; schema error keeps original state|400 invalid_query|op14_error_schema_unchanged|history|
|OP-14|any; role error keeps original state|403 forbidden|op14_error_role_unchanged|history|
|OP-14|any; foreign error keeps original state|404 not_found|op14_error_foreign_unchanged|history|
|OP-14|any; store error keeps original state|503 store_unavailable|op14_error_store_unchanged|history|
|OP-15|active>active; valid event|201|op15_transition_1_persists|record|
|OP-15|any; domain error keeps original state|409 expediente_archived|op15_error_domain_unchanged|record|
|OP-15|any; schema error keeps original state|400 invalid_body|op15_error_schema_unchanged|record|
|OP-15|any; role error keeps original state|403 forbidden|op15_error_role_unchanged|record|
|OP-15|any; foreign error keeps original state|404 not_found|op15_error_foreign_unchanged|record|
|OP-15|any; store error keeps original state|503 store_unavailable|op15_error_store_unchanged|record|
|OP-15|valid state; injected native mid-write failure|500 internal_error; all writes rollback|op15_midwrite_rolls_back|record|
|OP-16|active>active; valid event|201|op16_transition_1_persists|record|
|OP-16|any; domain error keeps original state|409 conflict|op16_error_domain_unchanged|record|
|OP-16|any; schema error keeps original state|400 invalid_body|op16_error_schema_unchanged|record|
|OP-16|any; role error keeps original state|403 forbidden|op16_error_role_unchanged|record|
|OP-16|any; foreign error keeps original state|404 not_found|op16_error_foreign_unchanged|record|
|OP-16|any; store error keeps original state|503 store_unavailable|op16_error_store_unchanged|record|
|OP-16|valid state; injected native mid-write failure|500 internal_error; all writes rollback|op16_midwrite_rolls_back|record|
|OP-17|active>active; valid event|201|op17_transition_1_persists|attachments|
|OP-17|any; domain error keeps original state|400 invalid_body|op17_error_domain_unchanged|attachments|
|OP-17|any; schema error keeps original state|400 invalid_body|op17_error_schema_unchanged|attachments|
|OP-17|any; role error keeps original state|403 forbidden|op17_error_role_unchanged|attachments|
|OP-17|any; foreign error keeps original state|404 not_found|op17_error_foreign_unchanged|attachments|
|OP-17|any; store error keeps original state|503 store_unavailable|op17_error_store_unchanged|attachments|
|OP-17|valid state; injected native mid-write failure|500 internal_error; all writes rollback|op17_midwrite_rolls_back|attachments|
|OP-18|active>archived; valid event|200|op18_transition_1_persists|record|
|OP-18|any; domain error keeps original state|409 already_archived|op18_error_domain_unchanged|record|
|OP-18|any; schema error keeps original state|400 invalid_body|op18_error_schema_unchanged|record|
|OP-18|any; role error keeps original state|403 forbidden|op18_error_role_unchanged|record|
|OP-18|any; foreign error keeps original state|404 not_found|op18_error_foreign_unchanged|record|
|OP-18|any; store error keeps original state|503 store_unavailable|op18_error_store_unchanged|record|
|OP-18|valid state; injected native mid-write failure|500 internal_error; all writes rollback|op18_midwrite_rolls_back|record|
|OP-19|archived>active; valid event|200|op19_transition_1_persists|record|
|OP-19|any; domain error keeps original state|409 conflict|op19_error_domain_unchanged|record|
|OP-19|any; schema error keeps original state|400 invalid_body|op19_error_schema_unchanged|record|
|OP-19|any; role error keeps original state|403 forbidden|op19_error_role_unchanged|record|
|OP-19|any; foreign error keeps original state|404 not_found|op19_error_foreign_unchanged|record|
|OP-19|any; store error keeps original state|503 store_unavailable|op19_error_store_unchanged|record|
|OP-19|valid state; injected native mid-write failure|500 internal_error; all writes rollback|op19_midwrite_rolls_back|record|
|OP-20|schedule>schedule; valid event|200|op20_transition_1_persists|agenda|
|OP-20|any; domain error keeps original state|400 invalid_query|op20_error_domain_unchanged|agenda|
|OP-20|any; schema error keeps original state|400 invalid_query|op20_error_schema_unchanged|agenda|
|OP-20|any; role error keeps original state|403 forbidden|op20_error_role_unchanged|agenda|
|OP-20|any; foreign error keeps original state|404 not_found|op20_error_foreign_unchanged|agenda|
|OP-20|any; store error keeps original state|503 store_unavailable|op20_error_store_unchanged|agenda|
|OP-21|absent>programada; valid event|201|op21_transition_1_persists|agenda|
|OP-21|any; domain error keeps original state|409 conflict|op21_error_domain_unchanged|agenda|
|OP-21|any; schema error keeps original state|400 invalid_body|op21_error_schema_unchanged|agenda|
|OP-21|any; role error keeps original state|403 forbidden|op21_error_role_unchanged|agenda|
|OP-21|any; foreign error keeps original state|404 not_found|op21_error_foreign_unchanged|agenda|
|OP-21|any; store error keeps original state|503 store_unavailable|op21_error_store_unchanged|agenda|
|OP-21|valid state; injected native mid-write failure|500 internal_error; all writes rollback|op21_midwrite_rolls_back|agenda|
|OP-22|programada>programada; valid event|200|op22_transition_1_persists|agenda|
|OP-22|confirmada>programada; valid event|200|op22_transition_2_persists|agenda|
|OP-22|any; domain error keeps original state|409 conflict|op22_error_domain_unchanged|agenda|
|OP-22|any; schema error keeps original state|400 invalid_body|op22_error_schema_unchanged|agenda|
|OP-22|any; role error keeps original state|403 forbidden|op22_error_role_unchanged|agenda|
|OP-22|any; foreign error keeps original state|404 not_found|op22_error_foreign_unchanged|agenda|
|OP-22|any; store error keeps original state|503 store_unavailable|op22_error_store_unchanged|agenda|
|OP-22|valid state; injected native mid-write failure|500 internal_error; all writes rollback|op22_midwrite_rolls_back|agenda|
|OP-23|programada>cancelada; valid event|200|op23_transition_1_persists|agenda|
|OP-23|confirmada>cancelada; valid event|200|op23_transition_2_persists|agenda|
|OP-23|any; domain error keeps original state|409 conflict|op23_error_domain_unchanged|agenda|
|OP-23|any; schema error keeps original state|400 invalid_body|op23_error_schema_unchanged|agenda|
|OP-23|any; role error keeps original state|403 forbidden|op23_error_role_unchanged|agenda|
|OP-23|any; foreign error keeps original state|404 not_found|op23_error_foreign_unchanged|agenda|
|OP-23|any; store error keeps original state|503 store_unavailable|op23_error_store_unchanged|agenda|
|OP-23|valid state; injected native mid-write failure|500 internal_error; all writes rollback|op23_midwrite_rolls_back|agenda|
|OP-24|programada>confirmada; valid event|200|op24_transition_1_persists|agenda|
|OP-24|any; domain error keeps original state|409 conflict|op24_error_domain_unchanged|agenda|
|OP-24|any; schema error keeps original state|400 invalid_body|op24_error_schema_unchanged|agenda|
|OP-24|any; role error keeps original state|403 forbidden|op24_error_role_unchanged|agenda|
|OP-24|any; foreign error keeps original state|404 not_found|op24_error_foreign_unchanged|agenda|
|OP-24|any; store error keeps original state|503 store_unavailable|op24_error_store_unchanged|agenda|
|OP-24|valid state; injected native mid-write failure|500 internal_error; all writes rollback|op24_midwrite_rolls_back|agenda|
|OP-25|schedule>schedule; valid event|200|op25_transition_1_persists|agenda|
|OP-25|any; domain error keeps original state|400 invalid_query|op25_error_domain_unchanged|agenda|
|OP-25|any; schema error keeps original state|400 invalid_query|op25_error_schema_unchanged|agenda|
|OP-25|any; role error keeps original state|403 forbidden|op25_error_role_unchanged|agenda|
|OP-25|any; foreign error keeps original state|404 not_found|op25_error_foreign_unchanged|agenda|
|OP-25|any; store error keeps original state|503 store_unavailable|op25_error_store_unchanged|agenda|
|OP-26|absent>abierta; valid event|201|op26_transition_1_persists|consultation|
|OP-26|any; domain error keeps original state|409 expediente_archived|op26_error_domain_unchanged|consultation|
|OP-26|any; schema error keeps original state|400 invalid_body|op26_error_schema_unchanged|consultation|
|OP-26|any; role error keeps original state|403 forbidden|op26_error_role_unchanged|consultation|
|OP-26|any; foreign error keeps original state|404 not_found|op26_error_foreign_unchanged|consultation|
|OP-26|any; store error keeps original state|503 store_unavailable|op26_error_store_unchanged|consultation|
|OP-26|valid state; injected native mid-write failure|500 internal_error; all writes rollback|op26_midwrite_rolls_back|consultation|
|OP-27|abierta>abierta; valid event|200|op27_transition_1_persists|consultation|
|OP-27|any; domain error keeps original state|409 conflict|op27_error_domain_unchanged|consultation|
|OP-27|any; schema error keeps original state|400 invalid_body|op27_error_schema_unchanged|consultation|
|OP-27|any; role error keeps original state|403 forbidden|op27_error_role_unchanged|consultation|
|OP-27|any; foreign error keeps original state|404 not_found|op27_error_foreign_unchanged|consultation|
|OP-27|any; store error keeps original state|503 store_unavailable|op27_error_store_unchanged|consultation|
|OP-27|valid state; injected native mid-write failure|500 internal_error; all writes rollback|op27_midwrite_rolls_back|consultation|
|OP-28|abierta>abierta; valid event|200|op28_transition_1_persists|consultation|
|OP-28|any; domain error keeps original state|422 invalid_bundle|op28_error_domain_unchanged|consultation|
|OP-28|any; schema error keeps original state|400 invalid_body|op28_error_schema_unchanged|consultation|
|OP-28|any; role error keeps original state|403 forbidden|op28_error_role_unchanged|consultation|
|OP-28|any; foreign error keeps original state|404 not_found|op28_error_foreign_unchanged|consultation|
|OP-28|any; store error keeps original state|503 store_unavailable|op28_error_store_unchanged|consultation|
|OP-28|valid state; injected native mid-write failure|500 internal_error; all writes rollback|op28_midwrite_rolls_back|consultation|
|OP-29|abierta>abierta; valid event|200|op29_transition_1_persists|consultation|
|OP-29|any; domain error keeps original state|422 invalid_bundle|op29_error_domain_unchanged|consultation|
|OP-29|any; schema error keeps original state|400 invalid_body|op29_error_schema_unchanged|consultation|
|OP-29|any; role error keeps original state|403 forbidden|op29_error_role_unchanged|consultation|
|OP-29|any; foreign error keeps original state|404 not_found|op29_error_foreign_unchanged|consultation|
|OP-29|any; store error keeps original state|503 store_unavailable|op29_error_store_unchanged|consultation|
|OP-29|valid state; injected native mid-write failure|500 internal_error; all writes rollback|op29_midwrite_rolls_back|consultation|
|OP-30|abierta>abierta; valid event|200|op30_transition_1_persists|consultation|
|OP-30|any; domain error keeps original state|422 reference_not_found|op30_error_domain_unchanged|consultation|
|OP-30|any; schema error keeps original state|400 invalid_body|op30_error_schema_unchanged|consultation|
|OP-30|any; role error keeps original state|403 forbidden|op30_error_role_unchanged|consultation|
|OP-30|any; foreign error keeps original state|404 not_found|op30_error_foreign_unchanged|consultation|
|OP-30|any; store error keeps original state|503 store_unavailable|op30_error_store_unchanged|consultation|
|OP-30|valid state; injected native mid-write failure|500 internal_error; all writes rollback|op30_midwrite_rolls_back|consultation|
|OP-31|abierta>cerrada; valid event|200|op31_transition_1_persists|consultation|
|OP-31|any; domain error keeps original state|422 invalid_bundle|op31_error_domain_unchanged|consultation|
|OP-31|any; schema error keeps original state|400 invalid_body|op31_error_schema_unchanged|consultation|
|OP-31|any; role error keeps original state|403 forbidden|op31_error_role_unchanged|consultation|
|OP-31|any; foreign error keeps original state|404 not_found|op31_error_foreign_unchanged|consultation|
|OP-31|any; store error keeps original state|503 store_unavailable|op31_error_store_unchanged|consultation|
|OP-31|valid state; injected native mid-write failure|500 internal_error; all writes rollback|op31_midwrite_rolls_back|consultation|
|OP-32|abierta>anulada; valid event|200|op32_transition_1_persists|consultation|
|OP-32|cerrada>anulada; valid event|200|op32_transition_2_persists|consultation|
|OP-32|any; domain error keeps original state|409 conflict|op32_error_domain_unchanged|consultation|
|OP-32|any; schema error keeps original state|400 invalid_body|op32_error_schema_unchanged|consultation|
|OP-32|any; role error keeps original state|403 forbidden|op32_error_role_unchanged|consultation|
|OP-32|any; foreign error keeps original state|404 not_found|op32_error_foreign_unchanged|consultation|
|OP-32|any; store error keeps original state|503 store_unavailable|op32_error_store_unchanged|consultation|
|OP-32|valid state; injected native mid-write failure|500 internal_error; all writes rollback|op32_midwrite_rolls_back|consultation|
|OP-33|active>active; valid event|200|op33_transition_1_persists|consultation|
|OP-33|archived>archived; valid event|200|op33_transition_2_persists|consultation|
|OP-33|any; domain error keeps original state|404 not_found|op33_error_domain_unchanged|consultation|
|OP-33|any; schema error keeps original state|400 invalid_query|op33_error_schema_unchanged|consultation|
|OP-33|any; role error keeps original state|403 forbidden|op33_error_role_unchanged|consultation|
|OP-33|any; foreign error keeps original state|404 not_found|op33_error_foreign_unchanged|consultation|
|OP-33|any; store error keeps original state|503 store_unavailable|op33_error_store_unchanged|consultation|
|OP-34|beds>beds; valid event|200|op34_transition_1_persists|admission|
|OP-34|any; domain error keeps original state|400 invalid_query|op34_error_domain_unchanged|admission|
|OP-34|any; schema error keeps original state|400 invalid_query|op34_error_schema_unchanged|admission|
|OP-34|any; role error keeps original state|403 forbidden|op34_error_role_unchanged|admission|
|OP-34|any; foreign error keeps original state|404 not_found|op34_error_foreign_unchanged|admission|
|OP-34|any; store error keeps original state|503 store_unavailable|op34_error_store_unchanged|admission|
|OP-35|absent>activa; valid event|201|op35_transition_1_persists|admission|
|OP-35|any; domain error keeps original state|409 conflict|op35_error_domain_unchanged|admission|
|OP-35|any; schema error keeps original state|400 invalid_body|op35_error_schema_unchanged|admission|
|OP-35|any; role error keeps original state|403 forbidden|op35_error_role_unchanged|admission|
|OP-35|any; foreign error keeps original state|404 not_found|op35_error_foreign_unchanged|admission|
|OP-35|any; store error keeps original state|503 store_unavailable|op35_error_store_unchanged|admission|
|OP-35|valid state; injected native mid-write failure|500 internal_error; all writes rollback|op35_midwrite_rolls_back|admission|
|OP-36|activa>activa; valid event|201|op36_transition_1_persists|procedure|
|OP-36|any; domain error keeps original state|409 conflict|op36_error_domain_unchanged|procedure|
|OP-36|any; schema error keeps original state|400 invalid_body|op36_error_schema_unchanged|procedure|
|OP-36|any; role error keeps original state|403 forbidden|op36_error_role_unchanged|procedure|
|OP-36|any; foreign error keeps original state|404 not_found|op36_error_foreign_unchanged|procedure|
|OP-36|any; store error keeps original state|503 store_unavailable|op36_error_store_unchanged|procedure|
|OP-36|valid state; injected native mid-write failure|500 internal_error; all writes rollback|op36_midwrite_rolls_back|procedure|
|OP-37|activa>activa; valid event|201|op37_transition_1_persists|procedure|
|OP-37|any; domain error keeps original state|422 reference_not_found|op37_error_domain_unchanged|procedure|
|OP-37|any; schema error keeps original state|400 invalid_body|op37_error_schema_unchanged|procedure|
|OP-37|any; role error keeps original state|403 forbidden|op37_error_role_unchanged|procedure|
|OP-37|any; foreign error keeps original state|404 not_found|op37_error_foreign_unchanged|procedure|
|OP-37|any; store error keeps original state|503 store_unavailable|op37_error_store_unchanged|procedure|
|OP-37|valid state; injected native mid-write failure|500 internal_error; all writes rollback|op37_midwrite_rolls_back|procedure|
|OP-38|activa>cerrada; valid event|200|op38_transition_1_persists|discharge|
|OP-38|any; domain error keeps original state|409 conflict|op38_error_domain_unchanged|discharge|
|OP-38|any; schema error keeps original state|400 invalid_body|op38_error_schema_unchanged|discharge|
|OP-38|any; role error keeps original state|403 forbidden|op38_error_role_unchanged|discharge|
|OP-38|any; foreign error keeps original state|404 not_found|op38_error_foreign_unchanged|discharge|
|OP-38|any; store error keeps original state|503 store_unavailable|op38_error_store_unchanged|discharge|
|OP-38|valid state; injected native mid-write failure|500 internal_error; all writes rollback|op38_midwrite_rolls_back|discharge|
|OP-39|absent>solicitada; valid event|201|op39_transition_1_persists|referral|
|OP-39|any; domain error keeps original state|422 reference_not_found|op39_error_domain_unchanged|referral|
|OP-39|any; schema error keeps original state|400 invalid_body|op39_error_schema_unchanged|referral|
|OP-39|any; role error keeps original state|403 forbidden|op39_error_role_unchanged|referral|
|OP-39|any; foreign error keeps original state|404 not_found|op39_error_foreign_unchanged|referral|
|OP-39|any; store error keeps original state|503 store_unavailable|op39_error_store_unchanged|referral|
|OP-39|valid state; injected native mid-write failure|500 internal_error; all writes rollback|op39_midwrite_rolls_back|referral|
|OP-40|absent>recorded; valid event|200|op40_transition_1_persists|growth|
|OP-40|recorded>recorded; valid event|200|op40_transition_2_persists|growth|
|OP-40|any; domain error keeps original state|400 invalid_body|op40_error_domain_unchanged|growth|
|OP-40|any; schema error keeps original state|400 invalid_body|op40_error_schema_unchanged|growth|
|OP-40|any; role error keeps original state|403 forbidden|op40_error_role_unchanged|growth|
|OP-40|any; foreign error keeps original state|404 not_found|op40_error_foreign_unchanged|growth|
|OP-40|any; store error keeps original state|503 store_unavailable|op40_error_store_unchanged|growth|
|OP-40|valid state; injected native mid-write failure|500 internal_error; all writes rollback|op40_midwrite_rolls_back|growth|
|OP-41|abierta>abierta; valid event|201|op41_transition_1_persists|growth|
|OP-41|cerrada>cerrada; valid event|201|op41_transition_2_persists|growth|
|OP-41|any; domain error keeps original state|422 reference_not_found|op41_error_domain_unchanged|growth|
|OP-41|any; schema error keeps original state|400 invalid_body|op41_error_schema_unchanged|growth|
|OP-41|any; role error keeps original state|403 forbidden|op41_error_role_unchanged|growth|
|OP-41|any; foreign error keeps original state|404 not_found|op41_error_foreign_unchanged|growth|
|OP-41|any; store error keeps original state|503 store_unavailable|op41_error_store_unchanged|growth|
|OP-41|valid state; injected native mid-write failure|500 internal_error; all writes rollback|op41_midwrite_rolls_back|growth|
|OP-42|active>active; valid event|200|op42_transition_1_persists|growth|
|OP-42|archived>archived; valid event|200|op42_transition_2_persists|growth|
|OP-42|any; domain error keeps original state|404 not_found|op42_error_domain_unchanged|growth|
|OP-42|any; schema error keeps original state|400 invalid_query|op42_error_schema_unchanged|growth|
|OP-42|any; role error keeps original state|403 forbidden|op42_error_role_unchanged|growth|
|OP-42|any; foreign error keeps original state|404 not_found|op42_error_foreign_unchanged|growth|
|OP-42|any; store error keeps original state|503 store_unavailable|op42_error_store_unchanged|growth|
|OP-43|absent>scheduled; valid event|200|op43_transition_1_persists|vaccines|
|OP-43|scheduled>scheduled; valid event|200|op43_transition_2_persists|vaccines|
|OP-43|any; domain error keeps original state|422 reference_not_found|op43_error_domain_unchanged|vaccines|
|OP-43|any; schema error keeps original state|400 invalid_query|op43_error_schema_unchanged|vaccines|
|OP-43|any; role error keeps original state|403 forbidden|op43_error_role_unchanged|vaccines|
|OP-43|any; foreign error keeps original state|404 not_found|op43_error_foreign_unchanged|vaccines|
|OP-43|any; store error keeps original state|503 store_unavailable|op43_error_store_unchanged|vaccines|
|OP-44|pendiente>aplicada; valid event|200|op44_transition_1_persists|vaccines|
|OP-44|any; domain error keeps original state|409 conflict|op44_error_domain_unchanged|vaccines|
|OP-44|any; schema error keeps original state|400 invalid_body|op44_error_schema_unchanged|vaccines|
|OP-44|any; role error keeps original state|403 forbidden|op44_error_role_unchanged|vaccines|
|OP-44|any; foreign error keeps original state|404 not_found|op44_error_foreign_unchanged|vaccines|
|OP-44|any; store error keeps original state|503 store_unavailable|op44_error_store_unchanged|vaccines|
|OP-44|valid state; injected native mid-write failure|500 internal_error; all writes rollback|op44_midwrite_rolls_back|vaccines|
|OP-45|aplicada>aplicada; valid event|200|op45_transition_1_persists|vaccines|
|OP-45|any; domain error keeps original state|409 conflict|op45_error_domain_unchanged|vaccines|
|OP-45|any; schema error keeps original state|400 invalid_body|op45_error_schema_unchanged|vaccines|
|OP-45|any; role error keeps original state|403 forbidden|op45_error_role_unchanged|vaccines|
|OP-45|any; foreign error keeps original state|404 not_found|op45_error_foreign_unchanged|vaccines|
|OP-45|any; store error keeps original state|503 store_unavailable|op45_error_store_unchanged|vaccines|
|OP-45|valid state; injected native mid-write failure|500 internal_error; all writes rollback|op45_midwrite_rolls_back|vaccines|
|OP-46|absent>evaluated; valid event|200|op46_transition_1_persists|milestones|
|OP-46|evaluated>evaluated; valid event|200|op46_transition_2_persists|milestones|
|OP-46|any; domain error keeps original state|422 reference_not_found|op46_error_domain_unchanged|milestones|
|OP-46|any; schema error keeps original state|400 invalid_body|op46_error_schema_unchanged|milestones|
|OP-46|any; role error keeps original state|403 forbidden|op46_error_role_unchanged|milestones|
|OP-46|any; foreign error keeps original state|404 not_found|op46_error_foreign_unchanged|milestones|
|OP-46|any; store error keeps original state|503 store_unavailable|op46_error_store_unchanged|milestones|
|OP-46|valid state; injected native mid-write failure|500 internal_error; all writes rollback|op46_midwrite_rolls_back|milestones|
|OP-47|schedule>schedule; valid event|200|op47_transition_1_persists|vaccines|
|OP-47|any; domain error keeps original state|400 invalid_query|op47_error_domain_unchanged|vaccines|
|OP-47|any; schema error keeps original state|400 invalid_query|op47_error_schema_unchanged|vaccines|
|OP-47|any; role error keeps original state|403 forbidden|op47_error_role_unchanged|vaccines|
|OP-47|any; foreign error keeps original state|404 not_found|op47_error_foreign_unchanged|vaccines|
|OP-47|any; store error keeps original state|503 store_unavailable|op47_error_store_unchanged|vaccines|
|OP-48|absent>recibida; valid event|201|op48_transition_1_persists|lab-intake|
|OP-48|any; domain error keeps original state|409 conflict|op48_error_domain_unchanged|lab-intake|
|OP-48|any; schema error keeps original state|400 invalid_body|op48_error_schema_unchanged|lab-intake|
|OP-48|any; role error keeps original state|403 forbidden|op48_error_role_unchanged|lab-intake|
|OP-48|any; foreign error keeps original state|404 not_found|op48_error_foreign_unchanged|lab-intake|
|OP-48|any; store error keeps original state|503 store_unavailable|op48_error_store_unchanged|lab-intake|
|OP-48|valid state; injected native mid-write failure|500 internal_error; all writes rollback|op48_midwrite_rolls_back|lab-intake|
|OP-49|recibida>en_proceso; valid event|201|op49_transition_1_persists|lab-intake|
|OP-49|en_proceso>en_proceso; valid event|201|op49_transition_2_persists|lab-intake|
|OP-49|any; domain error keeps original state|409 conflict|op49_error_domain_unchanged|lab-intake|
|OP-49|any; schema error keeps original state|400 invalid_body|op49_error_schema_unchanged|lab-intake|
|OP-49|any; role error keeps original state|403 forbidden|op49_error_role_unchanged|lab-intake|
|OP-49|any; foreign error keeps original state|404 not_found|op49_error_foreign_unchanged|lab-intake|
|OP-49|any; store error keeps original state|503 store_unavailable|op49_error_store_unchanged|lab-intake|
|OP-49|valid state; injected native mid-write failure|500 internal_error; all writes rollback|op49_midwrite_rolls_back|lab-intake|
|OP-50|en_proceso>en_proceso; valid event|201|op50_transition_1_persists|lab-results|
|OP-50|any; domain error keeps original state|422 invalid_bundle|op50_error_domain_unchanged|lab-results|
|OP-50|any; schema error keeps original state|400 invalid_body|op50_error_schema_unchanged|lab-results|
|OP-50|any; role error keeps original state|403 forbidden|op50_error_role_unchanged|lab-results|
|OP-50|any; foreign error keeps original state|404 not_found|op50_error_foreign_unchanged|lab-results|
|OP-50|any; store error keeps original state|503 store_unavailable|op50_error_store_unchanged|lab-results|
|OP-50|valid state; injected native mid-write failure|500 internal_error; all writes rollback|op50_midwrite_rolls_back|lab-results|
|OP-51|preliminar>validado; valid event|200|op51_transition_1_persists|lab-results|
|OP-51|any; domain error keeps original state|409 conflict|op51_error_domain_unchanged|lab-results|
|OP-51|any; schema error keeps original state|400 invalid_body|op51_error_schema_unchanged|lab-results|
|OP-51|any; role error keeps original state|403 forbidden|op51_error_role_unchanged|lab-results|
|OP-51|any; foreign error keeps original state|404 not_found|op51_error_foreign_unchanged|lab-results|
|OP-51|any; store error keeps original state|503 store_unavailable|op51_error_store_unchanged|lab-results|
|OP-51|valid state; injected native mid-write failure|500 internal_error; all writes rollback|op51_midwrite_rolls_back|lab-results|
|OP-52|preliminar>preliminar; valid event|200|op52_transition_1_persists|lab-results|
|OP-52|any; domain error keeps original state|422 reference_not_found|op52_error_domain_unchanged|lab-results|
|OP-52|any; schema error keeps original state|400 invalid_body|op52_error_schema_unchanged|lab-results|
|OP-52|any; role error keeps original state|403 forbidden|op52_error_role_unchanged|lab-results|
|OP-52|any; foreign error keeps original state|404 not_found|op52_error_foreign_unchanged|lab-results|
|OP-52|any; store error keeps original state|503 store_unavailable|op52_error_store_unchanged|lab-results|
|OP-52|valid state; injected native mid-write failure|500 internal_error; all writes rollback|op52_midwrite_rolls_back|lab-results|
|OP-53|validada>entregada; valid event|200|op53_transition_1_persists|lab-results|
|OP-53|any; domain error keeps original state|409 conflict|op53_error_domain_unchanged|lab-results|
|OP-53|any; schema error keeps original state|400 invalid_body|op53_error_schema_unchanged|lab-results|
|OP-53|any; role error keeps original state|403 forbidden|op53_error_role_unchanged|lab-results|
|OP-53|any; foreign error keeps original state|404 not_found|op53_error_foreign_unchanged|lab-results|
|OP-53|any; store error keeps original state|503 store_unavailable|op53_error_store_unchanged|lab-results|
|OP-53|valid state; injected native mid-write failure|500 internal_error; all writes rollback|op53_midwrite_rolls_back|lab-results|
|OP-54|active>active; valid event|200|op54_transition_1_persists|lab-results|
|OP-54|archived>archived; valid event|200|op54_transition_2_persists|lab-results|
|OP-54|any; domain error keeps original state|404 not_found|op54_error_domain_unchanged|lab-results|
|OP-54|any; schema error keeps original state|400 invalid_query|op54_error_schema_unchanged|lab-results|
|OP-54|any; role error keeps original state|403 forbidden|op54_error_role_unchanged|lab-results|
|OP-54|any; foreign error keeps original state|404 not_found|op54_error_foreign_unchanged|lab-results|
|OP-54|any; store error keeps original state|503 store_unavailable|op54_error_store_unchanged|lab-results|
|OP-55|absent>open; valid event|201|op55_transition_1_persists|dental-chart|
|OP-55|any; domain error keeps original state|409 conflict|op55_error_domain_unchanged|dental-chart|
|OP-55|any; schema error keeps original state|400 invalid_body|op55_error_schema_unchanged|dental-chart|
|OP-55|any; role error keeps original state|403 forbidden|op55_error_role_unchanged|dental-chart|
|OP-55|any; foreign error keeps original state|404 not_found|op55_error_foreign_unchanged|dental-chart|
|OP-55|any; store error keeps original state|503 store_unavailable|op55_error_store_unchanged|dental-chart|
|OP-55|valid state; injected native mid-write failure|500 internal_error; all writes rollback|op55_midwrite_rolls_back|dental-chart|
|OP-56|open>open; valid event|200|op56_transition_1_persists|dental-chart|
|OP-56|any; domain error keeps original state|400 invalid_body|op56_error_domain_unchanged|dental-chart|
|OP-56|any; schema error keeps original state|400 invalid_body|op56_error_schema_unchanged|dental-chart|
|OP-56|any; role error keeps original state|403 forbidden|op56_error_role_unchanged|dental-chart|
|OP-56|any; foreign error keeps original state|404 not_found|op56_error_foreign_unchanged|dental-chart|
|OP-56|any; store error keeps original state|503 store_unavailable|op56_error_store_unchanged|dental-chart|
|OP-56|valid state; injected native mid-write failure|500 internal_error; all writes rollback|op56_midwrite_rolls_back|dental-chart|
|OP-57|absent>propuesto; valid event|201|op57_transition_1_persists|dental-plan|
|OP-57|any; domain error keeps original state|422 reference_not_found|op57_error_domain_unchanged|dental-plan|
|OP-57|any; schema error keeps original state|400 invalid_body|op57_error_schema_unchanged|dental-plan|
|OP-57|any; role error keeps original state|403 forbidden|op57_error_role_unchanged|dental-plan|
|OP-57|any; foreign error keeps original state|404 not_found|op57_error_foreign_unchanged|dental-plan|
|OP-57|any; store error keeps original state|503 store_unavailable|op57_error_store_unchanged|dental-plan|
|OP-57|valid state; injected native mid-write failure|500 internal_error; all writes rollback|op57_midwrite_rolls_back|dental-plan|
|OP-58|propuesto>en_proceso; valid event|200|op58_transition_1_persists|dental-plan|
|OP-58|any; domain error keeps original state|409 conflict|op58_error_domain_unchanged|dental-plan|
|OP-58|any; schema error keeps original state|400 invalid_body|op58_error_schema_unchanged|dental-plan|
|OP-58|any; role error keeps original state|403 forbidden|op58_error_role_unchanged|dental-plan|
|OP-58|any; foreign error keeps original state|404 not_found|op58_error_foreign_unchanged|dental-plan|
|OP-58|any; store error keeps original state|503 store_unavailable|op58_error_store_unchanged|dental-plan|
|OP-58|valid state; injected native mid-write failure|500 internal_error; all writes rollback|op58_midwrite_rolls_back|dental-plan|
|OP-59|en_proceso>en_proceso; valid event|201|op59_transition_1_persists|dental-session|
|OP-59|en_proceso>finalizado; valid event|201|op59_transition_2_persists|dental-session|
|OP-59|any; domain error keeps original state|409 conflict|op59_error_domain_unchanged|dental-session|
|OP-59|any; schema error keeps original state|400 invalid_body|op59_error_schema_unchanged|dental-session|
|OP-59|any; role error keeps original state|403 forbidden|op59_error_role_unchanged|dental-session|
|OP-59|any; foreign error keeps original state|404 not_found|op59_error_foreign_unchanged|dental-session|
|OP-59|any; store error keeps original state|503 store_unavailable|op59_error_store_unchanged|dental-session|
|OP-59|valid state; injected native mid-write failure|500 internal_error; all writes rollback|op59_midwrite_rolls_back|dental-session|
|OP-60|plan>plan; valid event|200|op60_transition_1_persists|dental-session|
|OP-60|any; domain error keeps original state|404 not_found|op60_error_domain_unchanged|dental-session|
|OP-60|any; schema error keeps original state|400 invalid_query|op60_error_schema_unchanged|dental-session|
|OP-60|any; role error keeps original state|403 forbidden|op60_error_role_unchanged|dental-session|
|OP-60|any; foreign error keeps original state|404 not_found|op60_error_foreign_unchanged|dental-session|
|OP-60|any; store error keeps original state|503 store_unavailable|op60_error_store_unchanged|dental-session|
|OP-61|absent>active; valid event|201|op61_transition_1_persists|personnel|
|OP-61|active>inactive; valid event|201|op61_transition_2_persists|personnel|
|OP-61|active>active; valid event|201|op61_transition_3_persists|personnel|
|OP-61|any; domain error keeps original state|409 conflict|op61_error_domain_unchanged|personnel|
|OP-61|any; schema error keeps original state|400 invalid_body|op61_error_schema_unchanged|personnel|
|OP-61|any; role error keeps original state|403 forbidden|op61_error_role_unchanged|personnel|
|OP-61|any; foreign error keeps original state|404 not_found|op61_error_foreign_unchanged|personnel|
|OP-61|any; store error keeps original state|503 store_unavailable|op61_error_store_unchanged|personnel|
|OP-61|valid state; injected native mid-write failure|500 internal_error; all writes rollback|op61_midwrite_rolls_back|personnel|
|OP-62|current>closed_and_new; valid event|200|op62_transition_1_persists|personnel|
|OP-62|any; domain error keeps original state|409 conflict|op62_error_domain_unchanged|personnel|
|OP-62|any; schema error keeps original state|400 invalid_body|op62_error_schema_unchanged|personnel|
|OP-62|any; role error keeps original state|403 forbidden|op62_error_role_unchanged|personnel|
|OP-62|any; foreign error keeps original state|404 not_found|op62_error_foreign_unchanged|personnel|
|OP-62|any; store error keeps original state|503 store_unavailable|op62_error_store_unchanged|personnel|
|OP-62|valid state; injected native mid-write failure|500 internal_error; all writes rollback|op62_midwrite_rolls_back|personnel|
|OP-63|absent>recorded; valid event|201|op63_transition_1_persists|honoraria|
|OP-63|any; domain error keeps original state|409 conflict|op63_error_domain_unchanged|honoraria|
|OP-63|any; schema error keeps original state|400 invalid_body|op63_error_schema_unchanged|honoraria|
|OP-63|any; role error keeps original state|403 forbidden|op63_error_role_unchanged|honoraria|
|OP-63|any; foreign error keeps original state|404 not_found|op63_error_foreign_unchanged|honoraria|
|OP-63|any; store error keeps original state|503 store_unavailable|op63_error_store_unchanged|honoraria|
|OP-63|valid state; injected native mid-write failure|500 internal_error; all writes rollback|op63_midwrite_rolls_back|honoraria|
|OP-64|recorded>calculated; valid event|200|op64_transition_1_persists|honoraria|
|OP-64|any; domain error keeps original state|422 reference_not_found|op64_error_domain_unchanged|honoraria|
|OP-64|any; schema error keeps original state|400 invalid_body|op64_error_schema_unchanged|honoraria|
|OP-64|any; role error keeps original state|403 forbidden|op64_error_role_unchanged|honoraria|
|OP-64|any; foreign error keeps original state|404 not_found|op64_error_foreign_unchanged|honoraria|
|OP-64|any; store error keeps original state|503 store_unavailable|op64_error_store_unchanged|honoraria|
|OP-64|valid state; injected native mid-write failure|500 internal_error; all writes rollback|op64_midwrite_rolls_back|honoraria|
|OP-65|calculated>calculated; valid event|200|op65_transition_1_persists|honoraria|
|OP-65|any; domain error keeps original state|403 forbidden|op65_error_domain_unchanged|honoraria|
|OP-65|any; schema error keeps original state|400 invalid_query|op65_error_schema_unchanged|honoraria|
|OP-65|any; role error keeps original state|403 forbidden|op65_error_role_unchanged|honoraria|
|OP-65|any; foreign error keeps original state|404 not_found|op65_error_foreign_unchanged|honoraria|
|OP-65|any; store error keeps original state|503 store_unavailable|op65_error_store_unchanged|honoraria|
|OP-66|stock>stock_decremented; valid event|201|op66_transition_1_persists|inventory|
|OP-66|any; domain error keeps original state|409 conflict|op66_error_domain_unchanged|inventory|
|OP-66|any; schema error keeps original state|400 invalid_body|op66_error_schema_unchanged|inventory|
|OP-66|any; role error keeps original state|403 forbidden|op66_error_role_unchanged|inventory|
|OP-66|any; foreign error keeps original state|404 not_found|op66_error_foreign_unchanged|inventory|
|OP-66|any; store error keeps original state|503 store_unavailable|op66_error_store_unchanged|inventory|
|OP-66|valid state; injected native mid-write failure|500 internal_error; all writes rollback|op66_midwrite_rolls_back|inventory|
|OP-67|stock>stock; valid event|200|op67_transition_1_persists|inventory|
|OP-67|any; domain error keeps original state|400 invalid_query|op67_error_domain_unchanged|inventory|
|OP-67|any; schema error keeps original state|400 invalid_query|op67_error_schema_unchanged|inventory|
|OP-67|any; role error keeps original state|403 forbidden|op67_error_role_unchanged|inventory|
|OP-67|any; foreign error keeps original state|404 not_found|op67_error_foreign_unchanged|inventory|
|OP-67|any; store error keeps original state|503 store_unavailable|op67_error_store_unchanged|inventory|
|OP-68|absent>pendiente; valid event|201|op68_transition_1_persists|charges|
|OP-68|any; domain error keeps original state|409 conflict|op68_error_domain_unchanged|charges|
|OP-68|any; schema error keeps original state|400 invalid_body|op68_error_schema_unchanged|charges|
|OP-68|any; role error keeps original state|403 forbidden|op68_error_role_unchanged|charges|
|OP-68|any; foreign error keeps original state|404 not_found|op68_error_foreign_unchanged|charges|
|OP-68|any; store error keeps original state|503 store_unavailable|op68_error_store_unchanged|charges|
|OP-68|valid state; injected native mid-write failure|500 internal_error; all writes rollback|op68_midwrite_rolls_back|charges|
|OP-69|pending>pending; valid event|200|op69_transition_1_persists|charges|
|OP-69|any; domain error keeps original state|404 not_found|op69_error_domain_unchanged|charges|
|OP-69|any; schema error keeps original state|400 invalid_query|op69_error_schema_unchanged|charges|
|OP-69|any; role error keeps original state|403 forbidden|op69_error_role_unchanged|charges|
|OP-69|any; foreign error keeps original state|404 not_found|op69_error_foreign_unchanged|charges|
|OP-69|any; store error keeps original state|503 store_unavailable|op69_error_store_unchanged|charges|
|OP-70|pendiente>anulado; valid event|200|op70_transition_1_persists|charges|
|OP-70|pendiente>cortesia; valid event|200|op70_transition_2_persists|charges|
|OP-70|any; domain error keeps original state|409 conflict|op70_error_domain_unchanged|charges|
|OP-70|any; schema error keeps original state|400 invalid_body|op70_error_schema_unchanged|charges|
|OP-70|any; role error keeps original state|403 forbidden|op70_error_role_unchanged|charges|
|OP-70|any; foreign error keeps original state|404 not_found|op70_error_foreign_unchanged|charges|
|OP-70|any; store error keeps original state|503 store_unavailable|op70_error_store_unchanged|charges|
|OP-70|valid state; injected native mid-write failure|500 internal_error; all writes rollback|op70_midwrite_rolls_back|charges|
|OP-71|catalog>catalog; valid event|200|op71_transition_1_persists|charges|
|OP-71|any; domain error keeps original state|400 invalid_query|op71_error_domain_unchanged|charges|
|OP-71|any; schema error keeps original state|400 invalid_query|op71_error_schema_unchanged|charges|
|OP-71|any; role error keeps original state|403 forbidden|op71_error_role_unchanged|charges|
|OP-71|any; foreign error keeps original state|404 not_found|op71_error_foreign_unchanged|charges|
|OP-71|any; store error keeps original state|503 store_unavailable|op71_error_store_unchanged|charges|
|OP-72|pending>pending; valid event|200|op72_transition_1_persists|invoicing|
|OP-72|any; domain error keeps original state|409 conflict|op72_error_domain_unchanged|invoicing|
|OP-72|any; schema error keeps original state|400 invalid_body|op72_error_schema_unchanged|invoicing|
|OP-72|any; role error keeps original state|403 forbidden|op72_error_role_unchanged|invoicing|
|OP-72|any; foreign error keeps original state|404 not_found|op72_error_foreign_unchanged|invoicing|
|OP-72|any; store error keeps original state|503 store_unavailable|op72_error_store_unchanged|invoicing|
|OP-72|valid state; injected native mid-write failure|500 internal_error; all writes rollback|op72_midwrite_rolls_back|invoicing|
|OP-73|absent>emitida; valid event|201|op73_transition_1_persists|invoicing|
|OP-73|any; domain error keeps original state|409 conflict|op73_error_domain_unchanged|invoicing|
|OP-73|any; schema error keeps original state|400 invalid_body|op73_error_schema_unchanged|invoicing|
|OP-73|any; role error keeps original state|403 forbidden|op73_error_role_unchanged|invoicing|
|OP-73|any; foreign error keeps original state|404 not_found|op73_error_foreign_unchanged|invoicing|
|OP-73|any; store error keeps original state|503 store_unavailable|op73_error_store_unchanged|invoicing|
|OP-73|valid state; injected native mid-write failure|500 internal_error; all writes rollback|op73_midwrite_rolls_back|invoicing|
|OP-74|emitida>parcial; valid event|200|op74_transition_1_persists|payments|
|OP-74|emitida>pagada; valid event|200|op74_transition_2_persists|payments|
|OP-74|parcial>parcial; valid event|200|op74_transition_3_persists|payments|
|OP-74|parcial>pagada; valid event|200|op74_transition_4_persists|payments|
|OP-74|any; domain error keeps original state|409 conflict|op74_error_domain_unchanged|payments|
|OP-74|any; schema error keeps original state|400 invalid_body|op74_error_schema_unchanged|payments|
|OP-74|any; role error keeps original state|403 forbidden|op74_error_role_unchanged|payments|
|OP-74|any; foreign error keeps original state|404 not_found|op74_error_foreign_unchanged|payments|
|OP-74|any; store error keeps original state|503 store_unavailable|op74_error_store_unchanged|payments|
|OP-74|valid state; injected native mid-write failure|500 internal_error; all writes rollback|op74_midwrite_rolls_back|payments|
|OP-75|emitida>anulada; valid event|200|op75_transition_1_persists|payments|
|OP-75|parcial>anulada; valid event|200|op75_transition_2_persists|payments|
|OP-75|pagada>anulada; valid event|200|op75_transition_3_persists|payments|
|OP-75|any; domain error keeps original state|409 conflict|op75_error_domain_unchanged|payments|
|OP-75|any; schema error keeps original state|400 invalid_body|op75_error_schema_unchanged|payments|
|OP-75|any; role error keeps original state|403 forbidden|op75_error_role_unchanged|payments|
|OP-75|any; foreign error keeps original state|404 not_found|op75_error_foreign_unchanged|payments|
|OP-75|any; store error keeps original state|503 store_unavailable|op75_error_store_unchanged|payments|
|OP-75|valid state; injected native mid-write failure|500 internal_error; all writes rollback|op75_midwrite_rolls_back|payments|
|OP-76|account>account; valid event|200|op76_transition_1_persists|payments|
|OP-76|any; domain error keeps original state|404 not_found|op76_error_domain_unchanged|payments|
|OP-76|any; schema error keeps original state|400 invalid_query|op76_error_schema_unchanged|payments|
|OP-76|any; role error keeps original state|403 forbidden|op76_error_role_unchanged|payments|
|OP-76|any; foreign error keeps original state|404 not_found|op76_error_foreign_unchanged|payments|
|OP-76|any; store error keeps original state|503 store_unavailable|op76_error_store_unchanged|payments|
|OP-77|ledger>ledger; valid event|200|op77_transition_1_persists|payments|
|OP-77|any; domain error keeps original state|400 invalid_query|op77_error_domain_unchanged|payments|
|OP-77|any; schema error keeps original state|400 invalid_query|op77_error_schema_unchanged|payments|
|OP-77|any; role error keeps original state|403 forbidden|op77_error_role_unchanged|payments|
|OP-77|any; foreign error keeps original state|404 not_found|op77_error_foreign_unchanged|payments|
|OP-77|any; store error keeps original state|503 store_unavailable|op77_error_store_unchanged|payments|

## Required concurrency and cross-module e2e beyond generic rows
|Transition/event|Named e2e|Oracle|
|---|---|---|
|two appointment overlapping reservations|agenda_overlap_one_winner|one201 one409; one reservation|
|reschedule write fails after old slot release|agenda_reschedule_restores_old|old slot still reserved, new free|
|same bed two admissions|admission_same_bed_one_winner|one201 one409; exactly one active|
|discharge bed release then cargo failure|discharge_failure_restores_bed|admission active and bed occupied, no charge|
|duplicate vaccine application|vaccine_apply_exactly_once|one application row; unchanged lot on replay|
|two stock consumptions exceed stock|inventory_no_negative_race|winner only; stock>=0; no loser cargo|
|two invoice issues same charge|invoice_charge_claim_one_winner|one invoice, unique line, gapless counter|
|invoice issue fails after counter increment|invoice_failure_does_not_burn_number|same next number after rollback|
|two payments exceed balance|payment_race_cannot_overpay|one winner or serial valid payments, balance>=0|
|invoice annulment with partial payments|invoice_annul_updates_day_close|payments flagged, saldo0, closure excludes receipts|
|clinical close then cargo insert failure|consultation_charge_failure_rolls_back|core consultations/children counts and draft revision unchanged|
|referral send success then worker crash before ack|referral_replay_no_duplicate_order|one lab order, mapping stable, no numeric-id alias|
|preliminary result delivery attempt|lab_preliminary_not_deliverable|409; origin cannot read preliminary data|
|delivered lab result replay|lab_delivery_once_origin_visible|one PG receipt, order received, no foreign patient read|
|accepted plan duplicate completion|dental_line_claim_once|one session claim, no duplicate cargo|
|wrong role/disabled role after access JWT minted|auth_role_change_takes_effect|403 on next request, claims unchanged|
|password reset token reuse|auth_reset_revokes_refresh|old refresh401; temp login restricted until change|
|clinical read audit unavailable|restricted_read_fails_closed_without_audit|503; no clinical DTO emitted|
|reception/admin opens clinical ficha|roles_no_admin_superuser|403 no restricted fields|
|per-engine service restart after committed write|full_restart_survival_each_store|same native record and correct engine, zero other stores|

Every module UI test also checks axe+contrast, Escape and restored focus for dialogs, keyboard submit, loading/empty/error states, no duplicate submit, widths375/768/1440. Evidence includes3 screenshots from actual native demo, not a mocked browser. Common auth errors are tested with principal absent401 as well as wrong role403. For a read operation whose valid response can legitimately be empty, domain-error fixture must deliberately violate its stated query/parent/reference; do not demand404 merely because there are no rows. OP01 login has no authenticated role/foreign-id case. OP02 signed revoked refresh remains idempotent204; invalid JWT401. Structural 400 tests use unknown keys to guarantee a real rejected request even on no-body command routes. Native failure injection is constructor-only, never a production route/environment flag.
