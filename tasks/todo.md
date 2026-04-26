# Niteflow — Task List

## Phase A · Foundation & Pi-hole Integration

- [x] **T01** · Project scaffolding, Drizzle schema, app shell
- [x] **T02** · Settings page + Pi-hole v6 auth (session token)
- [x] **T03** · Device selection + Pi-hole query sync

> **CHECKPOINT A** — Pi-hole syncing real queries into local DB

## Phase B · Data Ingestion

- [x] **T04 + T05** · Replaced with IAB Taxonomy v3 + Curlie pipeline (514K domains, 37.8% query coverage with subdomain fallback)
- [x] **T06** · Apple Health import (ZIP upload, XML parser, sleep scoring)

> **CHECKPOINT B** — Both sources populated; ≥7 nights of sleep + queries overlap

## Phase C · Analytics

- [x] **T07** · Pre-sleep window aggregation (category totals per night)
- [x] **T08** · Correlation engine (Pearson r, minimum-data guard)

> **CHECKPOINT C** ✅ — Correlations computing correctly on real data

## Phase D · Dashboard & Recommendations

- [x] **T09** · Dashboard — Sleep timeline chart
- [x] **T10** · Dashboard — Pre-sleep activity stacked bar
- [x] **T11** · Correlations page — Heatmap + scatter drill-down
- [x] **T12** · Recommendations panel with blocklist suggestions

> **CHECKPOINT D** ✅ — Full dashboard working end-to-end

## Phase E · Polish

- [x] **T13** · User domain override UI
- [ ] ~~**T14**~~ · Pi-hole list name inference — superseded by Curlie (T04+T05)
