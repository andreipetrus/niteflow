# Niteflow

> Local-first app that correlates your Pi-hole DNS history with Apple Health sleep data to show which content categories are hurting your sleep — and suggests blocklists to fix it.

Your phone's screen time report tells you how long you spent on social media. Niteflow tells you whether it actually mattered for how well you slept. It does this by joining two data sources you already have — your Pi-hole's DNS query log and your Apple Watch sleep data — and computing statistical correlations between pre-sleep internet activity and sleep quality, night by night.

Everything runs locally. No account, no cloud, no data leaves your machine.

---

## Features

- **Pi-hole v6 integration** — connects to your Pi-hole via the v6 REST API, imports DNS queries for selected devices, and keeps them in sync
- **Apple Health import** — upload your Health export ZIP; Niteflow parses the XML, groups records into sleep sessions, and computes a composite quality score (duration, deep sleep %, REM %, HRV, efficiency)
- **Domain categorization** — 514 K domains mapped to 21 IAB Content Taxonomy categories using a Curlie directory snapshot, with progressive subdomain fallback; manual overrides saved per-domain
- **Correlation engine** — Pearson r between pre-sleep query volume per category and five sleep metrics (quality score, total duration, HRV, deep %, REM %) over a configurable pre-sleep window
- **Dashboard** — sleep timeline chart (quality, hours, HRV), stacked pre-sleep activity bar chart, and a correlation heatmap with scatter drill-down per cell
- **Recommendations** — surfaces categories with statistically significant negative correlations and links directly to Pi-hole-compatible blocklists you can paste into Group Management

---

## Vision / Roadmap

These are the directions planned for future versions:

- **Mobile companion app** — React Native app for on-the-go summary and push nudges ("you've been on social media for 45 min, your sleep usually suffers after this")
- **Real-time Pi-hole streaming** — replace polling sync with a live WebSocket feed from Pi-hole FTL so the pre-sleep window updates as you browse
- **Scheduled Pi-hole blocks** — one-click "block this category after 10 pm" that writes a time-based group rule back to Pi-hole via the API
- **Multi-user households** — per-device sleep profiles so each family member gets their own correlation analysis
- **Wearable variety** — Garmin Connect and Fitbit export parsers alongside Apple Health
- **LLM-powered plain-English summaries** — run a small local model (Ollama) to narrate your weekly sleep report in plain language

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                     Browser                         │
│  Next.js App Router · React 19 · Tailwind · shadcn  │
└──────────────────────┬──────────────────────────────┘
                       │ Server Actions / API Routes
┌──────────────────────▼──────────────────────────────┐
│                  Next.js Server                     │
│                                                     │
│  ┌─────────────────┐   ┌──────────────────────────┐ │
│  │  Pi-hole sync   │   │  Apple Health import     │ │
│  │  lib/pihole/    │   │  lib/health/             │ │
│  │  · auth (v6)   │   │  · ZIP → XML parser      │ │
│  │  · sync        │   │  · sleep session scorer  │ │
│  │  · devices     │   └──────────────────────────┘ │
│  └────────┬────────┘                                │
│           │              ┌───────────────────────┐  │
│           │              │  Taxonomy engine       │  │
│           │              │  lib/taxonomy/         │  │
│           │              │  · 514K Curlie domains │  │
│           │              │  · IAB v3 categories  │  │
│           │              └──────────┬────────────┘  │
│           │                         │               │
│  ┌────────▼─────────────────────────▼────────────┐  │
│  │              SQLite (Drizzle ORM)              │  │
│  │  settings · sleep_sessions · sleep_records    │  │
│  │  pihole_queries · domain_categories           │  │
│  └────────────────────┬───────────────────────────┘ │
│                       │                             │
│  ┌────────────────────▼───────────────────────────┐ │
│  │          Analytics  lib/analytics/             │ │
│  │  · nightly category aggregation               │ │
│  │  · Pearson r correlation engine               │ │
│  └────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
                       │
         Pi-hole v6 REST API (local network)
```

### Key design decisions

| Decision | Rationale |
|---|---|
| SQLite over Postgres | Single-file, zero-config, works on a laptop or Raspberry Pi with no daemon |
| Next.js Server Actions | Avoids a separate API layer; DB calls stay server-side, never exposed to the browser |
| Streaming XML parser (sax) | Apple Health exports can exceed 1 GB; sax keeps memory flat regardless of file size |
| Pearson r with n ≥ 7 guard | Requires at least 7 paired nights and \|r\| ≥ 0.3 before surfacing a result, reducing noise |
| IAB + Curlie taxonomy | Single authoritative taxonomy with a large pre-built domain map avoids per-request DNS lookups |

---

## Prerequisites

- **Node.js** 20+
- **Pi-hole v6** on your local network (the v6 REST API is required; v5 is not compatible)
- **Apple Watch** paired to an iPhone with the Health app (for sleep stage data including HRV)

---

## Installation

```bash
# 1. Clone
git clone https://github.com/andreipetrus/niteflow.git
cd niteflow

# 2. Install dependencies
npm install

# 3. Run database migrations (creates niteflow.db on first run)
npm run db:migrate

# 4. Start the development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

> **Production build**
> ```bash
> npm run build
> npm start
> ```

---

## Setup

### 1. Connect Pi-hole

Go to **Settings → Pi-hole** and enter:

- **URL** — e.g. `http://192.168.1.2` (the address of your Pi-hole)
- **Password** — your Pi-hole web interface password

Click **Test connection**. Once connected, select the devices whose queries you want to track and click **Sync queries**.

### 2. Import Apple Health data

1. On your iPhone, open the **Health** app → your profile picture → **Export All Health Data**
2. AirDrop or transfer the resulting `export.zip` to your Mac
3. In Niteflow, go to **Import** and upload the ZIP

Niteflow will parse the XML, group records into sleep sessions, and score each night.

### 3. View correlations

Go to **Correlations**. Once you have at least 7 nights where both sleep sessions and pre-sleep Pi-hole queries exist, the heatmap will populate. Click any cell to see the scatter plot for that category/metric pair.

---

## Development

```bash
npm test          # run Vitest test suite
npm run lint      # ESLint
npm run format    # Prettier
npm run db:generate  # regenerate Drizzle migration after schema changes
```

### Project structure

```
app/
  (app)/              # authenticated app shell (sidebar nav)
    page.tsx          # dashboard
    correlations/     # correlation heatmap + recommendations
    settings/         # Pi-hole config, device selector, domain overrides
    import/           # Apple Health ZIP upload
components/
  charts/             # Recharts wrappers (timeline, activity bar, correlation matrix)
  ui/                 # shadcn/ui primitives
lib/
  analytics/          # aggregate.ts, correlate.ts
  db/                 # Drizzle schema, client, query helpers
  health/             # ZIP reader, SAX parser, sleep scorer
  pihole/             # v6 auth, sync, device listing
  taxonomy/           # categorize.ts, Curlie loader, color map
data/
  iab-categories.ts   # 21 IAB category definitions
  curlie-taxonomy.json  # 514K domain→category pairs (pre-built)
  blocklist-recommendations.ts
drizzle/              # SQL migrations
scripts/              # one-off dev/debug scripts (tsx)
```

---

## Tech stack

| Layer | Library |
|---|---|
| Framework | Next.js 16 (App Router) |
| UI | React 19 · Tailwind CSS v4 · shadcn/ui |
| Database | SQLite via Drizzle ORM + better-sqlite3 |
| Charts | Recharts |
| Validation | Zod v4 |
| XML parsing | sax (streaming) |
| ZIP handling | yauzl |
| Testing | Vitest |

---

## License

MIT
