from pathlib import Path
import re,json,hashlib,datetime
ROOT=Path('/workspace/genki/plan/2026-11-05'); F=ROOT/'full-system'
if (ROOT/'ADOPTION.md').exists():
 raise SystemExit('Adopted pack regeneration blocked: preserve ADOPTION/DECISIONS status and explicitly review amendment changes before regeneration.')
S=(F/'source/analisis-y-modelo-relacional.md').read_text(); lines=S.splitlines()
# Planning-only artifact generator. No application implementation, repository checkout or external writes.
entities={}; current=None
for no,line in enumerate(lines[399:1425],400):
 t=line.strip()
 if re.fullmatch('[A-Z_]+',t):
  current=t; entities.setdefault(current,{})
 m=re.match(r'^\s*(?:([A-Z][A-Z_]+)\s+)?([a-z][a-z_0-9]*)\s+(INT|BIGINT|SMALLINT|BOOLEAN|DATE|TIMESTAMP|TEXT|JSON / TEXT|VARCHAR\(\d+\)|CHAR\(\d+\)|DECIMAL\(\d+,\d+\))\s+(.*?)\s+(Sí|No)\s+(.*)',line)
 if m:
  en,field,typ,key,req,rule=m.groups();en=en or current
  if en:
   entities.setdefault(en,{})[field]={'type':typ,'required':req=='Sí','key':key.strip(),'rule':rule.strip(),'source_line':no}
# relational schema keeps E1-06 correction B over earlier attribute table
entities['PROFESIONAL']={k:v for k,v in entities['PROFESIONAL'].items() if k not in ['id_tipo_personal','modalidad_contrato','fecha_ingreso']}
manual={
'TIPO_PERSONAL':'id_tipo_personal:INT!PK nombre:VARCHAR(40)!UK requiere_colegiado:BOOLEAN! genera_honorario:BOOLEAN!',
'ROL_CLINICO':'codigo_rol:VARCHAR(15)!PK nombre:VARCHAR(60)!UK factor_honorario:DECIMAL(4,3)! descripcion:VARCHAR(200)',
'ORDEN_EXAMEN':'id_orden:INT!PK id_paciente:INT! institucion_origen:INT! medico_solicitante:VARCHAR(120)! fecha_solicitud:TIMESTAMP! prioridad:VARCHAR(15)! estado:VARCHAR(20)! observaciones:VARCHAR(500) referencia_externa:VARCHAR(40)',
'EXAMEN':'codigo_examen:VARCHAR(20)!PK nombre:VARCHAR(120)! tipo:VARCHAR(20)! area:VARCHAR(80)! metodo:VARCHAR(80)! tiempo_entrega_horas:INT! requiere_ayuno:BOOLEAN!',
'MUESTRA':'id_muestra:INT!PK id_orden:INT! codigo_barras:VARCHAR(80)!UK tipo_muestra:VARCHAR(20)! fecha_hora_toma:TIMESTAMP! condicion:VARCHAR(20)! responsable_toma:INT!',
'RESULTADO':'id_resultado:INT!PK id_orden:INT! codigo_examen:VARCHAR(20)! id_muestra:INT! fecha_hora_resultado:TIMESTAMP! datos:JSON! estado:VARCHAR(20)! validado_por:INT fecha_validacion:TIMESTAMP observaciones:VARCHAR(500)',
'VALOR_REFERENCIA':'codigo_examen:VARCHAR(20)!PK analito:VARCHAR(80)!PK sexo:VARCHAR(5)!PK edad_min_meses:INT!PK edad_max_meses:INT! valor_min:DECIMAL(14,4)! valor_max:DECIMAL(14,4)! unidad:VARCHAR(30)!',
'ODONTOGRAMA':'id_odontograma:INT!PK id_expediente:INT! fecha:DATE! notacion:VARCHAR(3)! id_profesional:INT! observacion_general:VARCHAR(500)',
'PIEZA_DENTAL':'id_odontograma:INT!PK numero_pieza:INT!PK estado:VARCHAR(20)! superficies:JSON! movilidad:INT! observacion:VARCHAR(500)',
'PROCEDIMIENTO_DENTAL':'codigo:VARCHAR(20)!PK nombre:VARCHAR(150)! categoria:VARCHAR(30)! duracion_estimada_min:INT! costo_referencia:DECIMAL(10,2)!',
'PLAN_TRATAMIENTO':'id_plan:INT!PK id_expediente:INT! fecha_elaboracion:DATE! id_profesional:INT! estado:VARCHAR(20)! total_estimado:DECIMAL(10,2)! detalle:JSON!',
'SESION_TRATAMIENTO':'id_sesion:INT!PK id_plan:INT! id_cita:INT fecha:DATE! procedimientos_realizados:JSON! anestesia_utilizada:VARCHAR(200) observaciones:VARCHAR(500) saldo_pendiente:DECIMAL(10,2)!',
# Explicit architecture additions, not claims of source schema:
'PROFESIONAL_CONTRATO':'id_profesional:INT!PK id_tipo_personal:INT! modalidad_contrato:VARCHAR(20)! fecha_ingreso:DATE!',
'ORDEN_EXAMEN_ITEM':'id_orden:INT!PK codigo_examen:VARCHAR(20)!PK',
'REFERENCIA_OMS':'version:VARCHAR(20)!PK indicador:VARCHAR(30)!PK sexo:CHAR(1)!PK edad_dias:INT!PK l:DECIMAL(14,8)! m:DECIMAL(14,8)! s:DECIMAL(14,8)!',
'VACUNA_INTERVALO':'id_vacuna:INT!PK numero_dosis:INT!PK edad_meses:INT!',
'OUTBOX_LAB':'id_evento:VARCHAR(80)!PK tipo:VARCHAR(20)! origen_id:INT! destino_id:INT! payload:JSON! estado:VARCHAR(20)! intentos:INT! fecha_hora:TIMESTAMP!',
'CORRELATIVO_FACTURA':'id_institucion:INT!PK serie:VARCHAR(10)!PK siguiente:INT!',
'COMANDO_IDEMPOTENTE':'id_institucion:INT!PK clave:VARCHAR(80)!PK operacion:VARCHAR(20)! hash_request:CHAR(64)! respuesta:JSON!',
'CONSULTA_BORRADOR':'id_consulta:INT!PK bundle:JSON! revision:INT!',
'ANULACION_CONSULTA':'id_consulta:INT!PK motivo:VARCHAR(300)! id_usuario:INT! fecha_hora:TIMESTAMP!',
}
for en,ds in manual.items():
 fields={}
 for item in ds.split():
  name,t=item.split(':');req='!' in t; typ,key=(t.split('!')+[''])[:2] if req else (t,'')
  fields[name]={'type':typ,'required':req,'key':key,'rule':'Frozen delta design; source logical fields retained' if en in list(manual)[:12] else 'Additive infrastructure/ADR, not a source entity','source_line':1433 if en in ['ORDEN_EXAMEN','EXAMEN','MUESTRA','RESULTADO','VALOR_REFERENCIA'] else 1477 if en in ['ODONTOGRAMA','PIEZA_DENTAL','PROCEDIMIENTO_DENTAL','PLAN_TRATAMIENTO','SESION_TRATAMIENTO'] else None}
 entities[en]=fields
# Recover field names in textual schemas, report source parsing gaps instead of inventing fields.
rel=S[S.index('7.4 Esquema relacional'):S.index('7.6 Integridad referencial')]
gaps=[]
for en,body in re.findall(r'\b([A-Z][A-Z_]+)\(([^)]+)\)',rel,re.S):
 if en not in entities: continue
 names=[re.sub('[#*\\s]','',x).strip('_') for x in body.split(',')]
 for n in names:
  if n and n not in entities[en]:gaps.append((en,n))
