# Niteflow — Task List

## Phase A · Foundation & Pi-hole Integration

- [x] **T01** · Project scaffolding, Drizzle schema, app shell
- [x] **T02** · Settings page + Pi-hole v6 auth (session token)
- [ ] **T03** · Device selection + Pi-hole query sync

> **CHECKPOINT A** — Pi-hole syncing real queries into local DB

## Phase B · Data Ingestion

- [ ] **T04** · Domain taxonomy data file (build script + committed output)
- [ ] **T05** · Domain categorization engine + batch categorize synced queries
- [ ] **T06** · Apple Health import (ZIP upload, XML parser, sleep scoring)

> **CHECKPOINT B** — Both sources populated; ≥7 nights of sleep + queries overlap

## Phase C · Analytics

- [ ] **T07** · Pre-sleep window aggregation (category totals per night)
- [ ] **T08** · Correlation engine (Pearson r, minimum-data guard)

> **CHECKPOINT C** — Correlations computing correctly on real data

## Phase D · Dashboard & Recommendations

- [ ] **T09** · Dashboard — Sleep timeline chart
- [ ] **T10** · Dashboard — Pre-sleep activity stacked bar
- [ ] **T11** · Correlations page — Heatmap + scatter drill-down
- [ ] **T12** · Recommendations panel with blocklist suggestions

> **CHECKPOINT D** — Full dashboard working end-to-end

## Phase E · Polish

- [ ] **T13** · User domain override UI
- [ ] **T14** · Pi-hole list name inference for categorization
