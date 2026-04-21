# Niteflow — Implementation Plan

## Dependency Graph

```
T01 (scaffold+DB)
 ├── T02 (settings + Pi-hole auth)
 │    └── T03 (device select + query sync)
 │         └── T14 (list inference)        [Phase E]
 ├── T04 (taxonomy data file)
 │    └── T05 (categorization engine)      ← also needs T03
 │         └── T13 (user domain override)  [Phase E]
 ├── T06 (Apple Health import)
 │    └── T09 (sleep timeline chart)
 │         └── T10 (pre-sleep activity chart) ← also needs T07
 └── T07 (pre-sleep aggregation)           ← needs T05 + T06
      └── T08 (correlation engine)
           ├── T11 (correlation matrix + scatter)
           └── T12 (recommendations panel)
```

**Parallelizable pairs (after T01):**
- T04 alongside T02–T03
- T06 alongside T02–T05
- T09 alongside T07–T08

---

## Phase A — Foundation & Pi-hole Integration

### T01 · Project Scaffolding & Database

**Goal**: Runnable app shell with all 5 DB tables migrated.

**Steps:**
1. `npx create-next-app@latest niteflow` with TypeScript, Tailwind, App Router, no `src/` dir
2. Install: `drizzle-orm better-sqlite3 drizzle-kit @types/better-sqlite3`
3. Install: `shadcn/ui` (init), `recharts`, `@tanstack/react-query`, `zod`
4. Configure ESLint + Prettier (no default exports rule)
5. `lib/db/schema.ts` — define all 5 Drizzle tables:
   - `settings` (key TEXT PK, value TEXT)
   - `sleep_sessions` (date TEXT PK, quality_score REAL, total_min REAL, deep_pct REAL, rem_pct REAL, hrv_avg REAL, efficiency REAL)
   - `sleep_records` (id INTEGER PK, type TEXT, start_ts INTEGER, end_ts INTEGER, value REAL, unit TEXT, source TEXT)
   - `pihole_queries` (id INTEGER PK, timestamp INTEGER, domain TEXT, client_ip TEXT, status TEXT, category TEXT)
   - `domain_categories` (domain TEXT PK, category TEXT, source TEXT, updated_at INTEGER)
6. `lib/db/client.ts` — better-sqlite3 singleton, run migrations on startup
7. `drizzle.config.ts` + generate + run first migration
8. App shell: root layout with sidebar nav links (Dashboard, Import, Settings)
9. Stub pages: `/`, `/import`, `/settings`, `/correlations`

**Acceptance criteria:**
- `npm run dev` starts without errors
- `npm run lint` passes
- `npm run db:migrate` runs cleanly
- SQLite file created with all 5 tables
- Nav renders, stub pages load

---

### T02 · Settings Page + Pi-hole v6 Auth

**Goal**: User can enter Pi-hole credentials, test the connection, and have settings persist.

**Steps:**
1. Settings page form: URL field, password field (type=password), self-signed TLS toggle
2. `lib/pihole/auth.ts`:
   - `acquireToken(url, password, allowInsecure)` → `POST /api/auth` → returns `sid`
   - `refreshIfExpired(url, password, sid, expiresAt)` → re-acquires when within 60s of expiry
   - Session stored in `settings` table (key: `pihole_session`, value: JSON `{sid, expiresAt}`)
3. `lib/pihole/client.ts`:
   - `piholeGet(path, params)` → attaches `sid` cookie, handles 401 by re-authing once
4. Server action `saveSettings(formData)`:
   - Validate with Zod (URL must be http/https, password non-empty)
   - Store `pihole_url`, `pihole_password`, `pihole_tls_insecure` in settings table
5. "Test Connection" button → server action calls `GET /api/info` → returns Pi-hole version
6. Display: connected badge + Pi-hole version string on success; error message on failure

**Acceptance criteria:**
- Entering valid Pi-hole URL + password → green "Connected" badge + version shown
- Wrong password → clear error message, no crash
- Settings survive page refresh (read back from SQLite on load)
- Self-signed TLS toggle works (rejectUnauthorized: false)

---

### T03 · Device Selection + Pi-hole Query Sync

**Goal**: User selects monitored devices and can sync query logs into local DB.

**Steps:**
1. `GET /api/network/devices` via pihole client → returns device list (IP, name, MAC, lastSeen)
2. Settings page section: device list renders as checkboxes with IP + hostname label
3. Server action `saveDevices(ips: string[])` → persist to settings as JSON array
4. Pre-sleep window setting: number input (default 3, min 1, max 12 hours)
5. Server action `syncPihole(fromDate, toDate)`:
   - Paginate `GET /api/queries?from=<ts>&until=<ts>&clients=<ip>` for each selected IP
   - Upsert rows into `pihole_queries` (skip duplicates by timestamp+domain+client_ip)
   - Return: `{ inserted, skipped, dateRange }`