print('PARSE GAPS',gaps)
(F/'contracts/entities.json').write_text(json.dumps(entities,ensure_ascii=False,indent=2)+'\n')
# OP names and institution applicability transcribed from source §10, not inferred from IDs.
RAW='''01|Iniciar sesión|HPLO|POST|/api/auth/login|LoginRequestDto|AuthTokensDto|anonymous>authenticated|invalid_credentials|Retain JWT; five failed attempts block account; verify current persisted status on every request.
02|Cerrar sesión|HPLO|POST|/api/auth/logout|refresh_token:string|void|authenticated>anonymous|invalid_token|Retain 204 and idempotent signed revoked token; add logout timestamp audit, never log token.
03|Cambiar contraseña|HPLO|POST|/api/auth/password|anterior:string,nueva:string|void|active>active|invalid_credentials|Verify previous Argon2id; policy >=12 chars <=200, at least one letter and digit; revoke all refresh sessions atomically with password update.
04|Restablecer contraseña|HPLO|POST|/api/usuarios/:id/reset-password|none|temporal:string|blocked>active|not_found|Admin only; CSPRNG 24-char temporary password shown once, never audit; must change before clinical access; revoke sessions, clear failed counter.
05|Administrar usuarios y roles|HPLO|POST|/api/usuarios|UsuarioAdminInput|UsuarioAdminResult|absent>active;active>inactive;inactive>active|conflict|Create/update/deactivate through explicit action upsert with optional id; role allowlist; may not deactivate last active administrator; no password/hash in DTO.
06|Consultar bitácora|HPLO|GET|/api/bitacora|AuditQuery|Page<BitacoraSafe>|audit>audit|forbidden|Admin/auditor only; stable time/id paging; append-only; restricted reads/writes audited without clinical content.
07|Buscar paciente|HPLO|GET|/api/pacientes|SearchPacientesInput|PacientePage|records>records|invalid_query|Preserve baseline literal search, active filter, scoped document uniqueness.
08|Registrar paciente nuevo|HPLO|POST|/api/pacientes|RegisterPacienteRequest|PacienteResumen|absent>active|duplicate_document|Preserve atomic patient+expediente+required guardian.
09|Actualizar datos del paciente|HPLO|PATCH|/api/pacientes/:id|PacientePatch|PacienteResumen|active>active|duplicate_document|Allow identity/contact edits except generated ids, institution, state and registration time; validate document uniqueness and no future birth; return only identity to reception.
10|Registrar contacto de emergencia|HPLO|POST|/api/pacientes/:id/contactos|Input<CONTACTO_EMERGENCIA>|CONTACTO_EMERGENCIA|active>active|conflict|Atomic replace principal flag on other contacts when adding a new principal; validate ownership.
11|Registrar responsable o tutor|P|POST|/api/pacientes|RegisterPacienteRequest.responsables|PacienteResumen|absent>active|guardian_required|Keep inline atomic registration, not a new orphan patient workflow; later guardian addition uses contacts-style child write while exactly one principal remains.
12|Consultar ficha del paciente|HPLO|GET|/api/pacientes/:id/ficha|none|FichaCompleta|active>active;archived>archived|not_found|Clinical role sees identity+allergies+antecedents, reception gets only baseline identity; never grant reception clinical field access.
13|Abrir expediente|HPLO|POST|/api/pacientes|RegisterPacienteRequest|PacienteResumen|absent>active|duplicate_document|Retain registration transaction and one record per patient; not a second opening route.
14|Consultar historial completo|HPLO|GET|/api/pacientes/:id/historial|PageQuery|Page<HistoryEvent>|active>active;archived>archived|not_found|Merge all local clinical events including specialty, attachments, admissions, notes, exams, dental, growth and vaccines; timestamp desc then type then id; bridge results only after delivery.
15|Registrar antecedentes|HPLO|POST|/api/pacientes/:id/antecedentes|Input<ANTECEDENTE>|ANTECEDENTE|active>active|expediente_archived|Append, source types personal/familiar/quirurgico/habito; no future start date; no clinical DELETE.
16|Registrar alergia|HPLO|POST|/api/pacientes/:id/alergias|Input<ALERGIA>|ALERGIA|active>active|conflict|Unique normalized substance per expediente; severity leve/moderada/severa, reference rules from schema.
17|Adjuntar documento|HPLO|POST|/api/pacientes/:id/documentos|multipart archivo plus optional id_consulta|DOCUMENTO_ADJUNTO|active>active|invalid_body|PDF/JPEG/PNG magic and MIME, max 10MiB, stream SHA256, generated local path; authorized download GET /api/documentos/:id/contenido; cleanup orphan temp files on failure.
18|Archivar expediente|HPLO|POST|/api/pacientes/:id/archivo|ArchiveRequest|ExpedienteDto|active>archived|already_archived|Keep archive behavior; reject active admissions or open consultations with conflict instead of corrupting state.
19|Reactivar expediente|HPLO|POST|/api/pacientes/:id/reactivacion|motivo:string|ExpedienteDto|archived>active|conflict|Administrator only; clear archive metadata but append old values to safe audit; never erase history.
20|Consultar disponibilidad|HPO|GET|/api/agenda/disponibilidad|id_profesional:id,desde:iso,hasta:iso|Slot[]|schedule>schedule|invalid_query|UTC intervals, <=31 days; 08:00-17:00 Guatemala Mon-Sat, 30min default; explicit academic configurable hours not claimed source fact.
21|Agendar cita|HPLO|POST|/api/citas|Input<CITA>|CITA|absent>programada|conflict|Lock scoped professional/day; reject overlapping non-cancelled/non-no_asistio intervals, not only identical start.
22|Reprogramar cita|HPLO|POST|/api/citas/:id/reprogramacion|fecha_hora:iso,duracion_minutos:int|CITA|programada>programada;confirmada>programada|conflict|Release prior and reserve new interval atomically; injected mid-write failure restores old slot.
23|Cancelar cita|HPLO|POST|/api/citas/:id/cancelacion|motivo:string|CITA|programada>cancelada;confirmada>cancelada|conflict|Keep record; cancelled interval becomes reusable, never delete.
24|Registrar llegada|HPO|POST|/api/citas/:id/llegada|none|CITA|programada>confirmada|conflict|Source has no llegada enum; map arrival to confirmada; duplicate arrival idempotent confirmed, attended/cancelled rejected.
25|Ver agenda del día|HPLO|GET|/api/agenda|fecha:date,id_profesional?:id|CITA[]|schedule>schedule|invalid_query|Convert Guatemala day bounds to UTC half-open interval; role-safe projection omits motivo for nonclinical viewers.
26|Abrir consulta|HPO|POST|/api/pacientes/:id/consultas/abiertas|OpenConsultaInput|ConsultaDraft|absent>abierta|expediente_archived|Persist open consultation+draft, optional owned confirmed appointment; keep baseline atomic closed shortcut unchanged.
27|Registrar signos vitales|HP|PUT|/api/consultas/:id/signos|Input<SIGNOS_VITALES>|SIGNOS_VITALES|abierta>abierta|conflict|Enfermeria/medico only; one row per consultation; bounds source §5.1; no BMI persisted.
28|Registrar diagnóstico|HPO|PUT|/api/consultas/:id/borrador/diagnosticos|diagnosticos:DiagnosticoInput[]|ConsultaDraft|abierta>abierta|invalid_bundle|Store draft only with expected_revision; validate one primary; final normalized children only at close.
29|Registrar tratamiento|HPO|PUT|/api/consultas/:id/borrador/tratamientos|tratamientos:TratamientoInput[]|ConsultaDraft|abierta>abierta|invalid_bundle|Use diagnosis_index and expected_revision; diagnostic links validated at close; retained baseline enums.
30|Emitir receta|HPO|PUT|/api/consultas/:id/borrador/receta|receta:CloseConsultaRequest.receta|ConsultaDraft|abierta>abierta|reference_not_found|Validate active medications; final issued prescription and folio only when close commits; draft preview explicitly labeled not issued.
31|Cerrar consulta|HPO|POST|/api/consultas/:id/cierre|expected_revision:int|ConsultaCompleta|abierta>cerrada|invalid_bundle|Atomically close persisted draft, children, prescription and consultation charge; extend baseline shortcut to charge in same native transaction too; mark linked appointment atendida.
32|Anular consulta|HPO|POST|/api/consultas/:id/anulacion|motivo:string|ConsultaDto|abierta>anulada;cerrada>anulada|conflict|Append reason/user/time, retain all clinical children; reject if consultation cargo already invoiced until invoice annulled; cancel only pending generated charges atomically.
33|Consultar recetas del paciente|HPO|GET|/api/pacientes/:id/recetas|PageQuery|Page<ConsultaCompleta>|active>active;archived>archived|not_found|Include issue date and annulled markers, medication detail and clinician; no fabricated interaction detection.
34|Consultar camas disponibles|H|GET|/api/camas|id_servicio?:id|CAMA[]|beds>beds|invalid_query|Only libre scoped beds ordered service/id; show service tariff public values.
35|Registrar ingreso|H|POST|/api/pacientes/:id/admisiones|Input<ADMISION>|ADMISION|absent>activa|conflict|Lock expediente+bed; one active admission per record and bed; active expediente; owned ingreso diagnosis; admission+occupied bed atomic.
36|Escribir nota de evolución|H|POST|/api/admisiones/:id/notas|Input<NOTA_EVOLUCION>|NOTA_EVOLUCION|activa>activa|conflict|Append-only, required ADMISION FK; correction references prior note in same admission, original content immutable.
37|Registrar procedimiento|H|POST|/api/procedimientos|ProcedimientoBundle|PROCEDIMIENTO|activa>activa|reference_not_found|Exactly one admission/consultation anchor; create procedure+team+consumption+charges atomically through shared ports, rollback on missing lot/stock.
38|Registrar egreso|H|POST|/api/admisiones/:id/egreso|id_diagnostico_egreso:id,condicion_egreso:enum,fecha_hora_egreso:iso|ADMISION|activa>cerrada|conflict|Strictly later than ingreso; owned diagnosis; free bed and bill max(1,ceil(elapsed_hours/24)) days at snapshotted current bed tariff atomically.
39|Solicitar estudio al laboratorio|H|POST|/api/consultas/:id/ordenes-laboratorio|Input<ORDEN_ESTUDIO>,examenes:string[]|ORDEN_ESTUDIO|absent>solicitada|reference_not_found|Local PG order+outbox commit; local worker imports lab order idempotently with explicit approved referral scope; never synchronous distributed transaction.
40|Registrar antecedentes de nacimiento|P|PUT|/api/pacientes/:id/perinatal|Input<ANTECEDENTE_PERINATAL>|ANTECEDENTE_PERINATAL|absent>recorded;recorded>recorded|invalid_body|Source §5.3 ranges, versioned audit on correction; active record required.
41|Registrar medición de crecimiento|P|POST|/api/consultas/:id/mediciones|MedicionInput|MEDICION_ANTROPOMETRICA|abierta>abierta;cerrada>cerrada|reference_not_found|Compute age at measurement and WHO LMS percentiles/Z from pinned verified reference, store version and historical values; no synthetic WHO table.
42|Ver curva de crecimiento|P|GET|/api/pacientes/:id/crecimiento|none|MEDICION_ANTROPOMETRICA[]|active>active;archived>archived|not_found|Chronological actual measurements SVG chart with WHO reference overlay; no line interpolation that pretends unmeasured data.
43|Consultar esquema de vacunación|P|GET|/api/pacientes/:id/vacunas|none|DosisSchedule[]|absent>scheduled;scheduled>scheduled|reference_not_found|Idempotent scheduled dose creation from versioned explicit dose interval catalog; pending/overdue derived relative to clock, not invented dates.
44|Registrar dosis aplicada|P|POST|/api/dosis/:id/aplicacion|fecha_aplicacion:date,lote:string,fabricante?:string,sitio_aplicacion?:string,id_profesional:id|DOSIS_VACUNA|pendiente>aplicada|conflict|Validate dose <= catalog total; nonfuture date >= birth, required lot/professional; apply+update schedule atomically, repeated command idempotent.
45|Registrar reacción adversa|P|POST|/api/dosis/:id/reacciones|reaccion_adversa:string|DOSIS_VACUNA|aplicada>aplicada|conflict|Only applied dose accepts reaction, append safe audit, preserve lot and application date.
46|Evaluar hitos de desarrollo|P|PUT|/api/pacientes/:id/hitos/:hito|Input<SEGUIMIENTO_HITO>|SEGUIMIENTO_HITO|absent>evaluated;evaluated>evaluated|reference_not_found|Show expected catalog milestones by age; upsert reached flag with date/observations and immutable audit of previous evaluation.
47|Listar dosis pendientes|P|GET|/api/vacunas/pendientes|hasta:date,PageQuery|Page<DosisPendiente>|schedule>schedule|invalid_query|Pending dates <= requested day, patient contact role-filtered, stable page; no automatic patient outreach.
48|Recibir orden de examen|L|POST|/api/laboratorio/ordenes|LabOrderInput|ORDEN_EXAMEN|absent>recibida|conflict|One or more active exam codes; idempotent external origin/reference; referred patient mapped by explicit referral link not coincident numeric id.
49|Registrar toma de muestra|L|POST|/api/laboratorio/ordenes/:id/muestras|Input<MUESTRA>|MUESTRA|recibida>en_proceso;en_proceso>en_proceso|conflict|Unique barcode, ordered exam-compatible sample, inadequate sample stored but cannot validate result.
50|Cargar resultado|L|POST|/api/laboratorio/ordenes/:id/resultados|ResultadoInput|RESULTADO|en_proceso>en_proceso|invalid_bundle|Discriminated exam schema, correct sample/order, automatic reference flags and preliminary result+order state atomic; one current result per ordered exam.
51|Validar resultado|L|POST|/api/laboratorio/resultados/:id/validacion|none|RESULTADO|preliminar>validado|conflict|Authorized professional distinct? no source mandates distinct operator, allow qualified validator; when all ordered exams valid, order becomes validada atomically.
52|Comparar contra valores de referencia|L|POST|/api/laboratorio/resultados/:id/comparacion|none|ResultadoFlags|preliminar>preliminar|reference_not_found|Also automatic inside OP50; sex/age interval [min,max), one matching range per numeric analyte; fail missing/ambiguous references, store reference snapshot.
53|Entregar resultado|L|POST|/api/laboratorio/ordenes/:id/entrega|none|ORDEN_EXAMEN|validada>entregada|conflict|Only all validated; local order+delivery outbox atomic; result available at referring hospital after idempotent receipt, not before.
54|Consultar historial de exámenes|L|GET|/api/pacientes/:id/examenes|PageQuery|Page<LabHistory>|active>active;archived>archived|not_found|All owned exam results with preliminary/validated/rectified status; origin only receives delivered snapshot.
55|Abrir odontograma|O|POST|/api/pacientes/:id/odontogramas|id_profesional:id,observacion_general?:string|ODONTOGRAMA|absent>open|conflict|Create exactly 32 permanent FDI teeth (quadrants1..4 positions1..8) with sane surfaces, no 19/29/39/49; one chart per submitted command.
56|Actualizar estado de una pieza|O|PUT|/api/odontogramas/:id/piezas/:numero|PiezaPatch|PIEZA_DENTAL|open>open|invalid_body|Per-surface status map allows obturada oclusal+caries mesial simultaneously; expected revision prevents lost updates.
57|Elaborar plan de tratamiento|O|POST|/api/pacientes/:id/planes|PlanInput|PLAN_TRATAMIENTO|absent>propuesto|reference_not_found|Nonempty ordered procedure/tooth lines with snapshot price; calculate total, stable line ids, max100 lines, no user supplied total.
58|Aceptar plan de tratamiento|O|POST|/api/planes/:id/aceptacion|none|PLAN_TRATAMIENTO|propuesto>en_proceso|conflict|Source OP says in-progress, schema also aceptado: audit proposed->accepted->in-progress in one transaction; immutable accepted budget.
59|Registrar sesión de tratamiento|O|POST|/api/planes/:id/sesiones|SesionInput|SESION_TRATAMIENTO|en_proceso>en_proceso;en_proceso>finalizado|conflict|Validate performed plan lines not repeated; session+line completion+procedure charges atomic; completed all marks finalizado.
60|Consultar saldo del paciente|O|GET|/api/pacientes/:id/saldo-dental|none|DentalBalance|plan>plan|not_found|Budget, performed/billed, paid and remaining separately; join real billing port, never equate session count with payment.
61|Administrar personal|HPLO|POST|/api/personal|PersonalInput|PersonalDto|absent>active;active>inactive;active>active|conflict|Keep locked PROFESIONAL B; separate 1:1 contrato table stores category/contract/start; conditional colegiado, no forbidden columns on profesional.
62|Definir tarifa de honorarios|HPLO|POST|/api/personal/:id/tarifas|Input<TARIFA_HONORARIO>|TARIFA_HONORARIO|current>closed_and_new|conflict|Honorarios type only, no planilla; lock professional+service; nonoverlapping [desde,hasta) version windows; cannot mutate historical tariffs.
63|Registrar el equipo de una atención|HPO|POST|/api/participaciones|Input<PARTICIPACION>|PARTICIPACION|absent>recorded|conflict|Exactly one consultation/procedure, unique role+professional+act; scoped professional.
64|Calcular honorarios de un acto|HPO|POST|/api/actos/honorarios|ActRef|PARTICIPACION[]|recorded>calculated|reference_not_found|Snapshot tariff at act time times role factor; percentage of service price; persist amount+idempotent honorario charge in same transaction, never recalculate history silently.
65|Liquidar honorarios de un período|HPO|GET|/api/honorarios/liquidacion|desde:date,hasta:date,id_profesional?:id|Liquidacion[]|calculated>calculated|forbidden|Monthly report by professional/act/role, RRHH all; clinical self only; no actual bank payouts.
66|Registrar consumo de material|HPLO|POST|/api/consumos|Input<CONSUMO_INSUMO>,id_paciente:id|CONSUMO_INSUMO|stock>stock_decremented|conflict|Atomic consumption+stock decrement+charge; positive integer quantity while source stock INT; controlled/requires_lote needs lot; one or zero act anchors with explicit patient.
67|Consultar existencias|HPLO|GET|/api/insumos|PageQuery,bajo_stock?:boolean|Page<INSUMO>|stock>stock|invalid_query|Low-stock academic threshold <=5 configurable seed metadata, actual counts; public projection excludes cost to unauthorized role.
68|Generar cargo|HPLO|POST|/api/cargos|CargoInput|CARGO|absent>pendiente|conflict|Shared application port reused inside close/exit/consume/honoraria/dental; unique source event key, snapshot price; manual charges authorized caja only.
69|Consultar cargos pendientes|HPLO|GET|/api/pacientes/:id/cargos|PageQuery|Page<CargoCaja>|pending>pending|not_found|Only pendiente, safe projection no clinical origin FKs/descriptions, generic service label for reception.
70|Anular o marcar cortesía un cargo|HPLO|POST|/api/cargos/:id/disposicion|estado:anulado_or_cortesia,motivo:string|CargoCaja|pendiente>anulado;pendiente>cortesia|conflict|Caja with explicit cargo.autorizar permission only; reason audited, invoiced rejects.
71|Consultar tarifario|HPLO|GET|/api/tarifario|PageQuery|Page<SERVICIO_FACTURABLE>|catalog>catalog|invalid_query|Institution tariff read, no private contract honoraria, active service list.
72|Seleccionar cargos a facturar|HPLO|POST|/api/pacientes/:id/facturas/preview|cargo_ids:id[]|InvoicePreview|pending>pending|conflict|Nonempty unique owned pending ids, compute immutable snapshot preview hash; preview does not reserve or mutate cargo, revalidate at issue.
73|Emitir factura|HPLO|POST|/api/pacientes/:id/facturas|FacturaInput|FacturaCompleta|absent>emitida|conflict|Native atomic invoice+lines+mark cargos+transactional series counter, gapless successful commits; 12% IVA taxable discounted base; no real FEL call.
74|Registrar pago|HPLO|POST|/api/facturas/:id/pagos|PagoInput|FacturaCompleta|emitida>parcial;emitida>pagada;parcial>parcial;parcial>pagada|conflict|Lock invoice, amount<=balance, nonannulled, charge+balance+state atomic; idempotency required; card is simulated method label no PAN capture/provider.
75|Anular factura|HPLO|POST|/api/facturas/:id/anulacion|motivo:string|FacturaCompleta|emitida>anulada;parcial>anulada;pagada>anulada|conflict|Mark invoice+all payments annulled, balance0, cargo anulado, retain sequence forever; no automatic real refunds.
76|Consultar estado de cuenta|HPLO|GET|/api/pacientes/:id/cuenta|PageQuery|EstadoCuenta|account>account|not_found|Actual invoices/payments/balances; patient role requires bound patient id, otherwise no self access; clinician sees balance only not payments.
77|Cierre de caja|HPLO|GET|/api/caja/cierre|fecha:date|CierreCaja|ledger>ledger|invalid_query|Guatemala day aggregate nonannulled payments by method; include annulation totals separately, no fictitious fiscal submission.'''
ops=[]
for line in RAW.splitlines():
 id,title,inst,verb,path,request,response,transitions,error,rules=line.split('|')
 n=int(id); search=re.search(r'(?:OP-\s*\n?\s*'+str(n).zfill(2)+r'\b)',S[ S.index('10. Operaciones'):])
 # Source table wraps ID across title columns, so line references pinned using exact known blocks.
 starts={1:2725,2:2728,3:2731,4:2734,5:2737,6:2740,7:2746,8:2749,9:2752,10:2755,11:2758,12:2761,13:2767,14:2770,15:2774,16:2779,17:2782,18:2785,19:2788,20:2794,21:2797,22:2800,23:2803,24:2806,25:2809,26:2816,27:2819,28:2822,29:2825,30:2828,31:2831,32:2834,33:2837,34:2844,35:2847,36:2850,37:2853,38:2856,39:2859,40:2866,41:2869,42:2872,43:2875,44:2878,45:2881,46:2884,47:2887,48:2894,49:2897,50:2900,51:2903,52:2906,53:2912,54:2915,55:2921,56:2923,57:2925,58:2927,59:2929,60:2931,61:2936,62:2939,63:2942,64:2945,65:2948,66:2951,67:2954,68:2957,69:2960,70:2963,71:2969,72:2972,73:2975,74:2980,75:2983,76:2986,77:2989}
 ops.append(dict(id=n,title=title,institutions=inst,method=verb,path=path,request=request,response=response,transitions=transitions.split(';'),error=error,rules=rules,source_line=starts[n]))
(F/'contracts/operations.json').write_text(json.dumps(ops,ensure_ascii=False,indent=2)+'\n')
# Each module owns its types/use cases, port, HTTP plugin, UI page and per-store adapter files.
# Common data persists in all four stores; specialized data follows the source Inst. matrix.
MODS=[
('account',[1,2,3,4],['postgres'],['auth'],['USUARIO','AUTH_SESSION'],[]),
('users',[5,6],['postgres'],['admin'],['ROL','PERMISO','ROL_PERMISO','BITACORA'],['account']),
('patient',[7,8,9,10,11,13],['postgres','mysql','mongodb','firebase'],['recepcion'],['CONTACTO_EMERGENCIA'],[]),
('record',[12,15,16,18,19],['postgres','mysql','mongodb','firebase'],['medico'],['ANTECEDENTE','ALERGIA'],[]),
('attachments',[17],['postgres','mysql','mongodb','firebase'],['medico'],['DOCUMENTO_ADJUNTO'],['record']),
('agenda',[20,21,22,23,24,25],['postgres','mysql','mongodb','firebase'],['recepcion'],['CITA'],[]),
('consultation',[26,27,28,29,30,31,32,33],['postgres','mysql','mongodb','firebase'],['medico'],['SIGNOS_VITALES','CONSULTA_BORRADOR','ANULACION_CONSULTA'],['charges','agenda']),
('admission',[34,35],['postgres'],['medico'],[],['consultation']),
('procedure',[36,37],['postgres'],['medico'],['CATALOGO_PROCEDIMIENTO','PROCEDIMIENTO'],['admission','honoraria','inventory']),
('discharge',[38],['postgres'],['medico'],[],['admission','charges']),
('referral',[39],['postgres','mongodb'],['medico'],['ORDEN_ESTUDIO','OUTBOX_LAB'],['consultation','lab-intake']),
('growth',[40,41,42],['mysql'],['medico'],['ANTECEDENTE_PERINATAL','MEDICION_ANTROPOMETRICA','REFERENCIA_OMS'],['consultation']),
('vaccines',[43,44,45,47],['mysql'],['enfermeria'],['VACUNA','DOSIS_VACUNA','VACUNA_INTERVALO'],[]),
('milestones',[46],['mysql'],['medico'],['HITO_DESARROLLO','SEGUIMIENTO_HITO'],[]),
('lab-intake',[48,49],['mongodb'],['laboratorista'],['ORDEN_EXAMEN','ORDEN_EXAMEN_ITEM','EXAMEN','MUESTRA'],[]),
('lab-results',[50,51,52,53,54],['mongodb'],['laboratorista'],['RESULTADO','VALOR_REFERENCIA'],['lab-intake']),
('dental-chart',[55,56],['firebase'],['odontologo'],['ODONTOGRAMA','PIEZA_DENTAL'],[]),
('dental-plan',[57,58],['firebase'],['odontologo'],['PROCEDIMIENTO_DENTAL','PLAN_TRATAMIENTO'],['dental-chart']),
('dental-session',[59,60],['firebase'],['odontologo'],['SESION_TRATAMIENTO'],['dental-plan','charges','payments']),
('personnel',[61,62],['postgres','mysql','mongodb','firebase'],['recursos_humanos'],['PROFESIONAL_CONTRATO','TIPO_PERSONAL','TARIFA_HONORARIO'],[]),
('honoraria',[63,64,65],['postgres','mysql','mongodb','firebase'],['medico'],['ROL_CLINICO','PARTICIPACION'],['personnel','charges']),
('inventory',[66,67],['postgres','mysql','mongodb','firebase'],['almacen'],['INSUMO','CONSUMO_INSUMO'],['charges']),
('charges',[68,69,70,71],['postgres','mysql','mongodb','firebase'],['caja'],['SERVICIO_FACTURABLE','CARGO','COMANDO_IDEMPOTENTE'],[]),
('invoicing',[72,73],['postgres','mysql','mongodb','firebase'],['caja'],['FACTURA','DETALLE_FACTURA','CORRELATIVO_FACTURA'],['charges']),
('payments',[74,75,76,77],['postgres','mysql','mongodb','firebase'],['caja'],['PAGO'],['invoicing']),
('history',[14],['postgres','mysql','mongodb','firebase'],['medico'],[],['attachments','consultation','procedure','discharge','referral','growth','vaccines','milestones','lab-results','dental-session']),
]
modmap={m[0]:m for m in MODS};opmod={n:m[0] for m in MODS for n in m[1]}
assert sorted(opmod)==list(range(1,78))
# Minimal source-grounded projection inputs; omitted/generated/actor/route-owned fields cannot be supplied.
projections={
'CONTACTO_EMERGENCIA':'nombre_completo parentesco telefono telefono_alterno es_principal',
'ANTECEDENTE':'tipo descripcion fecha_inicio vigente', 'ALERGIA':'sustancia tipo severidad reaccion fecha_deteccion',
'CITA':'id_paciente id_profesional id_especialidad fecha_hora duracion_minutos motivo',
'SIGNOS_VITALES':'presion_sistolica presion_diastolica frecuencia_cardiaca frecuencia_respiratoria temperatura_c saturacion_oxigeno peso_kg talla_cm',
'ADMISION':'id_consulta_origen id_cama id_diagnostico_ingreso tipo_ingreso fecha_hora_ingreso',
'NOTA_EVOLUCION':'id_nota_anterior contenido turno',
'ORDEN_ESTUDIO':'id_institucion_destino tipo_examen prioridad indicaciones',
'ANTECEDENTE_PERINATAL':'semanas_gestacion tipo_parto peso_nacimiento_g talla_nacimiento_cm apgar_1min apgar_5min complicaciones',
'CONSUMO_INSUMO':'id_insumo id_admision id_procedimiento id_consulta id_profesional_registra cantidad lote',
'PARTICIPACION':'id_profesional codigo_rol id_consulta id_procedimiento fecha_hora_inicio fecha_hora_fin observacion',
'TARIFA_HONORARIO':'codigo_servicio modalidad monto_fijo porcentaje vigente_desde',
'SEGUIMIENTO_HITO':'alcanzado fecha_evaluacion observacion',
'MUESTRA':'codigo_barras tipo_muestra fecha_hora_toma condicion responsable_toma',
}
for en,fs in projections.items():
 for field in fs.split():assert field in entities[en],(en,field)
