import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import bcrypt from 'bcryptjs';
import env from './env.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DB_PATH = join(__dirname, '..', '..', 'database', 'samadhan.db');

let db;

/**
 * Initialize the SQLite database connection and create all tables.
 */
export function initializeDatabase() {
  db = new Database(DB_PATH);

  // Enable WAL mode for better concurrent read performance
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  // Create all tables
  db.exec(`
    -- Citizens table
    CREATE TABLE IF NOT EXISTS citizens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      full_name TEXT NOT NULL,
      mobile TEXT NOT NULL UNIQUE,
      area TEXT NOT NULL,
      pincode TEXT NOT NULL,
      preferred_language TEXT DEFAULT 'English',
      profile_picture TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    -- Authorities table
    CREATE TABLE IF NOT EXISTS authorities (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      job_role TEXT NOT NULL,
      sector TEXT NOT NULL,
      area TEXT NOT NULL,
      pincode TEXT NOT NULL,
      mobile TEXT NOT NULL,
      profile_picture TEXT,
      village TEXT,
      mandal TEXT,
      district TEXT,
      latitude TEXT,
      longitude TEXT,
      active_status INTEGER DEFAULT 1,
      workload_count INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    -- Admins table
    CREATE TABLE IF NOT EXISTS admins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      admin_id TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );

    -- OTP records table
    CREATE TABLE IF NOT EXISTS otp_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      mobile TEXT NOT NULL,
      otp_code TEXT NOT NULL,
      purpose TEXT NOT NULL CHECK(purpose IN ('signup', 'login')),
      is_verified INTEGER DEFAULT 0,
      expires_at TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );

    -- Complaint categories/sectors table
    CREATE TABLE IF NOT EXISTS complaint_categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sector_name TEXT NOT NULL UNIQUE,
      description TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    -- Complaints table
    CREATE TABLE IF NOT EXISTS complaints (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      citizen_id INTEGER NOT NULL,
      title TEXT NOT NULL DEFAULT 'General Complaint',
      sector TEXT NOT NULL DEFAULT 'General',
      description TEXT NOT NULL,
      image_path TEXT,
      location TEXT NOT NULL,
      latitude TEXT,
      longitude TEXT,
      area TEXT,
      pincode TEXT,
      city TEXT,
      village TEXT,
      mandal TEXT,
      district TEXT,
      status TEXT DEFAULT 'Pending' CHECK(status IN ('Pending','In Progress','Resolved','Rejected')),
      priority TEXT DEFAULT 'Medium' CHECK(priority IN ('Low','Medium','High','Critical')),
      assigned_authority_id INTEGER,
      resolution_photo TEXT,
      resolution_notes TEXT,
      resolved_by INTEGER,
      resolved_at TEXT,
      resolution_latitude TEXT,
      resolution_longitude TEXT,
      resolution_distance_meters REAL,
      started_at TEXT,
      started_by INTEGER,
      process_latitude TEXT,
      process_longitude TEXT,
      process_notes TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (citizen_id) REFERENCES citizens(id),
      FOREIGN KEY (assigned_authority_id) REFERENCES authorities(id),
      FOREIGN KEY (resolved_by) REFERENCES authorities(id),
      FOREIGN KEY (started_by) REFERENCES authorities(id)
    );

    -- Complaint status history table
    CREATE TABLE IF NOT EXISTS complaint_status_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      complaint_id INTEGER NOT NULL,
      old_status TEXT,
      new_status TEXT NOT NULL,
      changed_by_role TEXT NOT NULL CHECK(changed_by_role IN ('citizen','authority','admin')),
      changed_by_id INTEGER NOT NULL,
      remarks TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (complaint_id) REFERENCES complaints(id)
    );
  `);

  // Safely add title, sector, area, pincode, city columns if they don't exist in existing DB
  const columns = db.prepare("PRAGMA table_info(complaints)").all();

  const hasTitle = columns.some(col => col.name === 'title');
  if (!hasTitle) {
    db.exec("ALTER TABLE complaints ADD COLUMN title TEXT NOT NULL DEFAULT 'General Complaint'");
    console.log("⚡ Added 'title' column to existing complaints table.");
  }

  const hasSector = columns.some(col => col.name === 'sector');
  if (!hasSector) {
    db.exec("ALTER TABLE complaints ADD COLUMN sector TEXT NOT NULL DEFAULT 'General'");
    console.log("⚡ Added 'sector' column to existing complaints table.");
  }

  const hasArea = columns.some(col => col.name === 'area');
  if (!hasArea) {
    db.exec("ALTER TABLE complaints ADD COLUMN area TEXT");
    console.log("⚡ Added 'area' column to existing complaints table.");
  }

  const hasPincode = columns.some(col => col.name === 'pincode');
  if (!hasPincode) {
    db.exec("ALTER TABLE complaints ADD COLUMN pincode TEXT");
    console.log("⚡ Added 'pincode' column to existing complaints table.");
  }

  const hasCity = columns.some(col => col.name === 'city');
  if (!hasCity) {
    db.exec("ALTER TABLE complaints ADD COLUMN city TEXT");
    console.log("⚡ Added 'city' column to existing complaints table.");
  }

  const hasVillageC = columns.some(col => col.name === 'village');
  if (!hasVillageC) {
    db.exec("ALTER TABLE complaints ADD COLUMN village TEXT");
    console.log("⚡ Added 'village' column to existing complaints table.");
  }

  const hasMandalC = columns.some(col => col.name === 'mandal');
  if (!hasMandalC) {
    db.exec("ALTER TABLE complaints ADD COLUMN mandal TEXT");
    console.log("⚡ Added 'mandal' column to existing complaints table.");
  }

  const hasDistrictC = columns.some(col => col.name === 'district');
  if (!hasDistrictC) {
    db.exec("ALTER TABLE complaints ADD COLUMN district TEXT");
    console.log("⚡ Added 'district' column to existing complaints table.");
  }

  // Add resolution tracking columns
  if (!columns.some(col => col.name === 'resolution_photo')) {
    db.exec("ALTER TABLE complaints ADD COLUMN resolution_photo TEXT");
    db.exec("ALTER TABLE complaints ADD COLUMN resolution_notes TEXT");
    db.exec("ALTER TABLE complaints ADD COLUMN resolved_by INTEGER");
    db.exec("ALTER TABLE complaints ADD COLUMN resolved_at TEXT");
    db.exec("ALTER TABLE complaints ADD COLUMN resolution_latitude TEXT");
    db.exec("ALTER TABLE complaints ADD COLUMN resolution_longitude TEXT");
    db.exec("ALTER TABLE complaints ADD COLUMN resolution_distance_meters REAL");
    console.log("⚡ Added 'resolution' tracking columns to existing complaints table.");
  }

  // Add begin-process tracking columns
  if (!columns.some(col => col.name === 'started_at')) {
    db.exec("ALTER TABLE complaints ADD COLUMN started_at TEXT");
    db.exec("ALTER TABLE complaints ADD COLUMN started_by INTEGER");
    db.exec("ALTER TABLE complaints ADD COLUMN process_latitude TEXT");
    db.exec("ALTER TABLE complaints ADD COLUMN process_longitude TEXT");
    db.exec("ALTER TABLE complaints ADD COLUMN process_notes TEXT");
    console.log("⚡ Added 'begin process' tracking columns to existing complaints table.");
  }

  // Safely add missing columns to existing authorities table
  const authColumns = db.prepare("PRAGMA table_info(authorities)").all();
  
  if (!authColumns.some(col => col.name === 'village')) {
    db.exec("ALTER TABLE authorities ADD COLUMN village TEXT");
    console.log("⚡ Added 'village' column to existing authorities table.");
  }
  if (!authColumns.some(col => col.name === 'mandal')) {
    db.exec("ALTER TABLE authorities ADD COLUMN mandal TEXT");
    console.log("⚡ Added 'mandal' column to existing authorities table.");
  }
  if (!authColumns.some(col => col.name === 'district')) {
    db.exec("ALTER TABLE authorities ADD COLUMN district TEXT");
    console.log("⚡ Added 'district' column to existing authorities table.");
  }
  if (!authColumns.some(col => col.name === 'latitude')) {
    db.exec("ALTER TABLE authorities ADD COLUMN latitude TEXT");
    console.log("⚡ Added 'latitude' column to existing authorities table.");
  }
  if (!authColumns.some(col => col.name === 'longitude')) {
    db.exec("ALTER TABLE authorities ADD COLUMN longitude TEXT");
    console.log("⚡ Added 'longitude' column to existing authorities table.");
  }
  if (!authColumns.some(col => col.name === 'active_status')) {
    db.exec("ALTER TABLE authorities ADD COLUMN active_status INTEGER DEFAULT 1");
    console.log("⚡ Added 'active_status' column to existing authorities table.");
  }
  if (!authColumns.some(col => col.name === 'workload_count')) {
    db.exec("ALTER TABLE authorities ADD COLUMN workload_count INTEGER DEFAULT 0");
    console.log("⚡ Added 'workload_count' column to existing authorities table.");
  }

  // Seed default complaint categories/sectors
  seedDefaultCategories();

  // Seed default admin if not exists
  seedDefaultAdmin();

  console.log('✅ Database initialized successfully');
  return db;
}

