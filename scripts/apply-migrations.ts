import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import path from 'path'

const sqlite = new Database(path.join(process.cwd(), 'niteflow.db'))
const db = drizzle(sqlite)
migrate(db, { migrationsFolder: path.join(process.cwd(), 'drizzle') })
console.log('Migrations applied')