# Render source types into exact wire semantics. Decimal values are strings for new money APIs.
def wire(v,name=''):
 t=v['type'];
 if t in ['INT','BIGINT','SMALLINT']:return 'number' if t!='BIGINT' else 'string'
 if t=='BOOLEAN':return 'boolean'
 if t=='TIMESTAMP' or t=='DATE':return 'string'
 if t.startswith('DECIMAL'):return 'string' if any(s in name for s in ['monto','precio','subtotal','total','saldo','impuesto','descuento','cobertura','honorario','factor','porcentaje','costo']) else 'number'
 if t.startswith('JSON'):return 'JsonValue'
 return 'string'
def shape(en,cols=None):
 return '{ '+ '; '.join(n+('' if v['required'] else '?')+':'+wire(v,n)+(' | null' if not v['required'] else '') for n,v in entities[en].items() if cols is None or n in cols)+' }'
types='''# F2 — Additive DTO, validation, route/error contract

Normative with per-operation contracts below. Future repo path `docs/plan/full-system/contracts/TYPES-API.md`. Existing `@genki/shared` DTOs, integer brands, errors and 17 C3.4 cases remain intact. No renamed baseline fields. Only FULL-FOUNDATION owns shared export-map/index and full error aliases. New per-module types import via `@genki/shared/full/<module>`; foundation adds package export pattern `./full/*` mapping to dist/full/*.js and *.d.ts. No module writes `shared/src/index.ts`.

## Validation rules
IDs positive signed int32; BIGINT audit id decimal string; strict objects recursively reject unknown keys (400 invalid_body), strict query (400 invalid_query). Timestamps ISO UTC Z; source DATE YYYY-MM-DD; UI Guatemala UTC-6. Text trimmed nonempty and maximum source VARCHAR length, TEXT max 10000; request strings cannot contain NUL. Source domain enums/ranges in `entities.json` are normative, except explicitly retained baseline enums/widths in API.md/C4 prevail for already existing fields. Source projections below determine exactly writable fields; server derives PK, principal institution, timestamp, actor, state and route parent. Optional source fields accept null; no implicit mass assignment. No body can set `id_institucion`, role, calculated monetary fields or creator except explicit administrator role operation. Parent id from route is authorized/scoped before use. All new mutation requests include `Idempotency-Key` 1..80 chars, replay same operation/hash returns stored response, different payload =>409 conflict; stored atomically in same target store. expected_revision where stated is nonnegative integer in body; stale=>409 conflict.

GET responses 200; creates POST 201; commands POST 200; password change/logout204; malformed400; no principal401 missing_bearer/invalid_token; wrong operation role403 forbidden; missing/foreign resource404 not_found; invalid domain422 invalid_bundle/reference_not_found; state/duplicate/stock/overpay409 conflict; engine unavailable503 store_unavailable; unexpected500 internal_error. Retain more specific baseline codes duplicate_document/guardian_required/invalid_guardians/expediente_archived/already_archived. No new ErrorCode is needed: extend Spanish safe messages by existing code, not new catalog entries. No driver/raw clinical body in logs.

`PageQuery={page?:number=1,page_size?:number=20<=50}`. `Page<T>={items:T[],page:number,page_size:number,total:number}`, stable id ascending unless per-op order specifies otherwise. `JsonValue` is only used for explicitly documented bounded discriminated result/plan/draft bodies, never an unrestricted request blob. Date/decimal/enum constraints must be enforced in Zod and domain as well as native SQL/document validators. Route methods below are not permission to add production routes in this architecture run.

## Exact request projection aliases
'''
for en,cols in projections.items(): types+=f'\n- `Input<{en}> = {shape(en,cols.split())}`. Parent, actor and generated fields are server-owned.\n'
types+='''
## Composite request / response aliases

```ts
// Specification only; shared/src/full/<module>.ts owns its relevant declarations.
type UsuarioAdminInput = {action:'create'|'update'|'deactivate'; id?:number; nombre_usuario?:string; correo?:string; id_profesional?:number|null; rol?:string; estado?:'activo'|'bloqueado'|'inactivo';vinculo_paciente?:{id_paciente:number};vinculo_profesional?:{id_profesional:number}};
// create requires nombre_usuario,correo,rol; update requires id and >=1 changed field;
// create yields generated temporary password once alongside UsuarioPublico, never persistent cleartext.
type UsuarioAdminResult = {usuario:UsuarioPublico;temporal?:string}; // temporary only for create/reset response, never subsequent reads
type UsuarioPublico = {id_usuario:number;id_institucion:number;id_profesional:number|null;nombre_usuario:string;correo:string;rol:string;estado:string};
type AuditQuery = PageQuery & {desde?:string;hasta?:string;entidad?:string;id_registro?:string;id_usuario?:number};
type BitacoraSafe = {id_bitacora:string;id_usuario:number;entidad:string;id_registro:string;accion:string;fecha_hora:string;detalle:{campos:string[];op:number;resultado:string}};
type PacientePatch = Partial<Omit<RegisterPacienteRequest,'responsables'>>; // >=1 field, retain baseline validation
// Input envelope for existing baseline patient fields remains unchanged.
type FichaCompleta = {paciente:PacienteDto;expediente:ExpedienteDto;alergias:ALERGIA[];antecedentes:ANTECEDENTE[];contactos:CONTACTO_EMERGENCIA[]};
type HistoryEvent = {tipo:'consulta'|'documento'|'admision'|'nota'|'procedimiento'|'perinatal'|'medicion'|'vacuna'|'hito'|'examen'|'odontograma'|'plan'|'sesion';id:number;fecha_hora:string;datos:TypedHistoryPayload};
// TypedHistoryPayload is a closed discriminated union of the corresponding entity DTOs, never `any`.
type Slot = {id_profesional:number;inicio:string;fin:string};
type OpenConsultaInput = {id_profesional:number;id_cita?:number|null;tipo:'primera_vez'|'seguimiento'|'emergencia';motivo_consulta:string;fecha_hora_inicio:string};
type FullConsultaDto = Omit<ConsultaDto,'estado'|'tipo'> & {estado:'abierta'|'cerrada'|'anulada';tipo:'primera_vez'|'seguimiento'|'emergencia'};
type ConsultaDraft = {consulta:FullConsultaDto;revision:number;diagnosticos:DiagnosticoInput[];tratamientos:TratamientoInput[];receta:CloseConsultaRequest['receta']|null};
// Additive FullConsultaDto permits abierta/anulada and nullable fin; baseline ConsultaDto is not narrowed/rewritten.
type ActRef = {id_consulta?:number;id_procedimiento?:number}; // exactly one
// Nested bundle writes happen in a single local UoW, no outbound HTTP callback.
type ProcedimientoBundle = {id_admision?:number;id_consulta?:number;codigo_procedimiento:string;id_profesional:number;fecha_hora:string;sala?:string;hallazgos?:string;complicaciones?:string;equipo:Input<PARTICIPACION>[];consumos:Input<CONSUMO_INSUMO>[]};
type MedicionInput = {fecha_medicion:string;peso_kg:number;talla_cm:number;perimetro_cefalico_cm?:number};
type DosisSchedule = DOSIS_VACUNA & {atrasada:boolean;version_esquema:string};
type DosisPendiente = DosisSchedule & {id_paciente:number;nombre:string;telefono:string|null};
type LabOrderInput = {id_paciente:number;institucion_origen:number;medico_solicitante:string;prioridad:'rutina'|'urgente';examenes:string[];observaciones?:string;referencia_externa?:string};
// `institucion_origen` is a referral descriptor ONLY, NOT storage routing; explicit referral policy validates origin.
type ResultadoInput = {codigo_examen:string;id_muestra:number;datos:ResultadoDatos;observaciones?:string};
type ResultadoFlags = {id_resultado:number;analitos:{nombre:string;valor:number;unidad:string;min:number;max:number;fuera_rango:boolean;referencia_version:string}[]};
type LabHistory = {orden:ORDEN_EXAMEN;muestras:MUESTRA[];resultados:RESULTADO[]};
type PiezaPatch = {estado:'sana'|'caries'|'obturada'|'ausente'|'corona'|'implante'|'endodoncia';superficies:Partial<Record<'mesial'|'distal'|'vestibular'|'lingual'|'oclusal','sana'|'caries'|'obturada'|'corona'|'endodoncia'>>;movilidad:0|1|2|3;observacion?:string;expected_revision:number};
type PlanInput = {id_profesional:number;detalle:{linea:number;numero_pieza:number;codigo_procedimiento:string;orden:number;precio_unitario:string}[]};
// Every price checked against snapshot reference catalog, not accepted as arbitrary client price. Max100 unique line ids.
type SesionInput = {id_cita?:number;fecha:string;lineas:number[];anestesia_utilizada?:string;observaciones?:string;expected_revision:number};
type DentalBalance = {presupuesto:string;ejecutado:string;facturado:string;pagado:string;pendiente:string};
type PersonalInput = {action:'create'|'update'|'deactivate';id_profesional?:number;nombres?:string;apellidos?:string;id_especialidad?:number|null;numero_colegiado?:string|null;telefono?:string|null;correo?:string|null;id_tipo_personal?:number;modalidad_contrato?:'planilla'|'honorarios'|'externo';fecha_ingreso?:string};
// create requires names, category, contract and start; other actions require id; locked B profesional stays unchanged.
type PersonalDto = {profesional:PROFESIONAL;contrato:PROFESIONAL_CONTRATO};
type Liquidacion = {id_profesional:number;periodo:string;actos:{id_participacion:number;codigo_rol:string;honorario:string}[];total:string};
type CargoInput = {id_paciente:number;codigo_servicio:string;origen:'manual'|'consulta'|'procedimiento'|'estancia'|'insumo'|'honorario'|'examen';id_consulta?:number;id_procedimiento?:number;id_admision?:number;id_consumo?:number;id_participacion?:number;cantidad:string;clave_evento:string};
// Nonmanual origin only internal application writer, HTTP accepts manual. Unit price/description derived from tariff.
type CargoCaja = {id_cargo:number;descripcion:string;cantidad:string;precio_unitario:string;subtotal:string;estado:string};
type InvoicePreview = {cargos:CargoCaja[];subtotal:string;impuesto:string;total:string;preview_hash:string};
type FacturaInput = {cargo_ids:number[];serie:string;nombre_receptor:string;nit_receptor:string;descuento?:string;cobertura_seguro?:string;preview_hash:string};
type PagoInput = {monto:string;metodo:'efectivo'|'tarjeta'|'transferencia'|'seguro';referencia?:string};
type FacturaCompleta = {factura:FACTURA;lineas:DETALLE_FACTURA[];pagos:PAGO[]}; // Caja DTO excludes clinical FKs; original entity remains native storage only.
type EstadoCuenta = {facturas:FacturaCompleta[];total:string;pagado:string;saldo:string};
type CierreCaja = {fecha:string;por_metodo:{metodo:string;monto:string;anulado:string}[];total:string};
```

Lab result discriminated payload (`tipo` must equal catalog exam type):
- hematologia: numeric hemoglobina,hematocrito,leucocitos,plaquetas,eritrocitos,VCM,HCM; `diferencial` numeric neutrofilos,linfocitos,monocitos,eosinofilos,basofilos, each0..100 and sum100±0.1.
- orina: strings color,aspecto; numeric densidad,pH(0..14); boolean proteinas,glucosa,cetonas,nitritos; `sedimento` strings leucocitos,eritrocitos,celulas_epiteliales,bacterias,cristales.
- cultivo: microorganismo:string,recuento_colonias:number>=0,tipo_medio:string,antibiograma array1..100 of {antibiotico:string,sensibilidad:'sensible'|'intermedio'|'resistente',cmi:number>=0}; antibiotic unique.
- quimica: analitos array1..100 of {nombre:string,valor:number,unidad:string}; names unique and configured for exam. Negative only if reference/catalog expressly allows, otherwise >=0.
- serologia: analytes array1..100 of {nombre:string,resultado:'positivo'|'negativo'|'indeterminado',valor?:number,unidad?:string}; numeric values require matching reference. This shape is a declared delta design because source lists serologia type without its fields.
All numbers finite. No unknown exam/analytical key. Result snapshot holds flag+reference values for every numeric analyte; missing quantitative reference fails422 instead of fake-normal. Qualitative entries explicitly not numeric-range evaluated.
'''
for op in ops:
 types+=f"\n## OP-{op['id']:02d} — {op['title']}\n- Source: [§10 L{op['source_line']}](../source/analisis-y-modelo-relacional.md#L{op['source_line']}); Inst. **{op['institutions']}**. Owner module `{opmod[op['id']]}`.\n- `{op['method']} {op['path']}`; request `{op['request']}`; response `{op['response']}`; status policy above (baseline endpoints unchanged).\n- Named domain error `{op['error']}` plus common401/403/404/400/503; all failures leave state unchanged.\n- {op['rules']}\n"
