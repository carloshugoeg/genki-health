# Entrega I — Análisis y Modelo Relacional

Transcripción fiel del PDF `entrega-i.pdf` (metadatos del archivo: 7 de septiembre de 2026). El PDF es la fuente con las figuras. Este archivo conserva el texto para que un agente pueda buscarlo. No se agregaron entidades, atributos ni reglas.

Los diagramas de las secciones 6 y 7 se perdieron al extraer el texto. Las vistas generales y el esquema relacional en texto se reconstruyeron en `diagramas/` a partir de las secciones 6.2, 6.3, 7.4 y 7.5. Los diagramas detallados de la sección 6.4 todavía no existen como fuente. Ese es el trabajo del ticket en curso.

Catedrático: Ing. José Arturo Monterroso.
Integrantes: Carlos Hugo Escobar Gómez y Héctor Jordin Adolfo García Coyoy.
Fecha de entrega del documento: 8 de septiembre de 2026.

---

UNIVERSIDAD RAFAEL LANDÍVAR Facultad de Ingeniería Licenciatura en Ingeniería en Informática y Sistemas Bases de
Datos II

Genki Health
Entrega I — Análisis y Modelo Relacional
Plataforma compartida de historiales clínicos para una red de cuatro instituciones médicas independientes

Catedrático: Ing. José Arturo Monterroso

Integrantes: Carlos Hugo Escobar Gómez Héctor Jordin Adolfo García Coyoy

Fecha de entrega: 8 de septiembre de 2026 Repositorio: https://github.com/carloshugoeg/genki-health

Índice

 1. Introducción
 2. Alcance de la Entrega I
 3. Levantamiento de información del historial clínico
 4. Entidades identificadas
 5. Atributos por entidad
 6. Modelo entidad-relación
 7. Modelo relacional
 8. Normalización
 9. Clasificación de la información
10. Operaciones de la aplicación
11. Supuestos y decisiones de diseño
12. Glosario

1. Introducción

Genki Health es una plataforma compartida de historiales clínicos para una red de cuatro instituciones médicas independientes.
Todas usan la misma aplicación, pero cada una es dueña de su propia infraestructura de datos: el motor de base de datos que
persiste la información cambia según la institución a la que pertenece el usuario que inicia sesión.

Este documento corresponde a la Entrega I del proyecto y contiene el análisis previo a cualquier implementación: qué
información compone un historial clínico completo, cómo se estructura, qué entidades y atributos la conforman, cómo se modela
en un motor relacional, cómo se clasifica según su sensibilidad y qué operaciones necesitará ejecutar la aplicación sobre esos
datos.

El resultado de este análisis es la base común sobre la que se implementarán los cuatro motores en la Entrega II. Por eso el
modelado se hizo pensando en un núcleo clínico compartido —el conjunto de conceptos que existen en las cuatro instituciones
— más un conjunto de extensiones específicas por institución. Esa separación es la que permite que la lógica de negocio no
dependa del motor: las mismas reglas (registrar consulta, agregar diagnóstico, recetar medicamento) operan sobre el mismo
núcleo sin importar dónde se persista.

1.1 Las cuatro instituciones
 Institución           Perfil operativo                                            Necesidad dominante

 Hospital              Alto volumen, múltiples especialidades, atención            Integridad transaccional fuerte: una consulta con su diagnóstico y su
 general               programada y de emergencia, hospitalización                 tratamiento se guarda completa o no se guarda

 Centro médico         Consultas frecuentes y cortas, seguimiento longitudinal     Datos altamente estructurados y repetitivos: control de crecimiento y
 pediátrico            del mismo paciente durante años                             esquema de vacunación

 Laboratorio           Procesa órdenes de examen provenientes de otras             Estructura variable: el resultado de una hematología no tiene los
 clínico               instituciones y de pacientes particulares                   mismos campos que una orina o un cultivo

 Clínica               Equipo pequeño, sin personal técnico, la agenda la          Rapidez de atención y operación simple: flujos cortos, poca
 odontológica          maneja la secretaria                                        configuración

1.2 Asignación de motores
La asignación quedó ratificada por el equipo y se justifica a fondo en el documento comparativo de la Entrega II. Se incluye aquí
porque determina cuáles instituciones se modelan de forma relacional en este documento.

 Institución                              Motor                           Modelado en esta entrega

 Hospital general                         PostgreSQL                      Modelo ER + modelo relacional completo + normalización

 Centro médico pediátrico                 MySQL                           Modelo ER + modelo relacional completo + normalización

 Laboratorio clínico                      MongoDB                         Entidades, atributos, clasificación y operaciones

 Clínica odontológica                     Firebase (Firestore)            Entidades, atributos, clasificación y operaciones

Cada motor se usa exactamente una vez. Los dos motores relacionales quedaron en las instituciones cuya información es
estructurada y estable; los dos motores documentales, en las instituciones donde la estructura varía (laboratorio) o donde interesa
más la simplicidad operativa que el control del esquema (odontológica).

2. Alcance de la Entrega I

 Resultado esperado por el enunciado                                                                Dónde se atiende

 Modelo entidad-relación de las instituciones relacionales                                          Sección 6

 Modelo relacional de las instituciones relacionales                                                Sección 7

 Entidades identificadas                                                                            Sección 4

 Lista de atributos por entidad                                                                     Sección 5

 Información pública, confidencial y restringida (las 4 instituciones)                              Sección 9

 Base de datos normalizada                                                                          Sección 8

 Operaciones sobre los datos, en lenguaje sencillo                                                  Sección 10

Los modelos ER y relacional se desarrollan para Hospital general y Centro médico pediátrico, que son las instituciones
asignadas a motores relacionales. El análisis de entidades, atributos, clasificación de información y operaciones cubre las cuatro
instituciones, tal como pide el enunciado, porque es la base sobre la que se implementarán los motores documentales en la
Entrega II.

3. Levantamiento de información del historial clínico

3.1 Qué es un historial clínico completo
Un historial clínico (o expediente clínico) es el registro acumulado de toda la atención que una institución le ha dado a un
paciente a lo largo del tiempo. No es un documento único: es un contenedor que crece. Se abre una sola vez, cuando el paciente
ingresa por primera vez a la institución, y a partir de ahí cada atención agrega contenido nuevo sin borrar lo anterior.

El levantamiento identificó cinco bloques de información dentro de un historial:

 1. Identificación del paciente — quién es, cómo contactarlo, quién responde por él. Se captura una vez y se actualiza cuando
    cambia.
 2. Antecedentes — lo que ya traía el paciente antes de esta institución: enfermedades previas, cirugías, alergias, antecedentes
    familiares, hábitos. Se registra al abrir el expediente y se complementa con el tiempo.
 3. Encuentros clínicos — cada vez que el paciente es atendido: motivo, exploración, signos vitales, diagnósticos, tratamientos
    y recetas de esa atención concreta.
 4. Seguimiento longitudinal — información que solo tiene sentido vista en serie a lo largo del tiempo: curva de crecimiento,
    esquema de vacunación, evolución de un tratamiento, historial de exámenes.
 5. Metadatos administrativos — número de expediente, fecha de apertura, estado (activo o archivado), motivo de archivo, y la
    bitácora de quién vio o modificó qué.

3.2 Los dos flujos de entrada
El enunciado pide explícitamente que el servicio atienda tanto a pacientes ya registrados como a pacientes de nuevo ingreso.
Estos son los dos flujos que el modelo debe soportar:

La búsqueda del paso B es la operación más frecuente de todo el sistema: se ejecuta en cada llegada de paciente. Por eso el
modelo contempla identificadores de búsqueda indexables y únicos por institución (número de expediente y documento de
identidad).

                               Flujo de atención: paciente nuevo frente a paciente ya registrado

3.3 Núcleo clínico común
De comparar las cuatro instituciones salió un conjunto de conceptos que existe en todas, aunque cada una lo use con distinta
intensidad:

 Concepto                                            Hospital         Pediátrico         Laboratorio           Odontológica

 Paciente                                               ✔                 ✔                   ✔                      ✔

 Expediente clínico                                     ✔                 ✔                   ✔                      ✔

 Antecedentes y alergias                                ✔                 ✔                   ✔                      ✔

 Profesional de salud                                   ✔                 ✔                   ✔                      ✔

 Usuario, rol y permiso                                 ✔                 ✔                   ✔                      ✔

 Consulta / encuentro clínico                           ✔                 ✔                   —                      ✔

 Signos vitales                                         ✔                 ✔                   —                   parcial

 Diagnóstico                                            ✔                 ✔                   —                      ✔

 Tratamiento                                            ✔                 ✔                   —                      ✔

 Receta y medicamento recetado                          ✔                 ✔                   —                      ✔

 Cita / agenda                                          ✔                 ✔                   ✔                      ✔

 Personal, roles y honorarios                           ✔                 ✔                   ✔                      ✔

 Insumos y material consumido                           ✔                 ✔                   ✔                      ✔

 Captura de cargos                                      ✔                 ✔                   ✔                      ✔

 Facturación y pagos                                    ✔                 ✔                   ✔                      ✔

 Bitácora de auditoría                                  ✔                 ✔                   ✔                      ✔

 Archivo del expediente                                 ✔                 ✔                   ✔                      ✔

El laboratorio no genera consultas médicas ni diagnósticos propios: recibe órdenes, procesa muestras y emite resultados. Por eso
su columna aparece vacía en esos conceptos, aunque comparte paciente, expediente y control de acceso con el resto de la red.

3.4 Extensiones por institución
Lo que cada institución agrega sobre el núcleo:

Hospital general. Agenda de citas por especialidad con control de disponibilidad; admisión y egreso hospitalario con asignación
de cama; notas de evolución durante la estancia; procedimientos y órdenes de estudio dirigidas a otras instituciones de la red. La
regla dura es que consulta, diagnóstico, tratamiento y receta forman una unidad: si falla el guardado de cualquiera de las partes,
no debe quedar nada a medias. Al cierre de la atención se emite una factura que suma la consulta, los procedimientos realizados,
los días de cama de la hospitalización, el material consumido y el honorario de cada miembro del equipo que intervino. Una
cirugía no la hace una sola persona: entran cirujano, ayudante, anestesiólogo, instrumentista y enfermería circulante, y cada uno
cobra según su papel.

Centro médico pediátrico. Responsable o tutor del paciente (obligatorio, porque el paciente es menor de edad); antecedentes
perinatales; mediciones antropométricas con percentiles y puntuaciones Z contra la referencia OMS; esquema de vacunación con
dosis programadas y aplicadas, lote y fabricante; hitos de desarrollo psicomotor. El seguimiento es longitudinal: el valor de la
información está en la serie, no en el dato aislado.

Laboratorio clínico. Orden de examen con médico solicitante e institución de origen; muestras con su condición y trazabilidad;
resultados cuya estructura depende del tipo de examen; valores de referencia que dependen de sexo y edad del paciente;
validación del resultado por un profesional antes de su entrega; la orden se cobra por examen según el tarifario del laboratorio.

Clínica odontológica. Odontograma con el estado de cada pieza dental y de sus superficies; plan de tratamiento por pieza con
sesiones y presupuesto; agenda simplificada operada por la secretaria; el plan de tratamiento lleva presupuesto y se cobra por
sesiones, de modo que el paciente arrastra un saldo pendiente entre visitas.

4. Entidades identificadas

Las entidades se agrupan en tres bloques: el núcleo compartido, presente en las cuatro instituciones; las extensiones
relacionales, propias de Hospital y Pediátrico; y las extensiones documentales, propias de Laboratorio y Odontológica, que se
modelan aquí a nivel de análisis y se implementarán como documentos en la Entrega II.

4.1 Núcleo compartido (las cuatro instituciones)
 #    Entidad              Qué representa                                                              Tipo

 1    INSTITUCION          Cada una de las cuatro organizaciones de la red                             Maestra

 2    PACIENTE             Persona que recibe atención en la institución                               Maestra

 3    CONTACTO_EMERGENCI   Persona a quien avisar si el paciente no puede responder                    Débil (depende de paciente)
      A

 4    EXPEDIENTE           Contenedor del historial clínico del paciente en esa institución            Maestra

 5    ANTECEDENTE          Condición previa del paciente: personal, familiar, quirúrgica o de hábito   Débil (depende de
                                                                                                       expediente)

 6    ALERGIA              Sustancia a la que el paciente reacciona, con severidad y reacción          Débil (depende de
                                                                                                       expediente)

 7    PROFESIONAL          Médico, enfermero, odontólogo o laboratorista que atiende                   Maestra

 8    ESPECIALIDAD         Catálogo de especialidades médicas                                          Catálogo

 9    USUARIO              Credencial de acceso al sistema, ligada a una institución                   Maestra

 1    ROL                  Perfil de acceso: recepción, enfermería, médico, administrador              Catálogo
 0

 11   PERMISO              Acción concreta autorizable dentro del sistema                              Catálogo

 1    ROL_PERMISO          Qué permisos tiene cada rol                                                 Asociativa
 2

 1    CITA                 Reserva de atención en una fecha y hora para un paciente                    Transaccional
 3

 1    CONSULTA             Encuentro clínico efectivamente realizado                                   Transaccional
 4

 1    SIGNOS_VITALES       Medición tomada durante una consulta                                        Débil (depende de consulta)
 5

 1    DIAGNOSTICO          Juicio clínico registrado en una consulta                                   Transaccional
 6

 1    CATALOGO_CIE10       Catálogo estándar internacional de diagnósticos                             Catálogo
 7

 1    TRATAMIENTO          Indicación terapéutica derivada de un diagnóstico                           Transaccional
 8

 1    RECETA               Documento que agrupa los medicamentos prescritos en una consulta            Transaccional
 9

 2    DETALLE_RECETA       Cada medicamento recetado con su dosis e indicaciones                       Asociativa con atributos
 0

 2    MEDICAMENTO          Catálogo de medicamentos disponibles para prescribir                        Catálogo
 1

 2    DOCUMENTO_ADJUNTO    Archivo asociado al expediente o a una consulta                             Débil
 2

 2    BITACORA             Registro de quién hizo qué sobre qué dato y cuándo                          Transaccional
 3

#    Entidad                Qué representa                                                                           Tipo

2    SERVICIO_FACTURABL     Catálogo de lo que la institución cobra, con su precio vigente                           Catálogo
4    E

2    FACTURA                Documento de cobro emitido a un paciente, con su serie y número                          Transaccional
5

2    DETALLE_FACTURA        Cada línea de la factura: qué se cobró, cuánto y a qué precio                            Débil (depende de factura)
6

2    PAGO                   Abono recibido contra una factura; una factura admite varios                             Débil (depende de factura)
7

2    TIPO_PERSONAL          Clase de personal: médico, enfermería, técnico, laboratorista, apoyo                     Catálogo
8

2    ROL_CLINICO            Papel que alguien cumple en un acto: cirujano, anestesiólogo, instrumentista             Catálogo
9

3    TARIFA_HONORARIO       Cuánto cobra un profesional concreto por un servicio concreto                            Maestra
0

3    PARTICIPACION          Quién intervino en una consulta o procedimiento, en qué rol y qué honorario le           Asociativa con atributos
1                           corresponde

3    INSUMO                 Catálogo de material y suministros: gasas, sueros, jeringas, medicamento de              Catálogo
2                           administración

3    CONSUMO_INSUMO         Qué material se gastó, en qué atención y en qué cantidad                                 Transaccional
3

 3    CARGO                  Cada concepto cobrable que genera la atención, antes de facturarse                       Transaccional
4

 3    MUNICIPIO              Catálogo geográfico al que apunta el paciente (municipio de residencia)                 Catálogo
5

4.2 Extensiones del Hospital general (PostgreSQL)
#        Entidad                             Qué representa

36       SERVICIO                            Área o departamento del hospital (medicina interna, cirugía, emergencia)

37       CAMA                                Cama física asignable dentro de un servicio

38       ADMISION                            Ingreso hospitalario del paciente, con egreso y condición de salida

39       NOTA_EVOLUCION                      Registro cronológico del estado del paciente durante la admisión

40       PROCEDIMIENTO                       Intervención realizada al paciente (quirúrgica o diagnóstica)

41       CATALOGO_PROCEDIMIENTO              Catálogo de procedimientos con su código y duración estimada

42       ORDEN_ESTUDIO                       Solicitud de examen que el hospital envía al laboratorio de la red

4.3 Extensiones del Centro médico pediátrico (MySQL)
#        Entidad                                  Qué representa

43       RESPONSABLE                              Padre, madre o tutor legal del paciente menor de edad

44       ANTECEDENTE_PERINATAL                    Datos del nacimiento: semanas de gestación, tipo de parto, Apgar

45       MEDICION_ANTROPOMETRICA                  Peso, talla y perímetro cefálico en una fecha, con percentiles

46       VACUNA                                   Catálogo de vacunas del esquema nacional

47       DOSIS_VACUNA                             Dosis concreta programada o aplicada a un paciente

48       HITO_DESARROLLO                          Catálogo de hitos psicomotores esperados por edad

49       SEGUIMIENTO_HITO                         Registro de si el paciente alcanzó un hito y cuándo

4.4 Extensiones del Laboratorio clínico (MongoDB)
 #     Entidad                      Qué representa

 50     ORDEN_EXAMEN                Solicitud de uno o varios exámenes para un paciente

 51     EXAMEN                      Catálogo de exámenes: tipo, área, método, tiempo de entrega

 52     MUESTRA                     Material biológico recolectado, con su condición y trazabilidad

 53     RESULTADO                   Resultado del examen; su estructura varía según el tipo de examen

 54     VALOR_REFERENCIA            Rango normal de un analito según sexo y edad

RESULTADO es la entidad que motiva la elección de un motor documental: una hematología completa registra hemoglobina,
hematocrito, leucocitos, plaquetas y fórmula diferencial; un examen de orina registra color, aspecto, densidad, pH y sedimento;
un cultivo registra microorganismo aislado, recuento y un antibiograma con una lista variable de antibióticos y su sensibilidad.
Modelarlo en tablas obligaría a columnas dispersas o a un esquema entidad-atributo-valor.

4.5 Extensiones de la Clínica odontológica (Firebase)
 #     Entidad                         Qué representa

 55    ODONTOGRAMA                     Fotografía del estado de la dentadura del paciente en una fecha

 56    PIEZA_DENTAL                    Estado de una pieza concreta y de sus superficies, dentro del odontograma

 57    PROCEDIMIENTO_DENTAL            Catálogo de procedimientos odontológicos con costo de referencia

 58    PLAN_TRATAMIENTO                Conjunto de procedimientos planificados por pieza, con presupuesto

 59    SESION_TRATAMIENTO              Cada visita en la que se avanza el plan

Las once entidades de personal, insumos y cobro pertenecen al núcleo compartido porque las cuatro instituciones tienen equipo
que atiende, material que se gasta y cuentas que cobrar: el hospital cobra consulta, procedimientos y días de cama; el pediátrico,
consulta y vacunas; el laboratorio, cada examen de la orden; y la odontológica, las sesiones del plan de tratamiento. Lo único que
cambia entre ellas es el contenido del catálogo SERVICIO_FACTURABLE , no la estructura. `MUNICIPIO` (n.º 35) también es núcleo
compartido.

CARGO es la pieza que articula lo clínico con lo económico. Cada cosa que se le hace al paciente —la consulta, el procedimiento,
cada día de cama, cada gasa que se gasta, el honorario de cada miembro del equipo— genera un cargo con su precio. La factura
no se construye leyendo el expediente: se construye juntando los cargos pendientes del paciente. Esa separación es lo que permite
que recepción facture sin leer historias clínicas.

Total: 59 entidades identificadas, de las cuales 35 son comunes a las cuatro instituciones, 7 son propias del hospital, 7 del
centro pediátrico, 5 del laboratorio y 5 de la clínica odontológica. `MUNICIPIO` se añadió al inventario (E1-06 / Carlos,
2026-10-14) para que `PACIENTE.id_municipio` tenga destino real.

5. Atributos por entidad

Convenciones usadas en las tablas: PK clave primaria, FK clave foránea, UK clave única alterna. La columna Obl. indica si el
atributo es obligatorio. La columna Clasif. anticipa la sección 9: P pública, C confidencial, R restringida.

