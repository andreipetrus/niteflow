import { sqliteTable, text, real, integer } from 'drizzle-orm/sqlite-core'

export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
})

export const sleepSessions = sqliteTable('sleep_sessions', {
  date: text('date').primaryKey(), // YYYY-MM-DD (wake-date per SPEC)
  sleepStartTs: integer('sleep_start_ts'), // Unix seconds, first asleep record
  sleepEndTs: integer('sleep_end_ts'), // Unix seconds, last asleep record
  qualityScore: real('quality_score').notNull(),
  totalMin: real('total_min').notNull(),
  deepPct: real('deep_pct').notNull(),
  remPct: real('rem_pct').notNull(),
  hrvAvg: real('hrv_avg'),
  efficiency: real('efficiency').notNull(),
})

export const sleepRecords = sqliteTable('sleep_records', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  type: text('type').notNull(),
  startTs: integer('start_ts').notNull(), // Unix seconds
  endTs: integer('end_ts').notNull(),
  // Value is a string — Apple uses enums for sleep stages
  // (HKCategoryValueSleepAnalysisAsleepCore) and numeric strings for quantity
  // types (HRV "45.2", heart rate "62"). Callers parse as needed.
  value: text('value'),
  unit: text('unit'),
  source: text('source'),
})

export const piholeQueries = sqliteTable('pihole_queries', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  piholeId: integer('pihole_id').notNull().unique(),
  timestamp: integer('timestamp').notNull(), // Unix seconds
  domain: text('domain').notNull(),
  clientIp: text('client_ip').notNull(),
  status: text('status').notNull(),
  category: text('category'),
})

export const domainCategories = sqliteTable('domain_categories', {
  domain: text('domain').primaryKey(),
  category: text('category').notNull(),
  source: text('source').notNull(), // curated | inferred | user
  updatedAt: integer('updated_at').notNull(), // Unix seconds
})