(F/'contracts/TYPES-API.md').write_text(types)
entities.pop('TIPO_PERSO',None)
# Additive operational metadata explicitly distinguished from source fields.
extra={
'USUARIO':{'debe_cambiar_contrasena':('BOOLEAN',True),'auth_version':('INT',True)},
'CITA':{'revision':('INT',True)},'CONSULTA':{'revision':('INT',True)},
'CARGO':{'clave_evento':('VARCHAR(80)',True),'motivo_disposicion':('VARCHAR(300)',False)},
'RESULTADO':{'referencias_snapshot':('JSON',True),'revision':('INT',True)},
'PLAN_TRATAMIENTO':{'revision':('INT',True)},'PIEZA_DENTAL':{'revision':('INT',True)},
'ORDEN_EXAMEN':{'examenes':('JSON',True)},'BITACORA':{'id_institucion':('INT',True)},
}
# These additions are generated in module migrations, not silently presented as original source.
(F/'contracts/schema-additions.json').write_text(json.dumps(extra,indent=2)+'\n')
(F/'contracts/entities.json').write_text(json.dumps(entities,ensure_ascii=False,indent=2)+'\n')
schema='''# F3 — Physical schema/document amendment

## Precedence and migration algorithm (no schema reset)
`entities.json` is exact typed field inventory: source SQL attributes (§5/§7.4/§7.5), explicit lab/dental document schemas (§5.4/§5.5) and explicitly labeled additive tables. `schema-additions.json` is additional infrastructure metadata, not claimed source. Retain existing C4/C5 widths/enum spellings for existing tables; do not shrink, rename or recreate them. Reference source capture is pinned at 2fa2c1579658ce64d9be2f80458268aeeaf70b06, full text/hash in SOURCE-EVIDENCE.md.

Each engine module migration owns only its tables listed below and additions named for it. PostgreSQL16/MySQL8.4 exact DDL templates below are the source of new tables. Read `information_schema` for already present tables; validate expected columns and fail on unknown drift instead of silently deleting columns. New migrations sequential once-only by migration ledger primary key. Driver selects only its engine migrations, stable module number prefix. Later FULL-RELATIONS adds explicit source FKs/constraints after referenced tables exist; it may not enable a module for demo until its constraints pass. Normal module tests still enforce scoped reference prechecks and transactions before final FK wiring.

- Source TIMESTAMP→PG TIMESTAMPTZ/MySQL DATETIME(3) UTC; INT→INTEGER, SMALLINT→SMALLINT, BIGINT→BIGINT, BOOLEAN→BOOLEAN, DATE→DATE, DECIMAL(p,s)→NUMERIC(p,s)/DECIMAL(p,s), JSON/TEXT→JSONB/JSON, VARCHAR/CHAR retain source width. Integer PK alone with source Autoincremental→GENERATED BY DEFAULT AS IDENTITY/AUTO_INCREMENT; no autoincrement on foreign shared PK/composite keys. No clinical cascade delete. New tables add `id_institucion INTEGER NOT NULL` unless present, including scoped catalogs. Sole physical identity users/sessions/roles remain Hospital PG, never duplicated as credentials in other stores. Clinical actor foreign ids elsewhere are validated through an identity reference port before clinical transaction, stored immutable numeric actor references (not cross-engine FK).
- New child tables PK is `(id_institucion,<source PK columns>)`; new generated integer ids still globally allocate per engine and get supporting UNIQUE(id) for MySQL auto increment. Source composite keys preserved. Parent lookup always principal scope and joins, including FKs. Source keys UK/UK* are enforced by explicit list below, not mistakenly treated as independent UNIQUE per marked column.
- New `schema-additions` NOT NULL columns on existing tables backfill deterministically: revision=0, auth_version=0, debe_cambiar_contrasena=false, id_institucion from parent/actor, referencias_snapshot=[], examenes from order item catalog, clave_evento='legacy:'+id_cargo. Verify uniqueness before adding constraint. No fixture-default value is silently applied to new live requests.
- Mongo collections names are lowercase source entity names scoped with `id_institucion`; `_id` is `${institution}:${source composite key}`. Preserve baseline bounded consultation embed. New histories/notes/results/measurements/sessions/payments are separate documents, never push unbounded patient arrays. Every collection validator `{bsonType:'object',required:[all required fields],properties:{...}}`: INT/SMALLINT int; BIGINT long with safe decimal-string wire; BOOLEAN bool; DATE ISO YYYY-MM-DD string/TIMESTAMP BSON date (preserve C5); VARCHAR string+maxLength; DECIMAL Decimal128 for prices, double for measurements, JSON bounded strict nested schemas from F2. `additionalProperties:false` except `_id` and documented `_rev`. Derive same unique indexes with institution prefix; source clinical parents validated in same Mongo transaction. Result encrypted `datos` is BinData plus explicit encrypted version metadata (FULL-SEC-MONGODB), not plaintext validator bypass. `referencias_snapshot` encrypted too if linked result details.
- Firestore `instituciones/{id}/<entity>/{source key}`, integer DTO ids allocated through baseline UoW counters. One document per entity/child composite key. Same strict field/type/bounds tests in backend, collection rules deny unauthorized shape/role/institution. New monetary DECIMAL is decimal-string exactly2 places, role factors exactly3; numeric measurements remain numbers. Never store JS floating-money. Size guard ≤700KiB per new payload, max500 native writes transaction; cap plan lines100, result analytes100, invoice lines100. Chunking cannot weaken atomic graded operations: reject oversized422 before writes. Rules tests use client SDK, backend Admin scoping tested independently.
- SQL JSON fields limited to documented draft/result/plan/outbox data, not replacing normalized core SQL with arbitrary documents. SQL financial tables normalized. Firestore plan detail is bounded embed (<=100 lines), dental surface map bounded5; session history reference. Mongo lab result variable `datos` is intentional bounded embed.

## Exact new-table DDL rendering template
For each table assigned to a module and absent from baseline C4, render:
```
CREATE TABLE <lowercase entity> (
  id_institucion INTEGER NOT NULL,
  <field> <mapped type> <NOT NULL iff required> <generated clause iff eligible>, ...,
  PRIMARY KEY (id_institucion,<source PK columns>),
  UNIQUE (<generated integer id>) -- only if used for MySQL AUTO_INCREMENT
);
```
If entity already has id_institucion, emit it once. Foreign-shared PKs aren't generated. Mandatory actor/time fields server-derived from scoped context. Apply listed FK/index/check constraints after full schema creation; required production module availability is gated on them. Table-by-table exact field lines follow so implementer does not choose types.

## Required uniqueness / referential constraints and native tests
- Contact principal: PG partial unique `(institution,id_paciente) WHERE es_principal`; MySQL generated `principal_paciente=CASE WHEN es_principal THEN id_paciente ELSE NULL END` unique(institution,principal_paciente); Mongo partialFilterExpression es_principal:true; Firestore principal reservation in patient transaction. Registration guardians retain baseline exactly-one invariant.
- Allergy unique institution+expediente+upper(trim(sustancia)); SQL stores `sustancia_normalizada VARCHAR(120)` as additive metadata. Mongo unique normalized key; Firestore reservation. Existing source sustancia spelling retained.
- Appointment unique institution+professional+active interval reservation: serialize all writes on professional/day lock row/doc, query overlap `start < newEnd AND end > newStart`; lock both days ordered for reschedule. Add `agenda_lock(id_institucion INT,id_profesional INT,fecha DATE,PRIMARY KEY(...))` to agenda migration. Old cancelled record remains; no unconditional unique original slot blocks reuse.
- Consulta C4 constraints demanding closed/non-null fin/null cita must be replaced narrowly with named full-state checks. PG identify only matching constraint definitions on consulta via pg_constraint; MySQL information_schema CHECK_CONSTRAINTS. Keep start/end, FK and all other checks; DROP only exact old closed-only/null-cita rules documented C4 lines71–75. Set fin nullable; add cita FK after agenda. Full-state CHECK: abierta=>fin null; cerrada=>fin>=inicio; anulada permits prior fin. Add FullConsultaDto instead of changing baseline DTO. Baseline closed shortcut still returns original shape.
- Source FK every `#`/arrow in source inventory, except locked B omitted professional fields and actor IDs across stores. Match institution with composite parent key; add parent UNIQUE(institution,id) when needed. FK RESTRICT on delete, CASCADE on key update per source §7.6, but application never updates PK. Note predecessor must share admission; diagnosis ingreso/egreso belongs same expediente. Procedure anchor exactly one nonnull. Participation exactly one consulta/procedimiento and unique `(institution,professional,role,act_kind,act_id)` generated normalized key. Consumo max one anchor. Cargo max one origin, unique institution+clave_evento. Never map nullable source composite columns to one unconstrained NULL-allowing uniqueness.
- Hospital active admission partial unique institution+expediente and institution+cama; MySQL not required because original MySQL schema excludes hospital module. Bed/record row locks retained. Evolution note self reference must not cross admission.
- Tariff unique institution+professional+service+vigente_desde with nonoverlap lock on professional/service. Honorario snapshot immutable once computed, factor0..1; normal prices>=0 except service public >0; stock integer>=0; consumption>0 and integer because stock source INT.
- Vaccines unique institution+expediente+vaccine+dose; dose1..dosis_totales and date/lot/professional required applied. Anthropometric one per consulta (source UK*), no future/pre-birth measurement, head circumference required age<=36months, version reference nonempty.
- Lab barcode unique institution+codigo_barras; external order unique institution+origin+reference when not null; order items unique order+exam; current result unique order+exam; chosen reference intervals nonoverlap at same sex/analito. Rectifications create version records, not overwrite validated data; rectification API not in OP catalog but immutable storage needed if later used.
- FDI composite chart+tooth; plan line unique index, session completion claims unique plan+line in same transaction; prices/total snapshots retain2 decimals.
- Invoice unique institution+serie+numero and unique institution+id_cargo in all lines; transactional correlativo row/doc read+increment rolls back on failure, NOT SQL sequence/AUTO_INCREMENT for fiscal numero. Invoice PK can have gaps, fiscal number cannot. Consumed annulled invoice number never reused. Money decimal strings parsed into integer minor units for arithmetic, native DECIMAL storage. Payment>0, <=locked balance; annulled rejects payments. Preview hash checked against current price/state; no client total accepted. All listed races have dedicated contract tests.

'''
for idx,(slug,ns,eng,roles,tables,deps) in enumerate(MODS,1):
 schema+=f'\n## Schema owner {idx:02d} `{slug}` — stores {", ".join(eng)}\n'
 for en in tables:
  if en not in entities:
   schema+=f'\n`{en}`: baseline C4 auth_session; no duplicate table.\n';continue
  schema+=f'\n### {en}\n|Column|SQL/source type|Required|Key|Source line|\n|---|---|---|---|---|\n'
  for n,v in entities[en].items():schema+=f"|{n}|{v['type']}|{v['required']}|{v['key']}|{v['source_line'] or 'delta ADR'}|\n"
(F/'contracts/SCHEMA.md').write_text(schema)
ports='''# F1 — Extension ports, ownership and composition

## Freeze and dependency rules
P2-01 (#17 head20417c8951c8466a66691cdca008e415e5ce1067) and P2-02..06 core DTOs/signatures/17 cases are not rewritten by this amendment. P2-06 is required green before FULL-FOUNDATION or any feature lane. P2-09 auth extraction/P3A-05 identity remain dependencies for live identity. Baseline engine tickets remain required. FULL specs supersede only MVP exclusions and explicitly listed restrictions. `reactivate_route_absent` old C3.5 is an obsolete *scope* assertion, not one of frozen17 behavioral cases: explicit protocol-change supersedes it with OP19 tests; don't stealth-delete/relabel test. New operation routes are additive, baseline closed shortcut remains callable and consistent.

## Port shapes (specification, no app implementation here)
Each module file `server/src/ports/full/<module>.ts` defines a narrow `<PascalModule>RepositoryPort` with named methods `opNN(input:OpNNRequest,context:OperationContext):Promise<OpNNResponse>` for its listed operations. Operations already implemented by baseline call the existing named use case/port rather than copying its logic. OpNNRequest/Response are exact F2 aliases and operation entries. A request is an explicit envelope `{params:RouteParamsNN;query:QueryNN;body:BodyNN}`: parameters named in the route are positive numeric ids (FDI numero enumerated valid tooth), GET table request alias goes in query, all non-GET table aliases in body; absent params/query/body use strict empty object. Body does not redundantly accept route parent ids. This prevents losing patient/consultation id when passing a projected body to the port. For OP01/02 use existing pre-principal AuthPort boundary rather than inventing an authenticated actor; login institution comes only from existing LoginRequestDto validated kind. Other requests derive actor server-side. This fixed opNN naming is an explicit mechanical dispatch convention, NOT guessing domain semantics from an id. Implementation may wrap with semantic function name, but exported contract and tests remain stable.

`OperationContext={id_institucion:InstitutionId;id_usuario:number;id_profesional:number|null;roles:readonly string[];permissions:readonly string[];idempotency_key?:string;now:string}` is server-derived, never raw body. `FullContext={base:ClinicalContext;modules:FullModulePorts;unitOfWork:UnitOfWorkPort;clock:ClockPort;ids:IdPort}`. FullModulePorts is a typed record of the 26 module port interfaces; foundation owns declaration at `server/src/ports/full/context.ts`, with type-only imports from per-module paths. Do not use `any`, runtime `Record<string,unknown>` business APIs or domain imports from config.

`register<PascalModule>Routes(app:FastifyInstance,deps:{contextFor:(principal)=>FullContext;authorize:AuthorizePort})` in module HTTP plugin; `Full<PascalModule>Page` in module UI file has props `{api:FullApiClient;params:Record<string,string>;principal:AuthPrincipalDto}`. User input validated before business write, principal before lookup. API client routes exact F2. Each module exports `manifest={slug,paths,roles,Page}`; central UI router consumes manifest list, only FULL-WIRE writes App/router/nav/global CSS. Module tests mount standalone page/HTTP plugin until wire ticket. Thus feature tests run without shared registration collisions.

## FullHarness exact test contract
`FullHarness={context:FullContext;actor:OperationContext;reset():Promise<void>;counts():Promise<Record<string,number>>;nativeSnapshot():Promise<Record<string,string>>;failAfterWrite(n:number):void;otherInstitution():Promise<FullHarness>;close():Promise<void>}`. Snapshot values are canonical hashes of native rows/documents, never patient payload; failAfterWrite constructor-only injection. Module contract exports `moduleContract(name:string,make:()=>Promise<FullHarness>,ops:readonly number[]):void`, test case names stable from F4. Nonlisted operations cannot be skipped when its engine advertises the module; ops list only separates already assigned serial PR chunks.

## Application/domain, data engine division
`server/src/application/full/<module>.ts` exports pure orchestration `executeOpNN(context,input,actor)`, calls scope/role checks, validates shared invariants and invokes local UoW. Domain rules in `server/src/domain/full/<module>.ts`; no driver/config imports. Engine implementations own persistence and locks only, never fork calculation, WHO curve, tooth, billing/tax, role or state business rules. All current common methods run identical core tests against memory/Postgres/MySQL/Mongo/Firestore. Specialized original Inst operations run native assigned engine plus memory contract; no manufactured hospital tables in MySQL (source §7.5 excludes them). Additional cross-engine specialty demos would be a separate design decision, not an implicit scope claim.

Cross-module atomic calls join same UnitOfWork: consultation.close→charges.generate; procedure→participation+inventory+charges; admission.exit→charges; vaccine.apply→schedule; invoice.issue→charges+counter; payment/annul→invoice+ledger. No nested commit. Catalog/reference lookups inside transaction for mutable clinical/financial refs; identity actor verified before local UoW (not distributed ACID).

The same-instance full adapter factory returns local module ports sharing existing engine pool/session/UoW. New extension adapters receive engine-local transaction executor internally; it never escapes into application types. `server/src/adapters/<engine>/full/index.ts` is owned solely by FULL-WIRE. Feature adapters do not edit baseline index/factory/composition. Native repository construction cannot open a second unrelated pool when called inside baseline UoW.

## Memory extension
FULL-FOUNDATION owns one additive `extensions` map on baseline memory transaction state and a register-once extension factory, cloned/published/rolled back with existing patient/consultation maps. Module memory adapter uses its namespaced maps injected from that shared transaction. No separate per-module mutex that lets half of consultation+charge commit. Register extension maps before first request; duplicate slug fails startup. Existing17 run unmodified after this change.

## File ownership and handoff (one writer)
- Foundation: shared/package.json export map, shared/src/index.ts only if needed, ports/full/context.ts, memory full state/UoW extension; serialized after P2-06.
- Every module: only own `shared/src/full/<slug>.ts`, domain/application/ports/full/<slug>.ts, adapters/http/full/<slug>.ts, adapters/<engine>/full/<slug>.ts, web/src/full/<slug>/**, own tests/migrations/fixtures/docs fragments. Within a module, core/persistence/UI chunks ordered serially for the same file. Different modules may run in parallel after declared dependencies.
- FULL-WIRE agent is SOLE writer of server config/composition, existing http/app.ts, adapters/*/index.ts + */full/index.ts, web/src/App.tsx and session/navigation/global styles, shared context import table after initial foundation, package scripts/lockfile, server+web test configs, playwright config, .github/workflows/ci.yml, scripts/validate.sh, docs/gate-checklist.md, docs/ARCHITECTURE.md, docs/progress/TASKS.md, poteto tracker/NOW, docs/plan/E2-EXECUTABLE.md, final Spanish note. Baseline owners finish old tickets touching these files first, then hand a recorded lock to FULL-WIRE. Never concurrent edits or last-writer-wins trackers.
- Per-ticket gate/ADR fragments are `docs/plan/full-system/fragments/<ticket-id>.gate.md` and `<ticket-id>.decisions.md`; ticket-id lowercase, each file has exactly one owner; module journals unique by ticket. Integrator folds fragments into shared docs. Tests add no package dependencies; any needed package (multipart, chart-free SVG, encryption native bindings) goes via dedicated dependency/setup ticket with lockfile owner.
- Physical engine security policy files are owned by corresponding FULL-SEC engine agent only; module migrations never grant broad runtime permissions.

## P2-02 red-spec acceptance correction — proposed gate interpretation
Existing local ticket P2-02 §Contracts correctly calls opt-in CONTRACT_RED expected failing until06, but generic acceptance says all named cases pass. Replace only that generic paragraph, not17 assertions: **baseline `npm test -w @genki/server` and validate.sh must exit0; explicit CONTRACT_RED=1 invocation must execute all17 assertions and exit nonzero on missing target methods/behavior, with actual failure list stored. No `.skip`, conditional return, dummy throw, test weakening or false green.** P2-03..05 may leave this opt-in red suite incomplete; P2-06 acceptance requires all17 pass, removes opt-in/discovery boundary and temporary casts, makes normal+full gate invoke it always. Missing packages, unstarted engine or discovery=0 are setup failures, not red evidence. This is an explicit specification-stage gate clarification requiring router/protocol review, NOT authority to bypass CI. Ticket P2-02 planning file contains this amendment notice; external repo unchanged.
'''
(F/'contracts/PORTS-LANES.md').write_text(ports)
# Every state transition gets distinct success/error e2e; shared common errors are included per OP.
trans='''# F4 — Statechart transition/e2e matrix

Exact future test path: `web/e2e/full/<module>.spec.ts`, one named test per row. Each test runs actual page action+HTTP status assertion against assigned physical engine; independently scoped fake fixture, no parallel shared identifiers. Mutations add failure-in-transaction test as below, not HTTP mock. Existing C3.4 17-case suite remains additional and unchanged. Read rows are self-loop transitions; asserts response matches actual native stored state, not only visible text. App starts with no memory fallback.

|OP|Transition/event|HTTP outcome|Named e2e|Owner module|
|---|---|---|---|---|
'''
for op in ops:
 for j,t in enumerate(op['transitions'],1):
  trans+=f"|OP-{op['id']:02d}|{t}; valid event|{204 if op['id'] in [2,3] else 201 if op['id'] in [8,10,13,15,16,17,21,26,35,36,37,39,41,48,49,50,55,57,59,61,63,66,68,73] else 200}|op{op['id']:02d}_transition_{j}_persists|{opmod[op['id']]}|\n"
 for name,status,code in [('domain',409 if op['error'] in ['conflict','duplicate_document','expediente_archived','already_archived'] else 422 if op['error'] in ['invalid_bundle','guardian_required','reference_not_found'] else 401 if op['error'] in ['invalid_credentials','invalid_token'] else 403 if op['error']=='forbidden' else 404 if op['error']=='not_found' else 400,op['error']),('schema',400,'invalid_body' if op['method']!='GET' else 'invalid_query'),('role',403,'forbidden'),('foreign',404,'not_found'),('store',503,'store_unavailable')]:
  if op['id'] in [1,2] and name in ['role','foreign']:continue
  trans+=f"|OP-{op['id']:02d}|any; {name} error keeps original state|{status} {code}|op{op['id']:02d}_error_{name}_unchanged|{opmod[op['id']]}|\n"
 if op['method'] not in ['GET'] and op['id'] not in [1,2,3,4,5]:
  trans+=f"|OP-{op['id']:02d}|valid state; injected native mid-write failure|500 internal_error; all writes rollback|op{op['id']:02d}_midwrite_rolls_back|{opmod[op['id']]}|\n"
