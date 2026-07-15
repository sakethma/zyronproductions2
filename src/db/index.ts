import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema.ts';
import { users, events, bookings, galleryItems, notifications } from './schema.ts';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

// Load environment variables immediately before checking SQL_HOST
dotenv.config();

const hasSql = !!process.env.SQL_HOST;

export const createPool = () => {
  if (!hasSql) return null;
  return new Pool({
    host: process.env.SQL_HOST,
    user: process.env.SQL_USER,
    password: process.env.SQL_PASSWORD,
    database: process.env.SQL_DB_NAME,
    connectionTimeoutMillis: 15000,
  });
};

const pool = createPool();

if (pool) {
  pool.on('error', (err: any) => {
    console.error('Unexpected error on idle SQL pool client:', err);
  });
}

// Local JSON DB utilities
const DB_DIR = path.join(process.cwd(), 'data');
const DB_PATH = path.join(DB_DIR, 'db.json');

function ensureJsonDb() {
  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }
  if (!fs.existsSync(DB_PATH)) {
    fs.writeFileSync(DB_PATH, JSON.stringify({
      users: [],
      events: [],
      bookings: [],
      gallery_items: [],
      notifications: []
    }, null, 2));
  }
}

function readJsonDb(): any {
  ensureJsonDb();
  try {
    const data = fs.readFileSync(DB_PATH, 'utf-8');
    return JSON.parse(data);
  } catch (e) {
    return { users: [], events: [], bookings: [], gallery_items: [], notifications: [] };
  }
}

function writeJsonDb(data: any) {
  ensureJsonDb();
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

function getTableName(table: any): string {
  if (table === users) return 'users';
  if (table === events) return 'events';
  if (table === bookings) return 'bookings';
  if (table === galleryItems) return 'gallery_items';
  if (table === notifications) return 'notifications';
  return '';
}

function matchRow(row: any, sqlExpr: any): boolean {
  if (!sqlExpr) return true;
  
  let cols: string[] = [];
  let params: any[] = [];
  let checkIsNull = false;
  let isNullCol: string | null = null;
  
  const scan = (expr: any) => {
    if (!expr || !expr.queryChunks) return;
    for (const chunk of expr.queryChunks) {
      if (!chunk) continue;
      const cname = chunk.constructor?.name;
      if (cname === 'StringChunk') {
        const val = chunk.value || '';
        if (val.toLowerCase().includes('is null')) {
          checkIsNull = true;
          if (cols.length > 0) {
            isNullCol = cols[cols.length - 1];
            cols.pop();
          }
        }
      } else if (cname && (cname.startsWith('Pg') || cname.startsWith('Column'))) {
        cols.push(chunk.name);
      } else if (cname === 'Param') {
        params.push(chunk.value);
      } else if (cname === 'SQL') {
        scan(chunk);
      }
    }
  };
  
  scan(sqlExpr);
  
  if (checkIsNull && isNullCol) {
    const val = row[isNullCol];
    if (val !== null && val !== undefined && val !== '') {
      return false;
    }
  }
  
  for (let i = 0; i < cols.length; i++) {
    const colName = cols[i];
    const targetVal = params[i];
    
    let rowVal = row[colName];
    if (colName === 'uid' && rowVal === undefined) {
      rowVal = row['id'];
    }
    
    if (rowVal !== targetVal) {
      return false;
    }
  }
  
  return true;
}

const createMockDrizzle = () => {
  return {
    select: () => {
      return {
        from: (table: any) => {
          const tableName = getTableName(table);
          
          return {
            where: (sqlExpr: any) => {
              const data = readJsonDb();
              const list = data[tableName] || [];
              const filtered = list.filter((row: any) => matchRow(row, sqlExpr));
              return Promise.resolve(filtered);
            },
            then: (resolve: any) => {
              const data = readJsonDb();
              const list = data[tableName] || [];
              return resolve(list);
            },
            catch: (reject: any) => {},
          };
        }
      };
    },
    insert: (table: any) => {
      const tableName = getTableName(table);
      return {
        values: (values: any) => {
          const vals = Array.isArray(values) ? values : [values];
          
          const chain = {
            onConflictDoUpdate: (config: any) => {
              const data = readJsonDb();
              const list = data[tableName] || [];
              const inserted: any[] = [];
              
              for (const val of vals) {
                const existingIndex = list.findIndex((row: any) => row.uid === val.uid);
                if (existingIndex !== -1) {
                  list[existingIndex] = { ...list[existingIndex], ...config.set, ...val };
                  inserted.push(list[existingIndex]);
                } else {
                  const row = { ...val };
                  if (!row.id) {
                    row.id = row.uid || 'id-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
                  }
                  list.push(row);
                  inserted.push(row);
                }
              }
              data[tableName] = list;
              writeJsonDb(data);
              
              return {
                returning: () => Promise.resolve(inserted),
                then: (resolve: any) => resolve(inserted),
              };
            },
            returning: () => {
              const data = readJsonDb();
              const list = data[tableName] || [];
              const inserted: any[] = [];
              
              for (const val of vals) {
                const row = { ...val };
                if (!row.id) {
                  row.id = row.uid || 'id-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
                }
                list.push(row);
                inserted.push(row);
              }
              
              data[tableName] = list;
              writeJsonDb(data);
              return Promise.resolve(inserted);
            },
            then: (resolve: any) => {
              const data = readJsonDb();
              const list = data[tableName] || [];
              const inserted: any[] = [];
              for (const val of vals) {
                const row = { ...val };
                if (!row.id) {
                  row.id = row.uid || 'id-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
                }
                list.push(row);
                inserted.push(row);
              }
              data[tableName] = list;
              writeJsonDb(data);
              return resolve(inserted);
            }
          };
          
          return chain;
        }
      };
    },
    update: (table: any) => {
      const tableName = getTableName(table);
      return {
        set: (updateValues: any) => {
          return {
            where: (sqlExpr: any) => {
              const data = readJsonDb();
              const list = data[tableName] || [];
              const updated: any[] = [];
              
              for (let i = 0; i < list.length; i++) {
                if (matchRow(list[i], sqlExpr)) {
                  list[i] = { ...list[i], ...updateValues };
                  updated.push(list[i]);
                }
              }
              
              data[tableName] = list;
              writeJsonDb(data);
              
              return Promise.resolve(updated);
            }
          };
        }
      };
    },
    delete: (table: any) => {
      const tableName = getTableName(table);
      return {
        where: (sqlExpr: any) => {
          const data = readJsonDb();
          const list = data[tableName] || [];
          const remaining = list.filter((row: any) => !matchRow(row, sqlExpr));
          const deletedCount = list.length - remaining.length;
          
          data[tableName] = remaining;
          writeJsonDb(data);
          
          return Promise.resolve({ affectedRows: deletedCount });
        }
      };
    }
  };
};

export const db = hasSql ? drizzle(pool, { schema }) : (createMockDrizzle() as any);