/**
 * Seed default complaint categories/sectors.
 */
function seedDefaultCategories() {
  const defaultSectors = [
    { sector_name: 'Water', description: 'Water supply issues, pipeline leakage, contamination' },
    { sector_name: 'Roads', description: 'Potholes, broken pavement, road damage' },
    { sector_name: 'Electricity', description: 'Power cuts, sparking poles, transformer faults' },
    { sector_name: 'Drainage', description: 'Blocked drains, sewage overflow, broken manhole covers' },
    { sector_name: 'Sanitation', description: 'Garbage accumulation, dead animals, cleanliness issues' },
    { sector_name: 'Street Lights', description: 'Non-functional street lights, timer issues' },
    { sector_name: 'Traffic', description: 'Faulty traffic signals, severe congestion points' },
    { sector_name: 'Public Safety', description: 'Unsafe public areas, unauthorized encroachments' },
  ];

  const checkStmt = db.prepare('SELECT id FROM complaint_categories WHERE sector_name = ?');
  const insertStmt = db.prepare('INSERT INTO complaint_categories (sector_name, description) VALUES (?, ?)');

  for (const item of defaultSectors) {
    const existing = checkStmt.get(item.sector_name);
    if (!existing) {
      insertStmt.run(item.sector_name, item.description);
    }
  }
}

/**
 * Seed a default admin account on first run.
 */
function seedDefaultAdmin() {
  const existing = db.prepare('SELECT id FROM admins WHERE admin_id = ?').get(env.DEFAULT_ADMIN_ID);

  if (!existing) {
    const hash = bcrypt.hashSync(env.DEFAULT_ADMIN_PASSWORD, env.BCRYPT_SALT_ROUNDS);
    db.prepare('INSERT INTO admins (admin_id, password_hash) VALUES (?, ?)').run(env.DEFAULT_ADMIN_ID, hash);
    console.log(`🔐 Default admin seeded: ${env.DEFAULT_ADMIN_ID}`);
  }
}

/**
 * Get the database instance.
 */
export function getDb() {
  if (!db) {
    throw new Error('Database not initialized. Call initializeDatabase() first.');
  }
  return db;
}

export default { initializeDatabase, getDb };
