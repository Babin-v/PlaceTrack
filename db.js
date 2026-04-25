// db.js — sql.js wrapper with better-sqlite3-compatible API
const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

// On Render, we use a persistent disk at /opt/render/project/src/data/
const DB_DIR = process.env.RENDER_DISK_PATH || __dirname;
const DB_PATH = path.join(DB_DIR, 'placement.db');

// Ensure the directory exists (important for Render persistent disks)
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

async function createDb() {
  const SQL = await initSqlJs();
  let sqljs;
  if (fs.existsSync(DB_PATH)) {
    sqljs = new SQL.Database(fs.readFileSync(DB_PATH));
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