6. "Sync Now" button with progress feedback (count of queries fetched)
7. Display: last sync timestamp + total query count in DB

**Acceptance criteria:**
- Device list loads from live Pi-hole after connection test passes
- Selecting devices and saving persists selection
- Sync pulls queries for all selected IPs; count shown post-sync
- Re-sync skips already-stored queries (idempotent)
- Sync respects 30-day default range; date range is configurable

**CHECKPOINT A** — Pi-hole connected, devices selected, queries populating local DB.
Verify before proceeding: at least one sync has run with real data.

---

## Phase B — Data Ingestion

### T04 · Domain Taxonomy Data File

**Goal**: `data/domain-taxonomy.json` ships with ~2,000+ domain→category mappings.

**Steps:**
1. `scripts/build-taxonomy.ts` — Node script (run once, output committed):
   - Fetch Steven Black extensions: `social.txt`, `gambling.txt`, `porn.txt`, `fakenews.txt` from GitHub raw URLs
   - Fetch Hagezi category lists: `hagezi-social.txt`, `hagezi-gambling.txt`, `hagezi-nsfw.txt`
   - Parse each file (strip `0.0.0.0 ` prefix from hosts format, or plain domain lines)
   - Map list source → category label (social→"Social Media", gambling→"Gambling", etc.)
   - Merge with a hand-curated `scripts/curated-domains.json` (top consumer domains: streaming, news, shopping, gaming, etc.)
   - Output: `data/domain-taxonomy.json` as `Record<string, Category>`
2. Add `npm run build:taxonomy` script
3. Run the script and commit output

**Acceptance criteria:**
- Script runs without errors
- Output contains ≥ 2,000 entries
- Spot-check: `youtube.com` → "Video Streaming", `instagram.com` → "Social Media", `draftkings.com` → "Gambling"
- File is valid JSON, parseable with `JSON.parse`

---

### T05 · Domain Categorization Engine

**Goal**: All synced Pi-hole queries are categorized; lookup is fast.

**Steps:**
1. `lib/taxonomy/categorize.ts`:
   - Load `domain-taxonomy.json` once into memory (module-level singleton)
   - `categorizeDomain(domain: string): Category`:
     - Exact match → return category
     - Strip `www.` prefix → retry
     - Strip one subdomain level (e.g. `cdn.youtube.com` → `youtube.com`) → retry
     - Fall through → "Other"
2. Server action `categorizePendingQueries()`:
   - Batch-select pihole_queries where category IS NULL (process in chunks of 500)
   - Run categorizeDomain on each domain
   - Bulk-upsert into domain_categories (source=curated)
   - UPDATE pihole_queries.category from domain_categories
3. Trigger categorization automatically after each sync (append to syncPihole action)
4. Unit tests (Vitest): 10 domain fixtures covering exact match, www prefix, subdomain fallback, unknown

**Acceptance criteria:**
- After sync + categorization, < 20% of queries remain in "Other" for typical home usage
- categorizeDomain is pure and fast (< 1ms per call)
- Unit tests pass

---

### T06 · Apple Health Import

**Goal**: User uploads Health export ZIP; sleep sessions + quality scores stored in DB.