trans+='''
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
'''
(F/'contracts/STATECHARTS.md').write_text(trans)
security='''# F5 — Security, clinical money and free local defaults

No real patient, payment, card, FEL provider, paid API, cloud hosting, upgrade or external contact. Four physical demo engines are local PostgreSQL16, MySQL8.4 community, authenticated Mongo replica set rs0 and Firestore emulator. Existing env-only credentials/PG identity/JWT claims/Argon2id/30m+14d timings retained. Source §9 is stricter than earlier MVP A5: native security evidence must not be reduced to institution routing.

## Role policy (not administrator-as-superuser)
Server refreshes identity role/status on every bearer use, authorizes both operation and response projection. Source admin cannot read clinical content; do NOT seed one administrador for every clinical action. Seed separate role accounts for each institution, passwords from env only. Reception/caja handles identity/agenda/billing, not clinical; enfermeria signs/vaccines/consumption, medico/odontologo clinical, laboratorista lab results, almacen inventory, recursos_humanos professional/contracts/honoraria, auditor safe ledger/audit. Administrator users/reset/reactivate/archive administration but no restricted ficha. `cargo.autorizar` and `factura.anular` extra role-permission entries assigned caja supervisor test account, not unrestricted default. `resultado.validar` only qualified profesional with laboratorista/medico role assigned by admin; ordinary lab data-entry account cannot approve. Patient/responsable viewer requires explicit own patient mapping, not numeric user=id_patient coincidence. Until mapping exists no public patient role is granted. This does not defer OP42/76: clinical/recepcion authorized paths remain functional; source optional patient access gets explicit mapping at FULL-SECURITY-INTEGRATION.

## Native enforcement by engine (dedicated security tickets)
- PostgreSQL: roles rol_recepcion,rol_medico,rol_caja,rol_admin,rol_auditor plus identity/migration role. Real GRANT by table/column; safe billing view no clinical origin FKs or detailed clinical descriptions. RLS FORCE on institution tables with current_setting('app.institution_id',true), SET LOCAL per UoW. Driver role allowlist from principal, never user SQL role string. Runtime not table owner/BYPASSRLS. pgcrypto restricted-note content via pgp_sym_encrypt/decrypt with env key; key never SQL logging/args in evidence. Migrations enable extension with local migration owner. Native role permission denial tests, column projections and cross-tenant RLS tests with same physical connection pool reuse.
- MySQL8.4 community: SQL roles, explicit table/column grants, safe views SQL SECURITY DEFINER owned by nonlogin restricted owner; runtime cannot access underlying restricted columns. Institution scoped repository and per-institution credentials (no native RLS claim). Free local file-keyring component/tablespace encryption: mount local keyring file outside repo, component_keyring_file startup manifest/config with path on local protected mount, innodb_file_per_table=ON, create restricted tables ENCRYPTION='Y'. Probe component and information_schema encryption metadata; a binary lacking keyring is factual setup blocker, not silently passing encryption. No paid managed MySQL fallback.
- Mongo: scoped collection RBAC app/report+safe projection views, native access denial. Use explicit CSFLE with local master key via mongodb-client-encryption/libmongocrypt community; encrypt RESULTADO.datos and reference snapshot before writes, decrypt only authorized app path, local key vault protected; no Enterprise automatic query encryption, Atlas or paid KMS. Native physical read proves ciphertext BinData; domain receives typed clear values. Protect integrity values/hash, do not print ciphertext or key in journal.
- Firestore: deny-by-default per institution/role collection rules, real emulator client SDK tests; backend Admin SDK bypass independently scoped/authorized. Do not claim emulator reproduces production IAM or encryption-at-rest. JWT app remains existing HS256, rules test Firebase client auth uses synthetic test tokens only; no replacement of identity SoR. Local demo emulator data restricted to synthetic fixtures.

## Audit and local files
BITACORA records restricted reads and writes with actor/institution/entity/id/action/time, never before/after clinical text or password/token. SQL/doc local write audit joins same native transaction. Restricted read emits no DTO unless audit append succeeds; attach per-module audit port so users/audit PG isn't a cross-engine distributed write. Local clinical audit rows live in clinical engine; central OP06 uses scoped per-engine readers and identity audit PG. No best-effort drop; read error=>503. Login/logout/password events go to identity audit in PG; logout server time persisted even idempotent repeat (single exit event/session jti_hash). Audit endpoint never returns IP/secret/full before/after payload. Local attachments stored protected local volume keyed by generated ids, not web public path; stream MIME/magic/hash+authorized read, traversal and symlink rejection, fake uploads only. Temp upload commit/outbox reconciliation handles crash between filesystem rename and DB commit; never claim file+DB has distributed ACID.

## Monetary rules frozen for academic system
Currency GTQ. New money wire strings regex `^(0|[1-9][0-9]{0,7})\\.[0-9]{2}$`, minor-unit integer arithmetic (BigInt if product overflow), round half-up to cent per line. Quantity positive2-decimal except consumption source stock INT requires integer. `subtotal_linea=round(qty*unit_price)`; invoice subtotal=sum line; discount <=subtotal allocated proportionally to lines using largest-remainder cents, tie line order; IVA12% of discounted taxable lines, round half-up; total=subtotal-discount+IVA; coverage0..total; saldo=total-coverage-nonannulledpayments. Immutable line prices/descriptions snapshots. No external tax validation/FEL, authorizacion_fel=null labeled factura académica no fiscal. Honorarium fixed or service base*percentage/100 then role factor0..1; snapshot once at act time. Invoice atomic counter not sequence, parallel issues unique and no gaps among successful commits. All payment methods simulated receipts, never PAN/CVV/provider integrations. OP75 ledger annulment is NOT a real refund.

## Factual data gates (no fabricated clinical reference)
WHO LMS tables and dose interval catalog are absent from source. Growth ticket must acquire free official WHO2006 male/female weight-for-age, length/height-for-age and head-circumference-for-age LMS0..60 months tables, record source URL/license/version/SHA256 and check known independent values before use. Source says reference OMS but provides no values; `reference_not_found`422 is honest runtime error while fixture outside available ages, not an implementation success for missing graded data. Do not fabricate normal curves. Vaccine source gives age first dose and total only: actual intervals must be pinned from free Guatemala MSPAS official schedule, distinguish academic seeded demonstrator schedule from medical guidance. Lab reference values source supplies fields not actual ranges; use explicitly labeled synthetic range catalog for fake demo, not real patient normal ranges. These data acquisition tasks run early off critical coding files. Failure to acquire is a visible graded-feature blocker; it is not an automatic deferral/cut.
'''
(F/'contracts/SECURITY-FREE.md').write_text(security)
adr='''# DECISIONS — Full-system amendment (2026-11-07, America/Guatemala UTC-6)

Architecture recommendations under Carlos's relayed overnight delegation (Nov7 23:19GT, t392u). This local document is NOT an external approval claim or authorization to publish/merge. Router owns protocol-change acceptance, independent gate+CI unchanged. No new human questions.

|ADR|Decision / status|Why / evidence|Rejected alternatives|
|---|---|---|---|
|FS-001|Recommended full OP01..77, no MVP specialty exclusions; supersedes A1 scope and A10 specialty deferral|Carlos's relayed full-system clarification; original source §10 exactly77|Retain14-op MVP; stubs; cosmetic documentation instead of functional slices|
|FS-002|Keep P2 core and17 C3.4 cases, additive modules after06|#17 DTO baseline ready, P2-02..06 not started; avoid thrash|Rewrite whole app/core contracts; change assertions to fit driver|
|FS-003|Interpret original Inst column as production capability map; common ops four stores, specialties on assigned engine; recommend router confirm interpretation against §10 introductory equivalence sentence|§7.5 explicitly excludes hospital from MySQL; OP35 H only, OP41 P only, OP50 L only, OP55 O only; contradiction in source if read as308 production operations|Invent 308 features and hospital MySQL tables; hide ambiguity as certainty|
|FS-004|Free local compose+Firestore emulator, no production assumption|A4 confirmed default; no-spend overnight rule|Real Firebase billing/project; paid DB/KMS/provider; deploy before local verification|
|FS-005|Durable open consultation/draft additive route, baseline atomic shortcut retained; close includes charge|OP26 starts record, §10.12 OP31 includes cargo absent in MVP; old closed-only SQL constraint insufficient|Browser-only draft as full OP26; partial normalized diagnosis commits; change basic DTO breaking17 cases|
|FS-006|Personnel contract/category separate1:1 table; retain locked PROFESIONAL B|Source§7.4 B omitted fields conflicts OP61/§6.5 honorary eligibility; sidecar preserves prohibition while enabling behavior|Add forbidden columns to profesional; assume all staff generates honoraria|
|FS-007|PG identity unchanged claims; password temporary reset must-change field+revoke sessions; per-request role/status re-read|A6/A12 baseline, OP03..06, source§9 role least-privilege|JWT claim redesign; password email; admin omnipotence; cloud identity migration|
|FS-008|Native atomic money/stock writes+idempotency, gapless fiscal counter; academic receipts only|Source§6.5 and§10.12, no paid services|SQL sequence fiscal numbering; floats; real FEL/bank/card processing|
|FS-009|Local outbox for H↔L referrals, explicit scoped patient mapping and delivery-only result|OP39/48/53 needs cross-engine link without distributed transaction; invariant C1 clinical isolation retained for all other ids|Cross-store naked numeric patient FK; pretend synchronous ACID; silently omit transfer|
|FS-010|Role policy source§9 overrides MVP demo-admin superuser; native security tickets and encryption|Earlier A5 minimal matrix insufficient for full original system; source admin explicitly cannot read clinical data|Route-only authorization; Admin-SDK rules-only claim; paid Mongo Enterprise/KMS|
|FS-011|Official WHO/schedule acquisition early, verified source/hash, no synthetic medical reference labeled official|Source lacks tables, values are factual data not designer choice|Fake LMS/percentiles; defer graded growth/vaccination silently|
|FS-012|One shared-file integrator; module fragments aggregate only at integration|26 modules with parallel lanes; existing tickets share router/CI trackers|Concurrent edits global files, multiple PRs each updating NOW/gate/lockfile|
|FS-013|P2-02 explicit expected-red specification gate, P2-06 mandatory green removal|Existing ticket generic acceptance contradicts explicit red section; no assertion edits|Claim failing suite passed; skip tests; bypass CI; make protocol exception without router|
|FS-014|Invoice annulment cancels associated cargo and payments, retains fiscal number, no rebill of same cargo|Source§10.12 requires balance/payment reversal, unique cargo invoiced once|Delete invoice/payment; reuse correlativo; real refunds without authorization|

## High-risk changes router must gate (not a Carlos interruption)
FS-005 schema/state+atomic charge, FS-006 personnel sidecar, FS-007 auth/permissions, FS-008 money, FS-009 scoped cross-store referral and FS-010 native grants/encryption. Recommend adopt as explicit additive protocol-change pack after evidence/read review; do not label Carlos personally approved design details. Local plan ready does not imply CI or implementation gate passed. If protected two-owner review cannot be satisfied overnight, router records concrete blocked gate and can queue isolated work; no force merge or waived CI.

## Execution records
No app tests, migrations, engine startup, PR creation, message, merge, deployment or paid service action occurred in this architecture task. Static plan verification results in SELF-CHECK-FULL.md only. Future module ADR fragments append actual implementation evidence and any rejected alternative, then FULL-WIRE folds into repo DECISIONS.md. No completed status is prechecked.
'''
(ROOT/'DECISIONS.md').write_text(adr)
# Mechanical ticket assembly: each feature PR adds at most two operations on one layer/store.
BASE_ENG={'postgres':'E2-P3A-04','mysql':'E2-P3B-03','mongodb':'E2-P4A-03','firebase':'E2-P4B-04'}
chunks={slug:[ns[i:i+2] for i in range(0,len(ns),2)] for slug,allns,*_ in MODS for ns in [[n for n in allns if n not in [7,8,11,13]]]} # retained baseline ops don't get duplicate implementations
num={slug:f'{i:02d}' for i,(slug,*_) in enumerate(MODS,1)}
def tid(slug,layer,j=1):return f'FS-{num[slug]}-{layer}{j:02d}'
def last(slug,layer):return tid(slug,layer,len(chunks[slug]))
T=[]
def add(id,title,owner,deps,paths,steps,opsn=None,layer='integration',engine=None):
 T.append(dict(id=id,title=title,owner=owner,deps=list(dict.fromkeys(deps)),paths=paths,steps=steps,ops=opsn or [],layer=layer,engine=engine))
