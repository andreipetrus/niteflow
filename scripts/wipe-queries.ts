import Database from 'better-sqlite3'
import path from 'path'

const sqlite = new Database(path.join(process.cwd(), 'niteflow.db'))
const before = (sqlite.prepare('SELECT COUNT(*) as c FROM pihole_queries').get() as { c: number }).c
sqlite.prepare('DELETE FROM pihole_queries').run()
console.log(`Deleted ${before} rows from pihole_queries`)
