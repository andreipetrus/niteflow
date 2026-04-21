# Niteflow — Product Specification

## 1. Objective

Niteflow is a **local-first web application** for tech-savvy consumers who run Pi-hole at home and wear a health tracker. It correlates pre-sleep internet activity (sourced from Pi-hole query logs) with sleep quality metrics (sourced from Apple Health exports) to surface patterns and recommendations.

**Target user**: Runs Pi-hole at home, wears an Apple Watch or compatible device, is comfortable with local self-hosted apps.

**Core value**: Answer "is what I'm browsing before bed affecting how I sleep?" — and tell users which content categories to avoid.

---

## 2. Tech Stack

| Layer | Choice | Rationale |
|---|---|---|
| Framework | Next.js 15 (App Router) | React ecosystem shared with future React Native mobile app |
| Language | TypeScript (strict) | Consistent across web and future mobile codebase |
| Database | SQLite via Drizzle ORM + `better-sqlite3` | Local-first, zero-config, migrations via Drizzle |
| UI | Tailwind CSS + shadcn/ui | Accessible, composable, dark-mode ready |
| Charts | Recharts | Lightweight, React-idiomatic; patterns port to React Native |
| Server data | TanStack Query + Next.js Server Actions | Client cache + server-side Pi-hole/health processing |
| Validation | Zod | Runtime validation at all system boundaries |
| Runtime | Node.js local server (`next dev` / `next start`) | Simple local setup; Tauri/Electron wrapping is a later option |

---

## 3. Core Features (MVP)

### 3.1 Settings

- Pi-hole connection: URL + API key input (v6 REST API only — target version: 6.4.1 FTL / 6.6 web)
- Device selection: fetch device/client list from Pi-hole, user picks IPs to monitor (e.g. phone + laptop)
- Pre-sleep window: configurable look-back hours before detected sleep start (default: 3 hours)
- Minimum data threshold for correlation display: configurable nights (default: 7)

### 3.2 Apple Health Import

User uploads the `.zip` exported from the Apple Health app on iPhone.

**How to export** (in-app help guide):
> iPhone → Health → your profile icon → Export All Health Data → Share the .zip

**Parsed record types from `export.xml`:**
- `HKCategoryTypeIdentifierSleepAnalysis` — sleep stages: `InBed`, `Asleep`, `AsleepCore`, `AsleepDeep`, `AsleepREM`, `Awake`
- `HKQuantityTypeIdentifierHeartRateVariabilitySDNN` — HRV (ms)
- `HKQuantityTypeIdentifierRespiratoryRate` — breaths/min
- `HKQuantityTypeIdentifierHeartRate` — BPM
- `HKQuantityTypeIdentifierOxygenSaturation` — SpO2 %

**Nightly sleep quality score (composite, 0–100):**
- Total sleep duration (vs. 8h target) — 25%
- Deep sleep % of total sleep — 25%
- REM sleep % of total sleep — 20%
- HRV (normalized to personal 30-day rolling baseline) — 20%
- Sleep efficiency (time asleep / time in bed) — 10%
- Deductions for excessive wake periods

Sleep sessions are grouped by night (anchored to the later date if crossing midnight).

### 3.3 Pi-hole Sync

- Fetch query log from Pi-hole v6 REST API (`GET /api/queries`) for configured date range
- Authenticate via session token (Pi-hole v6 uses password-derived session tokens, not bare API keys)
- Filter to selected device IPs only
- Store raw query records (timestamp, domain, client IP, status) in SQLite
- Handle self-signed TLS certificates gracefully (user opt-in toggle)

### 3.4 Domain Categorization

**Taxonomy (15 categories):**

| Category | Example domains |
|---|---|
| Social Media | instagram.com, tiktok.com, twitter.com, reddit.com, facebook.com |
| Video Streaming | youtube.com, netflix.com, twitch.tv, disneyplus.com, primevideo.com |
| News & Media | cnn.com, bbc.com, nytimes.com, reddit.com/r/news |
| Gaming | steampowered.com, epicgames.com, twitch.tv, roblox.com |
| Adult / NSFW | (from Steven Black + Hagezi NSFW lists) |
| Shopping | amazon.com, ebay.com, etsy.com, shopify.com |
| Gambling | (from Steven Black + Hagezi gambling lists) |
| Messaging & Communication | discord.com, whatsapp.com, telegram.org, slack.com |
| Music & Audio | spotify.com, soundcloud.com, music.apple.com |
| Work & Productivity | google.com/docs, notion.so, linear.app, github.com |
| Health & Wellness | — |
| Education | coursera.org, udemy.com, khanacademy.org |
| Finance | (banking, crypto exchanges) |
| Travel | airbnb.com, booking.com, skyscanner.com |
| Other | Unclassified |

**Categorization pipeline (in priority order):**
1. **Curated local taxonomy** — `data/domain-taxonomy.json` ships with top ~2,000 consumer domains hand-mapped to categories
2. **Pi-hole list inference** — if a domain appears in Pi-hole gravity.db and its list name matches a known category pattern (e.g. Hagezi "social", Steven Black "gambling"), infer the category
3. **User override** — user can assign any domain to a category via the UI; stored in SQLite

**Shipped taxonomy sources** (pre-parsed into `domain-taxonomy.json` at build time):
- Steven Black extensions: `social.txt`, `gambling.txt`, `porn.txt`, `fakenews.txt`
- Hagezi category-specific lists: social, gambling, NSFW
- Curated hand-mapped top consumer domains

### 3.5 Correlation Dashboard

