import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, 'medivora.db');

// Initialize the database connection
const db = new Database(dbPath);

// Enforce foreign keys
db.pragma('foreign_keys = ON');

// --- Schema Initialization ---

// Create Users Table
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    name TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

// Create Medicine Cabinet Table
db.exec(`
  CREATE TABLE IF NOT EXISTS cabinet (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    medicine_name TEXT NOT NULL,
    dosage TEXT,
    notes TEXT,
    added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  )
`);

console.log('[DB] SQLite Database Initialized');

export default db;
