# ADR-0001 — Stack and no ORM

- Status: Accepted
- Date: 2026-08-27

## Context

The course grades per-engine modeling, transactions, and security. Partners build through agents.

## Decision

TypeScript full stack: Fastify API + React/Vite web, npm workspaces, hexagonal ports and adapters, no ORM. Raw drivers later (`pg`, `mysql2`, `mongodb`, `firebase-admin`).

## Consequences

Scaffold and CI enforce hexagonal import rules. SQL and document mapping stay hand-written in Entrega II adapters.
