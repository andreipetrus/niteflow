import Database from 'better-sqlite3'
import path from 'path'

const sqlite = new Database(path.join(process.cwd(), 'niteflow.db'))

sqlite.exec(`
  DROP TABLE IF EXISTS pihole_queries;
  CREATE TABLE pihole_queries (
    id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
    pihole_id integer NOT NULL,
    timestamp integer NOT NULL,
    domain text NOT NULL,
    client_ip text NOT NULL,
    status text NOT NULL,
    category text
  );
  CREATE UNIQUE INDEX pihole_queries_pihole_id_unique ON pihole_queries (pihole_id);
`)

// Mark the 0001 migration as applied so drizzle doesn't try to re-run it
const journalRow = sqlite
  .prepare(
    "SELECT count(*) as c FROM sqlite_master WHERE type='table' AND name='__drizzle_migrations'"
  )
  .get() as { c: number }

if (journalRow.c > 0) {
  sqlite
    .prepare(
      "INSERT OR IGNORE INTO __drizzle_migrations (hash, created_at) VALUES (?, ?)"
    )
    .run('0001_parallel_bloodaxe', Date.now())
}

console.log('pihole_queries table recreated with pihole_id column')