**Steps:**
1. `/import` page: drag-and-drop or file picker (`.zip` only), step-by-step export guide
2. `public/help/apple-health-export.md` — export instructions (iPhone → Health → profile → Export)
3. API route `POST /api/health/import` (multipart upload, streaming):
   - Extract ZIP in memory (use `yauzl` or Node's built-in `zlib` + custom extractor) — find `export.xml`
   - Stream-parse XML with `sax` (not DOM — exports can be 1–2 GB)
   - Filter for the 5 relevant HK record types
   - Batch-insert into `sleep_records`
4. `lib/health/parser.ts` — SAX parsing logic, emit typed records
5. `lib/health/scoring.ts`:
   - `groupIntoNights(records)` → group by night date (session crosses midnight → anchor to end date)
   - `computeSleepSession(night)`:
     - total_min: sum of AsleepCore + AsleepDeep + AsleepREM durations
     - deep_pct: AsleepDeep / total_sleep
     - rem_pct: AsleepREM / total_sleep
     - efficiency: total_sleep / (InBed duration)
     - hrv_avg: mean of HRV records within the session window
   - `scoreNight(session, hrvBaseline)` → composite 0–100 per spec weights
   - HRV baseline: 30-day rolling mean recomputed each import
6. Upsert `sleep_sessions` (one row per night; re-import is idempotent)
7. Progress stream: Server-Sent Events or polling endpoint for % complete
8. Unit tests: XML fixture with 3 nights → correct sessions + scores

**Acceptance criteria:**
- Upload a real Apple Health export ZIP → progress bar → "X nights imported" success
- sleep_sessions table has one row per night with plausible values
- Re-upload same file produces identical results (idempotent)
- File > 500MB handled without OOM crash (streaming parser)
- Unit tests pass with fixture data

**CHECKPOINT B** — Both data sources populated. Verify:
- pihole_queries has categorized rows
- sleep_sessions has scored nightly rows
- At least 7 nights exist in both for the same date range

---

## Phase C — Analytics

### T07 · Pre-Sleep Window Aggregation

**Goal**: For each night, compute category query totals in the N-hour pre-sleep window.

**Steps:**
1. `lib/analytics/aggregate.ts`:
   - `aggregatePreSleep(date: string, sleepStartTs: number, windowHours: number)`:
     - Query pihole_queries WHERE timestamp BETWEEN (sleepStartTs - windowHours*3600) AND sleepStartTs AND client_ip IN selectedDevices
     - Group by category, count rows
     - Return `{ date, categories: Record<Category, { count, pct }> }`
   - `aggregateAllNights(windowHours)` → map over all sleep_sessions with a sleep start
2. Sleep start detection: use first `AsleepCore` or `Asleep` record of the night (from sleep_records)
3. Store aggregates in a derived `nightly_activity` view or compute on-demand (start on-demand; add caching if > 200ms)
4. Unit tests: synthetic DB (in-memory Drizzle) with 3 nights of interleaved query + sleep data

**Acceptance criteria:**
- For each night with a sleep session + Pi-hole data, returns category breakdown
- Window boundaries are correct (exclusive of sleep start timestamp)
- Nights with no Pi-hole data return empty category map (not an error)
- Unit tests pass

---

### T08 · Correlation Engine

**Goal**: Pearson r between each category's nightly usage and each sleep metric.

**Steps:**
1. `lib/analytics/correlate.ts`:
   - `pearson(xs: number[], ys: number[]): number` — standard formula, returns NaN if constant series
   - `correlateCategory(category: Category, metric: SleepMetric, nights: NightlyDataPoint[])`:
     - Returns `{ r: number, n: number, significant: boolean }` where significant = |r| > 0.3 && n >= 7
     - Returns null if n < 7
   - `computeAllCorrelations(nights)` → full matrix: all categories × all metrics
2. `SleepMetric` = `quality_score | total_min | hrv_avg | deep_pct | rem_pct`
3. `NightlyDataPoint` = joined sleep session + category query counts for that night
4. Unit tests:
   - Perfect positive correlation (r ≈ 1.0)
   - Perfect negative correlation (r ≈ -1.0)
   - Uncorrelated (r ≈ 0)
   - n=6 → returns null (insufficient data guard)

**Acceptance criteria:**
- pearson() correct to 4 decimal places vs reference values
- Minimum-data guard works (null returned for < 7 nights)
- Full matrix computed in < 100ms for 90 nights of data
- Unit tests pass

**CHECKPOINT C** — Analytics producing correct results. Verify with real data:
- At least one category shows a non-zero correlation
- Result matches manual spot-check calculation

---

## Phase D — Dashboard & Recommendations

### T09 · Dashboard — Sleep Timeline

**Goal**: `/dashboard` shows nightly sleep quality over time as a line chart.

**Steps:**
1. Dashboard page with date range picker (default: last 30 days)
2. Server action `getSleepTimeline(from, to)` → returns sleep_sessions rows
3. `components/charts/SleepTimeline.tsx`:
   - Recharts `ComposedChart` with `Line` (quality score, left Y) + `Bar` (total hours, right Y)
   - `Line` for HRV trend (normalized, right Y, dashed)
   - Tooltip showing all three values on hover
4. Empty state component: "Import Apple Health data to see your sleep timeline"
5. Loading skeleton while data fetches

**Acceptance criteria:**
- Chart renders with correct data points (spot-check 3 dates)
- Date range picker changes data shown
- Empty state shown when no sleep data
- No layout shift on load

---

### T10 · Dashboard — Pre-Sleep Activity Chart

**Goal**: Stacked bar chart showing category breakdown per night in the dashboard.

**Steps:**
1. Server action `getPreSleepActivity(from, to)` → calls aggregate.ts for each night in range
2. `components/charts/PreSleepActivity.tsx`:
   - Recharts `BarChart` stacked, one bar per night
   - Category color palette (15 consistent colors, defined in `lib/taxonomy/colors.ts`)
   - Legend + tooltip with category names + query counts
3. Render below SleepTimeline on dashboard, sharing date range state
4. Empty state: "Sync Pi-hole data to see pre-sleep activity"

**Acceptance criteria:**
- Categories stack correctly (total bar height = total queries that window)
- Colors are consistent with other charts
- Nights with no Pi-hole data show empty bar (not missing bar)

---

### T11 · Dashboard — Correlation Matrix + Scatter Charts

**Goal**: Heatmap of category × sleep metric correlations; scatter on drill-down.

**Steps:**
1. `/correlations` page
2. Server action `getCorrelationMatrix()` → calls computeAllCorrelations()
3. `components/charts/CorrelationMatrix.tsx`:
   - CSS grid heatmap (not a chart lib — simpler, more controllable)
   - Color scale: red (r=-1) → white (0) → green (r=1), with opacity proportional to |r|
   - Cells below significance threshold rendered at 30% opacity
   - Click a cell → opens scatter chart drawer/modal
4. `components/charts/CorrelationScatter.tsx`:
   - Recharts `ScatterChart`: x = category query count, y = sleep metric
   - Regression line overlaid as `ReferenceLine` (compute slope/intercept from same data)
   - r value + n labeled on chart
5. Minimum-data gate: page shows "Need at least 7 nights of overlapping data" when insufficient

**Acceptance criteria:**
- Matrix renders with correct r values (spot-check vs correlate.ts unit test output)
- Color encoding makes strong correlations visually obvious
- Click → scatter shows correct data points
- Gate message shown when data is insufficient

---

### T12 · Recommendations Panel

**Goal**: Ranked list of categories to avoid, with blocklist suggestions.

**Steps:**
1. `lib/analytics/recommend.ts`:
   - `getRecommendations(correlations)` → sort by quality_score r ascending (most negative first)
   - Filter to significant correlations only (|r| > 0.3, n >= 7)
   - Map category → suggested Pi-hole list URLs (defined in `data/blocklist-recommendations.json`)
2. `data/blocklist-recommendations.json`:
   - Per category: `{ listName, url, description }` array
   - Sources: Steven Black (GitHub raw), Hagezi (GitHub raw)
3. `/correlations` page: recommendations panel below matrix
   - Each card: category name, r value badge, brief interpretation, blocklist(s) with copy button
   - Positive correlations section (separated): "These categories are not hurting your sleep"
4. Copy-to-clipboard for Pi-hole list URL

**Acceptance criteria:**
- Recommendations ranked correctly (most negative r first)
- Only significant correlations appear
- Blocklist URLs are correct and copyable
- Positive correlations displayed separately

**CHECKPOINT D** — Full dashboard working end-to-end. Verify with real data:
- All 4 charts render correctly
- Recommendations appear when sufficient data exists
- Empty states show when data is missing

---

## Phase E — Polish

### T13 · User Domain Override

**Goal**: User can manually categorize unrecognized domains.

**Steps:**
1. Settings page section: table of top-N "Other" domains (by query count, last 30 days)
2. Each row: domain, query count, category dropdown (all 15 categories)
3. Server action `overrideDomainCategory(domain, category)`:
   - Upsert domain_categories with source=user
   - UPDATE pihole_queries.category for that domain
4. Changes take effect immediately (table re-fetches)

**Acceptance criteria:**
- Top uncategorized domains listed with query counts
- Override saves and immediately reflects in category totals

---

### T14 · Pi-hole List Inference

**Goal**: Reduce "Other" domains by inferring category from Pi-hole gravity list membership.

**Steps:**
1. `lib/taxonomy/infer.ts`:
   - `inferFromListName(listName: string): Category | null`
   - Map known list name patterns → categories (e.g. list URL contains "social" → Social Media)
   - Applied to pihole_queries rows where status = "blocked" (gravity-blocked queries carry list info)
2. Pipe this as step 2 in categorization: after curated lookup fails, before defaulting to "Other"
3. Unit tests: list name fixtures → correct inferred categories

**Acceptance criteria:**
- Domains blocked by known category lists are correctly inferred
- Does not override curated or user entries (priority order maintained)

---

## Task Dependency Summary

```
T01 → T02 → T03 → T14
T01 → T04 → T05 → T13
T01 → T06 → T09 → T10
T03 + T05 → (categorized queries ready)
T06 → (sleep sessions ready)
T05 + T06 → T07 → T08 → T11
                       → T12
T09 + T07 → T10
```

## Approximate Sizing

| Task | Complexity | Notes |
|------|-----------|-------|
| T01 | M | Standard Next.js scaffolding |
| T02 | M | Pi-hole v6 auth is non-trivial (session token model) |
| T03 | M | Pagination + upsert logic |
| T04 | S | Script work, not production code |
| T05 | S | Pure lookup function, fast |
| T06 | L | XML streaming parser + scoring formula is the most complex task |
| T07 | S | SQL + time window logic |
| T08 | S | Math is simple; joining the data correctly is the tricky part |
| T09 | S | Standard Recharts setup |
| T10 | S | Builds on T09 patterns |
| T11 | M | Heatmap CSS + scatter drill-down interaction |
| T12 | S | Data already computed, mostly UI |
| T13 | S | CRUD UI |
| T14 | S | Pattern matching on list names |