5.1 Núcleo compartido

INSTITUCION
 Atributo           Tipo                 Clave    Obl.    Dominio / regla                                         Clasif.

 id_institucion     INT                  PK       Sí      Autoincremental                                         P

 nombre             VARCHAR(120)         UK       Sí      —                                                       P

 tipo               VARCHAR(30)                   Sí      hospital, pediatrico, laboratorio, odontologica         P

 nit                VARCHAR(15)          UK       Sí      Formato NIT Guatemala                                   P

 direccion          VARCHAR(200)                  Sí      —                                                       P

 telefono           VARCHAR(20)                   Sí      —                                                       P

 correo             VARCHAR(120)                  No      Formato correo válido                                   P

 motor_datos        VARCHAR(20)                   Sí      postgresql, mysql, mongodb, firebase                    C

 activo             BOOLEAN                       Sí      Por defecto verdadero                                   P

MUNICIPIO
Catálogo geográfico al que apunta `PACIENTE.id_municipio`. Añadido al inventario en E1-06 (Carlos, 2026-10-14). Solo se
conserva lo necesario para el destino de la FK; el departamento no se modela como entidad aparte en esta entrega.

 Atributo                  Tipo                  Clave     Obl.      Dominio / regla                             Clasif.

 id_municipio              INT                   PK        Sí        Autoincremental                             P

 nombre                    VARCHAR(80)           UK        Sí        Nombre del municipio                        P

PACIENTE
 Atributo                  Tipo                  Clave     Obl.      Dominio / regla                             Clasif.

 id_paciente               INT                   PK        Sí        Autoincremental                             C

 id_institucion            INT                   FK        Sí        → INSTITUCION                               C

 tipo_documento            VARCHAR(10)                     Sí        DPI, CUI, pasaporte, ninguno                C

 numero_documento          VARCHAR(25)           UK*       No        Único por institución cuando existe         C

 primer_nombre             VARCHAR(50)                     Sí        —                                           C

 segundo_nombre            VARCHAR(50)                     No        —                                           C

 primer_apellido           VARCHAR(50)                     Sí        —                                           C

 segundo_apellido          VARCHAR(50)                     No        —                                           C

 fecha_nacimiento          DATE                            Sí        No puede ser futura                         C

 sexo                      CHAR(1)                         Sí        M, F                                        C

 tipo_sangre               VARCHAR(3)                      No        A+, A-, B+, B-, AB+, AB-, O+, O-            R

 telefono                  VARCHAR(20)                     No        —                                           C

 correo                    VARCHAR(120)                    No        Formato correo válido                       C

 direccion                 VARCHAR(200)                    No        —                                           C

 id_municipio              INT                   FK        No        → MUNICIPIO (catálogo geográfico)           C

 fecha_registro            TIMESTAMP                       Sí        Por defecto fecha actual                    C

 estado                    VARCHAR(15)                     Sí        activo, inactivo                            C

La edad no se almacena: se calcula a partir de fecha_nacimiento . Almacenarla introduciría un dato que queda desactualizado
todos los días (ver sección 8.4).

CONTACTO_EMERGENCIA
Atributo                    Tipo                   Clave          Obl.        Dominio / regla                              Clasif.

id_contacto                 INT                    PK             Sí          Autoincremental                              C

id_paciente                 INT                    FK             Sí          → PACIENTE                                   C

nombre_completo             VARCHAR(120)                          Sí          —                                            C

parentesco                  VARCHAR(30)                           Sí          padre, madre, hijo, cónyuge, otro            C

telefono                    VARCHAR(20)                           Sí          —                                            C

telefono_alterno            VARCHAR(20)                           No          —                                            C

es_principal                BOOLEAN                               Sí          Solo uno principal por paciente              C

EXPEDIENTE
Atributo               Tipo                Clave        Obl.        Dominio / regla                                            Clasif.

id_expediente          INT                 PK           Sí          Autoincremental                                            C

id_paciente            INT                 FK, UK       Sí          → PACIENTE, relación 1:1                                   C

numero_expediente      VARCHAR(20)         UK           Sí          Único por institución                                      C

fecha_apertura         DATE                             Sí          Por defecto fecha actual                                   C

estado                 VARCHAR(15)                      Sí          activo, archivado                                          C

fecha_archivo          DATE                             No          Obligatoria si estado = archivado                          C

motivo_archivo         VARCHAR(30)                      No          traslado, fallecimiento, administrativo, inactividad       R

observacion_archivo    VARCHAR(300)                     No          —                                                          R

ANTECEDENTE
Atributo              Tipo                   Clave           Obl.         Dominio / regla                                  Clasif.

id_antecedente        INT                    PK              Sí           Autoincremental                                  R

id_expediente         INT                    FK              Sí           → EXPEDIENTE                                     R

tipo                  VARCHAR(20)                            Sí           personal, familiar, quirurgico, habito           R

descripcion           VARCHAR(300)                           Sí           —                                                R

fecha_inicio          DATE                                   No           No puede ser futura                              R

vigente               BOOLEAN                                Sí           Por defecto verdadero                            R

fecha_registro        TIMESTAMP                              Sí           Por defecto fecha actual                         R

ALERGIA
Atributo              Tipo                  Clave          Obl.         Dominio / regla                                    Clasif.

id_alergia            INT                   PK             Sí           Autoincremental                                    R

id_expediente         INT                   FK             Sí           → EXPEDIENTE                                       R

sustancia             VARCHAR(120)                         Sí           Único junto con id_expediente                      R

tipo                  VARCHAR(20)                          Sí           medicamento, alimento, ambiental, otro             R

severidad             VARCHAR(15)                          Sí           leve, moderada, severa                             R

reaccion              VARCHAR(200)                         No           —                                                  R

fecha_deteccion       DATE                                 No           —                                                  R

PROFESIONAL
La entidad cubre a todo el personal que interviene en la atención, no solo a los médicos: enfermería, anestesiólogos,
instrumentistas, laboratoristas, técnicos de imagen y personal de apoyo. El atributo id_tipo_personal es el que los distingue,
y numero_colegiado pasa a ser opcional porque no todas las categorías se colegian.

 Atributo                            Tipo                   Clave            Obl.       Dominio / regla                                   Clasif.

 id_profesional                      INT                    PK               Sí         Autoincremental                                   P

 id_institucion                      INT                    FK               Sí         → INSTITUCION                                     P

 id_tipo_personal                    INT                    FK               Sí         → TIPO_PERSONAL                                   P

 numero_colegiado                    VARCHAR(15)            UK               No         Si TIPO_PERSONAL.requiere_colegiado: obligatorio; si no: NULL (nunca cadena vacía). UNIQUE entre no nulos (E1-06)       P

 nombres                             VARCHAR(80)                             Sí         —                                                 P

 apellidos                           VARCHAR(80)                             Sí         —                                                 P

 id_especialidad                     INT                    FK               No         → ESPECIALIDAD; solo aplica a médicos             P

 telefono                            VARCHAR(20)                             No         —                                                 C

 correo                              VARCHAR(120)                            No         —                                                 C

 modalidad_contrato                  VARCHAR(20)                             Sí         planilla, honorarios, externo                     C

 fecha_ingreso                       DATE                                    Sí         No puede ser futura                               C

 activo                              BOOLEAN                                 Sí         Por defecto verdadero                             P

La modalidad de contrato importa para el cobro: quien está en planilla no genera honorario por acto —su sueldo no depende de
cuántas cirugías haga—, mientras que quien trabaja por honorarios cobra por cada intervención. La sección 5.1 lo retoma en
 TARIFA_HONORARIO .

ESPECIALIDAD
 Atributo                              Tipo                                   Clave             Obl.            Dominio / regla       Clasif.

 id_especialidad                       INT                                    PK                Sí              Autoincremental       P

 nombre                                VARCHAR(80)                            UK                Sí              —                     P

 descripcion                           VARCHAR(200)                                             No              —                     P

USUARIO
 Atributo                      Tipo                   Clave        Obl.           Dominio / regla                                          Clasif.

 id_usuario                    INT                    PK           Sí             Autoincremental                                          C

 id_institucion                INT                    FK           Sí             → INSTITUCION; determina el motor de datos               C

 id_profesional                INT                    FK           No             → PROFESIONAL; nulo para personal no clínico             C

 nombre_usuario                VARCHAR(40)            UK           Sí             —                                                        C

 correo                        VARCHAR(120)           UK           Sí             —                                                        C

 hash_contrasena               VARCHAR(255)                        Sí             Argon2id; nunca se almacena en claro                     R

 id_rol                        INT                    FK           Sí             → ROL                                                    C

 estado                        VARCHAR(15)                         Sí             activo, bloqueado, inactivo                              C

 intentos_fallidos             SMALLINT                            Sí             Bloqueo al llegar a 5                                    R

 ultimo_acceso                 TIMESTAMP                           No             —                                                        R

ROL, PERMISO y ROL_PERMISO
 Entidad              Atributo             Tipo            Clave        Obl.        Dominio / regla

 ROL                  id_rol               INT             PK           Sí          Autoincremental

Entidad               Atributo             Tipo                Clave       Obl.       Dominio / regla

ROL                   nombre               VARCHAR(40)         UK          Sí         recepcion, enfermeria, medico, laboratorista, odontologo, administrador

ROL                   descripcion          VARCHAR(200)                    No         —

PERMISO               id_permiso           INT                 PK          Sí         Autoincremental

PERMISO               codigo               VARCHAR(60)         UK          Sí         Ej. expediente.leer , diagnostico.crear

PERMISO               descripcion          VARCHAR(200)                    Sí         —

PERMISO               nivel_dato           VARCHAR(15)                     Sí         publica, confidencial, restringida

ROL_PERMISO           id_rol               INT                 PK, FK      Sí         → ROL

ROL_PERMISO           id_permiso           INT                 PK, FK      Sí         → PERMISO

CITA
Atributo                       Tipo                      Clave      Obl.        Dominio / regla                                                              Clasif.

id_cita                        INT                       PK         Sí          Autoincremental                                                              C

id_paciente                    INT                       FK         Sí          → PACIENTE                                                                   C

id_profesional                 INT                       FK         Sí          → PROFESIONAL                                                                C

id_especialidad                INT                       FK         No          → ESPECIALIDAD                                                               P

fecha_hora                     TIMESTAMP                 UK*        Sí          Único junto con id_profesional                                               C

duracion_minutos               SMALLINT                             Sí          Mayor que 0, por defecto 30                                                  P

motivo                         VARCHAR(200)                         No          —                                                                            R

estado                         VARCHAR(20)                          Sí          programada, confirmada, atendida, cancelada, no_asistio                      C

id_usuario_registra            INT                       FK         Sí          → USUARIO                                                                    C

fecha_creacion                 TIMESTAMP                            Sí          Por defecto fecha actual                                                     C

CONSULTA
Atributo                             Tipo                        Clave           Obl.       Dominio / regla                                              Clasif.

id_consulta                          INT                         PK              Sí         Autoincremental                                              R

id_expediente                        INT                         FK              Sí         → EXPEDIENTE                                                 R

id_profesional                       INT                         FK              Sí         → PROFESIONAL                                                R

id_cita                              INT                         FK              No         → CITA; nulo si es atención espontánea                       C

fecha_hora_inicio                    TIMESTAMP                                   Sí         —                                                            C

fecha_hora_fin                       TIMESTAMP                                   No         Debe ser posterior al inicio                                 C

tipo                                 VARCHAR(20)                                 Sí         primera_vez, seguimiento, emergencia                         C

motivo_consulta                      VARCHAR(300)                                Sí         —                                                            R

enfermedad_actual                    TEXT                                        No         —                                                            R

exploracion_fisica                   TEXT                                        No         —                                                            R

plan                                 TEXT                                        No         —                                                            R

estado                               VARCHAR(15)                                 Sí         abierta, cerrada, anulada                                    C

SIGNOS_VITALES
Atributo                                          Tipo                           Clave          Obl.       Dominio / regla                           Clasif.

id_signos                                         INT                            PK             Sí         Autoincremental                           R

id_consulta                                       INT                            FK             Sí         → CONSULTA                                R

fecha_hora_toma                                   TIMESTAMP                                     Sí         Por defecto fecha actual                  R

 Atributo                                Tipo                           Clave           Obl.        Dominio / regla                     Clasif.

 presion_sistolica                       SMALLINT                                       No          Entre 50 y 300                      R

 presion_diastolica                      SMALLINT                                       No          Entre 30 y 200                      R

 frecuencia_cardiaca                     SMALLINT                                       No          Entre 20 y 250                      R

 frecuencia_respiratoria                 SMALLINT                                       No          Entre 5 y 80                        R

 temperatura_c                           DECIMAL(4,1)                                   No          Entre 30.0 y 45.0                   R

 saturacion_oxigeno                      SMALLINT                                       No          Entre 50 y 100                      R

 peso_kg                                 DECIMAL(5,2)                                   No          Mayor que 0                         R

 talla_cm                                DECIMAL(5,1)                                   No          Mayor que 0                         R

El índice de masa corporal no se almacena: se deriva de peso y talla (sección 8.4).

DIAGNOSTICO
 Atributo                  Tipo                       Clave             Obl.        Dominio / regla                                     Clasif.

 id_diagnostico            INT                        PK                Sí          Autoincremental                                     R

 id_consulta               INT                        FK                Sí          → CONSULTA                                          R

 codigo_cie10              VARCHAR(8)                 FK                No          → CATALOGO_CIE10                                    R

 descripcion               VARCHAR(300)                                 Sí          Obligatoria si no hay código CIE-10                 R

 tipo                      VARCHAR(15)                                  Sí          presuntivo, definitivo, descartado                  R

 es_principal              BOOLEAN                                      Sí          Solo uno principal por consulta                     R

 fecha_registro            TIMESTAMP                                    Sí          Por defecto fecha actual                            R

CATALOGO_CIE10
 Atributo                     Tipo                                 Clave               Obl.        Dominio / regla                  Clasif.

 codigo_cie10                 VARCHAR(8)                           PK                  Sí          Código oficial OMS               P

 descripcion                  VARCHAR(300)                                             Sí          —                                P

 capitulo                     VARCHAR(120)                                             No          —                                P

TRATAMIENTO
 Atributo                   Tipo                 Clave        Obl.           Dominio / regla                                                Clasif.

 id_tratamiento             INT                  PK           Sí             Autoincremental                                                R

 id_diagnostico             INT                  FK           Sí             → DIAGNOSTICO                                                  R

 tipo                       VARCHAR(20)                       Sí             farmacologico, procedimiento, terapia, reposo, dieta           R

 descripcion                VARCHAR(300)                      Sí             —                                                              R

 indicaciones               TEXT                              No             —                                                              R

 fecha_inicio               DATE                              Sí             —                                                              R

 fecha_fin_estimada         DATE                              No             Posterior a fecha_inicio                                       R

 estado                     VARCHAR(15)                       Sí             vigente, finalizado, suspendido                                R

RECETA y DETALLE_RECETA
 Entidad                   Atributo              Tipo                          Clave        Obl.   Dominio / regla                          Clasif.

 RECETA                    id_receta             INT                           PK           Sí     Autoincremental                          R

 RECETA                    id_consulta           INT                           FK           Sí     → CONSULTA                               R

 RECETA                    folio                 VARCHAR(20)                   UK           Sí     Correlativo por institución              C

 Entidad                     Atributo                 Tipo                Clave        Obl.   Dominio / regla                                 Clasif.

 RECETA                      fecha_emision            TIMESTAMP                        Sí     Por defecto fecha actual                        C

 RECETA                      id_profesional           INT                 FK           Sí     → PROFESIONAL, quien firma                      C

 RECETA                      observaciones            VARCHAR(300)                     No     —                                               R

 RECETA                      estado                   VARCHAR(15)                      Sí     emitida, anulada                                C

 DETALLE_RECETA              id_receta                INT                 PK, FK       Sí     → RECETA                                        R

 DETALLE_RECETA              id_medicamento           INT                 PK, FK       Sí     → MEDICAMENTO                                   R

 DETALLE_RECETA              dosis                    VARCHAR(60)                      Sí     Ej. "500 mg"                                    R

 DETALLE_RECETA              via_administracion       VARCHAR(20)                      Sí     oral, intravenosa, tópica, intramuscular        R

 DETALLE_RECETA              frecuencia_horas         SMALLINT                         Sí     Mayor que 0                                     R

 DETALLE_RECETA              duracion_dias            SMALLINT                         Sí     Mayor que 0                                     R

 DETALLE_RECETA              cantidad                 SMALLINT                         Sí     Mayor que 0                                     R

 DETALLE_RECETA              indicaciones             VARCHAR(200)                     No     —                                               R

MEDICAMENTO
 Atributo                             Tipo                     Clave       Obl.       Dominio / regla                                    Clasif.

 id_medicamento                       INT                      PK          Sí         Autoincremental                                    P

 nombre_generico                      VARCHAR(120)                         Sí         —                                                  P

 nombre_comercial                     VARCHAR(120)                         No         —                                                  P

 principio_activo                     VARCHAR(120)                         Sí         —                                                  P

 concentracion                        VARCHAR(40)                          Sí         Ej. "500 mg"                                       P

 forma_farmaceutica                   VARCHAR(40)                          Sí         tableta, jarabe, inyectable, crema                 P

 presentacion                         VARCHAR(60)                          No         —                                                  P

 requiere_receta                      BOOLEAN                              Sí         —                                                  P

 activo                               BOOLEAN                              Sí         —                                                  P

SERVICIO_FACTURABLE
 Atributo             Tipo                    Clave     Obl.   Dominio / regla                                                                Clasif.

 codigo_servicio      VARCHAR(12)             PK        Sí     Correlativo del tarifario                                                      P

 id_institucion       INT                     FK        Sí     → INSTITUCION; cada una tiene su tarifario                                     P

 nombre               VARCHAR(120)                      Sí     —                                                                              P

 tipo                 VARCHAR(25)                       Sí     consulta, procedimiento, examen, medicamento, estancia, otro                   P

 precio_unitario      DECIMAL(10,2)                     Sí     Mayor que 0; en quetzales                                                      P

 unidad               VARCHAR(20)                       Sí     sesión, día, unidad, examen                                                    P

 afecto_iva           BOOLEAN                           Sí     Por defecto verdadero                                                          P

 vigente              BOOLEAN                           Sí     Por defecto verdadero                                                          P

El tarifario es información pública: es el precio de lista que la institución publica. Lo que sí es confidencial es cuánto se le cobró
a un paciente concreto.

FACTURA
 Atributo                    Tipo                     Clave      Obl.    Dominio / regla                                                     Clasif.

 id_factura                  INT                      PK         Sí      Autoincremental                                                     C

 id_institucion              INT                      FK         Sí      → INSTITUCION, quien emite                                          P

 Atributo               Tipo                  Clave     Obl.    Dominio / regla                                            Clasif.

 id_paciente            INT                   FK        Sí      → PACIENTE                                                 C

 serie                  VARCHAR(10)           UK*       Sí      Único junto con numero                                     C

 numero                 INT                   UK*       Sí      Correlativo por serie, sin saltos                          C

 fecha_emision          TIMESTAMP                       Sí      Por defecto fecha actual                                   C

 nombre_receptor        VARCHAR(150)                    Sí      Puede diferir del paciente (quien paga)                    C

 nit_receptor           VARCHAR(15)                     Sí      NIT o la marca CF de consumidor final                      C

 subtotal               DECIMAL(10,2)                   Sí      Suma de las líneas antes de impuesto                       C

 descuento              DECIMAL(10,2)                   Sí      Por defecto 0; no puede exceder el subtotal                C

 impuesto               DECIMAL(10,2)                   Sí      IVA del 12 % sobre la base afecta                          C

 total                  DECIMAL(10,2)                   Sí      subtotal − descuento + impuesto                            C

 cobertura_seguro       DECIMAL(10,2)                   No      Parte que asume la aseguradora                             C

 saldo_pendiente        DECIMAL(10,2)                   Sí      total − cobertura − pagos aplicados                        C

 estado                 VARCHAR(15)                     Sí      emitida, pagada, parcial, anulada                          C

 motivo_anulacion       VARCHAR(200)                    No      Obligatorio si estado = anulada                            C

 id_usuario_emite       INT                   FK        Sí      → USUARIO                                                  C

 autorizacion_fel       VARCHAR(60)                     No      Número de autorización de la factura electrónica           C