add('FS-FOUNDATION','Adopt additive module contracts without changing the core17','agent-foundation',['E2-P2-06'],[
'docs/plan/full-system/**','DECISIONS.md','shared/package.json','shared/src/full/schema.ts','server/src/ports/full/context.ts','server/src/adapters/memory/unit-of-work.ts','server/src/adapters/memory/full-state.ts','server/test/full/foundation.test.ts'],[
'Copy the supplied full-system contract/source/ticket pack byte-for-byte from the absolute local deliverable; preserve original C1–C5 and46 ids as history. Create per-module types/port declarations exactly F1/F2/F3, no throwing stub implementations or manufactured success.',
'Add shared ./full/* export pattern and explicit typed DTO declarations including FullConsultaDto; basic clinical/auth DTO types and locked claims unchanged. Capture type-equality regression tests for existing core DTOs/errors.',
'Extend memory snapshot state with namespaced extension maps joining same baseline UoW; test outer failure rolls back a successful base+module draft transaction. Do not change17 assertions.',
'Write adoption/ADR fragments; protocol-change remains router/gate-controlled. Only foundation touches listed core memory files before module lanes start.'])
add('FS-TOOLCHAIN','Install free local test/module harness with one lockfile writer','agent-wire',['FS-FOUNDATION','E2-P3A-01'],[
'package.json','package-lock.json','server/package.json','web/package.json','server/vitest.config.ts','web/playwright.config.ts','web/e2e/full/harness.ts','server/test/full/harness.ts','scripts/full-module-test-server.ts','scripts/pregate.sh','scripts/check-full-docs.mjs'],[
'Pin test/dependency-only additions in a separate first commit: @playwright/test1.56.1 (reuse C5), @axe-core/playwright4.10.2 and @fastify/multipart9.0.3 matching observed Fastify5.0.0; mongodb-client-encryption6.1.0 for existing mongodb6.10.0 explicit CSFLE. Verify package availability/integrity during setup, record blocker rather than silently upgrade. No paid tools or extra router/chart dependency; SVG growth chart.',
'Implement isolated module test host using allowlisted module slug, no production test endpoint/fault env. Missing engine must fail clear setup, never skip suite. Native fixtures disposable namespaces per worker; identifiers never shared between tests.',
'Add npm run pregate: lint/typecheck/docs guards, core17/domain/application tests, relevant full module matrix, Playwright parallel axe+contrast/Esc/focus375/768/1440. Before final integration scoped module invocation is honest partial gate; final FS-GATE mandates every module/store and no discovery escape.',
'Keep CI/global runtime wiring with same agent-wire owner; record actual red/green output, no setup failure counted as red.'])
add('FS-REFERENCE-DATA','Acquire and verify free official WHO/schedule data before growth is unblocked','agent-data',['FS-FOUNDATION'],[
'data/reference/who2006/manifest.json','data/reference/who2006/lms.csv','data/reference/vaccines/manifest.json','data/reference/vaccines/intervals.json','server/test/full/reference-data.test.ts','docs/plan/full-system/fragments/reference-data.decisions.md'],[
'Use official free WHO child growth standards download source https://www.who.int/tools/child-growth-standards/standards and MSPAS Guatemala official vaccination schedule publication, not a commercial API. Capture exact chosen document URL, version, license, SHA256, acquisition date and source data. This is factual retrieval, not permission for paid spend or patient outreach.',
'Normalize WHO LMS by sex/age-day/indicator and ensure full supported0..60month range; test known median=M =>z0 percentile50, nonzeroL and L0 formulas, independently quoted published example, sex boundaries and out-of-range422. Use LMS z=((x/M)^L-1)/(L*S), L=0 log(x/M)/S; percentile100*normalCDF(z), round snapshot2 decimals. Round-age nearest published day with documented tie floor, never interpolate raw clinical data as actual measurement.',
'Normalize actual per-dose vaccine intervals with version, known vaccine totals and chronological ages; prove source matches records. If official source is unavailable or license prohibits bundling, mark blocker with exact URL/error and free approved published alternative recommendation; do not synthesize official data or mark task complete.',
'Create test fixture synthetic lab ranges labeled SYNTHETIC-DEMO, not real medical reference; no production patients.'])
# Module layers: C common core+memory2ops, E per native store2ops, H HTTP/UI2ops.
for slug,allns,engines,roles,tables,mdeps in MODS:
 cs=chunks[slug]
 for j,ns in enumerate(cs,1):
  deps=['FS-FOUNDATION']+([tid(slug,'C',j-1)] if j>1 else [last(d,'C') for d in mdeps])
  if slug=='account':deps+=['E2-P2-09']
  if slug=='growth' and 41 in ns:deps+=['FS-REFERENCE-DATA']
  if slug=='vaccines':deps+=['FS-REFERENCE-DATA']
  paths=[f'shared/src/full/{slug}.ts',f'server/src/ports/full/{slug}.ts',f'server/src/domain/full/{slug}.ts',f'server/src/application/full/{slug}.ts',f'server/src/adapters/memory/full/{slug}.ts',f'server/test/full/{slug}.contract.ts',f'server/test/full/{slug}/memory.test.ts']
  add(tid(slug,'C',j),f'{slug}: engine-neutral use cases and memory OP'+','.join(f'{n:02d}' for n in ns),f'agent-{slug}-core',deps,paths,[
'Write exact F2 operation inputs/outputs tests first, names from F4. Export module contract function taking FullHarness; assertions not engine-specific. Baseline retained operations delegate existing application functions, never duplicate patient or clinical implementation.',
'Implement pure domain checks and named executeOpNN orchestration with narrow ports. Cross-module writes use supplied ports and join local native UoW. No driver/config import or external effect in transaction callback.',
'Implement memory map adapter against foundation extension snapshot; include mid-write, concurrent-race, scope, returned DTO mutation and immutable audit assertions. Preserve earlier chunk assertions; all memory tests for this module pass.',
'Write module gate/decision fragment; no global registry/router/index/CI/trackers changes.'],ns,'core')
 for engine in engines:
  code={'postgres':'PG','mysql':'MY','mongodb':'MO','firebase':'FS'}[engine]
  for j,ns in enumerate(cs,1):
   deps=[tid(slug,'C',j),BASE_ENG[engine],'FS-TOOLCHAIN']
   if j>1:deps+=[tid(slug,code,j-1)]
   # Existing shared core adapter must be available before module-native tests; feature deps take local engine when present.
   for d in mdeps:
    if engine in modmap[d][2]:deps.append(last(d,code))
   if slug=='account':deps+=['E2-P3A-05']
   paths=[f'server/src/adapters/{engine}/full/{slug}.ts',f'server/src/adapters/{engine}/migrations/full-{num[slug]}-{j:02d}-{slug}.'+('sql' if engine in ['postgres','mysql'] else 'ts'),f'server/test/full/{slug}/{engine}.test.ts',f'server/test/full/{slug}/{engine}-fixture.ts']
   add(tid(slug,code,j),f'{slug}: {engine} persistence OP'+','.join(f'{n:02d}' for n in ns),f'agent-{slug}-{engine}',deps,paths,[
'Before driver behavior, instantiate unchanged module contract with disposable native-store harness and run relevant named assertions red. The service must already be healthy; unavailable emulator is setup failure, never a passing or red behavioral test.',
f'Create or extend only module-owned {engine} tables/collections and exact columns from F3/entities. Baseline table additions only if specifically assigned this module. Migrations use ordered ledger; no DROP/truncate/reset of demo data. FK finalization FS-RELATIONS remains required before demo.',
'Implement only persistence methods for listed OPs; reuse baseline same scoped UoW/session/connection. Preserve scope checks and lock ordering. Native failure callback throws after actual successful write, then counts/hash/parent state show whole transaction rolled back.',
'Run module shared assertions unchanged, native metadata/permission tests and core17 regression where harness available; record actual physical read and zero writes in other stores. No memory fallback, engine-specific fork of domain rules, global config change or direct publication.'],ns,'engine',engine)
 for j,ns in enumerate(cs,1):
  deps=[tid(slug,'C',j),'FS-TOOLCHAIN']+([tid(slug,'H',j-1)] if j>1 else [])
  paths=[f'server/src/adapters/http/full/{slug}.ts',f'server/src/adapters/http/full/{slug}.test.ts',f'web/src/full/{slug}/Page.tsx',f'web/src/full/{slug}/api.ts',f'web/src/full/{slug}/module.css',f'web/e2e/full/{slug}.spec.ts']
  add(tid(slug,'H',j),f'{slug}: route/UI slice OP'+','.join(f'{n:02d}' for n in ns),f'agent-{slug}-ui',deps,paths,[
'Write module plugin HTTP tests and F4 Playwright tests first; mount standalone module test host, then implement. API tests use real memory transaction contract initially; physical e2e must run again after module engine dependencies and FULL-WIRE. Record which engine actually ran, never label memory proof as native.',
'Expose exact F2 paths/strict schemas/types/statuses, scoped actor and per-operation role mapping F5. Build Spanish labeled form/table/detail views for listed OPs with corresponding schema fields; native response drives UI, no hardcoded success or inaccessible controls. Emit manifest for central router owner, do not touch shared router.',
'Cover loading/empty/error/success and stale revision, disabled duplicate submit; confirm archive/annul/reset/payment actions, Escape/focus return. All tables/forms usable keyboard and widths375/768/1440 with axe and contrast. Money decimal strings, Guatemala times.',
'Run standalone module HTTP/UI tests green; supply route manifest, exact query/body examples, screens and red/green evidence. Final native integration remains explicit FS-WIRE/GATE requirement, not prechecked by this isolated UI PR.'],ns,'http-ui')
# Incremental runtime handoffs: functional slices land before the final aggregate gate.
wave_order=['patient','record','charges','agenda','account','users','invoicing','payments','personnel','inventory','honoraria','consultation','dental-chart','dental-plan','milestones','admission','discharge','lab-intake','lab-results','referral','procedure','dental-session','attachments','vaccines','growth','history']
for wi,slug in enumerate(wave_order,1):
    es=modmap[slug][2]
    deps=[last(slug,'H')]+[last(slug,{'postgres':'PG','mysql':'MY','mongodb':'MO','firebase':'FS'}[e]) for e in es]+(['E2-P5-02','E2-P5-04'] if wi==1 else [f'FS-WAVE-{wi-1:02d}'])
    add(f'FS-WAVE-{wi:02d}',f'Incrementally mount functional {slug} slice in main app','agent-wire',deps,[
      'server/src/adapters/http/app.ts','server/src/config/compose-real.ts','server/src/config/compose-memory.ts','server/src/config/adapter-registry.ts','web/src/App.tsx','web/src/styles.css',f'server/test/full/wave-{wi:02d}.test.ts'
    ]+[f'server/src/adapters/{e}/full/index.ts' for e in es],[
      f'Under single shared-file lock, register only completed {slug} module routes, native adapters and UI manifest; reuse same baseline UoW. Existing mounted modules cannot regress. Missing unrelated future modules are not represented as working.',
      f'Run {slug} actual main-app e2e and native persistence proof now; do not wait until all modules or document packaging. Source applicable operations are usable, no unreachable standalone-only feature.',
      'Keep full delivery gate unchecked until relations/security/all77 tests pass. Intermediate scoped green is not full-system/security approval; do not bypass required existing CI/protocol controls or mark unfinished operations done.'
    ])

