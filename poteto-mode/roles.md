# Roles

Carlos Hugo Escobar Gómez and Héctor Jordin Adolfo García Coyoy own architecture and design. They do not hand design forks to an agent.

Coding is delegated.

| Human | Agent | Institutions |
| --- | --- | --- |
| Carlos | Cursor | Hospital general (PostgreSQL) and Laboratorio clínico (MongoDB) |
| Jordin | Claude | Centro médico pediátrico (MySQL) and Clínica odontológica (Firebase) |

Shared Entrega I material (the clinical core, access, billing, supplies) has no single owner. Either agent may take it when it is the ticket in `queue/NOW.md`. Do not take a ticket whose owner line names the other person unless that person reassigns it in the ticket file.

The institution split is the decision recorded on 2026-08-27 in the architecture spec. Entrega I diagrams follow the same split. Hospital-only figures go to Carlos. Pediatric figures go to Jordin. Laboratorio and the dental clinic have no ER diagram in Entrega I. Their document model is Entrega II.

An agent does not review its own pull request as the other partner. The other partner's agent checks the PR out and confirms the definition of done.