saldo_pendiente se almacena de forma deliberada, no como redundancia: es el dato que la recepción consulta cientos de
veces al día y recalcularlo exigiría recorrer todos los pagos de la factura en cada consulta. La sección 8.4 justifica esta y las
demás columnas calculadas.

DETALLE_FACTURA
 Atributo             Tipo                   Clave       Obl.    Dominio / regla                                          Clasif.

 id_factura           INT                    PK, FK      Sí      → FACTURA                                                C

 linea                SMALLINT               PK          Sí      Correlativo dentro de la factura, desde 1                C

 codigo_servicio      VARCHAR(12)            FK          Sí      → SERVICIO_FACTURABLE                                    C

 descripcion          VARCHAR(150)                       Sí      Copia del nombre al momento de facturar                  C

 cantidad             DECIMAL(8,2)                       Sí      Mayor que 0                                              C

 precio_unitario      DECIMAL(10,2)                      Sí      Precio vigente el día de la emisión                      C

 subtotal_linea       DECIMAL(10,2)                      Sí      cantidad × precio_unitario                               C

 id_cargo             INT                    FK, UK      Sí      → CARGO; un cargo se factura una sola vez                C

La línea ya no apunta directamente a la consulta ni al procedimiento: apunta a un cargo, que es donde vive el vínculo con el acto
clínico que lo originó. Esa indirección es deliberada y tiene dos efectos. Primero, evita repetir en el detalle cinco claves foráneas
opcionales, una por cada tipo de origen posible. Segundo, y más importante, permite que recepción trabaje con las facturas sin
tocar la tabla que sabe qué procedimiento se le hizo al paciente. id_cargo es único: un cargo entra en una sola factura, lo que
impide cobrar dos veces lo mismo.

PAGO
 Atributo                Tipo                 Clave     Obl.     Dominio / regla                                           Clasif.

 id_pago                 INT                  PK        Sí       Autoincremental                                           C

 id_factura              INT                  FK        Sí       → FACTURA                                                 C

 fecha_hora              TIMESTAMP                      Sí       Por defecto fecha actual                                  C

 monto                   DECIMAL(10,2)                  Sí       Mayor que 0; no puede exceder el saldo                    C

 metodo                  VARCHAR(20)                    Sí       efectivo, tarjeta, transferencia, seguro                  C

 Atributo                     Tipo                 Clave         Obl.        Dominio / regla                                                Clasif.

 referencia                   VARCHAR(60)                        No          Número de boleta, autorización o transferencia                 C

 id_usuario_recibe            INT                  FK            Sí          → USUARIO                                                      C

 anulado                      BOOLEAN                            Sí          Un pago no se borra: se marca anulado                          C

TIPO_PERSONAL y ROL_CLINICO
 Entidad           Atributo          Tipo          Clav    Obl        Dominio / regla                                                           Clasi
                                                   e       .                                                                                    f.

 TIPO_PERSO        id_tipo_person    INT           PK      Sí         Autoincremental                                                           P
 NAL               al

 TIPO_PERSO        nombre            VARCHAR(4     UK      Sí         médico, enfermería, anestesiología, técnico, laboratorista, apoyo         P
 NAL                                 0)

 TIPO_PERSO        requiere_colegi   BOOLEAN               Sí         Determina si el colegiado es obligatorio                                  P
 NAL               ado

 TIPO_PERSO        genera_honora     BOOLEAN               Sí         Si esta categoría puede cobrar por acto                                   P
 NAL               rio

 ROL_CLINICO       codigo_rol        VARCHAR(1     PK      Sí         —                                                                         P
                                     5)

 ROL_CLINICO       nombre            VARCHAR(6     UK      Sí         cirujano principal, primer ayudante, anestesiólogo, instrumentista,       P
                                     0)                               circulante, médico tratante

 ROL_CLINICO       factor_honorari   DECIMAL(4,            Sí         Entre 0 y 1; proporción de la tarifa que le corresponde a ese rol         P
                   o                 3)

 ROL_CLINICO       descripcion       VARCHAR(2             No         —                                                                         P
                                     00)

 factor_honorario es lo que resuelve el problema de repartir el pago de una cirugía entre varias personas. El cirujano
principal cobra el 100 % de su tarifa, el primer ayudante un 30 %, el anestesiólogo un 40 %: el factor vive en el catálogo de roles,
no repetido en cada intervención.

TARIFA_HONORARIO
 Atributo               Tipo                 Clave          Obl.          Dominio / regla                                                   Clasif.

 id_tarifa              INT                  PK             Sí            Autoincremental                                                   C

 id_profesional         INT                  FK, UK*        Sí            → PROFESIONAL                                                     C

 codigo_servicio        VARCHAR(12)          FK, UK*        Sí            → SERVICIO_FACTURABLE                                             C

 modalidad              VARCHAR(15)                         Sí            monto_fijo, porcentaje                                            C

 monto_fijo             DECIMAL(10,2)                       No            Obligatorio si modalidad = monto_fijo                             R

 porcentaje             DECIMAL(5,2)                        No            Entre 0 y 100; obligatorio si modalidad = porcentaje              R

 vigente_desde          DATE                 UK*            Sí            Único junto con profesional y servicio                            C

 vigente_hasta          DATE                                No            Nulo mientras la tarifa siga vigente                              C

Esta es la entidad que responde a que un médico no cobra lo mismo por una consulta general que por una cirugía. La tarifa se
define por profesional y por servicio: dos cirujanos del mismo hospital pueden cobrar distinto por la misma operación, y el
mismo cirujano cobra una cifra por operar y otra por pasar consulta externa. La modalidad permite las dos formas habituales: un
monto fijo por acto, o un porcentaje de lo que la institución le cobra al paciente.

El versionado por fechas es indispensable: subir la tarifa de un médico no puede cambiar lo que se le pagó el mes pasado. Por eso
la clave única incluye vigente_desde y las tarifas no se editan, se cierran con vigente_hasta y se abre una nueva.

Los montos están clasificados como restringidos: son los ingresos de una persona identificable, y ningún usuario clínico tiene
por qué verlos.

PARTICIPACION
 Atributo                     Tipo                    Clave          Obl.      Dominio / regla                                Clasif.

 id_participacion             INT                     PK             Sí        Autoincremental                                R

 id_profesional               INT                     FK, UK*        Sí        → PROFESIONAL                                  R

 codigo_rol                   VARCHAR(15)             FK, UK*        Sí        → ROL_CLINICO                                  R

 id_consulta                  INT                     FK, UK*        No        → CONSULTA                                     R

 id_procedimiento             INT                     FK, UK*        No        → PROCEDIMIENTO                                R

 fecha_hora_inicio            TIMESTAMP                              Sí        —                                              R

 fecha_hora_fin               TIMESTAMP                              No        Posterior al inicio                            R

 honorario_calculado          DECIMAL(10,2)                          No        tarifa × factor del rol, al momento del acto   R

 observacion                  VARCHAR(200)                           No        —                                              R

Un procedimiento quirúrgico tiene varias filas en esta tabla: una por cada persona que entró a sala, cada una con su rol. La
combinación (profesional, rol, acto) es única —nadie cumple dos veces el mismo papel en la misma operación—, pero una
persona sí puede aparecer dos veces con roles distintos.

Exactamente una de las dos referencias, id_consulta o id_procedimiento , debe estar informada: toda participación cuelga
de un acto concreto.

INSUMO
 Atributo              Tipo                   Clave     Obl.    Dominio / regla                                               Clasif.

 id_insumo             INT                    PK        Sí      Autoincremental                                               P

 id_institucion        INT                    FK        Sí      → INSTITUCION                                                 P

 codigo                VARCHAR(20)            UK        Sí      Código de almacén                                             P

 nombre                VARCHAR(120)                     Sí      Ej. gasa estéril 10×10, solución salina 0.9 % 500 ml          P

 tipo                  VARCHAR(25)                      Sí      material, solucion, medicamento, descartable, reactivo        P

 id_medicamento        INT                    FK        No      → MEDICAMENTO, cuando el insumo es un fármaco                 P

 unidad_medida         VARCHAR(20)                      Sí      unidad, caja, frasco, metro, mililitro                        P

 precio_unitario       DECIMAL(10,2)                    Sí      Mayor que 0                                                   P

 codigo_servicio       VARCHAR(12)            FK        No      → SERVICIO_FACTURABLE, si se factura al paciente              P

 requiere_lote         BOOLEAN                          Sí      Los fármacos y reactivos sí; las gasas normalmente no         P

 controlado            BOOLEAN                          Sí      Estupefacientes y psicotrópicos exigen registro estricto      P

 existencia_actual     INT                              Sí      No puede ser negativa                                         C

MEDICAMENTO e INSUMO conviven porque responden preguntas distintas. MEDICAMENTO es el catálogo de prescripción:
principio activo, concentración, forma farmacéutica, lo que el médico escribe en la receta. INSUMO es el catálogo de almacén: lo
que existe físicamente, se descuenta de una existencia y se le cobra al paciente. Un mismo fármaco aparece en ambos, ligado por
 id_medicamento ; una gasa solo aparece en el segundo.

CONSUMO_INSUMO
 Atributo                      Tipo                   Clave     Obl.        Dominio / regla                                   Clasif.

 id_consumo                    INT                    PK        Sí          Autoincremental                                   R

 id_insumo                     INT                    FK        Sí          → INSUMO                                          R

 id_admision                   INT                    FK        No          → ADMISION                                        R

 id_procedimiento              INT                    FK        No          → PROCEDIMIENTO                                   R

 id_consulta                   INT                    FK        No          → CONSULTA                                        R

 Atributo                     Tipo                   Clave       Obl.     Dominio / regla                                        Clasif.

 cantidad                     DECIMAL(8,2)                       Sí       Mayor que 0                                            R

 precio_unitario              DECIMAL(10,2)                      Sí       Precio del insumo el día del consumo                   C

 fecha_hora                   TIMESTAMP                          Sí       Por defecto fecha actual                               R

 lote                         VARCHAR(30)                        No       Obligatorio si el insumo lo requiere                   R

 id_profesional_registra      INT                    FK          Sí       → PROFESIONAL, quien lo gastó o lo entregó             R

Como máximo una de las tres referencias clínicas puede estar informada. En una hospitalización lo normal es que el consumo
cuelgue de la admisión; en una cirugía, del procedimiento.

CARGO
 Atributo             Tipo             Clave    Obl.      Dominio / regla                                                         Clasif.

 id_cargo             INT              PK       Sí        Autoincremental                                                         C

 id_expediente        INT              FK       Sí        → EXPEDIENTE                                                            C

 codigo_servicio      VARCHAR(12)      FK       Sí        → SERVICIO_FACTURABLE                                                   C

 origen               VARCHAR(20)               Sí        consulta, procedimiento, estancia, insumo, honorario, examen, manual    C

 id_consulta          INT              FK       No        → CONSULTA                                                              R

 id_procedimiento     INT              FK       No        → PROCEDIMIENTO                                                         R

 id_admision          INT              FK       No        → ADMISION                                                              R

 id_consumo           INT              FK       No        → CONSUMO_INSUMO                                                        R

 id_participacion     INT              FK       No        → PARTICIPACION                                                         R

 descripcion          VARCHAR(150)              Sí        Texto que se imprimirá en la factura                                    C

 cantidad             DECIMAL(8,2)              Sí        Mayor que 0; días de cama, unidades de gasa, 1 por consulta             C

 precio_unitario      DECIMAL(10,2)             Sí        Precio vigente al generarse el cargo                                    C

 subtotal             DECIMAL(10,2)             Sí        cantidad × precio_unitario                                              C

 fecha_hora           TIMESTAMP                 Sí        Por defecto fecha actual                                                C

 estado               VARCHAR(15)               Sí        pendiente, facturado, anulado, cortesía                                 C

CARGO es el punto donde se juntan las cinco fuentes de cobro del hospital: la consulta, el procedimiento, los días de estancia,
cada insumo gastado y el honorario de cada participante. Todas terminan siendo una fila de esta tabla, con la misma forma.
Facturar deja de ser un problema de recorrer cinco tablas distintas y pasa a ser una consulta simple: los cargos pendientes de este
expediente.

Como máximo una de las cinco referencias de origen está informada; un cargo manual no tiene ninguna.

DOCUMENTO_ADJUNTO y BITACORA
 Entidad                       Atributo              Tipo                   Clave      Obl.      Dominio / regla                  Clasif.

 DOCUMENTO_ADJUNTO             id_documento          INT                    PK         Sí        Autoincremental                  R

 DOCUMENTO_ADJUNTO             id_expediente         INT                    FK         Sí        → EXPEDIENTE                     R

 DOCUMENTO_ADJUNTO             id_consulta           INT                    FK         No        → CONSULTA                       R

 DOCUMENTO_ADJUNTO             nombre_archivo        VARCHAR(160)                      Sí        —                                R

 DOCUMENTO_ADJUNTO             tipo_mime             VARCHAR(60)                       Sí        —                                R

 DOCUMENTO_ADJUNTO             ruta                  VARCHAR(300)                      Sí        —                                R

 DOCUMENTO_ADJUNTO             hash_sha256           CHAR(64)                          Sí        Verificación de integridad       R

 DOCUMENTO_ADJUNTO             fecha_carga           TIMESTAMP                         Sí        —                                R

 BITACORA                      id_bitacora           BIGINT                 PK         Sí        Autoincremental                  R

 Entidad                           Atributo             Tipo                  Clave     Obl.       Dominio / regla                          Clasif.

 BITACORA                          id_usuario           INT                   FK        Sí         → USUARIO                                R

 BITACORA                          entidad              VARCHAR(40)                     Sí         Nombre de la tabla afectada              R

 BITACORA                          id_registro          VARCHAR(40)                     Sí         Identificador del registro afectado      R

 BITACORA                          accion               VARCHAR(15)                     Sí         consulta, alta, modificacion, archivo    R

 BITACORA                          fecha_hora           TIMESTAMP                       Sí         Por defecto fecha actual                 R

 BITACORA                          direccion_ip         VARCHAR(45)                     No         IPv4 o IPv6                              R

 BITACORA                          detalle              JSON / TEXT                     No         Valores antes y después                  R

5.2 Extensiones del Hospital general

SERVICIO y CAMA
 Entidad        Atributo          Tipo            Clave     Obl.   Dominio / regla                                                             Clasif.

 SERVICIO       id_servicio       INT             PK        Sí     Autoincremental                                                             P

 SERVICIO       nombre            VARCHAR(80)     UK        Sí     Ej. medicina interna, cirugía                                               P

 SERVICIO       piso              VARCHAR(20)               No     —                                                                           P

 SERVICIO       activo            BOOLEAN                   Sí     —                                                                           P

 CAMA           id_cama           INT             PK        Sí     Autoincremental                                                             P

 CAMA           id_servicio       INT             FK        Sí     → SERVICIO                                                                  P

 CAMA           codigo            VARCHAR(10)     UK*       Sí     Único junto con id_servicio                                                 P

 CAMA           tipo_cama         VARCHAR(25)               Sí     sala_general, habitación_individual, cuidados_intensivos, aislamiento       P

 CAMA           codigo_servicio   VARCHAR(12)     FK        Sí     → SERVICIO_FACTURABLE, la tarifa por día de esa cama                        P

 CAMA           estado            VARCHAR(15)               Sí     libre, ocupada, mantenimiento                                               C

Ligar la cama a un servicio facturable es lo que hace que una noche en cuidados intensivos cueste distinto que una noche en sala
general, sin necesidad de guardar el precio en la cama: la tarifa vive en un solo lugar y la cama apunta a ella.

ADMISION
 Atributo                          Tipo                   Clave     Obl.      Dominio / regla                                              Clasif.

 id_admision                       INT                    PK        Sí        Autoincremental                                              C

 id_expediente                     INT                    FK        Sí        → EXPEDIENTE                                                 C

 id_consulta_origen                INT                    FK        No        → CONSULTA que motivó el ingreso                             R

 id_cama                           INT                    FK        Sí        → CAMA; la cama pasa a estado ocupada                        C

 tipo_ingreso                      VARCHAR(20)                      Sí        emergencia, programado, referencia                           C

 fecha_hora_ingreso                TIMESTAMP                        Sí        —                                                            C

 fecha_hora_egreso                 TIMESTAMP                        No        Posterior al ingreso                                         C

 id_diagnostico_ingreso            INT                    FK        Sí        → DIAGNOSTICO                                                R

 id_diagnostico_egreso             INT                    FK        No        → DIAGNOSTICO                                                R

 condicion_egreso                  VARCHAR(25)                      No        mejoria, alta_voluntaria, traslado, defuncion                R

 estado                            VARCHAR(15)                      Sí        activa, cerrada                                              C

Regla: un paciente no puede tener dos admisiones con estado activa simultáneamente, y una cama no puede estar asignada a
dos admisiones activas.

NOTA_EVOLUCION
 Atributo                 Tipo                        Clave           Obl.          Dominio / regla                                        Clasif.

 id_nota                  INT                         PK              Sí            Autoincremental                                        R

 id_admision              INT                         FK              Sí            → ADMISION                                             R

 id_profesional           INT                         FK              Sí            → PROFESIONAL                                          R

 fecha_hora               TIMESTAMP                                   Sí            Por defecto fecha actual                               R

 contenido                TEXT                                        Sí            —                                                      R

 turno                    VARCHAR(10)                                 No            matutino, vespertino, nocturno                         C

 id_nota_anterior         INT                         FK              No            → NOTA_EVOLUCION (nota previa); nulo si no es corrección  R

Las notas de evolución son inmutables: una corrección se registra como una nota nueva que referencia la anterior
(`id_nota_anterior`), nunca como una modificación del texto original. (E1-06 / Carlos, elección A.)

PROCEDIMIENTO y CATALOGO_PROCEDIMIENTO
 Entidad                           Atributo                    Tipo                     Clave    Obl.   Dominio / regla                            Clasif.

 CATALOGO_PROCEDIMIENTO            codigo_procedimiento        VARCHAR(10)              PK       Sí     —                                          P

 CATALOGO_PROCEDIMIENTO            nombre                      VARCHAR(150)                      Sí     —                                          P

 CATALOGO_PROCEDIMIENTO            categoria                   VARCHAR(40)                       Sí     quirurgico, diagnostico, terapeutico       P

 CATALOGO_PROCEDIMIENTO            duracion_estimada_min       SMALLINT                          No     Mayor que 0                                P

 PROCEDIMIENTO                     id_procedimiento            INT                      PK       Sí     Autoincremental                            R

 PROCEDIMIENTO                     id_admision                 INT                      FK       No     → ADMISION                                 R

 PROCEDIMIENTO                     id_consulta                 INT                      FK       No     → CONSULTA                                 R

 PROCEDIMIENTO                     codigo_procedimiento        VARCHAR(10)              FK       Sí     → CATALOGO_PROCEDIMIENTO                   R

 PROCEDIMIENTO                     id_profesional              INT                      FK       Sí     → PROFESIONAL responsable                  R

 PROCEDIMIENTO                     fecha_hora                  TIMESTAMP                         Sí     —                                          R

 PROCEDIMIENTO                     sala                        VARCHAR(20)                       No     —                                          C

 PROCEDIMIENTO                     hallazgos                   TEXT                              No     —                                          R

 PROCEDIMIENTO                     complicaciones              TEXT                              No     —                                          R

Regla: id_admision e id_consulta no pueden ser ambos nulos; el procedimiento cuelga de una hospitalización o de una
consulta ambulatoria.