# Cross-module gate and specialty delivery glue.
allcore=[last(m[0],'C') for m in MODS]
alleng=[last(slug,{'postgres':'PG','mysql':'MY','mongodb':'MO','firebase':'FS'}[e]) for slug,_,es,*_ in MODS for e in es]
allhttp=[last(m[0],'H') for m in MODS]
add('FS-RELATIONS','Finalize native full FK/index/constraints and existing-schema transitions','agent-relations',alleng,[
'server/src/adapters/postgres/migrations/full-90-relations.sql','server/src/adapters/mysql/migrations/full-90-relations.sql','server/src/adapters/mongodb/migrations/full-90-relations.ts','server/src/adapters/firebase/migrations/full-90-relations.ts','server/test/full/relations.test.ts'],[
'Apply F3 exact foreign-key map/constraints after all referenced tables exist; preflight count orphan/cross-institution refs and fail before altering on drift.',
'Add full consulta state/cita/fin migration without replacing baseline DTO/error/17 cases; generated principal/act keys and gapless counter uniqueness; new role/privacy references cannot create cross-engine FK fiction.',
'Prove native violations reject and rollback, migration rerun idempotent ledger; snapshot actual metadata. Source§7.6 FK coverage table complete or precise blocker, never claim source-equivalent on missing constraints.'])
for engine in ['postgres','mysql','mongodb','firebase']:
 code={'postgres':'PG','mysql':'MY','mongodb':'MO','firebase':'FS'}[engine]
 add('FS-SEC-'+code,f'Native {engine} least privilege/encryption proof','agent-sec-'+engine,['FS-RELATIONS','FS-TOOLCHAIN'],[
 f'infra/security/full-{engine}.md',f'server/test/security/full-{engine}.test.ts',f'server/src/adapters/{engine}/full/security.ts',f'infra/{engine}/full-security.'+('sql' if engine in ['postgres','mysql'] else 'json'),f'server/src/adapters/{engine}/full/role-context.ts'],[
 f'Implement F5 {engine} paragraph with free local mechanisms and mandatory native denial/ciphertext/metadata probes. Keep migration/role owner separate from runtime. Prepare exact env var names and required mounts for sole compose/CI owner to integrate; never print keys/credentials.',
'Run role and field projection fixtures for reception, clinical, caja, system admin, auditor; wrong role native read fails, cross-institution same connection reuse cannot leak. Runtime no DELETE clinical permission.',
'Fail clear if local free plugin/library missing; record setup blocker and documented free alternative recommendation to router, not paid managed switch or permissive fallback.'])
add('FS-BRIDGE','Wire crash-safe H↔L referral/import/delivery worker locally','agent-bridge',[last('referral','PG'),last('referral','MO'),last('lab-results','MO')],['server/src/application/full/referral-worker.ts','server/src/ports/full/referral-transfer.ts','server/test/full/referral-transfer.test.ts','server/src/adapters/postgres/full/referral-transfer.ts','server/src/adapters/mongodb/full/referral-transfer.ts','server/src/adapters/postgres/migrations/full-89-referral-transfer.sql','server/src/adapters/mongodb/migrations/full-89-referral-transfer.ts'],[
'Implement F2 OP39/48/53 explicit referral outbox and mapping (origin institution+patient+referral id→lab id); copy minimal synthetic identity with referral purpose only. Scope network transfer to known1→3 and delivered3→1, never arbitrary store lookup.',
'Local bounded worker polls committed pending events with lease/retry <=3 then visible failed status, idempotent import and acknowledgement. No external network, no paid queue, no distributed transaction claim.',
'Test crash before/after remote commit, duplicate delivery, scope mismatch and preliminary access denied; hospital reads delivered result snapshot only, lab source result immutable. Configure worker later via FULL-WIRE only.'])
add('FS-SECURITY-INTEGRATION','Join role projections, local audits and own-patient viewers','agent-security',allcore+['FS-SEC-PG','FS-SEC-MY','FS-SEC-MO','FS-SEC-FS'],[
'server/src/ports/full/authorize.ts','server/src/application/full/authorize.ts','server/src/application/full/audit.ts','server/test/full/authorization.test.ts','server/test/full/audit.test.ts','server/src/adapters/postgres/migrations/full-91-viewer-map.sql'],[
'Create explicit usuario_paciente mapping in identity PG (institution,user,patient; validate target exists before grant), scoped own patient view for source curves/account. Add usuario_profesional_vinculo(id_usuario INT,id_institucion INT,id_profesional_clinico INT, PRIMARY KEY(id_usuario,id_institucion)); FK user to identity only, clinical professional existence validated by scoped port. Derive OperationContext.id_profesional from this binding without adding JWT claims; do not point MySQL/Mongo/Firestore professional ids at PG profesional FK. Add read model safe projection, no JWT claim extension.',
'Every restricted read requires local audit durable before DTO; every clinical write audit in same local UoW. Central audit reads per-store scoped safe rows, no cross-engine synchronous audit transaction.',
'Prove role changes take effect next bearer use, admin cannot clinical read, own honorarium only, reception never raw origin FKs; identity/session hashed data never returned.'])
add('FS-WIRE','Single-owner runtime/UI integration of all module manifests','agent-wire',alleng+allhttp+['FS-WAVE-26','FS-BRIDGE','FS-SECURITY-INTEGRATION'],[
'server/src/adapters/http/app.ts','server/src/config/adapter-registry.ts','server/src/config/compose-memory.ts','server/src/config/compose-real.ts','server/src/main.ts','web/src/App.tsx','web/src/session.ts','web/src/styles.css','infra/docker-compose.yml','infra/firebase/firestore.rules','infra/firebase/firestore.indexes.json','server/test/full/wiring.test.ts']+[f'server/src/adapters/{e}/full/index.ts' for e in ['memory','postgres','mysql','mongodb','firebase']],[
'Obtain shared-file lock after baseline owners complete overlapping files. Compose all module adapters using same base UoW, roles, audit and resources. Register module HTTP plugins+UI manifests once. Any missing engine/migration/env fails startup, no memory failover.',
'Wire local volumes, worker, encryption plugins/test deps and Firestore role rules prepared by security owners; consume their exact files, do not override their policy.',
'Full navigation lists every source-applicable workflow, no Out-of-scope specialty placeholder; preserve existing basic endpoints/screens and Spanish errors. Separate demo role sessions exercise required workflows rather than administrator superuser.',
'Wire all named F4 e2e to actual main app with4 real targets and physical probes; record native restarts. No cloud deployment/real payments or production-readiness claim.'])
add('FS-SEED-DEMO','Idempotent complete synthetic demo and all77 operation fixtures','agent-data',['FS-WIRE'],[
'scripts/seed-full.ts','data/demo/full-fixtures.json','server/test/full/seeds.test.ts','docs/entregas/entrega-2/demo-completo.md'],[
'Seed each applicable operation prerequisite including roles/professionals/contracts/catalogs/tariffs/stock/beds/vaccines/milestones/lab exams/reference intervals/dental procedures. Use official data manifests for curves/schedule and explicitly synthetic lab ranges. Passwords/env keys never tracked.',
'Run seed twice: same scoped counts and balances, no duplicate chart/order/tariff or fiscal numbering consumed. Test-only namespace reset guarded, not demo clinical DELETE.',
'Rehearse complete four-engine operation journey with role switches, link each OP to screenshot+native read and named test; every absent77 row a fail, not deferred.'])
add('FS-GATE','Make every operation/transition/native matrix mandatory in pregate+CI','agent-wire',['FS-SEED-DEMO','E2-P5-07'],[
'package.json','package-lock.json','.github/workflows/ci.yml','scripts/validate.sh','scripts/pregate.sh','scripts/check-full-docs.mjs','docs/gate-checklist.md','docs/ARCHITECTURE.md','docs/progress/TASKS.md','poteto-mode/feature-map.md','poteto-mode/queue/NOW.md','docs/plan/E2-EXECUTABLE.md','DECISIONS.md','docs/plan/full-system/coverage-evidence.json'],[
'Fold module gate+ADR fragments and exact77 evidence rows into shared docs. Docs guard requires77 unique OP ids, valid source lines and named success/error transition e2es; every claimed done includes commit SHA/native target/red+green evidence.',
'Mandatory npm run pregate and VALIDATE_FULL=1 bash scripts/validate.sh execute all unchanged17 baselinecases plus full common4-store and native specialty suites, API+Playwright tests in parallel with isolated fixtures, coverage>=80 domain/application, lint/build/docs guards, axe+contrast/Esc/focus at375/768/1440.',
'No CONTRACT_RED discovery switch remains after06; missing engine/test/module fails gate. Preserve claim/test/implementation ordering, independent review, no skip/weakening. CI and local command parity, native permission/encryption probes and physical restart proof included.',
'All gates actual pass or blocker explicitly recorded; no merge/push/permission change is authorized merely by passing this ticket.'])
add('FS-DELIVERY','Update graded Spanish document/PDF for full system, rehearse locally','agent-wire',['FS-GATE','E2-P6-01'],[
'docs/entregas/entrega-2/nota-comparativa.md','docs/entregas/entrega-2/nota-comparativa.pdf','docs/entregas/entrega-2/evidencia-operaciones.md','docs/entregas/entrega-2/demo-completo.md','poteto-mode/queue/tickets/e2-p6-03.md'],[
'Supersede old five-screen/deferred matrices in final Spanish note with actual77 applicability/engine/evidence; explain schema additions, document embedding/references, state/ACID/security and free emulators truthfully.',
'Produce offline PDF with local free renderer, embed sanitized actual evidence and compare storage/transactions/permission limits; no fabricated latency/grade/encryption-production-IAM claims.',
'Rehearse from fresh local compose+seed all4 engines and representative error/race paths; retain exhaustive automated77 matrix. Submission still distinct external action, not performed or marked complete.'])
# Expand foundation's future repo file list literally (no wildcard ownership ambiguity).
T[0]['paths']=[
'docs/plan/full-system/SOURCE-EVIDENCE.md','docs/plan/full-system/contracts/NEW-TABLES-postgres.sql','docs/plan/full-system/contracts/NEW-TABLES-mysql.sql','docs/plan/full-system/contracts/SOURCE-FKS.json','docs/plan/full-system/contracts/INFRASTRUCTURE-SCHEMA.md','docs/plan/full-system/contracts/PORTS-LANES.md','docs/plan/full-system/contracts/TYPES-API.md','docs/plan/full-system/contracts/SCHEMA.md','docs/plan/full-system/contracts/STATECHARTS.md','docs/plan/full-system/contracts/SECURITY-FREE.md','docs/plan/full-system/contracts/entities.json','docs/plan/full-system/contracts/schema-additions.json','docs/plan/full-system/contracts/operations.json','docs/plan/full-system/source/analisis-y-modelo-relacional.md','DECISIONS.md','shared/package.json','shared/src/full/schema.ts','server/src/ports/full/context.ts','server/src/adapters/memory/unit-of-work.ts','server/src/adapters/memory/full-state.ts','server/test/full/foundation.test.ts']+[f'shared/src/full/{m[0]}.ts' for m in MODS]+[f'server/src/ports/full/{m[0]}.ts' for m in MODS]
T[0]['paths'] += ['docs/plan/full-system/GATE-CHECKLIST-ADDITIONS.md','docs/plan/full-system/OP-COVERAGE.md','docs/plan/full-system/TICKET-INDEX.md','docs/plan/full-system/tickets/index.json'] + [f'docs/plan/full-system/tickets/{t["id"].lower()}.md' for t in T]
# Each module submits isolated fragments and journal. Integrator owns tracker and aggregate mutations.
for t in T:
 slug=next((m[0] for m in MODS if t['id'].startswith('FS-'+num[m[0]]+'-')),t['id'].lower())
 t['slug']=slug
 t['paths']+= [f'docs/plan/full-system/fragments/{t["id"].lower()}.gate.md',f'docs/plan/full-system/fragments/{t["id"].lower()}.decisions.md',f'docs/progress/journal/{t["id"].lower()}.md']
 if t['ops']:
  vpath=f'server/test/full/{slug}/'+(t['engine'] or ('http.test.ts' if t['layer']=='http-ui' else 'memory.test.ts'))
  if t['layer']=='http-ui':vpath=f'src/adapters/http/full/{slug}.test.ts'
  red=f'npm test -w @genki/server -- {vpath.removeprefix("server/")}'
  if t['engine']:red='TEST_ENGINES=1 '+red
  green=red
 else:
  vpath=next((p for p in t['paths'] if p.endswith('.test.ts')),f'server/test/full/{t["id"].lower()}.test.ts')
  if vpath not in t['paths']:t['paths'].append(vpath)
  red='npm test -w @genki/server -- '+vpath.removeprefix('server/')
  if t['id'].startswith('FS-SEC-') or t['id'] in ['FS-RELATIONS','FS-GATE','FS-WIRE','FS-SEED-DEMO','FS-DELIVERY']:red='TEST_ENGINES=1 '+red
  green=red
 if t['layer']=='core' and t['id'].endswith('C01'):
  # Module contract shared by all drivers: exact test harness semantics are in F1.
  pass
 names=[]
 for n in t['ops']:
  o=ops[n-1]; names += [f'op{n:02d}_transition_{j}_persists' for j,_ in enumerate(o['transitions'],1)]
  names += [f'op{n:02d}_error_domain_unchanged',f'op{n:02d}_error_schema_unchanged',f'op{n:02d}_error_store_unchanged']
  if n not in [1,2]:names +=[f'op{n:02d}_error_role_unchanged',f'op{n:02d}_error_foreign_unchanged']
  if o['method']!='GET' and n not in [1,2,3,4,5]:names +=[f'op{n:02d}_midwrite_rolls_back']
 if not names:names=[t['id'].lower().replace('-','_')+'_required_behavior',t['id'].lower().replace('-','_')+'_failure_preserves_invariants']
 txt=f'''# {t['id']} — {t['title']}

Status: READY only when dependencies are merged/green; no claim this is implemented.
Owner: {t['owner']} (agent; Carlos PM only, Jordin no programming).
Dependencies: {', '.join(t['deps'])}.
Layer: {t['layer']}; physical engine: {t['engine'] or 'memory/reference or integration as stated'}.
Estimate: {'1–3' if t['layer'] in ['core','engine','http-ui'] else '2–6'} active agent-hours plus service/setup/review wait. One PR intent, <=2 added OPs per feature layer, never one PR implementing a full engine/system. If actual patch materially exceeds400 production-behavior LOC, split implementation at these two numbered OP boundaries without changing contracts; reuse parent ticket id suffix `a`/`b`, keep ordered ownership and evidence. This mechanical size split is not a scope cut.

## Context and frozen input
Genki Health, Bases de Datos II, full77 original operations due Nov9. Baseline main observed d89f96b4bec26d834e501da2f4c81b2adad9f2cc; #17 DTO/schema head20417c8951c8466a66691cdca008e415e5ce1067 reported validate-green but protocol gate pending. P2-02..06 not begun at handoff. Core17 and basic DTOs survive unchanged. New full scope supersedes MVP deferrals only; no graded operation silently stubbed. Identity PG+current JWT;1 Hospital PG,2 pediatric MySQL,3 lab Mongo,4 dental Firestore emulator. Synthetic data and free local compose only. No app work was done by plan author.

Read repo AGENTS/DoD, then exact contracts `docs/plan/full-system/contracts/{{PORTS-LANES,TYPES-API,SCHEMA,STATECHARTS,SECURITY-FREE}}.md` and `entities.json`, `schema-additions.json`, `operations.json`. Foundation copies delivered files first from `/workspace/genki/plan/2026-11-05/full-system/`; all downstream tickets depend on that committed pack and need no previous chat. `DECISIONS.md` ADRFS001–014 supplies decision/why/rejected alternatives. Missing prerequisite is a not-ready state, not permission to invent a port. No publish/merge/external message is authorized by this ticket itself.

## Exact create/touch paths
'''
 for p in t['paths']:txt+=f'- `{p}` — create if absent, otherwise preserve prior committed chunks and touch only this ticket scope.\n'
 txt+='''
No other shared/router/CI/lockfile/aggregate file may be edited. Per-module repeated paths have one owner and serial chunk dependencies; another module cannot claim them. Foundation and wire handoffs precede later edits to their shared paths. Module migration is layer-owned, aggregate FK finalizer separate. No wildcard grants or clinical DELETE.

## Contracts / DDL / document schema / HTTP
'''
 if t['ops']:
  for n in t['ops']:
   o=ops[n-1]
   txt+=f"\n### OP-{n:02d} — {o['title']}\nSource §10 L{o['source_line']}; actual Inst {o['institutions']}; exact route `{o['method']} {o['path']}`. Request `{o['request']}`; output `{o['response']}`; success/error status policy F2 (baseline methods unchanged). Named semantic error `{o['error']}` plus common400/401/403/404/503, no raw driver message.\n{o['rules']}\n"
  m=modmap[slug];txt+=f"\nPhysical entities owned here: {', '.join(m[4]) or 'existing baseline entity tables; no new unrelated table'}. Exact required fields/types/PK/FK/source rules in F3 section `{num[slug]} {slug}` and `entities.json`; additions in schema-additions.json; no implementer schema choice. Source §§5–7 and F3 exact rendering/constraints mandatory. Core layer must not run DDL; engine layer renders/appends its own migration; HTTP/UI layer consumes typed contract only. Domain use cases executeOpNN and repository opNN signatures are F1; DTO aliases/projections exact F2.\n"
 else:txt+='\nApply exact assigned F1–F5 contract paragraphs and numbered steps below. Existing basicDTO/error catalog unchanged; no paid storage/provider, real payment, auth claim rewrite or schema reset. New infrastructure fields are labeled in schema-additions; no unstated product decision.\n'
 txt+='''
## Setup and red/green commands
Run in future authorized execution checkout, not planning directory. `npm ci` and engine readiness must succeed before behavioral red. Use existing Node22, C5 pinned drivers/tools and env-only local test credentials. No fetch/reset/checkout or deployment occurs in this planning run.

```bash
npm ci
npm run build -w @genki/shared
'''+('''docker compose --env-file .env -f infra/docker-compose.yml up -d --wait postgres mysql mongodb
# Firestore: start with C5 emulator command/project demo-test-*; never a real Firebase project.
''' if t['engine'] or t['id'] in ['FS-RELATIONS','FS-WIRE','FS-GATE'] else '')+f'''# Phase1 tests only: create tests/fixtures/imports first, then run:
{red}
# Capture actual nonzero behavioral output, commit as test: {t['id']} red
# Phase2 implement; rerun unchanged tests:
{green}
bash scripts/validate.sh
'''
 if t['layer']=='http-ui':txt+=f'FULL_MODULE={slug} npm run test:e2e -- --config web/playwright.config.ts web/e2e/full/{slug}.spec.ts\n'
 txt+='''# After FS-TOOLCHAIN exists, scoped gate uses this module before global wire:
# FULL_MODULE=<slug> npm run pregate
# Final delivery / integration after FS-GATE:
# npm run pregate
# VALIDATE_FULL=1 bash scripts/validate.sh
git diff --check
```
Phase1 missing dependency/script/service/discovery0 is SETUP FAILURE, not red proof. Add test wiring in test-only commit and rerun before production behavior. Test commit must predate code; do not edit/skip/weaken those assertions afterward. If a test is wrong, stop with concrete mismatch evidence for router, not self-approved assertion change. Temporary P2-02 expected-red correction is specified only in F1, it does not exempt these implementation PRs from green applicable tests.

## Named red-first assertions / statechart tests
Primary exact test paths in file list. Use unchanged module contract cases across every required native adapter. E2e names also appear in F4 statechart; engine/core PRs implement same oracle at their layer, UI/main-app evidence not claimed until mounted/rerun on native.
'''
 for name in names:txt+=f'- `{name}`\n'
 txt+='''
Success tests assert exact state/result and actual stored rows/documents; domain/schema/role/foreign/store failures assert stated status and before/after snapshot equality. Read-list empty is not an invented404: use a real foreign parent where route has parent, or query/projection isolation fixture; F4 caveats define legal oracle. Mutation fault is after a real write inside current native transaction, constructor-injected in test only. Exact race tests in F4 apply to appointments, admissions, charge/stock, fiscal counter/payment, referral and dental claims. Never fake counts or conditionally skip unsupported engine; native specialty matrix follows original source Inst.

## Numbered implementation steps
'''
 for i,step in enumerate(t['steps'],1):txt+=f'{i}. {step}\n'
 txt+='''
## Binary acceptance / definition of done
1. Every applicable named assertion above passes on unchanged tests; source/contract field and error status match, no stub endpoint/placeholder feature or silently deferred OP. Normal lint/typecheck/build/validate exit0. Native engine tickets show actual target metadata and transaction rollback; memory pass never counts as physical proof.
2. All state transitions and error loops for this ticket have named e2e in F4. UI ticket passes standalone axe+contrast, Escape+focus and375/768/1440; final FS-WIRE/FS-GATE reruns against physical assigned engines with3-width screenshots and HTTP status assertions. Record partial stage truthfully, do not pre-check final integration.
3. Journal includes exact dependency SHA, `test:` commit SHA, actual red output, green output, commands, physical engine/fixture namespace, paths, pass/fail counts and no secret/patient payload. `git diff --check`0. Independent agent reruns same applicable commands; no red evidence/no PR gate.
4. Ticket `.gate.md` fragment includes the fail reason+template test, commands/evidence and unchecked final items. `.decisions.md` has decision/why/rejected alternatives, linked ADR IDs. Central gate/DECISIONS/tracker changes belong sole wire owner, not simultaneous module PR edits.
5. Future PR body: Ticket,Why,What changed,Scope,Tradeoffs,Blast radius,Verification,Checklist. Protocol-change requires existing router-approved review/CI gates. Local work/ticket completion is not permission to push/merge or claim Carlos approved. Never print secrets, contact third parties, install paid infrastructure or perform a real payment.

## Out of scope
Other module/OP/layer not explicitly named, core17 rewrites, baseline DTO/claim renames, replacing SQL with generic JSON, ORM, engine fallback, clinical DELETE, special false-success stub, global router/config/CI/lockfile edits outside sole owner scope, managed deployment/paid upgrade/real account money. Out-of-scope here means assigned to other indexed tickets, NOT deferred from full-system delivery.
'''
 (F/'tickets'/f'{t["id"].lower()}.md').write_text(txt)
(F/'tickets/index.json').write_text(json.dumps(T,ensure_ascii=False,indent=2)+'\n')
# Coverage distinguishes old planning intent from observed runtime evidence.
nominal={1,2,7,8,11,12,13,14,18,26,28,29,30,31}
partial={2:'logout lacks exit audit',12:'allergies/antecedents absent',14:'only consultations, not complete history',26:'browser draft only',28:'composer-only, no durable open workflow',29:'composer-only, no durable open workflow',30:'composer-only, no issued durable workflow until close',31:'no consultation charge in atomic bundle'}
base_map={1:'E2-P2-09/P3A-05',2:'E2-P2-09/P3A-05',7:'E2-P2-04/P2-07',8:'E2-P2-04',11:'E2-P2-04',12:'E2-P2-07/P5-04',13:'E2-P2-04',14:'E2-P2-07/P5-04',18:'E2-P2-04/P2-07',26:'E2-P2-08/P5-04',28:'E2-P2-05/P2-06/P2-08',29:'E2-P2-05/P2-06/P2-08',30:'E2-P2-05/P2-06/P2-08',31:'E2-P2-06/P2-08'}
coverage='''# Exact77-row source operation coverage

Source catalog is original §10, pinned source blob matches current main tree. Rows are inventory/assignment, NOT claimed implementation or passing tests. Legacy46 plan nominally mentions14 IDs and explicitly omits63. Of14,8 have partial semantics listed here; remaining6 still not claimed live four-engine complete. Baseline observed HTTP has only login/refresh/me+POST patient; archive exists as application file, not exposed route. Main engine folders still .gitkeep in observed tree. Source-proven full77 operation inventory does NOT mean verified77 functional coverage.

|OP|Original operation|Original Inst|Source lines|Old46-plan coverage|Observed current main|Delta tickets|Final proof|
|---|---|---|---|---|---|---|---|
'''
for o in ops:
 n=o['id'];slug=opmod[n]; rowts=[t['id'] for t in T if n in t['ops']]
 old=('PARTIAL '+partial[n] if n in partial else 'planned '+base_map.get(n,'')) if n in nominal else 'ABSENT (explicitly deferred)'
 observed='HTTP scaffold only; memory, not4-engine verified' if n in [1,8,13] else 'application helper only, no HTTP route' if n==18 else 'no operation evidence in observed HTTP/tree'
 cov='; '.join(rowts) or 'Retain '+base_map[n]+' + FS-WAVE-01 + FS-GATE'
 coverage+=f"|OP-{n:02d}|{o['title']}|{o['institutions']}|[L{o['source_line']}–{o['source_line']+2}](source/analisis-y-modelo-relacional.md#L{o['source_line']})|{old}|{observed}|{cov}|PENDING native+F4 e2e|\n"