**Sleep Timeline (line chart)**
- Nightly sleep quality score over time
- Overlay: total sleep hours, HRV trend

**Pre-Sleep Activity (stacked bar chart)**
- For each night: category breakdown of queries in the pre-sleep window
- X-axis: nights, Y-axis: query count or % share by category

**Category vs Sleep Quality (scatter/correlation chart)**
- One chart per category: x = usage intensity that night, y = sleep quality score next morning
- Trend line + Pearson r value shown
- Only shown when ≥ 7 nights of data exist for that category

**Correlation Matrix (heatmap)**
- Rows: sleep metrics (quality score, total duration, HRV, deep %, REM %)
- Columns: content categories
- Cell color: correlation direction and strength

### 3.6 Recommendations

- Ranked list of categories with the strongest **negative** correlation to sleep quality
- For each flagged category: suggested Pi-hole blocklist(s) to install, with copy-paste URL and brief install instructions
- Positive correlations (categories associated with better sleep) also shown

**Recommended lists per category:**

| Category | Suggested list |
|---|---|
| Social Media | Hagezi Social, Steven Black social |
| Gambling | Steven Black gambling, Hagezi gambling |
| Adult / NSFW | Steven Black porn, Hagezi NSFW |
| Fake News | Steven Black fakenews |

---

## 4. Project Structure

```
niteflow/
├── app/
│   ├── (app)/
│   │   ├── layout.tsx              # App shell with nav
│   │   ├── page.tsx                # Dashboard home
│   │   ├── sleep/
│   │   │   └── page.tsx            # Sleep detail view
│   │   └── correlations/
│   │       └── page.tsx            # Correlation explorer
│   ├── settings/
│   │   └── page.tsx                # Pi-hole config + device selection
│   ├── import/
│   │   └── page.tsx                # Apple Health import flow
│   └── api/
│       ├── pihole/
│       │   ├── test/route.ts       # Test Pi-hole connection
│       │   ├── devices/route.ts    # Fetch device list
│       │   └── sync/route.ts       # Pull query log
│       ├── health/
│       │   └── import/route.ts     # Parse and store Health export
│       └── categorize/
│           └── route.ts            # Categorize a domain
├── components/
│   ├── ui/                         # shadcn/ui primitives
│   ├── charts/                     # Recharts wrappers
│   └── dashboard/                  # Page-level composed components
├── lib/
│   ├── db/
│   │   ├── schema.ts               # Drizzle table definitions
│   │   ├── client.ts               # SQLite singleton
│   │   └── queries/                # Typed query helpers
│   ├── pihole/
│   │   ├── client.ts               # Pi-hole v6 REST API client
│   │   └── auth.ts                 # Session token acquisition + refresh
│   ├── health/
│   │   ├── parser.ts               # Apple Health XML streaming parser
│   │   └── scoring.ts              # Nightly sleep quality score
│   ├── taxonomy/
│   │   ├── categorize.ts           # Domain → category lookup
│   │   └── infer.ts                # Gravity list name → category inference
│   └── analytics/
│       ├── correlate.ts            # Pearson correlation computation
│       └── aggregate.ts            # Pre-sleep window aggregation
├── data/
│   └── domain-taxonomy.json        # Curated domain → category mapping (~2K entries)
├── drizzle/                        # Migration SQL files
├── drizzle.config.ts
└── public/
    └── help/
        └── apple-health-export.md  # Export guide
```

---

## 5. Database Schema (Drizzle / SQLite)

```
settings          — key/value store (pihole_url, pihole_key, device_ips, etc.)
sleep_sessions    — one row per night: date, quality_score, hrv_avg, deep_pct, rem_pct, total_min
sleep_records     — raw HK records: type, start_ts, end_ts, value, source
pihole_queries    — timestamp, domain, client_ip, status, category (nullable)
domain_categories — domain, category, source (curated|inferred|user), updated_at
```

---

## 6. Code Style

- TypeScript strict mode, no `any`
- ESLint + Prettier, enforced in CI
- Named exports only (no default exports for components or utilities)
- Server Actions for all mutations (sync, import, settings save)
- Zod schemas at every external boundary (Pi-hole API responses, Health XML records, form inputs)
- No comments unless the WHY is non-obvious

---

## 7. Testing Strategy

- **Unit (Vitest)**: Pure functions — correlation math, XML parsing, sleep score, taxonomy lookup
- **Integration (Vitest + in-memory SQLite)**: Data layer — query helpers, import pipeline, sync pipeline
- **E2E (Playwright)**: Critical user flows — settings save, health import, Pi-hole sync, dashboard render
- Do not mock SQLite — use real in-memory Drizzle instances for data-layer tests
- Fixtures: sample Apple Health export snippet + Pi-hole API response stubs for unit/integration tests

---

## 8. Boundaries

**Always:**
- Store all data in local SQLite — never transmit health data, Pi-hole data, or device IPs externally
- Validate all external inputs with Zod before touching the database
- Show a clear "not enough data" state when < 7 nights of paired data exist (no misleading correlations)
- Accept self-signed TLS on Pi-hole connections (user-confirmed toggle)

**Ask before:**
- Adding npm dependencies beyond the approved stack
- Changing the SQLite schema (requires a Drizzle migration)
- Adding any outbound HTTP call not explicitly listed in this spec
- Implementing a feature not in this spec

**Never:**
- Send health data, query logs, or device identifiers to any external service
- Require user account creation or cloud authentication
- Store sensitive config (Pi-hole key) in localStorage, cookies, or env files — SQLite only
- Display correlation results with fewer than 7 nights of data