ORDEN_ESTUDIO
 Atributo                   Tipo                    Clave     Obl.         Dominio / regla                                                     Clasif.

 id_orden                   INT                     PK        Sí           Autoincremental                                                     R

 id_consulta                INT                     FK        Sí           → CONSULTA                                                          R

 id_institucion_destino     INT                     FK        Sí           → INSTITUCION (laboratorio de la red)                               C

 tipo_examen                VARCHAR(80)                       Sí           —                                                                   R

 prioridad                  VARCHAR(15)                       Sí           rutina, urgente                                                     C

 indicaciones               VARCHAR(300)                      No           —                                                                   R

 fecha_solicitud            TIMESTAMP                         Sí           Por defecto fecha actual                                            C

 estado                     VARCHAR(20)                       Sí           solicitada, en_proceso, resultado_recibido, anulada                 C

 referencia_externa         VARCHAR(40)                       No           Identificador de la orden en el laboratorio                         C

5.3 Extensiones del Centro médico pediátrico

RESPONSABLE
 Atributo                  Tipo                    Clave          Obl.       Dominio / regla                             Clasif.

 id_responsable            INT                     PK             Sí         Autoincremental                             C

 id_paciente               INT                     FK             Sí         → PACIENTE                                  C

 tipo_documento            VARCHAR(10)                            Sí         DPI, pasaporte                              C

 numero_documento          VARCHAR(25)                            Sí         —                                           C

 nombre_completo           VARCHAR(120)                           Sí         —                                           C

 parentesco                VARCHAR(25)                            Sí         madre, padre, abuelo, tutor_legal, otro     C

 telefono                  VARCHAR(20)                            Sí         —                                           C

 correo                    VARCHAR(120)                           No         —                                           C

 direccion                 VARCHAR(200)                           No         —                                           C

 es_principal              BOOLEAN                                Sí         Exactamente uno principal por paciente      C

Todo paciente pediátrico debe tener al menos un responsable registrado antes de que pueda abrirse su expediente.

ANTECEDENTE_PERINATAL
 Atributo                     Tipo                      Clave              Obl.        Dominio / regla                  Clasif.

 id_expediente                INT                       PK, FK             Sí          → EXPEDIENTE, relación 1:1       R

 semanas_gestacion            SMALLINT                                     No          Entre 20 y 45                    R

 tipo_parto                   VARCHAR(20)                                  No          vaginal, cesarea                 R

 peso_nacimiento_g            SMALLINT                                     No          Entre 300 y 7000                 R

 talla_nacimiento_cm          DECIMAL(4,1)                                 No          Entre 20 y 70                    R

 apgar_1min                   SMALLINT                                     No          Entre 0 y 10                     R

 apgar_5min                   SMALLINT                                     No          Entre 0 y 10                     R

 complicaciones               VARCHAR(300)                                 No          —                                R

MEDICION_ANTROPOMETRICA
 Atributo                  Tipo               Clave        Obl.        Dominio / regla                                      Clasif.

 id_medicion               INT                PK           Sí          Autoincremental                                      R

 id_consulta               INT                FK           Sí          → CONSULTA                                           R

 fecha_medicion            DATE                            Sí          No puede ser futura                                  R

 edad_meses                SMALLINT                        Sí          Edad del paciente en el momento de la medición       R

 peso_kg                   DECIMAL(5,2)                    Sí          Mayor que 0                                          R

 talla_cm                  DECIMAL(5,1)                    Sí          Mayor que 0                                          R

 perimetro_cefalico_cm     DECIMAL(4,1)                    No          Se registra hasta los 36 meses                       R

 percentil_peso_edad       DECIMAL(5,2)                    No          Entre 0 y 100                                        R

 percentil_talla_edad      DECIMAL(5,2)                    No          Entre 0 y 100                                        R

 percentil_pc_edad         DECIMAL(5,2)                    No          Entre 0 y 100                                        R

 puntuacion_z_peso         DECIMAL(4,2)                    No          —                                                    R

 puntuacion_z_talla        DECIMAL(4,2)                    No          —                                                    R

 version_referencia        VARCHAR(20)                     Sí          Ej. "OMS-2006"                                       R

 edad_meses , los percentiles y las puntuaciones Z se almacenan de forma deliberada: son valores históricos calculados contra
una versión concreta de la tabla de referencia OMS. Recalcularlos después contra otra versión cambiaría el dato clínico registrado
(ver sección 8.4).

VACUNA y DOSIS_VACUNA
 Entidad           Atributo                          Tipo                 Clave     Obl.    Dominio / regla                                  Clasif.

 VACUNA            id_vacuna                         INT                  PK        Sí      Autoincremental                                  P

 VACUNA            nombre                            VARCHAR(80)          UK        Sí      Ej. BCG, pentavalente, SPR                       P

 VACUNA            enfermedad_previene               VARCHAR(200)                   Sí      —                                                P

 VACUNA            dosis_totales                     SMALLINT                       Sí      Mayor que 0                                      P

 VACUNA            via_administracion                VARCHAR(20)                    Sí      intramuscular, oral, subcutánea                  P

 VACUNA            edad_recomendada_meses            SMALLINT                       Sí      Edad de la primera dosis                         P

 DOSIS_VACUNA      id_dosis                          INT                  PK        Sí      Autoincremental                                  R

 DOSIS_VACUNA      id_expediente                     INT                  FK        Sí      → EXPEDIENTE                                     R

 DOSIS_VACUNA      id_vacuna                         INT                  FK        Sí      → VACUNA                                         R

 DOSIS_VACUNA      numero_dosis                      SMALLINT                       Sí      Único junto con expediente y vacuna              R

 DOSIS_VACUNA      fecha_programada                  DATE                           Sí      —                                                R

 DOSIS_VACUNA      fecha_aplicacion                  DATE                           No      Obligatoria si estado = aplicada                 R

 DOSIS_VACUNA      lote                              VARCHAR(30)                    No      Obligatorio si estado = aplicada                 R

 DOSIS_VACUNA      fabricante                        VARCHAR(60)                    No      —                                                R

 DOSIS_VACUNA      sitio_aplicacion                  VARCHAR(30)                    No      brazo_izquierdo, muslo_derecho, oral             R

 DOSIS_VACUNA      id_profesional                    INT                  FK        No      → PROFESIONAL que aplicó                         R

 DOSIS_VACUNA      estado                            VARCHAR(20)                    Sí      pendiente, aplicada, omitida, contraindicada     R

 DOSIS_VACUNA      reaccion_adversa                  VARCHAR(300)                   No      —                                                R

HITO_DESARROLLO y SEGUIMIENTO_HITO
 Entidad                  Atributo                    Tipo                 Clave     Obl.    Dominio / regla                                 Clasif.

 HITO_DESARROLLO          id_hito                     INT                  PK        Sí      Autoincremental                                 P

 HITO_DESARROLLO          nombre                      VARCHAR(120)         UK        Sí      Ej. "sostiene la cabeza"                        P

 HITO_DESARROLLO          area                        VARCHAR(30)                    Sí      motor_grueso, motor_fino, lenguaje, social      P

 HITO_DESARROLLO          edad_esperada_meses         SMALLINT                       Sí      Mayor o igual a 0                               P

 SEGUIMIENTO_HITO         id_expediente               INT                  PK, FK    Sí      → EXPEDIENTE                                    R

 SEGUIMIENTO_HITO         id_hito                     INT                  PK, FK    Sí      → HITO_DESARROLLO                               R

 SEGUIMIENTO_HITO         alcanzado                   BOOLEAN                        Sí      —                                               R

 SEGUIMIENTO_HITO         fecha_evaluacion            DATE                           Sí      —                                               R

 SEGUIMIENTO_HITO         observacion                 VARCHAR(300)                   No      —                                               R

5.4 Extensiones del Laboratorio clínico
Estas entidades se implementarán como documentos en MongoDB. Se listan sus atributos lógicos; la decisión de qué se embebe y
qué se referencia se documenta en la Entrega II.

 Entidad       Atributos                                                                                                                         Cla
                                                                                                                                                 sif.

 ORDEN_EXA     id_orden (PK) · id_paciente (FK) · institucion_origen · medico_solicitante · fecha_solicitud · prioridad (rutina/urgente) ·       C/
 MEN           estado (recibida/en_proceso/validada/entregada/anulada) · observaciones · referencia_externa                                      R

 Entidad         Atributos                                                                                                                          Cla
                                                                                                                                                    sif.

 EXAMEN          codigo_examen (PK) · nombre · tipo (hematologia/orina/cultivo/quimica/serologia) · area · metodo · tiempo_entrega_horas ·          P
                 requiere_ayuno

 MUESTRA         id_muestra (PK) · id_orden (FK) · codigo_barras (UK) · tipo_muestra (sangre/orina/heces/hisopado) · fecha_hora_toma ·              C
                 condicion (adecuada/hemolizada/insuficiente) · responsable_toma

 RESULTADO       id_resultado (PK) · id_orden (FK) · codigo_examen (FK) · id_muestra (FK) · fecha_hora_resultado · datos (estructura                R
                 variable) · estado (preliminar/validado/rectificado) · validado_por · fecha_validacion · observaciones

 VALOR_REF       codigo_examen (FK) · analito · sexo (M/F/ambos) · edad_min_meses · edad_max_meses · valor_min · valor_max · unidad                 P
 ERENCIA

El atributo datos de RESULTADO es el que varía por tipo de examen:

 Tipo de         Campos que aparecen
 examen

 Hematología     hemoglobina, hematocrito, leucocitos, plaquetas, eritrocitos, VCM, HCM, y una fórmula diferencial con neutrófilos, linfocitos,
 completa        monocitos, eosinófilos y basófilos

 Orina           color, aspecto, densidad, pH, proteínas, glucosa, cetonas, nitritos, y un sedimento con leucocitos, eritrocitos, células epiteliales,
 (uroanálisis)   bacterias y cristales

 Cultivo y       microorganismo aislado, recuento de colonias, tipo de medio, y una lista de longitud variable de antibióticos, cada uno con su
 antibiograma    sensibilidad (sensible / intermedio / resistente) y su concentración mínima inhibitoria

 Química         una lista de analitos (glucosa, creatinina, urea, colesterol, triglicéridos…) cada uno con valor, unidad y bandera de fuera de rango
 sanguínea

Un mismo RESULTADO puede tener 8 campos o 40 según el examen, y el antibiograma es una colección anidada cuya longitud
depende del microorganismo aislado. Este es el argumento concreto detrás de asignar MongoDB al laboratorio.

5.5 Extensiones de la Clínica odontológica
Estas entidades se implementarán como documentos en Firestore.

 Entidad           Atributos                                                                                                                        Cla
                                                                                                                                                    sif.

 ODONTOGRAM        id_odontograma (PK) · id_expediente (FK) · fecha · notacion (FDI) · id_profesional (FK) · observacion_general                    R
 A

 PIEZA_DENTA       id_odontograma (FK) · numero_pieza (11–48, notación FDI) · estado                                                                R
 L                 (sana/caries/obturada/ausente/corona/implante/endodoncia) · superficies afectadas (mesial, distal, vestibular, lingual,
                   oclusal) · movilidad · observacion

 PROCEDIMIEN       codigo (PK) · nombre · categoria (preventivo/restaurativo/endodoncia/cirugia/protesis) · duracion_estimada_min ·                 P
 TO_DENTAL         costo_referencia

 PLAN_TRATAM       id_plan (PK) · id_expediente (FK) · fecha_elaboracion · id_profesional (FK) · estado                                             R/
 IENTO             (propuesto/aceptado/en_proceso/finalizado/cancelado) · total_estimado · detalle: lista de                                        C

 SESION_TRAT       id_sesion (PK) · id_plan (FK) · id_cita (FK) · fecha · procedimientos_realizados · anestesia_utilizada · observaciones ·         R/
 AMIENTO           saldo_pendiente                                                                                                                  C

El estado de una pieza dental es un dato compuesto: la pieza 26 puede estar obturada en la superficie oclusal y con caries en la
mesial al mismo tiempo. En un modelo relacional puro esto exige una tabla adicional por superficie; en un documento se expresa
como un objeto anidado dentro de la pieza, que es como lo dibuja el odontólogo en papel.

6. Modelo entidad-relación

Los modelos se presentan en notación de Chen, que es la que exige el curso. Se desarrollan para las dos instituciones asignadas a
motores relacionales: el Hospital general y el Centro médico pediátrico.

Cada institución tiene una vista general —todas sus entidades, relaciones y cardinalidades en un solo diagrama— y un conjunto
de diagramas detallados que agregan los atributos de cada módulo en elipses. La vista general responde a la pregunta "cómo se
conecta todo"; los detallados, a "qué guarda cada entidad".

6.1 Notación empleada
 Símbolo                                     Significado

 Rectángulo                                  Entidad fuerte

 Rectángulo doble                            Entidad débil (no existe sin su entidad padre)

 Rombo                                       Relación

 Rombo doble                                 Relación identificadora (la que da identidad a una entidad débil)

 Elipse                                      Atributo

 Elipse con texto subrayado                  Atributo clave (identificador)

 Elipse punteada con texto subrayado         Clave parcial de una entidad débil

 Elipse doble                                Atributo multivaluado

 Elipse punteada                             Atributo derivado (se calcula, no se almacena)

 Elipses encadenadas                         Atributo compuesto y sus componentes

 Línea simple                                Participación parcial: la entidad puede existir sin participar en la relación

 Línea doble                                 Participación total: toda instancia de la entidad participa obligatoriamente

 1·N·M                                       Cardinalidad, escrita junto a la entidad correspondiente

El ejemplo de la figura reúne todos los símbolos sobre entidades reales del modelo: PACIENTE es una entidad fuerte con clave
 id_paciente , atributo compuesto          nombre , atributo multivaluado        telefono   y atributo derivado edad ;
 CONTACTO_EMERGENCIA es una entidad débil cuya clave parcial es nombre_completo y que participa de forma total en la
relación identificadora Declara .

                                    Notación de Chen empleada en este documento