(F/'OP-COVERAGE.md').write_text(coverage)
source_doc=f'''# Source evidence — read-only, 2026-11-07 America/Guatemala UTC-6

- Repo https://github.com/carloshugoeg/genki-health.
- Operation/model source `docs/entregas/entrega-1/analisis-y-modelo-relacional.md`, read via GitHub inline get_file_contents at commit2fa2c1579658ce64d9be2f80458268aeeaf70b06. Saved exact text `{F}/source/analisis-y-modelo-relacional.md`.
- SHA256 `{hashlib.sha256(S.encode()).hexdigest()}`. Git blob SHA1 `{hashlib.sha1(b'blob '+str(len(S.encode())).encode()+bytes([0])+S.encode()).hexdigest()}` equals current main-tree entry cad77f5033db19885f6efd8e311bfcf9fcbf860f. Thus source catalog is unchanged at observed current main.
- Current main recursive tree read inline: d89f96b4bec26d834e501da2f4c81b2adad9f2cc; saved source/main-tree.json; truncated flag checked in static report. Existing P1-04 spec pack present, app application folder only register/archive. No clone/checkout/gh/raw provider API used.
- Current main HTTP app read at d89f96b4: health, institutions, login, refresh, me and register-patient; no other OP endpoint claimed. Main server/package.json Fastify^5.0.0, Zod^3.23.8, Node toolchain remains C5 Node22. This is read evidence only, not execution.
- Parent live steering: merged #13/#15/#16, P1-04 d89f96b4; #17 DTO/schema head20417c8951c8466a66691cdca008e415e5ce1067 validate-green reported, protocol gate pending. P2-02..06 unstarted. PR17/CI not independently rerun here; report attribution rather than inventing gate result.
- Source §5 attrs lines400–1495; source §6.5 rules1722–1752; SQL textual schema1845–2050; source security2653–2713; catalog2715–2990; required atomic operations2992–3028. Exact77 names/Inst columns manually transcribed and op ids checked for contiguous1..77. Field inventory programmatically compared to §7.4/§7.5 source declarations, zero missing fields. Lab/dental logical types without source lengths explicitly frozen as delta design, not misattributed SQL source.

## Known factual gaps, not human product questions
WHO/Guatemala per-dose reference data not supplied; FS-REFERENCE-DATA acquisition+verification required. Local engine capacity/plugin availability, package installation and encryption keyring component unexecuted. No instructor cutoff hour, professor feedback, available local Docker/Java capacity, branch protection entitlement or grading acceptance of emulator has been independently established. Source§10 introduction each-operation-equivalent wording conflicts specialized Inst and MySQL excludes hospital schema; recommended original Inst interpretation is explicit ADRFS003 for router protocol gate, not hidden assumption. Repo may advance after observed tree: execution agents rebase/read dependency SHAs before claim.
'''
(F/'SOURCE-EVIDENCE.md').write_text(source_doc)
# Static graph + rough lower/upper dependency estimates. Not measured runtime or quota claim.
old=json.loads((ROOT/'tickets/index.json').read_text()); oldids={x['id'] for x in old}; ids={t['id'] for t in T};allids=oldids|ids
assert len(ids)==len(T)
for t in T:
 assert all(d in allids for d in t['deps']),(t['id'],t['deps'])
state={};order=[]
def visit(id):
 if state.get(id)==1:raise AssertionError('dependency cycle '+id)
 if state.get(id)==2:return
 state[id]=1
 x=next((t for t in T if t['id']==id),None)
 if x:
  for d in x['deps']:visit(d)
 state[id]=2;order.append(id)
for id in ids:visit(id)
finished={x['id'] for x in old if x['phase'] in ['P0','P1']}
# baseline P2-01 held for protocol gate; don't assume merged, assign its remaining nominal2h as conservative.
graph={x['id']:{'deps':x['deps'],'lo':0 if x['id'] in finished else x['hours'],'hi':0 if x['id'] in finished else x['hours']} for x in old}
for t in T:
 lo,hi=(1,3) if t['layer'] in ['core','engine','http-ui'] else ((.5,1.5) if t['id'].startswith('FS-WAVE-') else (2,6))
 t['estimate_low']=lo;t['estimate_high']=hi
 graph[t['id']]={'deps':t['deps'],'lo':lo,'hi':hi}
def finish(id,key,memo):
 if id not in memo:memo[id]=graph[id][key]+max([finish(d,key,memo) for d in graph[id]['deps']]or[0])
 return memo[id]
crit_lo=finish('FS-DELIVERY','lo',{});crit_hi=finish('FS-DELIVERY','hi',{})
add_lo=sum(t['estimate_low'] for t in T);add_hi=sum(t['estimate_high'] for t in T)
(F/'tickets/index.json').write_text(json.dumps(T,ensure_ascii=False,indent=2)+'\n')
index='''# Full-system additive ticket index

Old46 ticket IDs remain unchanged. C=core+memory, PG/MY/MO/FS=native engine, H=HTTP/UI; two OPs max per feature PR. Each same module/layer chunk serialized, disjoint module directories parallel. A complete operation requires ALL assigned layers plus wave integration/security/relations/gate; a core ticket done is not operation done.

|Ticket|Owner|Dependencies|OPs|Layer|
|---|---|---|---|---|
'''
for t in T:index+=f"|[{t['id']}](tickets/{t['id'].lower()}.md)|{t['owner']}|{', '.join(t['deps'])}|{','.join(f'{n:02d}' for n in t['ops']) or 'integration'}|{t['layer']}{'/'+t['engine'] if t['engine'] else ''}|\n"
(F/'TICKET-INDEX.md').write_text(index)
delta=f'''# FULL-SYSTEM-DELTA — Genki Health, executable scope amendment

**Architecture handoff, Nov7,2026 America/Guatemala UTC-6. Full original77 operations due MondayNov9; old reduced MVP exclusions are SUPERSEDED. No app code/repo change/PR/launch/merge/deployment/message/spend performed.**

## Ship NOW — do not restart the core
1. Preserve #17 P2-01 types/schema/errors and independently gate its reported green head20417c8951c8466a66691cdca008e415e5ce1067. Existing17 C3.4 cases unchanged; #17 is core baseline, not a cap on product scope.
2. P2-02 write17 red contract assertions, P2-03/04 memory isolation/patients, P2-05 pure bundle in parallel where disjoint, P2-06 all17 green + remove opt-in boundary. [Red-spec correction](full-system/contracts/PORTS-LANES.md#p2-02-red-spec-acceptance-correction--proposed-gate-interpretation): normal tests/validate green; explicit CONTRACT_RED expected fail until06, evidence truthfully recorded. Router must accept protocol clarification; no CI waiver or assertion weakening.
3. Immediately after06: [FS-FOUNDATION](full-system/tickets/fs-foundation.md), then disjoint first missing-OP core tickets [FS-03-C01 patient09/10](full-system/tickets/fs-03-c01.md), [FS-04-C01 ficha12+antecedent15](full-system/tickets/fs-04-c01.md), [FS-06-C01 availability20+appointment21](full-system/tickets/fs-06-c01.md), [FS-23-C01 charges68/69](full-system/tickets/fs-23-c01.md), [FS-13-C01 vaccines43/44](full-system/tickets/fs-13-c01.md) once reference data ready. These are runnable prompts, not another design phase.
4. Parallel noncolliding lane after foundation: FS-REFERENCE-DATA verifies official WHO/schedule; sole wire owner FS-TOOLCHAIN installs local test harness. Keep existing engine base tickets P3A/P3B/P4A/P4B moving in isolated engine folders; auth P2-09→P3A-05 PG identity retained. Do not launch a cloud agent from this planning task.
5. Each module core→native per-store chunks + H route/UI chunks; [FS-WAVE-01](full-system/tickets/fs-wave-01.md) mounts patient changes as soon as existing baseline physical composition/UI and module are ready.26 single-owner wave tickets integrate actual functional workflows incrementally, not only at final packaging. Final wiring audit FS-WIRE follows full native/security relations, then seeds/gate/document.

## Exact scope, facts and artifact index
- [77-row OP coverage](full-system/OP-COVERAGE.md), source names/Inst/line refs, old coverage, observed main and exact new ticket IDs. **77/77 source definitions verified, not77 functional passes.** Old46 plan names14 OP IDs, explicitly defers63;8 of14 are semantically partial (02,12,14,26,28,29,30,31). Additional source security and active-admission archive restrictions strengthen some nominal paths. Nothing is silently claimed implemented.
- Current observed main d89f96b4bec26d834e501da2f4c81b2adad9f2cc; [source evidence/blob verification](full-system/SOURCE-EVIDENCE.md), [saved original model](full-system/source/analisis-y-modelo-relacional.md). Source blob identical current main, no fabricated OP meanings.
- [Typed routes/errors/requests](full-system/contracts/TYPES-API.md); [ports/lane ownership](full-system/contracts/PORTS-LANES.md); [DDL/doc schemas](full-system/contracts/SCHEMA.md), [entity inventory](full-system/contracts/entities.json), [metadata additions](full-system/contracts/schema-additions.json).
- [Every state transition with named success/error e2e](full-system/contracts/STATECHARTS.md); [security, free choices and monetary algorithms](full-system/contracts/SECURITY-FREE.md); [ADRs decision/why/rejected alternatives](DECISIONS.md).
- [{len(T)} new concrete PR-sized ticket prompts](full-system/TICKET-INDEX.md), [machine dependency/path index](full-system/tickets/index.json). Existing46 unchanged => **{46+len(T)} indexed work units total**; original46 should NOT be reexecuted when already merged. New feature tickets add at most2 OPs on1 layer/store.40 integration/setup/security units include26 incremental shared-owner waves; none authorizes publication or paid spend.

## Isolated lanes after P2-06
|Lane|First ready work|Then|No shared write|
|---|---|---|---|
|Foundation agent|FS-FOUNDATION|explicit handoff of type/port/state files|Only one foundation writer; no app feature rewrite|
|Patient/record agent pair|FS-03-C01;FS-04-C01|nativePG/MY/MO/FS permodule in parallel + own H UI|module files only; do not both edit same module/layer chunk|
|Agenda agent|FS-06-C01→C02→C03|four native backends/H chunks|own files/migrations only|
|Charges/finance agent(s)|FS-23-C01→C02|invoicing24→payments25; inventory22/personnel20→honoraria21|pure arithmetic shared once, native ports no rule forks|
|Specialty agent(s)|lab15, dental17, milestones14; vaccines13 after data|hospital08/procedure09/discharge10 after consultation07 and stock/honoraria|original specialized Inst/native engine only|
|Data agent|FS-REFERENCE-DATA|verified growth12/vaccines13 fixtures, final seeds|reference files only, no shared app/router|
|Sole wire agent|FS-TOOLCHAIN, then wave01..26 dependency-ready|FS-WIRE→FS-SEED-DEMO→FS-GATE→FS-DELIVERY|all package/lock/router/config/globalCSS/CI/aggregate docs exclusively|

No Jordin coding dependency; agents implement all, Carlos PM only. Max actual concurrent free agents is not assumed; router queues ready tickets within existing free capacity, never upgrades/on-demand. If module file collides with existing baseline ticket, baseline finishes first and owner hands off lock. Tracker/gate/DECISIONS updates use fragments to avoid26 agents editing NOW.

## Source applicability, not invented308-feature promise
Source §10 introduction says equivalent four engines, but Inst columns specialize H/P/L/O and §7.5 explicitly excludes hospital tables from MySQL. Recommended interpretation: **all common operations live on all4 stores, specialty operations live on their assigned engine; all77 covered across the full system**, same engine-neutral use cases where applicable. Full demo uses4 physical targets, no memory-only substitute. This ambiguity is called out for router protocol decision (ADRFS003), not sent to sleeping Carlos or silently resolved into fictitious scope.

## Risks and recommended router decisions (no new Carlos questions)
- Adopt additive durable consultation/draft+close charge with full-state schema migration (FS005); retain baseline DTO/signatures and17 oracle. Old C3.5 `reactivate_route_absent` scope-only test superseded explicitly by OP19 protocol amendment, not stealth-deleted.
- Adopt locked-B personnel sidecar (FS006), no forbidden columns added to PROFESIONAL; preserve core source lock while implementing real eligibility/tariffs.
- Adopt source§9 roles/projections/auditing/native permissions/encryption (FS007/010). Administrator is NOT clinical superuser; demo role switching required. Current JWT/PG identity retained; temporary password reset+must-change/session revoke add metadata only, no token claim redesign.
- Adopt local scoped outbox/referral mapping for H↔L (FS009); no cross-engine nativeFK/distributedACID claim. This is a real clinical-isolation exception that needs explicit protocol gate; all other cross-tenant ids remain invisible.
- Adopt academic GTQ billing/ledger/idempotency/gapless counter (FS008/014); no card collection, FEL/provider, real bank payout/refund or spending. Monetary algorithms frozen in F5.
- Free default: existing C5 Node22,PG16,MySQL8.4,Mongo7+rs0,Firestore emulator, raw drivers, no production deployment/cloud billing. Local encryption component availability/uninstalled packages are factual setup blockers, not license/paid fallback permission.
- WHO/schedule facts absent: FS-REFERENCE-DATA must verify official free datasets. No invented percentiles/reference values; unresolved source/data access recorded precisely instead of auto-defer graded features.
- Protocol-change/two-owner review/CI remain gate requirements. Router may select recommended design under relayed overnight delegation, but this planning run does not approve/merge/publish anything. No external message/contact was sent.

## Deadline feasibility — honest risk, not the old95-hour estimate
Legacy Nov5 calendar and39.5h critical path are stale as of Nov7 23:19GT: P2-02..06 still unstarted. New scope adds **{add_lo:g}–{add_hi:g} active agent-hours** under explicit planning weights(feature layer1–3h; shared wave0.5–1.5h;setup/integration2–6h), before review/access retries. Dependency-DAG estimate from current unstarted P2 onward to FS-DELIVERY is **{crit_lo:g}–{crit_hi:g} elapsed work-hours even with unlimited disjoint workers**, excluding quota/resource/review wait. These are estimates, not measurements. Nov7 23:19→Nov9 17:00 Guatemala is only41h41m, and12:00 internal freeze only36h41m. **Full Monday delivery is critically at risk and cannot honestly be promised by this plan.** Extra parallel native lanes help throughput, not serialized core/shared-file/financial/state dependencies. Keep building ready functional slices tonight; do not substitute undocumented MVP cuts or mark tests passed to hide deadline risk. If router needs one exception, recommend explicit source-applicability interpretation+red-spec clarification, never relaxed CI/security/data integrity.

## Validation performed here
Only source extraction/blob comparison and static artifact checks. [SELF-CHECK-FULL.md](SELF-CHECK-FULL.md) records counts, dependency/source/path/link guards and factual caveats. No npm install/test/build, database migration/engine startup, Playwright/e2e, package fetch, security probe or final PDF was run. No repo checkout/app edit/cloudagent/external write/spend occurred.
'''
(ROOT/'FULL-SYSTEM-DELTA.md').write_text(delta)
# Actual static verification record, not app test results.
check=f'''# Full-system architecture static self-check

- PASS source OP inventory:77 ids contiguous01..77;77 exact source title/applicability rows, each source line points into pinned capture.
- PASS old nominal inventory14, absent63; partial8 explicitly identified. No runtime77 pass claim.
- PASS textual SQL field extraction §7.4/§7.5: zero missing fields after locked B correction. Source lab/dental logical fields separately transcribed and added design fields labeled.
- PASS source Git blob cad77f5033db19885f6efd8e311bfcf9fcbf860f equals observed main tree entry; source SHA256 in SOURCE-EVIDENCE.
- PASS new ticket IDs unique:{len(T)}; old46 retained; all dependencies resolve to old/new IDs; new DAG acyclic.
- PASS feature tickets at most2 OPs/layer; each has exact paths, setup/red+green/named tests/contracts/steps/acceptance/DoD/deps/owner/out-of-scope. Per-module shared files serialize within owner layer; aggregate ownership declared in F1; cross-owner foundation/wire handoffs explicit.
- Estimate reproducible graph weights:additional{add_lo:g}–{add_hi:g} agent-hours; longest-path{crit_lo:g}–{crit_hi:g} hours. No compute/time/throughput measurement claimed.
- NOT RUN app tests/DDL/engines/npm/Playwright/security/encryption/package install/PDF. Reference datasets not acquired; source institutional-equivalence ambiguity and native plugin availability remain visible factual/protocol gates.
- No repository/app file edited, no clone/checkout, external message/PR/push/merge/deploy/agent launch/payment.
'''
(ROOT/'SELF-CHECK-FULL.md').write_text(check)
print('WROTE',len(T),'tickets;',len(ops),'OPs; estimate',add_lo,add_hi,'critical',crit_lo,crit_hi)

# Deterministic supplemental architecture rendering (no app/DB/network action).
import subprocess
subprocess.run(['python3',str(F/'build_schema_appendices.py')],check=True)
with (F/'contracts/SCHEMA.md').open('a') as out:
 out.write('\n## Supplemental exact schema inputs\n- [Literal new PG table DDL](NEW-TABLES-postgres.sql), [MySQL](NEW-TABLES-mysql.sql); not executed, final FKs/checks/metadata required before gate.\n- [Source FK inventory](SOURCE-FKS.json); [exact referral/viewer/agenda schemas](INFRASTRUCTURE-SCHEMA.md).\n')
