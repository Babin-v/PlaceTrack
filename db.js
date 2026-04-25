// db.js — sql.js wrapper with better-sqlite3-compatible API
const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

// On Render, we use a persistent disk at /data/
const REPO_DB = path.join(__dirname, 'placement.db');
const DB_DIR = process.env.RENDER_DISK_PATH || __dirname;
const DB_PATH = path.join(DB_DIR, 'placement.db');

// Ensure the directory exists
if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });

// Sync Logic: If we have a DB in the repo but not on the disk (or it's a first deploy), copy it
if (fs.existsSync(REPO_DB) && DB_PATH !== REPO_DB) {
  // Only copy if it doesn't exist on the disk yet to prevent overwriting live data every deploy
  if (!fs.existsSync(DB_PATH)) {
    fs.copyFileSync(REPO_DB, DB_PATH);
  }
}

async function createDb() {
  const SQL = await initSqlJs();
  let sqljs;
  if (fs.existsSync(DB_PATH)) {
    sqljs = new SQL.Database(fs.readFileSync(DB_PATH));
  } else if (fs.existsSync(REPO_DB)) {
    sqljs = new SQL.Database(fs.readFileSync(REPO_DB));
  } else {
    sqljs = new SQL.Database();
  }

  function save() {
    fs.writeFileSync(DB_PATH, Buffer.from(sqljs.export()));
  }

  function toObj(cols, row) {
    return Object.fromEntries(cols.map((c, i) => [c, row[i]]));
  }

  function normalizeParams(args) {
    if (args.length === 0) return [];
    if (args.length === 1 && Array.isArray(args[0])) return args[0];
    return args;
  }

  const db = {
    exec(sql) {
      sqljs.run(sql);
      save();
    },
    prepare(sql) {
      return {
        run(...args) {
          const p = normalizeParams(args);
          sqljs.run(sql, p);
          const res = sqljs.exec('SELECT last_insert_rowid() as id');
          const lastInsertRowid = res[0]?.values[0][0] ?? 0;
          save();
          return { lastInsertRowid };
        },
        get(...args) {
          const p = normalizeParams(args);
          const res = sqljs.exec(sql, p);
          if (!res[0]) return undefined;
          return toObj(res[0].columns, res[0].values[0]);
        },
        all(...args) {
          const p = normalizeParams(args);
          const res = sqljs.exec(sql, p);
          if (!res[0]) return [];
          return res[0].values.map(row => toObj(res[0].columns, row));
        }
      };
    }
  };

  return db;
}

module.exports = { createDb };