Los archivos fuente de los diagramas entidad-relación están en diagramas/*.dot (Graphviz) y los de los diagramas del
modelo relacional de la sección 7 en diagramas/*.mmd (Mermaid), junto a las versiones renderizadas en PNG.

6.2 Vista general — Hospital general (PostgreSQL)

                                            Modelo entidad-relación del Hospital general

Lectura de las relaciones principales:

 Relación                   Cardinal     Lectura
                            idad

 PACIENTE – Posee –         1:1          Cada paciente tiene exactamente un expediente en la institución, y cada expediente pertenece a un
 EXPEDIENTE                              solo paciente. Participación total en ambos extremos

 EXPEDIENTE – Contiene –    1:N          Un expediente acumula cero o más consultas a lo largo del tiempo; toda consulta pertenece a un
 CONSULTA                                único expediente

 CITA – Se concreta en –    1:1          Una cita puede convertirse en una consulta; una consulta puede existir sin cita previa, por eso la
 CONSULTA                                participación es parcial

 CONSULTA – Produce –       1:N          Una consulta cerrada produce al menos un diagnóstico; el diagnóstico no existe fuera de su consulta
 DIAGNOSTICO

 DIAGNOSTICO – Origina –    1:N          Un diagnóstico puede originar varios tratamientos; todo tratamiento responde a un diagnóstico
 TRATAMIENTO

 CONSULTA – Emite –         1:1          Una consulta emite como máximo una receta; no toda consulta receta medicamentos
 RECETA

 RECETA – Detalla –         M:N          Una receta lleva varios medicamentos y un medicamento aparece en muchas recetas. La relación
 MEDICAMENTO                             tiene atributos propios: dosis, vía, frecuencia, duración y cantidad

 SERVICIO – Contiene –      1:N          Relación identificadora: el código de una cama solo es único dentro de su servicio
 CAMA

 CAMA – Aloja – ADMISION    1:N          Una cama aloja admisiones a lo largo del tiempo, pero solo una activa a la vez

 Relación                     Cardinal    Lectura
                              idad

 ADMISION – Documenta –       1:N         Relación identificadora: las notas de evolución no existen fuera de la hospitalización
 NOTA_EVOLUCION

 CONSULTA – Solicita –        1:N         Una consulta puede pedir varios estudios al laboratorio de la red
 ORDEN_ESTUDIO

6.3 Vista general — Centro médico pediátrico (MySQL)
El pediátrico comparte con el hospital el núcleo de paciente, expediente y atención clínica. Lo que lo distingue son cuatro
relaciones propias:

                                         Modelo entidad-relación del Centro médico pediátrico

 Relación                       Cardin     Lectura
                                alidad

 RESPONSABLE – Representa a     N:1        Un paciente menor de edad tiene uno o varios responsables; cada responsable está ligado a un
 – PACIENTE                                paciente. La participación del paciente es total: no se abre expediente sin responsable

 EXPEDIENTE – Nace con –        1:1        Relación identificadora hacia una entidad débil que extiende el expediente con los datos del
 ANTECEDENTE_PERINATAL                     nacimiento

 CONSULTA – Registra –          1:1        Cada control genera como máximo una medición de peso, talla y perímetro cefálico
 MEDICION_ANTROPOMETRIC
 A

 Relación                       Cardin   Lectura
                                alidad

 EXPEDIENTE – Se cumple con     1:N      El esquema de vacunación del paciente es el conjunto de dosis programadas y aplicadas
 – DOSIS_VACUNA

 VACUNA – Se compone de –       1:N      Cada vacuna del catálogo se administra en un número definido de dosis
 DOSIS_VACUNA

 EXPEDIENTE – Evalúa –          1:N      Registro de qué hitos de desarrollo alcanzó el paciente y cuándo
 SEGUIMIENTO_HITO

6.4 Diagramas detallados con atributos

6.4.1 Paciente y expediente clínico (núcleo común a ambas instituciones)

                                                   Detalle de paciente y expediente

Tres decisiones visibles en este diagrama:

     edad aparece como atributo derivado (elipse punteada): se calcula a partir de fecha_nacimiento y no se almacena.
     telefono aparece como atributo multivaluado (elipse doble) a nivel conceptual; al pasar al modelo relacional se resuelve
    en primera forma normal (sección 8.2).
     nombre es un atributo compuesto que se descompone en cuatro componentes, que son los que efectivamente se
    almacenan.

6.4.2 Agenda, consulta y signos vitales
 SIGNOS_VITALES es entidad débil de CONSULTA : una medición no tiene sentido fuera del encuentro clínico en que se tomó. El
índice de masa corporal aparece como derivado de peso y talla.

                                          Detalle de agenda, consulta y signos vitales

6.4.3 Diagnóstico, tratamiento y receta
Este diagrama contiene la única relación M : N del modelo: Detalla , entre RECETA y MEDICAMENTO . Sus atributos —dosis,
vía de administración, frecuencia, duración, cantidad e indicaciones— cuelgan del rombo, no de las entidades, porque solo tienen
sentido para el par receta-medicamento concreto. Al pasar al modelo relacional esta relación se convierte en la tabla
 DETALLE_RECETA con clave primaria compuesta (sección 7.2).

                                         Detalle de diagnóstico, tratamiento y receta

6.4.4 Hospitalización y procedimientos (Hospital general)
CAMA es entidad débil de SERVICIO : su clave parcial es codigo , único solo dentro del servicio. NOTA_EVOLUCION es
entidad débil de ADMISION y sus registros son inmutables: una corrección se agrega como nota nueva.

                                        Detalle de hospitalización y procedimientos

6.4.5 Acceso, roles y auditoría (núcleo común)
La relación M : N entre ROL y PERMISO se resuelve en el modelo relacional con la tabla puente ROL_PERMISO . El atributo
hash_contrasena de USUARIO es el único dato clasificado como restringido dentro de este módulo (sección 9).

                                            Detalle de acceso, roles y auditoría

6.4.6 Responsable y antecedentes de nacimiento (Centro pediátrico)
La línea doble entre PACIENTE y la relación Representa a expresa participación total: todo paciente pediátrico debe tener
responsable registrado antes de que se le abra expediente.

                                     Detalle de responsable y antecedentes perinatales

6.4.7 Control de crecimiento y desarrollo (Centro pediátrico)
 edad_meses , los percentiles y las puntuaciones Z aparecen como atributos normales, no como derivados, porque son valores
históricos calculados contra la versión de la tabla de referencia OMS indicada en version_referencia . La justificación

completa está en la sección 8.4.

                                        Detalle de control de crecimiento y desarrollo

6.4.8 Esquema de vacunación (Centro pediátrico)
 DOSIS_VACUNA es entidad débil con clave parcial numero_dosis : la dosis número 2 solo se identifica en combinación con el
expediente y la vacuna a la que pertenece.

                                              Detalle del esquema de vacunación

6.4.9 Facturación y cobros (núcleo común)
Tres atributos aparecen como derivados: total se obtiene de subtotal, descuento e impuesto; subtotal_linea , de cantidad
por precio unitario; y saldo_pendiente , del total menos la cobertura del seguro y los pagos aplicados. En el modelo relacional
los tres se almacenan de todos modos, por una razón de rendimiento que la sección 8.4 explica.

DETALLE_FACTURA y PAGO son entidades débiles de FACTURA : una línea suelta o un abono sin factura no significan nada.
Cada línea nace de un cargo, y la relación entre ambos es 1 : 1 —un cargo se cobra una sola vez— con participación parcial del
lado del cargo, porque un cargo puede seguir pendiente de facturar.

                                              Detalle de facturación y cobros

6.4.10 Personal, roles y honorarios (núcleo común)
Este módulo resuelve dos preguntas que el modelo anterior no podía responder: quién participó en una atención y cuánto le
corresponde cobrar.

                                             Detalle de personal, roles y honorarios

 TARIFA_HONORARIO es una relación entre profesional y servicio con atributos propios, y es la que permite que un cirujano cobre
una cifra por operar y otra por pasar consulta externa, y que dos cirujanos del mismo hospital cobren distinto por la misma
operación. Lleva fechas de vigencia porque subir la tarifa de un médico no puede cambiar lo que se le pagó el mes pasado.

PARTICIPACION es la entidad asociativa entre profesional, rol y acto clínico. Una cirugía genera varias filas: cirujano principal,
primer ayudante, anestesiólogo, instrumentista, enfermería circulante. El reparto del pago sale de multiplicar la tarifa del
profesional por el factor_honorario del rol, que vive en el catálogo ROL_CLINICO y no repetido en cada intervención.
 honorario_calculado aparece como derivado porque se obtiene de ese producto, aunque se almacena por la razón que
explica la sección 8.4.

6.4.11 Insumos y captura de cargos (núcleo común)
 INSUMO es el catálogo de almacén: gasas, sueros, jeringas, reactivos y las presentaciones de medicamento que se administran en
sala. Convive con MEDICAMENTO sin duplicarlo, porque responden a preguntas distintas —uno es lo que el médico prescribe, el
otro lo que el almacén entrega— y se enlazan cuando el insumo es un fármaco.

                                             Detalle de insumos y captura de cargos

CARGO es la pieza central del diseño económico. Las cinco fuentes de cobro del hospital —la consulta, el procedimiento, los días
de estancia, cada insumo consumido y el honorario de cada participante— desembocan en filas de esta única tabla, todas con la
misma forma: qué servicio, cuánta cantidad, a qué precio. Las cinco claves foráneas de origen son opcionales y como máximo
una está informada.

La ventaja no es solo de modelado. Facturar deja de exigir un recorrido por cinco tablas clínicas y se convierte en una consulta
sobre los cargos pendientes de un expediente, lo que hace posible que recepción emita facturas sin acceso al contenido clínico.

6.5 Reglas de negocio que el modelo debe garantizar
Hospital general:

 1. Un expediente no puede tener dos admisiones en estado activa al mismo tiempo.
 2. Una cama en estado ocupada no puede asignarse a una segunda admisión activa.
 3. fecha_hora_egreso , cuando existe, debe ser posterior a fecha_hora_ingreso .
 4. Un procedimiento cuelga de una admisión o de una consulta, nunca de ninguna de las dos.
 5. Un profesional no puede tener dos citas a la misma fecha y hora.
 6. Cerrar una consulta escribe consulta, diagnósticos, tratamientos y receta en una sola transacción: o queda todo, o no queda
    nada.
 7. El correlativo (serie, número) de una factura es único y no admite saltos.
 8. La suma de los pagos no anulados de una factura nunca puede superar su total.
 9. Una factura anulada no acepta pagos nuevos y exige motivo de anulación.
10. Un cargo referencia como máximo un origen: consulta, procedimiento, admisión, consumo de insumo o participación, nunca
    dos a la vez.

11. Un cargo se factura una sola vez: DETALLE_FACTURA.id_cargo es único.
12. Nadie cumple dos veces el mismo rol en el mismo acto clínico.
13. Solo el personal cuyo tipo tiene genera_honorario puede tener tarifas y devengar pago por acto; quien está en planilla,
    no.
14. Un insumo marcado como controlado exige lote en cada consumo.
15. La existencia de un insumo nunca puede quedar negativa.

Centro médico pediátrico:

 1. Todo paciente tiene al menos un responsable, y exactamente uno marcado como principal.
 2. La combinación (expediente, vacuna, número de dosis) es única: no se registra dos veces la misma dosis.
 3. numero_dosis no puede exceder dosis_totales de la vacuna correspondiente.
 4. Si el estado de la dosis es aplicada , fecha_aplicacion y lote son obligatorios.
 5. fecha_medicion no puede ser anterior a la fecha de nacimiento del paciente.
 6. perimetro_cefalico_cm solo se exige mientras edad_meses sea menor o igual a 36.

7. Modelo relacional

7.1 Notación
Cada relación se escribe como NOMBRE(atributos) . Los atributos subrayados con __ son clave primaria; los precedidos por
 # son clave foránea; los marcados con * forman una clave única alterna. Todas las relaciones que se presentan están en tercera
forma normal (la justificación está en la sección 8).

7.2 Diagramas del modelo relacional — Hospital general (PostgreSQL)
Los diagramas siguientes muestran el modelo ya convertido a tablas: cada caja es una relación con sus columnas, su tipo de dato
y sus claves. PK marca la clave primaria, FK la clave foránea y UK la clave única alterna. Las líneas usan notación de pata de
gallo: el extremo con tres trazos indica el lado "muchos" de la relación.

La conversión desde el modelo entidad-relación de la sección 6 siguió tres reglas:

 1. Cada entidad, fuerte o débil, se convierte en una tabla.
 2. Cada entidad débil hereda como clave foránea la clave de su entidad padre; su clave parcial se combina con esa foránea para
    formar la clave única.
 3. La única relación M : N del modelo ( Detalla , entre receta y medicamento) se convierte en la tabla DETALLE_RECETA ,
    con clave primaria compuesta por las dos foráneas y los atributos propios de la relación como columnas.

7.2.1 Módulo de paciente y expediente
Este módulo es idéntico en las dos instituciones relacionales. Las tres entidades débiles del expediente —antecedente, alergia y
documento adjunto— se convirtieron en tablas que heredan id_expediente como clave foránea. EXPEDIENTE.id_paciente
es a la vez clave foránea y clave única, que es como se implementa una relación 1 : 1 en un motor relacional.

                                        Modelo relacional — paciente y expediente

7.2.2 Módulo de agenda y consulta
CONSULTA.id_cita      admite   nulos:   así   se   representa   que   una   consulta   puede   existir   sin   cita   previa.
SIGNOS_VITALES.id_consulta es clave foránea y única a la vez, porque se toma como máximo un juego de signos vitales por
consulta. La pareja ( id_profesional , fecha_hora ) de CITA es clave única: impide agendar dos citas del mismo
profesional a la misma hora.

Modelo relacional — agenda y citas

                                    Modelo relacional — consulta y signos vitales

7.2.3 Módulo de diagnóstico, tratamiento y receta
DETALLE_RECETA   es la tabla resultante de resolver la relación M : N. Su clave primaria es el par ( id_receta ,
id_medicamento ), y las columnas dosis , via_administracion , frecuencia_horas , duracion_dias , cantidad e
indicaciones son los atributos que colgaban del rombo en el diagrama ER.

                                   Modelo relacional — diagnóstico, tratamiento y receta

7.2.4 Módulo de hospitalización
 CAMA conserva codigo como clave única compuesta con id_servicio , que es la traducción de su clave parcial en el modelo
ER. PROCEDIMIENTO tiene dos claves foráneas opcionales — id_admision e id_consulta — con la restricción de que
exactamente una debe estar informada.

                                     Modelo relacional — hospitalización y procedimientos

7.2.5 Módulo de facturación y cobros
El correlativo fiscal se implementa como clave única compuesta ( serie , numero ), no como clave primaria: la clave primaria
sigue siendo la sustituta id_factura , porque una serie puede reiniciar su numeración. DETALLE_FACTURA usa clave primaria
compuesta ( id_factura , linea ), que es la traducción directa de una entidad débil con clave parcial. Las tres claves foráneas
de origen clínico admiten nulos y llevan una restricción que impide que más de una esté informada.

                                         Modelo relacional — facturación y cobros

7.2.6 Módulo de personal y honorarios
 TARIFA_HONORARIO lleva clave única compuesta ( id_profesional , codigo_servicio , vigente_desde ): la misma
tarifa puede repetirse en el tiempo, pero no dos veces con la misma fecha de inicio. PARTICIPACION tiene clave única
( id_profesional , codigo_rol , más el acto), que es la traducción de "nadie cumple dos veces el mismo papel en la misma
operación".

                                        Modelo relacional — personal, roles y honorarios

7.2.7 Módulo de insumos y cargos
CARGO concentra cinco claves foráneas opcionales de origen. Es el único punto del modelo donde se admite esa forma, y se
admite porque la alternativa —una tabla de cargos por cada tipo de origen— multiplicaría por cinco las consultas de facturación
sin ganar integridad. La restricción de que exactamente una esté informada se verifica con un CHECK .

                                       Modelo relacional — insumos y captura de cargos

7.3 Diagramas del modelo relacional — Centro médico pediátrico (MySQL)
El pediátrico reutiliza sin cambios los módulos de paciente/expediente y de atención clínica del apartado anterior. Sus tablas
propias y el módulo de acceso, común a las dos instituciones, son los siguientes.

7.3.1 Módulo de acceso, roles y auditoría (común a ambas instituciones)
 ROL_PERMISO es la tabla puente que resuelve la relación M : N entre roles y permisos: su clave primaria es el par de foráneas y
no tiene columnas propias.

                                         Modelo relacional — acceso, roles y auditoría

7.3.2 Módulo de seguimiento pediátrico
ANTECEDENTE_PERINATAL y SEGUIMIENTO_HITO usan como clave primaria la misma clave foránea que las liga a su tabla
padre: la primera porque es una extensión 1 : 1 del expediente, la segunda porque es la tabla puente entre expediente e hitos de
desarrollo.

                                   Modelo relacional — extensiones del Centro pediátrico

7.4 Esquema relacional en notación textual — Hospital general (PostgreSQL)
Módulo institucional y de acceso

 INSTITUCION(__id_institucion__, nombre*, tipo, nit*, direccion, telefono,
             correo, motor_datos, activo)

 ESPECIALIDAD(__id_especialidad__, nombre*, descripcion)

 PROFESIONAL(__id_profesional__, #id_institucion, #id_especialidad,
             numero_colegiado*, nombres, apellidos, telefono, correo, activo)

Nota (E1-06 / Carlos, B): este esquema omite id_tipo_personal , modalidad_contrato y fecha_ingreso .
 numero_colegiado es UNIQUE entre valores no nulos; admite NULL ; nunca cadena vacía.

 ROL(__id_rol__, nombre*, descripcion)

 PERMISO(__id_permiso__, codigo*, descripcion, nivel_dato)

 ROL_PERMISO(__#id_rol, #id_permiso__)

 USUARIO(__id_usuario__, #id_institucion, #id_profesional, #id_rol,
         nombre_usuario*, correo*, hash_contrasena, estado,
         intentos_fallidos, ultimo_acceso)

 BITACORA(__id_bitacora__, #id_usuario, entidad, id_registro, accion,
          fecha_hora, direccion_ip, detalle)

Módulo de paciente y expediente

 MUNICIPIO(__id_municipio__, nombre*)

 PACIENTE(__id_paciente__, #id_institucion, tipo_documento, numero_documento*,
          primer_nombre, segundo_nombre, primer_apellido, segundo_apellido,
          fecha_nacimiento, sexo, tipo_sangre, telefono, correo, direccion,
           #id_municipio, fecha_registro, estado)

 CONTACTO_EMERGENCIA(__id_contacto__, #id_paciente, nombre_completo,
                      parentesco, telefono, telefono_alterno, es_principal)

 EXPEDIENTE(__id_expediente__, #id_paciente*, numero_expediente*,
            fecha_apertura, estado, fecha_archivo, motivo_archivo,
             observacion_archivo)

 ANTECEDENTE(__id_antecedente__, #id_expediente, tipo, descripcion,
              fecha_inicio, vigente, fecha_registro)

 ALERGIA(__id_alergia__, #id_expediente, sustancia*, tipo, severidad,
         reaccion, fecha_deteccion)

 DOCUMENTO_ADJUNTO(__id_documento__, #id_expediente, #id_consulta,
                   nombre_archivo, tipo_mime, ruta, hash_sha256, fecha_carga)

Módulo de atención clínica

 CITA(__id_cita__, #id_paciente, #id_profesional, #id_especialidad,
      fecha_hora*, duracion_minutos, motivo, estado, #id_usuario_registra,
      fecha_creacion)

 CONSULTA(__id_consulta__, #id_expediente, #id_profesional, #id_cita,
          fecha_hora_inicio, fecha_hora_fin, tipo, motivo_consulta,
          enfermedad_actual, exploracion_fisica, plan, estado)

 SIGNOS_VITALES(__id_signos__, #id_consulta*, fecha_hora_toma,
                presion_sistolica, presion_diastolica, frecuencia_cardiaca,
                frecuencia_respiratoria, temperatura_c, saturacion_oxigeno,
                 peso_kg, talla_cm)

 CATALOGO_CIE10(__codigo_cie10__, descripcion, capitulo)

 DIAGNOSTICO(__id_diagnostico__, #id_consulta, #codigo_cie10, descripcion,
             tipo, es_principal, fecha_registro)

 TRATAMIENTO(__id_tratamiento__, #id_diagnostico, tipo, descripcion,
             indicaciones, fecha_inicio, fecha_fin_estimada, estado)

 MEDICAMENTO(__id_medicamento__, nombre_generico, nombre_comercial,
              principio_activo, concentracion, forma_farmaceutica,
              presentacion, requiere_receta, activo)

 RECETA(__id_receta__, #id_consulta*, #id_profesional, folio*,
        fecha_emision, observaciones, estado)

 DETALLE_RECETA(__#id_receta, #id_medicamento__, dosis, via_administracion,
                 frecuencia_horas, duracion_dias, cantidad, indicaciones)

Módulo de personal, honorarios e insumos

 TIPO_PERSONAL(__id_tipo_personal__, nombre*, requiere_colegiado,
               genera_honorario)

 ROL_CLINICO(__codigo_rol__, nombre*, factor_honorario, descripcion)

 TARIFA_HONORARIO(__id_tarifa__, #id_profesional*, #codigo_servicio*,
                   modalidad, monto_fijo, porcentaje, vigente_desde*,
                   vigente_hasta)

 PARTICIPACION(__id_participacion__, #id_profesional*, #codigo_rol*,
                #id_consulta*, #id_procedimiento*, fecha_hora_inicio,
                fecha_hora_fin, honorario_calculado, observacion)

 INSUMO(__id_insumo__, #id_institucion, #id_medicamento, #codigo_servicio,
        codigo*, nombre, tipo, unidad_medida, precio_unitario,
        requiere_lote, controlado, existencia_actual)

 CONSUMO_INSUMO(__id_consumo__, #id_insumo, #id_admision, #id_procedimiento,
                #id_consulta, #id_profesional_registra, cantidad,
                precio_unitario, fecha_hora, lote)

 CARGO(__id_cargo__, #id_expediente, #codigo_servicio, origen, #id_consulta,
       #id_procedimiento, #id_admision, #id_consumo, #id_participacion,
       descripcion, cantidad, precio_unitario, subtotal, fecha_hora, estado)

Módulo de facturación

 SERVICIO_FACTURABLE(__codigo_servicio__, #id_institucion, nombre, tipo,
                     precio_unitario, unidad, afecto_iva, vigente)

 FACTURA(__id_factura__, #id_institucion, #id_paciente, #id_usuario_emite,
         serie*, numero*, fecha_emision, nombre_receptor, nit_receptor,
         subtotal, descuento, impuesto, total, cobertura_seguro,
         saldo_pendiente, estado, motivo_anulacion, autorizacion_fel)

 DETALLE_FACTURA(__#id_factura, linea__, #id_cargo*, descripcion, cantidad,
                 precio_unitario, subtotal_linea)

 PAGO(__id_pago__, #id_factura, #id_usuario_recibe, fecha_hora, monto,
      metodo, referencia, anulado)

Módulo de hospitalización

 SERVICIO(__id_servicio__, nombre*, piso, activo)

 CAMA(__id_cama__, #id_servicio, codigo*, tipo_cama, #codigo_servicio, estado)

 ADMISION(__id_admision__, #id_expediente, #id_consulta_origen, #id_cama,
          #id_diagnostico_ingreso, #id_diagnostico_egreso, tipo_ingreso,
          fecha_hora_ingreso, fecha_hora_egreso, condicion_egreso, estado)

 NOTA_EVOLUCION(__id_nota__, #id_admision, #id_profesional, #id_nota_anterior,
                fecha_hora, contenido, turno)

Nota (E1-06 / Carlos, A): id_nota_anterior es FK opcional a la nota previa (corrección = nota nueva).

 CATALOGO_PROCEDIMIENTO(__codigo_procedimiento__, nombre, categoria,
                            duracion_estimada_min)

 PROCEDIMIENTO(__id_procedimiento__, #id_admision, #id_consulta,
                #codigo_procedimiento, #id_profesional, fecha_hora, sala,
                hallazgos, complicaciones)

 ORDEN_ESTUDIO(__id_orden__, #id_consulta, #id_institucion_destino,
                tipo_examen, prioridad, indicaciones, fecha_solicitud,
                estado, referencia_externa)

Claves únicas compuestas del hospital:

     CAMA(id_servicio, codigo) — el código de cama solo es único dentro de su servicio.
     CITA(id_profesional, fecha_hora) — un profesional no puede tener dos citas a la misma hora.

     ALERGIA(id_expediente, sustancia) — una sustancia se registra una sola vez por expediente.
     FACTURA(serie, numero) — el correlativo fiscal no se repite dentro de una serie.
     DETALLE_FACTURA(id_cargo) — un cargo se cobra en una sola línea de una sola factura.

     TARIFA_HONORARIO(id_profesional, codigo_servicio, vigente_desde) — una tarifa por profesional, servicio y
    fecha de inicio.
     PARTICIPACION(id_profesional, codigo_rol, id_consulta, id_procedimiento) — nadie repite rol en el
    mismo acto.
     CAMA(id_servicio, codigo) y INSUMO(id_institucion, codigo) — códigos únicos dentro de su ámbito.

7.5 Esquema relacional en notación textual — Centro médico pediátrico (MySQL)
El pediátrico reutiliza sin cambios el módulo institucional y de acceso, el módulo de paciente y expediente, el módulo de atención
clínica y el módulo de facturación del esquema anterior. No incluye el módulo de hospitalización. Sus relaciones propias son:

  RESPONSABLE(__id_responsable__, #id_paciente, tipo_documento,
              numero_documento, nombre_completo, parentesco, telefono,
                 correo, direccion, es_principal)

  ANTECEDENTE_PERINATAL(__#id_expediente__, semanas_gestacion, tipo_parto,
                        peso_nacimiento_g, talla_nacimiento_cm, apgar_1min,
                            apgar_5min, complicaciones)

  MEDICION_ANTROPOMETRICA(__id_medicion__, #id_consulta*, fecha_medicion,
                               edad_meses, peso_kg, talla_cm,
                               perimetro_cefalico_cm, percentil_peso_edad,
                               percentil_talla_edad, percentil_pc_edad,
                               puntuacion_z_peso, puntuacion_z_talla,
                               version_referencia)

  VACUNA(__id_vacuna__, nombre*, enfermedad_previene, dosis_totales,
         via_administracion, edad_recomendada_meses)

  DOSIS_VACUNA(__id_dosis__, #id_expediente, #id_vacuna, #id_profesional,
               numero_dosis, fecha_programada, fecha_aplicacion, lote,
                  fabricante, sitio_aplicacion, estado, reaccion_adversa)

  HITO_DESARROLLO(__id_hito__, nombre*, area, edad_esperada_meses)

  SEGUIMIENTO_HITO(__#id_expediente, #id_hito__, alcanzado,
                   fecha_evaluacion, observacion)

Claves únicas compuestas del pediátrico:

     DOSIS_VACUNA(id_expediente, id_vacuna, numero_dosis) — cada dosis se registra una sola vez.

     RESPONSABLE(id_paciente, es_principal) restringido a un solo verdadero por paciente, implementado con índice
    único parcial en PostgreSQL y con verificación en la capa de aplicación más un índice funcional en MySQL.

7.6 Integridad referencial
 Relación hija         Clave foránea       Relación padre             ON        ON        Justificación
                                                                      DELETE    UPDATE

 PACIENTE              id_institucion      INSTITUCION                RESTRI    CASCA     No se borra una institución con pacientes
                                                                      CT        DE

Relación hija      Clave foránea         Relación padre        ON       ON       Justificación
                                                               DELETE   UPDATE

CONTACTO_EMERG     id_paciente           PACIENTE              CASCA    CASCA    El contacto no tiene sentido sin el paciente
ENCIA                                                          DE       DE

EXPEDIENTE         id_paciente           PACIENTE              RESTRI   CASCA    El expediente clínico nunca se borra en
                                                               CT       DE       cascada

ANTECEDENTE        id_expediente         EXPEDIENTE            CASCA    CASCA    Entidad débil del expediente
                                                               DE       DE

ALERGIA            id_expediente         EXPEDIENTE            CASCA    CASCA    Entidad débil del expediente
                                                               DE       DE

CONSULTA           id_expediente         EXPEDIENTE            RESTRI   CASCA    Registro clínico permanente
                                                               CT       DE

CONSULTA           id_cita               CITA                  SET      CASCA    Anular la cita no debe borrar la consulta
                                                               NULL     DE

SIGNOS_VITALES     id_consulta           CONSULTA              CASCA    CASCA    Entidad débil de la consulta
                                                               DE       DE

DIAGNOSTICO        id_consulta           CONSULTA              RESTRI   CASCA    Registro clínico permanente
                                                               CT       DE

DIAGNOSTICO        codigo_cie10          CATALOGO_CIE10        RESTRI   CASCA    Catálogo de referencia
                                                               CT       DE

TRATAMIENTO        id_diagnostico        DIAGNOSTICO           RESTRI   CASCA    Registro clínico permanente
                                                               CT       DE

RECETA             id_consulta           CONSULTA              RESTRI   CASCA    Documento legal
                                                               CT       DE

DETALLE_RECETA     id_receta             RECETA                CASCA    CASCA    El detalle no existe sin su receta
                                                               DE       DE

DETALLE_RECETA     id_medicamento        MEDICAMENTO           RESTRI   CASCA    Catálogo de referencia
                                                               CT       DE

ADMISION           id_expediente         EXPEDIENTE            RESTRI   CASCA    Registro clínico permanente
                                                               CT       DE

ADMISION           id_cama               CAMA                  RESTRI   CASCA    No se borra una cama con historial
                                                               CT       DE

NOTA_EVOLUCION     id_admision           ADMISION              RESTRI   CASCA    Registro clínico permanente e inmutable
                                                               CT       DE

PROCEDIMIENTO      codigo_procedimient   CATALOGO_PROCEDIMIE   RESTRI   CASCA    Catálogo de referencia
                   o                     NTO                   CT       DE

RESPONSABLE        id_paciente           PACIENTE              CASCA    CASCA    El responsable no tiene sentido sin el
                                                               DE       DE       paciente

ANTECEDENTE_PER    id_expediente         EXPEDIENTE            CASCA    CASCA    Extensión 1:1 del expediente
INATAL                                                         DE       DE

MEDICION_ANTROP    id_consulta           CONSULTA              RESTRI   CASCA    Dato clínico histórico
OMETRICA                                                       CT       DE

DOSIS_VACUNA       id_expediente         EXPEDIENTE            RESTRI   CASCA    Registro sanitario permanente
                                                               CT       DE

DOSIS_VACUNA       id_vacuna             VACUNA                RESTRI   CASCA    Catálogo de referencia
                                                               CT       DE

SEGUIMIENTO_HITO   id_expediente         EXPEDIENTE            CASCA    CASCA    Evaluación dependiente del expediente
                                                               DE       DE

USUARIO            id_rol                ROL                   RESTRI   CASCA    No se borra un rol en uso
                                                               CT       DE

ROL_PERMISO        id_rol / id_permiso   ROL / PERMISO         CASCA    CASCA    Tabla puente
                                                               DE       DE

 Relación hija        Clave foránea       Relación padre              ON            ON         Justificación
                                                                      DELETE        UPDATE

 SERVICIO_FACTURA     id_institucion      INSTITUCION                 RESTRI        CASCA      Cada institución tiene su tarifario
 BLE                                                                  CT            DE

 FACTURA              id_paciente         PACIENTE                    RESTRI        CASCA      Documento con valor fiscal
                                                                      CT            DE

 FACTURA              id_usuario_emite    USUARIO                     RESTRI        CASCA      Debe quedar quién la emitió
                                                                      CT            DE

 DETALLE_FACTURA      id_factura          FACTURA                     CASCA         CASCA      La línea no existe sin su factura
                                                                      DE            DE

 DETALLE_FACTURA      codigo_servicio     SERVICIO_FACTURABLE         RESTRI        CASCA      Catálogo de referencia
                                                                      CT            DE

 PAGO                 id_factura          FACTURA                     RESTRI        CASCA      Un pago recibido no se borra, se anula
                                                                      CT            DE

 PACIENTE             id_municipio        MUNICIPIO                   RESTRI        CASCA      Catálogo geográfico (E1-06)
                                                                      CT            DE

 CAMA                 codigo_servicio     SERVICIO_FACTURABLE         RESTRI        CASCA      Tarifa por día de la cama (E1-06)
                                                                      CT            DE

 NOTA_EVOLUCION       id_nota_anterior    NOTA_EVOLUCION              RESTRI        CASCA      Corrección = nota nueva; FK opcional (E1-06)
                                                                      CT            DE

 TARIFA_HONORARIO     id_profesional      PROFESIONAL                 RESTRI        CASCA      El histórico de tarifas se conserva
                                                                      CT            DE

 TARIFA_HONORARIO     codigo_servicio     SERVICIO_FACTURABLE         RESTRI        CASCA      Catálogo de referencia
                                                                      CT            DE

 PARTICIPACION        id_profesional      PROFESIONAL                 RESTRI        CASCA      Registro de quién intervino, permanente
                                                                      CT            DE

 PARTICIPACION        codigo_rol          ROL_CLINICO                 RESTRI        CASCA      Catálogo de referencia
                                                                      CT            DE

 PARTICIPACION        id_consulta /       CONSULTA /                  RESTRI        CASCA      Registro clínico permanente
                      id_procedimiento    PROCEDIMIENTO               CT            DE

 INSUMO               id_medicamento      MEDICAMENTO                 SET           CASCA      El insumo sobrevive aunque se retire el
                                                                      NULL          DE         fármaco del vademécum

 CONSUMO_INSUMO       id_insumo           INSUMO                      RESTRI        CASCA      Trazabilidad de material, permanente
                                                                      CT            DE

 CARGO                id_expediente       EXPEDIENTE                  RESTRI        CASCA      Base del cobro
                                                                      CT            DE

 CARGO                id_consumo /        CONSUMO_INSUMO /            RESTRI        CASCA      El cargo conserva su origen
                      id_participacion    PARTICIPACION               CT            DE

 DETALLE_FACTURA      id_cargo            CARGO                       RESTRI        CASCA      No se borra un cargo ya facturado
                                                                      CT            DE

 BITACORA             id_usuario          USUARIO                     RESTRI        CASCA      La auditoría no se borra jamás
                                                                      CT            DE

El criterio general es que ningún dato clínico se borra en cascada. La baja de un paciente se resuelve archivando su expediente
( estado = archivado con su motivo), no eliminando filas. CASCADE se reserva para entidades débiles que carecen de
sentido sin su padre y para tablas puente.

7.7 Índices propuestos
 Tabla                    Índice                                           Motivo

 PACIENTE                  (id_institucion, numero_documento) único        Búsqueda por documento en la recepción; evita duplicados

 PACIENTE                  (primer_apellido, primer_nombre)                Búsqueda por nombre cuando el paciente no trae documento

 EXPEDIENTE                (numero_expediente) único                       Acceso directo al historial

 CONSULTA                  (id_expediente, fecha_hora_inicio DESC)         Listado cronológico del historial, la consulta más frecuente

 CITA                      (id_profesional, fecha_hora) único              Agenda del día y control de choque de horarios

 CITA                      (fecha_hora, estado)                            Tablero de citas del día

Tabla                Índice                                     Motivo

DIAGNOSTICO          (id_consulta)                              Recuperación del detalle de la consulta

DIAGNOSTICO          (codigo_cie10)                             Reportes de morbilidad

DETALLE_RECETA       (id_medicamento)                           Consumo de medicamentos por período

ADMISION             (estado, id_cama)                          Censo de camas ocupadas

DOSIS_VACUNA         (id_expediente, id_vacuna, numero_dosis)   Esquema de vacunación del paciente
                     único

DOSIS_VACUNA         (estado, fecha_programada)                 Listado de dosis pendientes o atrasadas

MEDICION_ANTROPOME   (id_consulta) + join a expediente          Construcción de la curva de crecimiento
TRICA

FACTURA              (serie, numero) único                      Correlativo fiscal; búsqueda por número de factura

FACTURA              (id_paciente, fecha_emision DESC)          Estado de cuenta del paciente

FACTURA              (estado, saldo_pendiente)                  Listado de facturas pendientes de cobro

DETALLE_FACTURA      (codigo_servicio)                          Reporte de servicios más facturados

PAGO                 (id_factura)                               Suma de abonos de una factura

PAGO                 (fecha_hora, metodo)                       Corte de caja del día

CARGO                (id_expediente, estado)                    Cargos pendientes de facturar de un paciente: la consulta que
                                                                arma la factura

CARGO                (fecha_hora, origen)                       Reporte de ingresos por tipo de concepto

PARTICIPACION        (id_profesional, fecha_hora_inicio)        Liquidación de honorarios de un médico por período

TARIFA_HONORARIO     (id_profesional, codigo_servicio,          Tarifa vigente de un profesional para un servicio
                     vigente_desde DESC)

CONSUMO_INSUMO       (id_admision)                              Material gastado en una hospitalización

CONSUMO_INSUMO       (id_insumo, fecha_hora)                    Consumo de un insumo por período, para reposición

INSUMO               (existencia_actual) parcial donde exista   Alerta de insumos por agotarse
                     mínimo

BITACORA             (entidad, id_registro, fecha_hora)         Rastreo de accesos a un expediente concreto

8. Normalización

8.1 Punto de partida
El levantamiento inicial produjo, como es habitual, una vista plana del expediente: una sola fila por atención con todo lo que el
médico escribe en la hoja. Así se veía:

 numero      nombre    fech     ed    telefono      alergi     fecha    medi     cole   especi     diagnostic     medicamentos            pe   ta   im
 _expedi     _pacie    a_na     ad    s             as         _cons    co       giad   alidad     os                                     so   ll   c
 ente        nte       c                                       ulta              o                                                             a

 EXP-        Ana       1994     32    5512-         penicili   2026-    Dr.      123    Medici     J03.9          Amoxicilina 500mg       62   1    22.
 0417        Ruiz      -03-           3344 /        na,        09-01    Luis     45     na         Amigdalitis;   c/8h 7d; Acetaminofén   .5   6    96
                       02             4478-         maní                Paz             interna    R50 Fiebre     500mg c/6h 3d                5
                                      9010

Esta estructura tiene cinco problemas evidentes: repite los datos del médico en cada fila, mete varios valores en una sola celda,
guarda información derivada, y no permite registrar un diagnóstico sin recetar ni recetar sin diagnóstico.

8.2 Primera forma normal
Regla: todos los atributos deben ser atómicos; no se admiten grupos repetitivos ni listas dentro de una celda.

Atributos que la violaban y cómo se resolvieron:

 Atributo multivaluado original                Resolución

 telefonos con varios números                  PACIENTE.telefono (principal) + tabla CONTACTO_EMERGENCIA con teléfono y teléfono alterno
 separados

 alergias como lista de texto                  Tabla ALERGIA , una fila por sustancia, con tipo, severidad y reacción

 diagnosticos como lista en una celda          Tabla DIAGNOSTICO , una fila por diagnóstico, con su código CIE-10 y marca de principal

 medicamentos como texto con dosis             Tabla DETALLE_RECETA , una fila por medicamento, con dosis, vía, frecuencia, duración y cantidad en
 embebida                                      columnas separadas

 nombre_paciente como cadena                   Descompuesto en primer_nombre , segundo_nombre , primer_apellido , segundo_apellido
 completa

 Fórmula diferencial y antibiograma            En el modelo relacional exigirían tablas hijas; en el modelo documental se resuelven como arreglos
 (laboratorio)                                 anidados (Entrega II)

 Superficies afectadas de una pieza            Igual: tabla hija en relacional, objeto anidado en Firestore
 dental

Después de 1FN toda tabla tiene clave primaria definida y ninguna celda contiene más de un valor.

8.3 Segunda forma normal
Regla: estando en 1FN, todo atributo que no sea clave debe depender de la clave completa, no de una parte de ella. Solo aplica a
tablas con clave primaria compuesta.

Las tres tablas con clave compuesta del modelo y su análisis:

DETALLE_RECETA(id_receta, id_medicamento)

Dependencias funcionales encontradas en el borrador:

  (id_receta, id_medicamento) → dosis, via_administracion, frecuencia_horas,
                                duracion_dias, cantidad, indicaciones     [dependencia completa]
  id_medicamento              → nombre_generico, concentracion,
                                       forma_farmaceutica                             [dependencia parcial]
  id_receta                          → folio, fecha_emision                           [dependencia parcial]

El nombre y la concentración del medicamento no dependen de la receta: dependen solo de id_medicamento . Se movieron a la
relación MEDICAMENTO . El folio y la fecha de emisión dependen solo de id_receta y se movieron a RECETA . En
 DETALLE_RECETA quedaron únicamente los atributos que necesitan las dos partes de la clave para determinarse: la dosis de ese
medicamento en esa receta.

ROL_PERMISO(id_rol, id_permiso)

Es una tabla puente pura, sin atributos propios más allá de la clave. Cumple 2FN de forma trivial. El nombre del rol depende solo
de id_rol y vive en ROL ; la descripción del permiso depende solo de id_permiso y vive en PERMISO .

DETALLE_FACTURA(id_factura, linea)

  (id_factura, linea) → codigo_servicio, descripcion, cantidad,
                        precio_unitario, subtotal_linea                    [dependencia completa]
  id_factura             → serie, numero, fecha_emision, nit_receptor,
                           total, estado                            [dependencia parcial]

La serie, el número y el total son de la factura, no de la línea: repetirlos en cada línea haría que una factura de diez conceptos
guardara diez veces el mismo total, con el riesgo de que uno quedara desactualizado. Se movieron a FACTURA . En el detalle
quedó solo lo que necesita las dos partes de la clave: qué se cobró en esa línea de esa factura.

Caso relacionado:     PARTICIPACION . El borrador usaba la clave compuesta ( id_profesional , codigo_rol ,
 id_procedimiento y arrastraba factor_honorario , que depende solo de codigo_rol , y nombres / apellidos , que
                    )
dependen solo de id_profesional . Ambos grupos son dependencias parciales y se movieron a ROL_CLINICO y
 PROFESIONAL . Se introdujo la clave sustituta id_participacion conservando la terna como clave única.

SEGUIMIENTO_HITO(id_expediente, id_hito)

  (id_expediente, id_hito) → alcanzado, fecha_evaluacion, observacion              [completa]
  id_hito                  → nombre, area, edad_esperada_meses                     [parcial → HITO_DESARROLLO]

El nombre del hito y la edad esperada son propiedades del catálogo, no de la evaluación de un paciente concreto. Se separaron a
HITO_DESARROLLO .

Caso relacionado: DOSIS_VACUNA . El borrador usaba la clave compuesta (id_expediente, id_vacuna, numero_dosis)
y arrastraba nombre_vacuna y dosis_totales , que dependen solo de id_vacuna . Se movieron a VACUNA . Además se
introdujo la clave sustituta id_dosis para simplificar las referencias desde la aplicación, conservando la terna original como
clave única alterna.

8.4 Tercera forma normal
Regla: estando en 2FN, ningún atributo no clave puede depender de otro atributo no clave (no debe haber dependencias
transitivas).

Dependencias transitivas detectadas y eliminadas:

 Tabla del     Dependencia transitiva                                       Corrección
 borrador

 CONSULTA      id_consulta → id_profesional → nombres, apellidos,           Se dejó únicamente id_profesional ; los datos del médico
               numero_colegiado                                             viven en PROFESIONAL

 CONSULTA      id_consulta → id_profesional → id_especialidad →             Cadena doblemente transitiva; se resuelve con la misma
               nombre_especialidad                                          corrección más ESPECIALIDAD

 Tabla del      Dependencia transitiva                                                Corrección
 borrador

 DIAGNOSTIC     id_diagnostico → codigo_cie10 → descripcion_cie10,                    La descripción vive en CATALOGO_CIE10 ; el diagnóstico solo
 O              capitulo                                                              guarda el código

 PACIENTE       id_paciente → id_municipio → nombre_municipio,                        Se conserva solo id_municipio contra el catálogo
                id_departamento → nombre_departamento                                 geográfico

 CITA           id_cita → id_paciente → nombre_paciente                               La agenda muestra el nombre mediante join, no lo
                                                                                      almacena

 ADMISION       id_admision → id_cama → id_servicio → nombre_servicio                 Se conserva solo id_cama ; el servicio se obtiene
                                                                                      navegando

 DETALLE_REC    id_medicamento → principio_activo → ...                               El principio activo es atributo del medicamento, no del
 ETA                                                                                  detalle

 DETALLE_FAC    linea → codigo_servicio → nombre, tipo, unidad,                       Son propiedades del catálogo; el detalle conserva solo el
 TURA           afecto_iva                                                            código

 PAGO           id_pago → id_factura → nit_receptor, total                            Los datos fiscales viven en FACTURA ; el pago solo guarda la
                                                                                      foránea

 CONSUMO_INS    id_consumo → id_insumo → nombre, tipo, unidad_medida                  Propiedades del catálogo de almacén; el consumo guarda
 UMO                                                                                  solo la foránea

 CARGO          id_cargo → codigo_servicio → nombre, tipo, afecto_iva                 El cargo conserva su propia descripción congelada, no la
                                                                                      del catálogo

 TIPO_PERSON     requiere_colegiado / genera_honorario viven en el catálogo            El esquema 7.4 de PROFESIONAL no lleva
 AL /            TIPO_PERSONAL; no se modelan como atributos de la persona             id_tipo_personal (E1-06 / Carlos, B). La
 PROFESIONAL                                                                           obligatoriedad de numero_colegiado se
                                                                                       expresa vía requiere_colegiado en Entrega II

Atributos derivados que se eliminaron:

 Atributo                    Por qué se eliminó                                                   Cómo se obtiene

 edad en PACIENTE            Queda desactualizado cada día; depende de                            Se calcula al consultar
                             fecha_nacimiento y de la fecha actual

 imc en SIGNOS_VITALES       Depende funcionalmente de peso_kg y talla_cm                         Se calcula al consultar, o mediante columna
                                                                                                  generada del motor

 nombre_completo en          Concatenación de cuatro atributos ya presentes                       Se compone en la capa de presentación
 PACIENTE

 total_diagnosticos en       Conteo de filas hijas                                                Se obtiene con una agregación
 CONSULTA

 edad_paciente en CITA       Doblemente derivado                                                  Se calcula al consultar

Valores calculados que sí se almacenan, y por qué no son redundancia:

 Atributo                            Justificación

 MEDICION_ANTROPOMETRICA.edad_me     Es la edad en el momento de la medición, no la edad actual. Es un hecho histórico congelado, no un
 ses                                 derivado del presente

 MEDICION_ANTROPOMETRICA.percent     Se calculan contra una versión concreta de la tabla de referencia OMS, indicada en version_referencia .
 il_* y puntuacion_z_*               Recalcularlos con otra versión alteraría el dato clínico registrado

 RECETA.folio                        Correlativo con valor legal; no se deriva de la clave sustituta

 DOCUMENTO_ADJUNTO.hash_sha256       Prueba de integridad del archivo en el momento de la carga

 BITACORA.detalle                    Copia deliberada del estado anterior y posterior; es la razón de ser de la bitácora

 DETALLE_FACTURA.precio_unitari      Es el precio el día en que se emitió la factura. Si mañana sube la tarifa, las facturas de ayer no pueden
 o                                   cambiar: son documentos con valor fiscal

 DETALLE_FACTURA.descripcion         Igual: el nombre del servicio tal como se imprimió. El catálogo puede renombrarse; lo facturado no

 FACTURA.total y                     Se derivan aritméticamente, pero se materializan para que el documento emitido sea inmutable y no
 DETALLE_FACTURA.subtotal_linea      dependa de recalcular con reglas que pudieron cambiar

 FACTURA.saldo_pendiente             Recalcularlo exigiría sumar todos los pagos en cada consulta de recepción, que es la operación más
                                     frecuente de caja. Se actualiza dentro de la misma transacción que registra el pago

 Atributo                             Justificación

 CONSUMO_INSUMO.precio_unitario       Precio del insumo el día en que se gastó. Los precios de material se mueven con el tipo de cambio; lo
                                      consumido en marzo no puede recotizarse en agosto

 PARTICIPACION.honorario_calcula      Es tarifa × factor de rol en el momento del acto. Ambos factores cambian con el tiempo, y la liquidación de
 do                                   un médico no puede alterarse retroactivamente

 CARGO.precio_unitario ,              Un cargo es una promesa de cobro ya cuantificada: si el tarifario sube antes de que se emita la factura, se
 descripcion y subtotal               cobra el precio que estaba vigente cuando se prestó el servicio

 INSUMO.existencia_actual             Se deriva de las entradas menos los consumos, pero recalcularla en cada dispensación sería recorrer todo
                                      el histórico. Se mantiene en la misma transacción que registra el consumo

En casi todos los casos el valor no es una función de los datos actuales de la fila: es un registro histórico, y almacenarlo no viola
3FN porque no existe dependencia funcional desde otro atributo no clave de la misma relación.

Las tres columnas de la factura merecen una aclaración aparte, porque sí son aritméticamente derivables de otras columnas de su
propia fila. Se trata de una desnormalización deliberada, no de un descuido, y se sostiene en dos argumentos: el documento
fiscal debe quedar congelado tal como se emitió, aunque cambien las reglas de cálculo o la tasa de impuesto; y el saldo se
consulta muchas más veces de las que se modifica. La consistencia se garantiza actualizando estas columnas dentro de la misma
transacción que las origina, nunca por fuera.

8.5 Verificación de forma normal de Boyce-Codd
Se revisó cada relación buscando determinantes que no sean clave candidata:

 Relación            Determinantes encontrados                                       ¿Todos son clave candidata?

 PACIENTE             id_paciente , (id_institucion, numero_documento)               Sí — ambas son claves candidatas

 EXPEDIENTE           id_expediente , id_paciente , numero_expediente                Sí — relación 1:1 con paciente

 CITA                 id_cita , (id_profesional, fecha_hora)                         Sí — la agenda no admite dos citas del mismo médico a la
                                                                                     misma hora

 CAMA                 id_cama , (id_servicio, codigo)                                Sí

 DETALLE_RECETA       (id_receta, id_medicamento)                                    Sí — único determinante

 DOSIS_VACUNA         id_dosis , (id_expediente, id_vacuna, numero_dosis)            Sí

 ALERGIA              id_alergia , (id_expediente, sustancia)                        Sí

 RECETA               id_receta , id_consulta , folio                                Sí

 FACTURA              id_factura , (serie, numero)                                   Sí — el correlativo fiscal identifica la factura

 DETALLE_FACTURA      (id_factura, linea)                                            Sí — único determinante

 SERVICIO_FACTURA     codigo_servicio                                                Sí
 BLE

 TARIFA_HONORARIO     id_tarifa , (id_profesional, codigo_servicio,                  Sí
                     vigente_desde)

 PARTICIPACION        id_participacion , (id_profesional, codigo_rol,                Sí
                     acto)

 INSUMO               id_insumo , (id_institucion, codigo)                           Sí

 CARGO                id_cargo                                                       Sí — único determinante

Ninguna relación presenta un determinante que no sea clave candidata. El esquema está en BCNF, que es más estricta que la
3FN exigida.

8.6 Nota sobre cuarta forma normal
Un paciente tiene, de forma independiente entre sí, varias alergias y varios contactos de emergencia. Guardarlos en una sola tabla
produciría una dependencia multivaluada PACIENTE →→ ALERGIA y PACIENTE →→ CONTACTO , con el producto cartesiano de
ambas listas como resultado. El modelo las mantiene en relaciones separadas, por lo que la situación no llega a presentarse.

8.7 Resultado
 Forma normal    Estado      Evidencia

 1FN             Cumplida    Ningún atributo multivaluado; toda relación con clave primaria

 2FN             Cumplida    Las tres tablas de clave compuesta solo conservan atributos que dependen de la clave completa

 3FN             Cumplida    Siete dependencias transitivas eliminadas; cinco atributos derivados retirados

 BCNF            Cumplida    Todo determinante es clave candidata

 4FN             Cumplida    Las dependencias multivaluadas del paciente están separadas en relaciones propias

Resumen numérico: el modelo relacional del Hospital general quedó con 41 relaciones y el del Centro pediátrico con 41
relaciones (34 del núcleo compartido —incluidas las once de personal, insumos y cobro— más 7 propias de cada uno), todas en
BCNF.

9. Clasificación de la información: pública, confidencial y
restringida

9.1 Criterio
 Nivel       Definición operativa                                              Quién puede verla                    Consecuencia de una fuga

 Públic      Información que la institución publicaría por su propia cuenta    Cualquier usuario autenticado;       Ninguna
 a           o que no identifica a ninguna persona                             parte de ella incluso sin
                                                                               autenticar

 Confid      Datos que identifican a una persona o describen su relación       Personal de la institución con       Exposición de datos personales;
 encial      administrativa con la institución, sin revelar su estado de       necesidad de conocer, según su       incumplimiento de protección de
             salud                                                             rol                                  datos

 Restri      Contenido clínico, credenciales y auditoría. Revela el estado     Solo personal clínico asignado al    Daño directo a la persona:
 ngida       de salud de una persona identificable o permite suplantarla       paciente, y el propio paciente       discriminación, extorsión,
                                                                                                                    suplantación

La regla práctica que se aplicó al clasificar: si el dato, por sí solo o cruzado con el nombre del paciente, revela algo sobre su
salud, es restringido. Si identifica a la persona pero no dice nada de su salud, es confidencial. Si no identifica a nadie, es
público.

Un matiz importante: la existencia de una cita en el laboratorio de VIH o en salud mental es en sí misma información restringida,
aunque el campo solo contenga una fecha. Por eso CITA.motivo está clasificado como restringido aunque el resto de la cita sea
confidencial.

Hay dos casos más donde el dato económico esconde un dato clínico o personal. El material consumido es el primero: una lista
que incluye sutura, anestésico local y guantes estériles describe una intervención quirúrgica aunque no nombre ningún
diagnóstico. El segundo son los honorarios: TARIFA_HONORARIO.monto_fijo y PARTICIPACION.honorario_calculado
son los ingresos de una persona identificable, un dato laboral que ningún usuario clínico ni administrativo necesita ver para hacer
su trabajo. Ambos quedan clasificados como restringidos.

El mismo matiz aplica a la factura, y por eso el módulo de cobros queda partido en dos niveles. Los montos, el NIT y el saldo son
confidenciales: dicen cuánto debe una persona identificable, no de qué está enferma. Pero el concepto de cada línea es
restringido, porque una línea que dice "biopsia" o que apunta a un procedimiento concreto revela el diagnóstico con la misma
claridad que el expediente. Una factura detallada es un documento clínico disfrazado de documento contable.

9.2 Clasificación por institución

Hospital general (PostgreSQL)
 Niv      Datos
 el

 Púb      Nombre, dirección y teléfono del hospital · catálogo de especialidades · directorio de médicos con nombre, especialidad y número de
 lica     colegiado · catálogo CIE-10 · catálogo de medicamentos · catálogo de procedimientos · catálogo de insumos con su precio de lista ·
          catálogo de roles clínicos · nombre de los servicios · disponibilidad de agenda sin identificar al paciente · tarifario de servicios con sus
          precios de lista

 Con      Identidad y contacto del paciente (nombre, documento, fecha de nacimiento, sexo, teléfono, correo, dirección) · contactos de emergencia ·
 fide     número de expediente, fecha de apertura y estado · agenda con el nombre del paciente · fechas de ingreso y egreso · cama y servicio
 nci      asignados · folio y fecha de la receta · datos de contacto del personal · credenciales de usuario salvo la contraseña · serie y número de
 al       factura, NIT y nombre del receptor, montos, saldo pendiente, pagos y método de pago

 Niv      Datos
 el

 Res      Antecedentes · alergias · motivo de consulta, enfermedad actual, exploración física y plan · signos vitales · diagnósticos · tratamientos ·
 trin     medicamentos recetados con su dosis · notas de evolución · hallazgos y complicaciones de procedimientos · condición de egreso · tipo de
 gid      sangre · motivo de archivo del expediente · hash de contraseña e intentos fallidos · bitácora completa · documentos adjuntos · el vínculo
 a        del cargo con la consulta, el procedimiento, la admisión o el consumo · el material consumido en una atención · la tarifa y el
          honorario de cada profesional

Centro médico pediátrico (MySQL)
 Nivel      Datos

 Públic     Nombre, dirección y teléfono del centro · catálogo de vacunas y edades recomendadas · catálogo de hitos de desarrollo · directorio de
 a          pediatras · tablas de referencia OMS

 Confid     Identidad y contacto del paciente menor · identidad y contacto del responsable o tutor · parentesco · número de expediente · agenda
 encial     con nombre del paciente · facturas emitidas al responsable, montos y saldos

 Restri     Antecedentes perinatales (semanas de gestación, tipo de parto, Apgar) · mediciones antropométricas con percentiles y puntuaciones Z ·
 ngida      esquema de vacunación con fechas, lotes y reacciones adversas · seguimiento de hitos de desarrollo · diagnósticos, tratamientos y
            recetas · signos vitales

Los datos de un paciente menor de edad reciben un tratamiento más estricto: el acceso queda condicionado a que el usuario esté
asignado a la atención del paciente, y toda lectura del expediente se registra en bitácora, no solo las modificaciones.

Laboratorio clínico (MongoDB)
 Nivel       Datos

 Pública     Catálogo de exámenes con su nombre, tipo, método y tiempo de entrega · requisitos de preparación (ayuno) · valores de referencia por
             sexo y edad · nombre y dirección del laboratorio · precio de cada examen

 Confide     Identidad y contacto del paciente · médico solicitante e institución de origen · fecha y estado de la orden · código de barras y
 ncial       trazabilidad de la muestra · factura de la orden y su monto

 Restrin     Contenido del resultado (todos los analitos y sus valores) · microorganismo aislado y antibiograma · observaciones del validador · el
 gida        hecho de que se haya solicitado un examen determinado, cuando el examen revela sospecha diagnóstica

Clínica odontológica (Firebase)
 Nivel            Datos

 Pública          Nombre, dirección, teléfono y horarios de la clínica · catálogo de procedimientos con costo de referencia · directorio de odontólogos

 Confidenc        Identidad y contacto del paciente · agenda con nombre del paciente · estado y saldo del plan de tratamiento · total presupuestado ·
 ial              facturas, abonos y saldo pendiente

 Restringid       Odontograma y estado de cada pieza · plan de tratamiento por pieza · observaciones clínicas de cada sesión · anestesia utilizada ·
 a                antecedentes y alergias

9.3 Matriz de acceso por rol
L lectura · E escritura · — sin acceso

 Rol                       Datos       Identidad del     Agen     Contenido clínico      Insum    Facturaci     Honorario      Credenciales        Bitác
                          públicos       paciente         da                               os        ón            s                                ora

 Recepción / caja            L              LE            LE               —              —          LE             —                —               —

 Enfermería                  L               L             L     L E (signos vitales y    LE          —             —                —               —
                                                                       vacunas)

 Médico /                    L               L             L               LE             LE      L (solo el    L (solo el           —               —
 odontólogo                                                                                        saldo)        propio)

 Laboratorista               L               L             L           L E (solo          LE          —             —                —               —
                                                                      resultados)

 Rol                    Datos        Identidad del     Agen     Contenido clínico      Insum    Facturaci     Honorario       Credenciales        Bitác
                       públicos        paciente         da                               os        ón            s                                 ora

 Almacén                   L               —             —              —               LE          —              —                —              —

 Recursos                  L               —             —              —                —          —             LE                —              —
 humanos

 Administrador             L               L             L              —                —           L             —          E (restablecer,       L
 del sistema                                                                                                                   nunca leer)

 Auditor                   L               —             —              —                L           L             L                —               L

Cuatro decisiones deliberadas: recepción no ve contenido clínico —puede agendar, cobrar y registrar al paciente sin leer su
diagnóstico—; el administrador del sistema tampoco lo ve, puede restablecer una contraseña pero no abrir un expediente; el
personal clínico ve el saldo pero no la caja, lo justo para saber si el paciente está al día; y cada médico ve sus propios
honorarios, no los de sus colegas, restricción que se implementa por fila, comparando el profesional del registro con el del
usuario autenticado.

La primera decisión tiene una consecuencia práctica que hay que resolver en la implementación: recepción necesita emitir
facturas cuyas líneas nacen de procedimientos clínicos, pero no debe leer el detalle de esos procedimientos. Se resuelve
exponiéndole una vista de la factura que proyecta la descripción y el monto, y oculta las columnas que apuntan a la consulta, al
procedimiento o a la admisión.

9.4 Cómo se hará cumplir en cada motor
Transversalmente, en las cuatro instituciones: las contraseñas se almacenan con Argon2id y nunca viajan ni se registran en claro;
todo acceso a datos restringidos se escribe en BITACORA ; y ningún dato clínico se elimina físicamente, solo se archiva.

Por motor, los mecanismos previstos para la Entrega II son los siguientes.

 Motor     Mecanismo previsto para la Entrega II

 Postg     Roles de base de datos por perfil ( rol_recepcion , rol_medico , rol_caja , rol_admin ) con GRANT por tabla y por columna; vista de
 reSQ      facturación que oculta a recepción las columnas de origen clínico de DETALLE_FACTURA ; row-level security para limitar por institución;
 L          pgcrypto para columnas restringidas puntuales

 MySQ      Roles de MySQL 8 con GRANT por tabla y columna; vistas con SQL SECURITY DEFINER para el acceso de recepción; cifrado en reposo
 L         con InnoDB tablespace encryption

 Mong      Control de acceso basado en roles con acciones por colección; vistas de solo lectura que proyectan fuera los campos restringidos; field-
 oDB       level encryption para el contenido del resultado

 Fireb     Reglas de seguridad de Firestore que evalúan el rol del token y la pertenencia a la institución antes de permitir lectura de las colecciones
 ase       de odontograma y plan de tratamiento

10. Operaciones que la aplicación necesitará realizar

Esta sección describe qué hace el sistema con los datos, sin decir todavía cómo se implementa. Es el punto de partida de la
Entrega II: cada operación de esta lista deberá funcionar de forma equivalente en los cuatro motores.

Columna Inst.: H Hospital general · P Centro pediátrico · L Laboratorio clínico · O Clínica odontológica.

10.1 Acceso y seguridad
 ID    Operación              Quién              Qué hace, en lenguaje sencillo                                                                   Inst.

 OP-   Iniciar sesión         Cualquier          Verifica usuario y contraseña, y determina a qué institución pertenece la persona para saber     HPL
 01                           usuario            en qué base de datos trabajará durante toda la sesión                                            O

 OP-   Cerrar sesión          Cualquier          Termina la sesión y deja registro de la hora de salida                                           HPL
 02                           usuario                                                                                                             O

 OP-   Cambiar                Cualquier          Reemplaza la contraseña por una nueva, verificando primero la anterior                           HPL
 03    contraseña             usuario                                                                                                             O

 OP-   Restablecer            Administrador      Genera una contraseña temporal para un usuario bloqueado, sin poder ver la anterior              HPL
 04    contraseña                                                                                                                                 O

 OP-   Administrar            Administrador      Da de alta, modifica o desactiva usuarios y les asigna un rol                                    HPL
 05    usuarios y roles                                                                                                                           O

 OP-   Consultar bitácora     Administrador,     Muestra quién consultó o modificó un expediente y cuándo                                         HPL
 06                           auditor                                                                                                             O

10.2 Pacientes
 ID    Operación                     Quién                  Qué hace, en lenguaje sencillo                                                        Inst.

 OP-   Buscar paciente               Recepción,             Encuentra a un paciente por número de documento, número de expediente o               HPL
 07                                  personal clínico       nombre, para saber si ya está registrado                                              O

 OP-   Registrar paciente            Recepción              Guarda los datos de identificación y contacto de alguien que llega por primera vez,   HPL
 08    nuevo                                                verificando que no exista ya                                                          O

 OP-   Actualizar datos del          Recepción              Corrige o completa teléfono, dirección, correo u otros datos personales               HPL
 09    paciente                                                                                                                                   O

 OP-   Registrar contacto de         Recepción              Guarda a quién avisar si el paciente no puede responder por sí mismo                  HPL
 10    emergencia                                                                                                                                 O

 OP-   Registrar responsable o       Recepción              Guarda al padre, madre o tutor legal del paciente menor de edad, obligatorio          P
 11    tutor                                                antes de abrir el expediente

 OP-   Consultar ficha del           Personal clínico       Muestra los datos personales del paciente junto con sus alergias y antecedentes       HPL
 12    paciente                                                                                                                                   O

10.3 Expediente clínico
 ID    Operación          Quién              Qué hace, en lenguaje sencillo                                                                        Inst.

 OP-   Abrir              Recepción          Crea el historial clínico del paciente nuevo, le asigna número y lo deja en estado activo             HP
 13    expediente                                                                                                                                  LO

 OP-   Consultar          Personal           Muestra todas las atenciones del paciente en orden cronológico, de la más reciente a la más           HP
 14    historial          clínico            antigua                                                                                               LO
       completo

 OP-   Registrar          Personal           Anota enfermedades previas, cirugías, antecedentes familiares y hábitos del paciente                  HP
 15    antecedentes       clínico                                                                                                                  LO

ID    Operación          Quién            Qué hace, en lenguaje sencillo                                                                             Inst.

OP-   Registrar          Personal         Anota una sustancia a la que el paciente reacciona, con su severidad                                       HP
16    alergia            clínico                                                                                                                     LO

OP-   Adjuntar           Personal         Sube un archivo al expediente (radiografía, informe externo, consentimiento) y guarda su huella de         HP
17    documento          clínico          integridad                                                                                                 LO

OP-   Archivar           Administrador    Da de baja el historial indicando el motivo: traslado a otra institución, fallecimiento u otra causa       HP
18    expediente         , recepción      administrativa. El expediente deja de aparecer en las búsquedas activas pero no se borra                   LO

OP-   Reactivar          Administrador    Devuelve a estado activo un expediente archivado por error o por regreso del paciente                      HP
19    expediente                                                                                                                                     LO

10.4 Agenda y citas
ID     Operación                 Quién                    Qué hace, en lenguaje sencillo                                                         Inst.

OP-    Consultar                 Recepción,               Muestra los espacios libres de un profesional o especialidad en un rango de fechas     HPO
20     disponibilidad            secretaria

OP-    Agendar cita              Recepción,               Reserva un espacio para un paciente, verificando que el profesional no tenga otra      HPL
21                               secretaria               cita a esa hora                                                                        O

OP-    Reprogramar cita          Recepción,               Cambia la fecha y hora de una cita existente, liberando el espacio anterior            HPL
22                               secretaria                                                                                                      O

OP-    Cancelar cita             Recepción,               Marca la cita como cancelada conservando el registro de que existió                    HPL
23                               secretaria                                                                                                      O

OP-    Registrar llegada         Recepción,               Confirma que el paciente se presentó y lo deja listo para ser atendido                 HPO
24                               secretaria

OP-    Ver agenda del día        Todos                    Lista las citas de la jornada con su estado                                            HPL
25                                                                                                                                               O

10.5 Atención clínica
ID    Operación             Quién             Qué hace, en lenguaje sencillo                                                                         Inst
                                                                                                                                                     .

OP-   Abrir consulta        Personal          Inicia el registro de una atención, ligada a una cita o de forma espontánea, y anota el motivo         HP
26                          clínico                                                                                                                  O

OP-   Registrar signos      Enfermería        Anota presión, pulso, temperatura, saturación, peso y talla del paciente en esa atención               HP
27    vitales

OP-   Registrar             Médico,           Anota uno o varios diagnósticos de la consulta, con su código estándar, indicando cuál es el           HP
28    diagnóstico           odontólogo        principal                                                                                              O

OP-   Registrar             Médico,           Anota la indicación terapéutica que corresponde a un diagnóstico, con fechas de inicio y fin           HP
29    tratamiento           odontólogo                                                                                                               O

OP-   Emitir receta         Médico,           Genera la receta de la consulta con uno o más medicamentos, cada uno con dosis, vía,                   HP
30                          odontólogo        frecuencia y duración                                                                                  O

OP-   Cerrar consulta       Médico,           Da por terminada la atención. Guarda de una sola vez la consulta, sus diagnósticos, sus                HP
31                          odontólogo        tratamientos y su receta: si algo falla, no debe quedar nada a medias                                  O

OP-   Anular consulta       Médico            Invalida una consulta registrada por error, dejando constancia de la anulación en lugar de             HP
32                                            borrarla                                                                                               O

OP-   Consultar recetas     Personal          Muestra qué se le ha recetado al paciente y cuándo, para detectar interacciones o duplicaciones        HP
33    del paciente          clínico                                                                                                                  O

10.6 Hospitalización — Hospital general
ID    Operación                  Quién            Qué hace, en lenguaje sencillo                                                                  Ins
                                                                                                                                                  t.

OP-   Consultar camas            Recepción,       Muestra qué camas están libres en cada servicio                                                 H
34    disponibles                médico

OP-   Registrar ingreso          Médico           Ingresa al paciente, le asigna una cama y registra el diagnóstico de ingreso. La cama           H
35                                                queda ocupada en la misma operación

OP-   Escribir nota de           Personal         Agrega una anotación fechada sobre el estado del paciente durante su estancia; las notas        H
36    evolución                  clínico          no se editan, se agregan

OP-   Registrar                  Médico           Anota una intervención realizada, con sus hallazgos y complicaciones, el equipo que             H
37    procedimiento                               participó y el material que se gastó

OP-   Registrar egreso           Médico           Cierra la hospitalización con el diagnóstico y la condición de salida, y libera la cama en la   H
38                                                misma operación

OP-   Solicitar estudio al       Médico           Envía una orden de examen al laboratorio de la red y queda a la espera del resultado            H
39    laboratorio

10.7 Seguimiento pediátrico — Centro médico pediátrico
ID    Operación                     Quién             Qué hace, en lenguaje sencillo                                                              Ins
                                                                                                                                                  t.

OP-   Registrar antecedentes        Pediatra          Anota semanas de gestación, tipo de parto, peso y talla al nacer y puntuación Apgar         P
40    de nacimiento

OP-   Registrar medición de         Enfermería,       Anota peso, talla y perímetro cefálico del control, junto con la edad en meses y los        P
41    crecimiento                   pediatra          percentiles calculados contra la referencia OMS

OP-   Ver curva de crecimiento      Pediatra,         Muestra la serie histórica de mediciones del paciente para ver su evolución en el           P
42                                  responsable       tiempo

OP-   Consultar esquema de          Pediatra,         Muestra qué vacunas le tocan al paciente, cuáles ya recibió y cuáles están atrasadas        P
43    vacunación                    enfermería

OP-   Registrar dosis aplicada      Enfermería        Anota que se aplicó una dosis, con fecha, lote, fabricante y sitio de aplicación            P
44

OP-   Registrar reacción            Enfermería,       Anota una reacción posterior a una vacuna aplicada                                          P
45    adversa                       pediatra

OP-   Evaluar hitos de              Pediatra          Marca si el paciente alcanzó los hitos esperados para su edad y anota observaciones         P
46    desarrollo

OP-   Listar dosis pendientes       Enfermería        Muestra los pacientes con vacunas atrasadas para poder convocarlos                          P
47

10.8 Laboratorio clínico
ID    Operación                  Quién             Qué hace, en lenguaje sencillo                                                                 Ins
                                                                                                                                                  t.

OP-   Recibir orden de           Recepción de      Registra la solicitud de uno o varios exámenes, indicando quién la pidió y con qué prioridad   L
48    examen                     laboratorio

OP-   Registrar toma de          Laboratorista     Anota la muestra recolectada, su tipo, su condición y el código con que se identifica          L
49    muestra

OP-   Cargar resultado           Laboratorista     Ingresa los valores obtenidos. Los campos que se llenan dependen del tipo de                   L
50                                                 examen: una hematología pide unos, una orina otros, un cultivo otros más

OP-   Validar resultado          Profesional       Revisa el resultado y lo aprueba; hasta ese momento el resultado es preliminar y no se         L
51                               autorizado        entrega

OP-   Comparar contra            Sistema           Marca automáticamente qué valores están fuera del rango normal para el sexo y la edad          L
52    valores de referencia                        del paciente

ID      Operación                 Quién               Qué hace, en lenguaje sencillo                                                                       Ins
                                                                                                                                                           t.

OP-     Entregar resultado        Laboratorista       Marca la orden como entregada y la deja disponible para la institución que la solicitó               L
53

OP-     Consultar historial de    Personal            Muestra todos los exámenes previos del paciente para comparar su evolución                           L
54      exámenes                  clínico

10.9 Clínica odontológica
ID        Operación                           Quién           Qué hace, en lenguaje sencillo                                                           Inst.

OP-55     Abrir odontograma                   Odontólogo      Crea el mapa dental del paciente con el estado inicial de cada pieza                     O

OP-56     Actualizar estado de una pieza      Odontólogo      Cambia el estado de una pieza y de sus superficies afectadas                             O

OP-57     Elaborar plan de tratamiento        Odontólogo      Define qué procedimientos se harán en qué piezas, en qué orden y con qué costo           O

OP-58     Aceptar plan de tratamiento         Secretaria      Registra que el paciente aprobó el presupuesto y el plan pasa a estado en proceso        O

OP-59     Registrar sesión de tratamiento     Odontólogo      Anota qué se hizo en la visita y actualiza el avance del plan                            O

OP-60     Consultar saldo del paciente        Secretaria      Muestra cuánto se ha cubierto del plan y cuánto queda pendiente                          O

10.10 Personal, insumos y captura de cargos
ID      Operación                Quién                Qué hace, en lenguaje sencillo                                                                   Inst.

OP-     Administrar personal     Recursos             Da de alta médicos, enfermeras, anestesiólogos, técnicos y personal de apoyo, con su             HP
61                               humanos              categoría y modalidad de contrato                                                                LO

OP-     Definir tarifa de        Recursos             Fija cuánto cobra un profesional por cada servicio: una cifra por consulta, otra por cirugía.    HP
62      honorarios               humanos              Al cambiarla, cierra la anterior y abre una nueva                                                LO

OP-     Registrar el equipo      Médico,              Anota quién intervino y en qué papel: cirujano, ayudante, anestesiólogo, instrumentista,         HP
63      de una atención          enfermería           circulante                                                                                       O

OP-     Calcular honorarios      Sistema              Multiplica la tarifa vigente de cada participante por el factor de su rol y deja el honorario    HP
64      de un acto                                    de cada uno                                                                                      O

OP-     Liquidar honorarios      Recursos             Suma lo que devengó cada profesional en el mes, por acto y por rol                               HP
65      de un período            humanos                                                                                                               O

OP-     Registrar consumo        Enfermería,          Anota qué se gastó en la atención —gasas, suero, jeringas, anestésico— con su cantidad           HP
66      de material              instrumentista       y lote, y descuenta la existencia                                                                LO

OP-     Consultar                Almacén              Muestra qué insumos quedan y cuáles están por agotarse                                           HP
67      existencias                                                                                                                                    LO

OP-     Generar cargo            Sistema              Cada vez que ocurre algo cobrable —una consulta, un procedimiento, un día de cama, un            HP
68                                                    consumo, un honorario— crea el cargo con su cantidad y precio                                    LO

OP-     Consultar cargos         Recepción, caja      Lista lo que un paciente tiene acumulado sin facturar, que es el borrador de su cuenta           HP
69      pendientes                                                                                                                                     LO

OP-     Anular o marcar          Caja con             Deja fuera de la factura un cargo mal generado o exonerado, sin borrarlo                         HP
70      cortesía un cargo        autorización                                                                                                          LO

10.11 Facturación y cobros
ID      Operación                 Quién                    Qué hace, en lenguaje sencillo                                                             Inst.

OP-     Consultar tarifario       Recepción, caja          Muestra qué cobra la institución y a qué precio                                            HPL
71                                                                                                                                                    O

OP-     Seleccionar cargos a      Caja                     Elige cuáles de los cargos pendientes del paciente entran en esta factura; el resto        HPL
72      facturar                                           queda para una posterior                                                                   O

OP-     Emitir factura            Caja, secretaria         Convierte esos cargos en una factura con serie y número, calcula impuesto y total, y       HPL
73                                                         pide el NIT de quien paga                                                                  O

 ID       Operación              Quién                 Qué hace, en lenguaje sencillo                                                           Inst.

 OP-      Registrar pago         Caja, secretaria      Anota un abono contra la factura y actualiza el saldo. Una factura admite varios         HPL
 74                                                    pagos                                                                                    O

 OP-      Anular factura         Caja con              Invalida una factura emitida por error dejando el motivo. No se borra: queda             HPL
 75                              autorización          anulada y el correlativo no se reutiliza                                                 O

 OP-      Consultar estado de    Recepción, caja,      Muestra qué facturas tiene el paciente, cuánto pagó y cuánto debe                        HPL
 76       cuenta                 paciente                                                                                                       O

 OP-      Cierre de caja         Caja                  Lista los pagos recibidos en el día agrupados por método, para cuadrar el efectivo       HPL
 77                                                                                                                                             O

10.12 Operaciones que deben ser atómicas
Estas operaciones tocan varias entidades a la vez y no admiten estados intermedios. Son las que pondrán a prueba el manejo de
transacciones de cada motor en la Entrega II:

 Operación                 Qué debe ocurrir junto                                          Riesgo si falla a medias

 OP-31 Cerrar consulta     Consulta + diagnósticos + tratamientos + receta con su          Un diagnóstico sin tratamiento, una receta huérfana, o
                           detalle + cargo de la consulta                                  una atención que nunca se cobra

 OP-35 Registrar           Alta de la admisión + cambio de estado de la cama a             Una cama marcada libre con un paciente dentro, o al
 ingreso                   ocupada                                                         revés

 OP-38 Registrar           Cierre de la admisión + liberación de la cama + cargo por los   Camas fantasma que nunca vuelven a estar disponibles,
 egreso                    días de estancia                                                o una hospitalización que no se cobra

 OP-13 Abrir expediente    Alta del paciente + alta del expediente + responsable (en       Un paciente sin expediente, o un menor sin responsable
                           pediátrico)                                                     registrado

 OP-44 Registrar dosis     Cambio de estado de la dosis + actualización del esquema        Una dosis aplicada que sigue apareciendo como
                                                                                           pendiente

 OP-50 Cargar              Resultado + comparación contra valores de referencia +          Un resultado sin sus banderas de fuera de rango
 resultado                 cambio de estado de la orden

 OP-22 Reprogramar         Liberación del espacio anterior + reserva del nuevo             Doble reserva o pérdida del espacio
 cita

 OP-66 Registrar           Alta del consumo + descuento de la existencia + generación      Material gastado que no se descuenta del almacén ni se
 consumo de material       del cargo                                                       le cobra al paciente

 OP-73 Emitir factura      Cabecera + todas sus líneas + marca de los cargos como          Una factura sin líneas, dos facturas con el mismo
                           facturados + toma del siguiente correlativo                     número, o un cargo cobrado dos veces

 OP-74 Registrar pago      Alta del pago + recálculo del saldo + cambio de estado de la    Un pago cobrado que no baja el saldo, o una factura que
                           factura                                                         sigue apareciendo como pendiente

 OP-75 Anular factura      Marca de anulación + reversión del saldo + anulación de los     Una factura anulada que sigue sumando en la caja del
                           pagos asociados                                                 día

10.13 Operaciones más frecuentes
El diseño de índices de la sección 7.5 responde a esta frecuencia estimada:

 Frecuencia                 Operaciones

 Muy alta (cada paciente    OP-07 buscar paciente · OP-14 consultar historial · OP-25 ver agenda del día · OP-76 consultar estado de cuenta
 que llega)

 Alta (cada atención)       OP-26 a OP-31 · OP-41 medición · OP-43 esquema de vacunación · OP-66 registrar consumo · OP-68 generar cargo ·
                            OP-73 emitir factura · OP-74 registrar pago

 Media (diaria)             OP-21 agendar · OP-34 camas disponibles · OP-48 recibir orden · OP-53 entregar resultado · OP-67 consultar
                            existencias · OP-69 cargos pendientes · OP-77 cierre de caja

 Baja (ocasional)           OP-05 administrar usuarios · OP-18 archivar expediente · OP-06 consultar bitácora · OP-62 definir tarifas · OP-65
                            liquidar honorarios · OP-75 anular factura

11. Supuestos y decisiones de diseño

 1. Cada institución es dueña de sus datos. No existe una base de datos central de pacientes. Una misma persona atendida en el
    hospital y en el laboratorio tiene un expediente distinto en cada uno. La correlación entre ambos, cuando hace falta, se hace
    por número de documento a través de ORDEN_ESTUDIO.referencia_externa .
 2. El expediente es único por paciente dentro de la institución (relación 1:1). Toda la historia se acumula en él; no se abre un
    expediente por episodio.
 3. Ningún dato clínico se borra. La baja de un paciente se modela como archivo del expediente con motivo. Las correcciones
    se registran como anulaciones o notas nuevas, nunca como sobrescritura.
 4. Los identificadores son claves sustitutas (enteros autoincrementales), con las claves naturales conservadas como claves
    únicas alternas. Esto simplifica las referencias y permite corregir un número de documento mal digitado sin propagar el
    cambio.
 5. La edad y el índice de masa corporal no se almacenan, salvo en el caso pediátrico, donde la edad en meses de una
    medición es un hecho histórico.
 6. El paciente menor de edad siempre tiene responsable. En el centro pediátrico esta es una restricción de negocio verificada
    antes de abrir el expediente.
 7. Los catálogos son compartidos en estructura pero independientes en datos. CIE-10, medicamentos, vacunas y
    procedimientos tienen el mismo diseño en las cuatro instituciones, pero cada base de datos guarda su propia copia, porque
    cada institución es dueña de su infraestructura.
 8. La institución del usuario determina el motor. El atributo USUARIO.id_institucion es el único dato que la aplicación
    necesita para saber contra qué base de datos ejecutar toda la sesión.
 9. Las contraseñas nunca se almacenan ni se transmiten en claro. Se guarda únicamente el resultado de Argon2id,
    clasificado como dato restringido.
10. La facturación está simulada, no integrada. Los montos se manejan en quetzales, el impuesto se calcula al 12 % y el
    campo de autorización de factura electrónica existe para dejar el espacio previsto, pero el sistema no se conecta con ninguna
    administración tributaria: el número de autorización se genera dentro de la aplicación.
11. La cobertura de seguro se modeló al mínimo. Basta una columna con el monto que asume la aseguradora y otra con el
    saldo del paciente. Modelar pólizas, coberturas por servicio y deducibles sería un subsistema completo y queda fuera del
    alcance del curso.
12. Un paciente puede tener varias facturas abiertas a la vez —por ejemplo una por la consulta y otra por la hospitalización
    — y cada una lleva su propio saldo.
13. El personal en planilla no devenga honorario por acto. Su participación se registra igual —hace falta saber quién estuvo
    en la sala— pero no genera cargo. Solo quienes tienen contrato por honorarios cobran por intervención.
14. El inventario se modeló solo hasta donde el cobro lo exige. Hay existencia actual y consumo, pero no órdenes de compra,
    proveedores, ni entradas de almacén: eso es un sistema de inventarios completo y excede el alcance del curso.
15. Los diagramas de este documento son el modelo lógico. Los tipos de dato concretos ( SERIAL frente a
    AUTO_INCREMENT , TIMESTAMPTZ frente a DATETIME ) se resolverán en las migraciones de cada motor en la Entrega II.

12. Glosario

Término                 Significado en este documento

Antibiograma            Prueba que mide a qué antibióticos es sensible un microorganismo aislado en un cultivo

Apgar                   Puntuación de 0 a 10 que evalúa el estado del recién nacido al minuto y a los cinco minutos de vida

BCNF                    Forma normal de Boyce-Codd: todo determinante de la relación es clave candidata

Consumidor final (CF)   Marca que sustituye al NIT cuando quien paga no lo proporciona

Correlativo             Numeración consecutiva y sin saltos que identifica un documento dentro de su serie

CIE-10                  Clasificación Internacional de Enfermedades, décima revisión; catálogo estándar de códigos diagnósticos

Clave candidata         Conjunto mínimo de atributos que identifica de forma única cada fila

Clave sustituta         Identificador artificial (normalmente un entero autoincremental) que reemplaza a la clave natural como clave primaria

Dependencia             Relación A → B : conocer el valor de A determina el valor de B
funcional

Dependencia             A → B → C donde B no es clave; hace que C dependa indirectamente de A
transitiva

Factor de honorario     Proporción de la tarifa que corresponde a un rol dentro de un acto: el cirujano principal cobra el total, el ayudante una
                        fracción

FEL                     Factura Electrónica en Línea, el régimen de facturación electrónica de Guatemala; en este proyecto está simulado

Entidad débil           Entidad que no puede existir sin su entidad padre y cuya identidad depende de ella

Expediente clínico      Contenedor acumulativo de toda la atención de un paciente en una institución

FDI                     Notación de dos dígitos de la Federación Dental Internacional para numerar las piezas dentales

Hito de desarrollo      Capacidad que se espera que un niño alcance a una edad determinada

Insumo                  Material o suministro que se consume en la atención y se descuenta del almacén: gasas, sueros, jeringas, reactivos

Instrumentista          Miembro del equipo quirúrgico que prepara y entrega el instrumental al cirujano

NIT                     Número de Identificación Tributaria del contribuyente a quien se emite la factura

IVA                     Impuesto al Valor Agregado; en Guatemala, 12 % sobre la base afecta

Odontograma             Representación gráfica del estado de todas las piezas dentales de un paciente

Percentil               Posición de un valor dentro de una población de referencia; el percentil 50 es la mediana

Perímetro cefálico      Medida de la circunferencia de la cabeza, indicador de desarrollo hasta los tres años

Puntuación Z            Cuántas desviaciones estándar separa un valor de la media de la población de referencia

Signos vitales          Presión arterial, frecuencia cardíaca, frecuencia respiratoria, temperatura y saturación de oxígeno

Planilla                Modalidad de contrato con sueldo fijo, en contraste con el pago por acto realizado

Tarifario               Catálogo de servicios que la institución cobra, con el precio de lista de cada uno

Transacción             Conjunto de operaciones que se ejecutan como una unidad indivisible: o se aplican todas, o ninguna
