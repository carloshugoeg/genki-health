
# UNIVERSIDAD RAFAEL LANDÍVAR
## FACULTAD DE INGENIERÍA
### INGENIERÍA EN INFORMÁTICA Y SISTEMAS
**BASES DE DATOS II**  
**Proyecto final**

---

El presente proyecto tiene como objetivo aplicar de manera progresiva el conocimiento adquirido en el curso.

Los cursos han cubierto, hasta este punto, bases de datos relacionales y tiene programadas sesiones de bases de datos no relacionales más adelante en el semestre. El proyecto final busca que el estudiante compare motores de bases de datos en la práctica, enfrentándose a las mismas reglas de negocio implementadas sobre modelos de datos distintos.

Para aplicar esta solución nos apoyaremos de la arquitectura hexagonal, la cual será un mecanismo habilitador para que la lógica de negocio no dependa de un único motor de base de datos, de modo que cambiar entre PostgreSQL y MongoDB sea una decisión de configuración que no implique la reescritura del sistema. El proyecto no evalúa la implementación de la arquitectura como punto principal, sino que se evalúan las decisiones de modelado, consistencia y seguridad para cada motor.

---

## Contexto del caso

Una red de instituciones médicas independientes comparte una misma plataforma de historiales clínicos, pero cada institución es dueña de su propia infraestructura de datos. Las instituciones son:

* **Hospital general:** necesita control estricto sobre citas, diagnósticos y tratamientos, con integridad transaccional fuerte (no puede perderse un diagnóstico a medias).
* **Clínica odontológica pequeña:** no cuenta con personal técnico propio y prioriza rapidez de atención al cliente por medio de sus secretarias.
* **Laboratorio clínico:** procesa resultados de exámenes cuya estructura varía según el tipo de examen (una hematología completa tiene campos distintos a una prueba de orina o un cultivo).
* **Centro médico pediátrico:** administra historiales con seguimiento por paciente (control de crecimiento, esquema de vacunación), con consultas frecuentes y de corta duración.

A diferencia de una asignación fija de motor por institución, en este proyecto son los estudiantes quienes deciden qué motor de base de datos usará cada institución, sujeto a dos restricciones:

1. Un mismo motor no puede usarse más de una vez dentro del proyecto (cada institución debe tener un motor distinto a las demás).
2. Deben usarse al menos 4 motores diferentes en total.

Dado que hay 4 instituciones y se exigen al menos 4 motores distintos sin repetir ninguno, en la práctica esto significa que cada institución debe quedar asignada a un motor distinto entre sí, eligiendo libremente de entre motores como PostgreSQL, MySQL, MongoDB y Firebase. El estudiante puede implementar otros motores si así lo desea, no aplicando motores como SQLite, Realm o LiteDB, al ser opciones muy ligeras sin gestión real. La decisión de qué institución usa qué motor (y por qué) debe quedar justificada por escrito en el documento comparativo de la Entrega II.

---

## Entrega I, modelo relacional

**Instrucciones:** Debe realizar el análisis y levantamiento de información de un historial clínico completo, identificando los datos relevantes y la estructura que sigue para que se pueda proveer el servicio a pacientes que ya están registrados en el sistema, y a pacientes de nuevo ingreso. El análisis debe cubrir las cuatro instituciones a las cuáles se les dará el servicio, ya que será la base sobre la que se implementarán los motores en la entrega final.

**Resultados esperados:**
* Modelo entidad-relación de las instituciones que serán implementadas en motores relacionales.
* Modelo relacional de las instituciones que serán implementadas en motores relacionales.
* Entidades identificadas.
* Lista de atributos identificados para cada entidad.
* Identificación de información pública, confidencial y restringida para las instituciones.
* Base de datos normalizada (para los modelos relacionales).
* Documentar, en lenguaje sencillo, las operaciones que la aplicación necesitará realizar sobre los datos sin especificar todavía cómo se implementan. Esta lista es el punto de inicio para la Entrega II.

---

## Entrega II: Implementación en motores relacionales y no relacionales

**Instrucciones:** Debe realizar una aplicación cliente-servidor base, donde la aplicación "cliente" permite consultar y administrar el historial clínico de un paciente, y el servidor persiste los datos en distintos motores de base de datos según la institución a la que pertenece el usuario que inicia sesión, usando la arquitectura hexagonal como punto de partida común entre todos los motores. Esta fase busca demostrar la integración entre la base de datos y una aplicación real, enfrentando las mismas reglas de negocio (registrar consulta, agregar diagnóstico, recetar medicamento) a modelos de datos distintos.

### Motores y asignación:

| Institución | Motor elegido |
| :--- | :--- |
| **Hospital general** | _(Por definir)_ |
| **Clínica odontológica** | _(Por definir)_ |
| **Laboratorio clínico** | _(Por definir)_ |
| **Centro médico pediátrico** | _(Por definir)_ |

**Restricciones de asignación:**
* Motores disponibles: PostgreSQL, MySQL, MongoDB, Firebase.
* Cada motor se usa como máximo una vez en todo el proyecto.
* Deben usarse al menos 4 motores diferentes, en la práctica, esto obliga a que las 4 instituciones queden cubiertas con los 4 motores disponibles, sin repetir ninguno.
* La asignación debe justificarse por escrito: ¿por qué esa institución encaja mejor con ese motor, dado su volumen de datos, estructura de la información, y necesidad de transacciones estrictas?

**Resultados esperados:**
* Aplicación funcional.
* Conexión cliente-servidor.
* Modelado de base de datos corregido (a partir de la retroalimentación de la Entrega I).
* Consultas a la base de datos, funcionando de forma equivalente en los cuatro motores.
* Modelo documental para MongoDB y Firebase: decisión explícita y justificada de qué datos se embeben y cuáles se referencian. Por ejemplo, si los resultados de un examen de laboratorio se embeben dentro del documento del paciente, o se referencian por separado dado que un paciente puede acumular cientos de exámenes a lo largo del tiempo.
* Visualización de toda la información de manera ordenada, sin que la interfaz cambie según el motor de base de datos activo.
* Utilidad para generar nuevos historiales clínicos (registro de paciente nuevo).
* Mantenimiento de historiales existentes, incluyendo nuevas consultas, diagnósticos, tratamientos y medicamentos recetados.
* Desactivación o archivo de historiales por baja del paciente (ej. traslado a otra institución, fallecimiento, u otra causa administrativa).
* Enrutamiento por usuario: al autenticarse, el sistema debe dirigir automáticamente las operaciones de ese usuario al motor de base de datos correspondiente a su institución, sin que la lógica de negocio tenga que reescribirse por motor.
* Documento comparativo breve explicando, para cada motor, las decisiones de modelado, cómo se garantiza consistencia (transacciones en SQL y NoSQL), y cómo se aplica seguridad. El documento también debe justificar la asignación de la institución al motor elegido.

La aplicación será construida por medio de la tecnología de su preferencia, sin restricciones de uso.