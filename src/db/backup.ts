/**
 * Backup and restore: the whole database as one JSON file.
 *
 * A backup is a copy of every row, so restoring gives back exactly what you had —
 * decks, notes, scheduling and review history. It records the schema version it
 * was made with; restoring into a newer app copies the columns both versions
 * share and lets new columns take their defaults.
 */
import type { SQLiteDatabase } from 'expo-sqlite';

import { MIGRATIONS } from './schema';

export const BACKUP_FORMAT = 'recall-backup';
const BACKUP_VERSION = 1;

/** Parents before children, so foreign keys are satisfied while inserting. */
const TABLES = ['decks', 'notes', 'cards', 'review_logs'] as const;
type Table = (typeof TABLES)[number];

type Row = Record<string, unknown>;

export type Backup = {
  format: typeof BACKUP_FORMAT;
  version: number;
  schema: number;
  exportedAt: string;
  tables: Record<Table, Row[]>;
};

export async function createBackup(db: SQLiteDatabase, now = new Date()): Promise<Backup> {
  const tables = {} as Record<Table, Row[]>;
  for (const t of TABLES) tables[t] = await db.getAllAsync<Row>(`SELECT * FROM ${t} ORDER BY id`);
  return { format: BACKUP_FORMAT, version: BACKUP_VERSION, schema: MIGRATIONS.length, exportedAt: now.toISOString(), tables };
}

/** "recall-backup-2026-09-23.json" */
export function backupFileName(now = new Date()) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `recall-backup-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}.json`;
}

/** A message meant for the person restoring, not a crash. */
export class BackupError extends Error {}

/** Checks that `text` is a Recall backup this version can restore. */
export function parseBackup(text: string): Backup {
  let data: Partial<Backup>;
  try {
    data = JSON.parse(text);
  } catch {
    throw new BackupError('This file isn’t a Recall backup (it isn’t valid JSON).');
  }
  if (data?.format !== BACKUP_FORMAT) throw new BackupError('This file isn’t a Recall backup.');
  if ((data.version ?? 0) > BACKUP_VERSION || (data.schema ?? 0) > MIGRATIONS.length) {
    throw new BackupError('This backup was made by a newer version of Recall. Update the app, then try again.');
  }
  for (const t of TABLES) {
    if (!Array.isArray(data.tables?.[t])) throw new BackupError('This backup is incomplete or damaged.');
  }
  return data as Backup;
}

export function backupCounts(b: Backup) {
  return { decks: b.tables.decks.length, cards: b.tables.cards.length, reviews: b.tables.review_logs.length };
}

/**
 * Replaces everything in the database with the backup. All-or-nothing: if any
 * row fails, the transaction rolls back and your current data is untouched.
 */
export async function restoreBackup(db: SQLiteDatabase, backup: Backup) {
  const columns = {} as Record<Table, string[]>;
  for (const t of TABLES) {
    const info = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(${t})`);
    columns[t] = info.map((c) => c.name);
  }

  await db.withTransactionAsync(async () => {
    // Children first, so nothing is left pointing at a deleted row.
    for (const t of [...TABLES].reverse()) await db.runAsync(`DELETE FROM ${t}`);

    for (const t of TABLES) {
      for (const row of backup.tables[t]) {
        // Only columns this version of the app has, and only values SQLite can store.
        const keys = columns[t].filter((c) => c in row);
        const values = keys.map((k) => {
          const v = row[k];
          return typeof v === 'number' || typeof v === 'string' || v === null ? v : JSON.stringify(v);
        });
        await db.runAsync(`INSERT INTO ${t} (${keys.join(', ')}) VALUES (${keys.map(() => '?').join(', ')})`, values);
      }
    }

    const broken = await db.getAllAsync('PRAGMA foreign_key_check');
    if (broken.length) throw new BackupError('This backup is damaged: some cards point at notes or decks that aren’t in it.');
  });
}
