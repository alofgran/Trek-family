import cron, { type ScheduledTask } from 'node-cron';
import archiver from 'archiver';
import path from 'node:path';
import fs from 'node:fs';
import { logInfo, logError } from './services/auditLog';
import { ageFromDob, suggestTravelerType } from '@trek-family/shared';
import { isPassportInsufficientForTrip } from './services/documentValidityService';

const dataDir = path.join(__dirname, '../data');
const backupsDir = path.join(dataDir, 'backups');
const uploadsDir = path.join(__dirname, '../uploads');
const settingsFile = path.join(dataDir, 'backup-settings.json');

const VALID_INTERVALS = ['hourly', 'daily', 'weekly', 'monthly'];
const VALID_DAYS_OF_WEEK = new Set([0, 1, 2, 3, 4, 5, 6]); // 0=Sunday
const VALID_HOURS = new Set(Array.from({length: 24}, (_, i) => i));

interface BackupSettings {
  enabled: boolean;
  interval: string;
  keep_days: number;
  hour: number;
  day_of_week: number;
  day_of_month: number;
}

export function buildCronExpression(settings: BackupSettings): string {
  const hour = VALID_HOURS.has(settings.hour) ? settings.hour : 2;
  const dow = VALID_DAYS_OF_WEEK.has(settings.day_of_week) ? settings.day_of_week : 0;
  const dom = settings.day_of_month >= 1 && settings.day_of_month <= 28 ? settings.day_of_month : 1;

  switch (settings.interval) {
    case 'hourly':  return '0 * * * *';
    case 'daily':   return `0 ${hour} * * *`;
    case 'weekly':  return `0 ${hour} * * ${dow}`;
    case 'monthly': return `0 ${hour} ${dom} * *`;
    default:        return `0 ${hour} * * *`;
  }
}

let currentTask: ScheduledTask | null = null;

function getDefaults(): BackupSettings {
  return { enabled: false, interval: 'daily', keep_days: 7, hour: 2, day_of_week: 0, day_of_month: 1 };
}

function loadSettings(): BackupSettings {
  let settings = getDefaults();
  try {
    if (fs.existsSync(settingsFile)) {
      const saved = JSON.parse(fs.readFileSync(settingsFile, 'utf8'));
      settings = { ...settings, ...saved };
    }
  } catch (e) {}
  return settings;
}

function saveSettings(settings: BackupSettings): void {
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(settingsFile, JSON.stringify(settings, null, 2));
}

async function runBackup(): Promise<void> {
  if (!fs.existsSync(backupsDir)) fs.mkdirSync(backupsDir, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const filename = `auto-backup-${timestamp}.zip`;
  const outputPath = path.join(backupsDir, filename);

  try {
    // Flush WAL to main DB file before archiving
    try { const { db } = require('./db/database'); db.exec('PRAGMA wal_checkpoint(TRUNCATE)'); } catch (e) {}

    await new Promise<void>((resolve, reject) => {
      const output = fs.createWriteStream(outputPath);
      const archive = archiver('zip', { zlib: { level: 9 } });
      output.on('close', resolve);
      archive.on('error', reject);
      archive.pipe(output);
      const dbPath = path.join(dataDir, 'travel.db');
      if (fs.existsSync(dbPath)) archive.file(dbPath, { name: 'travel.db' });
      if (fs.existsSync(uploadsDir)) archive.directory(uploadsDir, 'uploads');
      archive.finalize();
    });
    logInfo(`Auto-Backup created: ${filename}`);
  } catch (err: unknown) {
    logError(`Auto-Backup: ${err instanceof Error ? err.message : err}`);
    if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
    return;
  }

  const settings = loadSettings();
  if (settings.keep_days > 0) {
    cleanupOldBackups(settings.keep_days);
  }
}

function autoBackupTimestampMs(filename: string): number | null {
  // auto-backup-2026-04-27T00-00-00.zip → 2026-04-27T00:00:00
  const stamp = filename.slice('auto-backup-'.length, -'.zip'.length);
  const iso = stamp.replace(/T(\d{2})-(\d{2})-(\d{2})$/, 'T$1:$2:$3');
  const ms = Date.parse(iso);
  return Number.isNaN(ms) ? null : ms;
}

export function cleanupOldBackups(keepDays: number, now: number = Date.now()): void {
  try {
    const cutoff = now - keepDays * 24 * 60 * 60 * 1000;
    const files = fs.readdirSync(backupsDir).filter(f => f.startsWith('auto-backup-') && f.endsWith('.zip'));
    for (const file of files) {
      const filePath = path.join(backupsDir, file);
      const ageMs = autoBackupTimestampMs(file) ?? fs.statSync(filePath).mtimeMs;
      if (ageMs < cutoff) {
        fs.unlinkSync(filePath);
        logInfo(`Auto-Backup old backup deleted: ${file}`);
      }
    }
  } catch (err: unknown) {
    logError(`Auto-Backup cleanup: ${err instanceof Error ? err.message : err}`);
  }
}

function start(): void {
  if (currentTask) {
    currentTask.stop();
    currentTask = null;
  }

  const settings = loadSettings();
  if (!settings.enabled) {
    logInfo('Auto-Backup disabled');
    return;
  }

  const expression = buildCronExpression(settings);
  const tz = process.env.TZ || 'UTC';
  currentTask = cron.schedule(expression, runBackup, { timezone: tz });
  logInfo(`Auto-Backup scheduled: ${settings.interval} (${expression}), tz: ${tz}, retention: ${settings.keep_days === 0 ? 'forever' : settings.keep_days + ' days'}`);
}

// Demo mode: hourly reset of demo user data
let demoTask: ScheduledTask | null = null;

function startDemoReset(): void {
  if (demoTask) { demoTask.stop(); demoTask = null; }
  if (process.env.DEMO_MODE?.toLowerCase() !== 'true') return;

  demoTask = cron.schedule('0 * * * *', () => {
    try {
      const { resetDemoUser } = require('./demo/demo-reset');
      resetDemoUser();
    } catch (err: unknown) {
      logError(`Demo reset: ${err instanceof Error ? err.message : err}`);
    }
  });
  logInfo('Demo hourly reset scheduled');
}

// Trip reminders: daily check at 9 AM local time for trips starting tomorrow
let reminderTask: ScheduledTask | null = null;

function startTripReminders(): void {
  if (reminderTask) { reminderTask.stop(); reminderTask = null; }

  try {
    const { db } = require('./db/database');
    const getSetting = (key: string) => (db.prepare('SELECT value FROM app_settings WHERE key = ?').get(key) as { value: string } | undefined)?.value;
    const reminderEnabled = getSetting('notify_trip_reminder') !== 'false';
    const channelsRaw = getSetting('notification_channels') || getSetting('notification_channel') || 'none';
    const activeChannels = channelsRaw === 'none' ? [] : channelsRaw.split(',').map((c: string) => c.trim());
    if (!reminderEnabled) {
      logInfo('Trip reminders: disabled in settings');
      return;
    }

    const tripCount = (db.prepare('SELECT COUNT(*) as c FROM trips WHERE reminder_days > 0 AND start_date IS NOT NULL').get() as { c: number }).c;
    logInfo(`Trip reminders: enabled via [${activeChannels.join(',')}]${tripCount > 0 ? `, ${tripCount} trip(s) with active reminders` : ''}`);
  } catch {
    return;
  }

  const tz = process.env.TZ || 'UTC';
  reminderTask = cron.schedule('0 9 * * *', async () => {
    try {
      const { db } = require('./db/database');
      const { send } = require('./services/notificationService');

      const trips = db.prepare(`
        SELECT t.id, t.title, t.user_id, t.reminder_days FROM trips t
        WHERE t.reminder_days > 0
          AND t.start_date IS NOT NULL
          AND t.start_date = date('now', '+' || t.reminder_days || ' days')
      `).all() as { id: number; title: string; user_id: number; reminder_days: number }[];

      for (const trip of trips) {
        await send({ event: 'trip_reminder', actorId: null, scope: 'trip', targetId: trip.id, params: { trip: trip.title, tripId: String(trip.id) } }).catch(() => {});
      }

      if (trips.length > 0) {
        logInfo(`Trip reminders sent for ${trips.length} trip(s): ${trips.map(t => `"${t.title}" (${t.reminder_days}d)`).join(', ')}`);
      }
    } catch (err: unknown) {
      logError(`Trip reminder check failed: ${err instanceof Error ? err.message : err}`);
    }
  }, { timezone: tz });
}

// Missing-traveler transport reminder: fires on the same day as the trip
// reminder (t.start_date = t.reminder_days before today), so it's naturally
// one-shot per trip with no dedup column needed — same trick startTripReminders
// uses. Flags trip travelers with zero flight/train/car/cruise reservation
// linked to them anywhere on the trip (see travelerService.getTravelersMissingTransport,
// which itself no-ops until at least one transport reservation exists).
let missingTransportTask: ScheduledTask | null = null;

function startMissingTransportReminders(): void {
  if (missingTransportTask) { missingTransportTask.stop(); missingTransportTask = null; }

  const { db } = require('./db/database');
  const getSetting = (key: string) => (db.prepare('SELECT value FROM app_settings WHERE key = ?').get(key) as { value: string } | undefined)?.value;
  const enabled = getSetting('notify_missing_traveler_transport') !== 'false';
  if (!enabled) {
    logInfo('Missing-transport reminders: disabled in settings');
    return;
  }

  const tz = process.env.TZ || 'UTC';
  missingTransportTask = cron.schedule('0 9 * * *', async () => {
    try {
      const { send } = require('./services/notificationService');
      const { getTravelersMissingTransport } = require('./services/travelerService');

      const trips = db.prepare(`
        SELECT t.id, t.title FROM trips t
        WHERE t.reminder_days > 0
          AND t.start_date IS NOT NULL
          AND t.start_date = date('now', '+' || t.reminder_days || ' days')
      `).all() as { id: number; title: string }[];

      let sent = 0;
      for (const trip of trips) {
        const missing = getTravelersMissingTransport(trip.id) as { name: string }[];
        if (missing.length === 0) continue;
        await send({
          event: 'missing_traveler_transport',
          actorId: null,
          scope: 'trip',
          targetId: trip.id,
          params: { trip: trip.title, tripId: String(trip.id), travelers: missing.map(t => t.name).join(', '), count: String(missing.length) },
        }).catch(() => {});
        sent++;
      }

      if (sent > 0) {
        logInfo(`Missing-transport reminders sent for ${sent} trip(s)`);
      }
    } catch (err: unknown) {
      logError(`Missing-transport reminder check failed: ${err instanceof Error ? err.message : err}`);
    }
  }, { timezone: tz });
}

// Todo due-date reminders: daily check at 9 AM for unchecked todos
// whose due_date falls within the next TODO_REMINDER_LEAD_DAYS days.
// Each todo gets reminded at most once per 24 h (tracked via
// todo_items.reminded_at) so the scheduler doesn't spam the user every
// morning leading up to the deadline.
const TODO_REMINDER_LEAD_DAYS = 3;
let todoReminderTask: ScheduledTask | null = null;

function startTodoReminders(): void {
  if (todoReminderTask) { todoReminderTask.stop(); todoReminderTask = null; }

  const { db } = require('./db/database');
  const getSetting = (key: string) => (db.prepare('SELECT value FROM app_settings WHERE key = ?').get(key) as { value: string } | undefined)?.value;
  const enabled = getSetting('notify_todo_due') !== 'false';
  if (!enabled) {
    logInfo('Todo due reminders: disabled in settings');
    return;
  }
  logInfo(`Todo due reminders: enabled (lead ${TODO_REMINDER_LEAD_DAYS}d)`);

  const tz = process.env.TZ || 'UTC';
  todoReminderTask = cron.schedule('0 9 * * *', async () => {
    try {
      const { send } = require('./services/notificationService');

      // Select unchecked todos with a due date inside the lead window
      // that haven't been reminded in the last 24 hours. `due_date` is
      // stored as a YYYY-MM-DD text; SQLite date() handles it directly.
      const todos = db.prepare(`
        SELECT ti.id, ti.trip_id, ti.name, ti.due_date, ti.assigned_user_id,
               t.title AS trip_title, t.user_id AS trip_owner_id
        FROM todo_items ti
        JOIN trips t ON t.id = ti.trip_id
        WHERE ti.checked = 0
          AND ti.due_date IS NOT NULL
          AND ti.due_date <> ''
          AND date(ti.due_date) <= date('now', '+' || ? || ' days')
          AND date(ti.due_date) >= date('now')
          AND (ti.reminded_at IS NULL OR ti.reminded_at <= datetime('now', '-20 hours'))
      `).all(TODO_REMINDER_LEAD_DAYS) as {
        id: number; trip_id: number; name: string; due_date: string;
        assigned_user_id: number | null; trip_title: string; trip_owner_id: number;
      }[];

      for (const todo of todos) {
        const targetScope: 'user' | 'trip' = todo.assigned_user_id ? 'user' : 'trip';
        const targetId = todo.assigned_user_id ?? todo.trip_id;
        await send({
          event: 'todo_due',
          actorId: null,
          scope: targetScope,
          targetId,
          params: {
            todo: todo.name,
            trip: todo.trip_title,
            tripId: String(todo.trip_id),
            due: todo.due_date,
          },
        }).catch(() => {});
        db.prepare('UPDATE todo_items SET reminded_at = CURRENT_TIMESTAMP WHERE id = ?').run(todo.id);
      }

      if (todos.length > 0) {
        logInfo(`Todo reminders sent for ${todos.length} item(s)`);
      }
    } catch (err: unknown) {
      logError(`Todo reminder check failed: ${err instanceof Error ? err.message : err}`);
    }
  }, { timezone: tz });
}

// Document expiry alerts: daily check at 9 AM for trip_files whose
// expiry_date falls within DOCUMENT_EXPIRY_LEAD_DAYS. Each document alerts
// at most once (tracked via trip_files.expiry_alert_sent_at) — unlike the
// todo reminder, this doesn't nag daily; it re-arms only if expiry_date is
// edited (see fileService.updateFile).
const DOCUMENT_EXPIRY_LEAD_DAYS = 90;
let documentExpiryTask: ScheduledTask | null = null;

interface DocExpiryRow {
  id: number; trip_id: number; document_type: string | null; expiry_date: string;
  trip_title: string; trip_owner_id: number;
  traveler_name: string | null; managed_by_user_id: number | null;
}

function startDocumentExpiryReminders(): void {
  if (documentExpiryTask) { documentExpiryTask.stop(); documentExpiryTask = null; }

  const { db } = require('./db/database');
  const getSetting = (key: string) => (db.prepare('SELECT value FROM app_settings WHERE key = ?').get(key) as { value: string } | undefined)?.value;
  const enabled = getSetting('notify_document_expiry') !== 'false';
  if (!enabled) {
    logInfo('Document expiry reminders: disabled in settings');
    return;
  }
  logInfo(`Document expiry reminders: enabled (lead ${DOCUMENT_EXPIRY_LEAD_DAYS}d)`);

  const tz = process.env.TZ || 'UTC';
  documentExpiryTask = cron.schedule('0 9 * * *', async () => {
    try {
      const { send } = require('./services/notificationService');
      const { requiredPassportValidityDays } = require('@trek-family/shared');
      const { getTripCountries } = require('./services/atlasService');

      // Non-passport docs: flat lead-time window, as before.
      const generic = db.prepare(`
        SELECT f.id, f.trip_id, f.document_type, f.expiry_date,
               t.title AS trip_title, t.user_id AS trip_owner_id,
               tr.name AS traveler_name, tr.managed_by_user_id
        FROM trip_files f
        JOIN trips t ON t.id = f.trip_id
        LEFT JOIN travelers tr ON tr.id = f.traveler_id
        WHERE f.expiry_date IS NOT NULL
          AND f.expiry_date <> ''
          AND f.document_type <> 'passport'
          AND date(f.expiry_date) <= date('now', '+' || ? || ' days')
          AND f.expiry_alert_sent_at IS NULL
      `).all(DOCUMENT_EXPIRY_LEAD_DAYS) as DocExpiryRow[];

      // Passports: many destinations require validity well beyond the raw
      // expiry date (e.g. 6 months past return) — a passport that isn't
      // "expiring soon" by the flat window can already be insufficient for a
      // specific trip. Check every undecided passport regardless of the flat
      // window and compute a country-aware cutoff instead.
      const passports = db.prepare(`
        SELECT f.id, f.trip_id, f.document_type, f.expiry_date,
               t.title AS trip_title, t.user_id AS trip_owner_id, t.end_date AS trip_end_date,
               tr.name AS traveler_name, tr.managed_by_user_id
        FROM trip_files f
        JOIN trips t ON t.id = f.trip_id
        LEFT JOIN travelers tr ON tr.id = f.traveler_id
        WHERE f.expiry_date IS NOT NULL
          AND f.expiry_date <> ''
          AND f.document_type = 'passport'
          AND f.expiry_alert_sent_at IS NULL
      `).all() as (DocExpiryRow & { trip_end_date: string | null })[];

      const docs: DocExpiryRow[] = [...generic];
      for (const doc of passports) {
        const countries: string[] = getTripCountries(doc.trip_id);
        if (isPassportInsufficientForTrip(doc.expiry_date, doc.trip_end_date, countries, requiredPassportValidityDays, DOCUMENT_EXPIRY_LEAD_DAYS)) {
          docs.push(doc);
        }
      }

      for (const doc of docs) {
        const recipientId = doc.managed_by_user_id ?? doc.trip_owner_id;
        await send({
          event: 'document_expiry',
          actorId: null,
          scope: 'user',
          targetId: recipientId,
          params: {
            documentType: doc.document_type || 'other',
            traveler: doc.traveler_name || '',
            trip: doc.trip_title,
            tripId: String(doc.trip_id),
            expiry: doc.expiry_date,
          },
        }).catch(() => {});
        db.prepare('UPDATE trip_files SET expiry_alert_sent_at = CURRENT_TIMESTAMP WHERE id = ?').run(doc.id);
      }

      if (docs.length > 0) {
        logInfo(`Document expiry reminders sent for ${docs.length} document(s)`);
      }
    } catch (err: unknown) {
      logError(`Document expiry check failed: ${err instanceof Error ? err.message : err}`);
    }
  }, { timezone: tz });
}

// Age-band reminders: daily check at 9 AM — notify a traveler's manager when
// the age computed from date_of_birth no longer matches the stored type
// (adult/teen/child/infant). The stored type is never auto-changed (families
// pick it deliberately, e.g. for packing needs) — this just surfaces the
// suggestion. Alerts once per mismatch (see updateTraveler's re-arm on edit).
let ageBandReminderTask: ScheduledTask | null = null;

function startAgeBandReminders(): void {
  if (ageBandReminderTask) { ageBandReminderTask.stop(); ageBandReminderTask = null; }

  const { db } = require('./db/database');
  const getSetting = (key: string) => (db.prepare('SELECT value FROM app_settings WHERE key = ?').get(key) as { value: string } | undefined)?.value;
  const enabled = getSetting('notify_age_band_update') !== 'false';
  if (!enabled) {
    logInfo('Age-band reminders: disabled in settings');
    return;
  }

  const tz = process.env.TZ || 'UTC';
  ageBandReminderTask = cron.schedule('0 9 * * *', async () => {
    try {
      const { send } = require('./services/notificationService');

      const travelers = db.prepare(`
        SELECT id, managed_by_user_id, name, type, date_of_birth
        FROM travelers
        WHERE date_of_birth IS NOT NULL
          AND date_of_birth <> ''
          AND age_band_alert_sent_at IS NULL
      `).all() as { id: number; managed_by_user_id: number; name: string; type: string; date_of_birth: string }[];

      let sent = 0;
      for (const traveler of travelers) {
        const suggested = suggestTravelerType(ageFromDob(traveler.date_of_birth));
        if (!suggested || suggested === traveler.type) continue;

        await send({
          event: 'age_band_update',
          actorId: null,
          scope: 'user',
          targetId: traveler.managed_by_user_id,
          params: { traveler: traveler.name, oldType: traveler.type, newType: suggested },
        }).catch(() => {});
        db.prepare('UPDATE travelers SET age_band_alert_sent_at = CURRENT_TIMESTAMP WHERE id = ?').run(traveler.id);
        sent++;
      }

      if (sent > 0) {
        logInfo(`Age-band reminders sent for ${sent} traveler(s)`);
      }
    } catch (err: unknown) {
      logError(`Age-band reminder check failed: ${err instanceof Error ? err.message : err}`);
    }
  }, { timezone: tz });
}

// Version check: daily at 9 AM — notify admins if a new TREK release is available
let versionCheckTask: ScheduledTask | null = null;

function startVersionCheck(): void {
  if (versionCheckTask) { versionCheckTask.stop(); versionCheckTask = null; }

  const tz = process.env.TZ || 'UTC';
  versionCheckTask = cron.schedule('0 9 * * *', async () => {
    try {
      const { checkAndNotifyVersion } = require('./services/adminService');
      await checkAndNotifyVersion();
    } catch (err: unknown) {
      logError(`Version check: ${err instanceof Error ? err.message : err}`);
    }
  }, { timezone: tz });
}

// Idempotency key cleanup: nightly at 3 AM — delete keys past their TTL.
// The TTL must exceed any realistic offline window: the TREK client replays
// queued mutations with their X-Idempotency-Key when it reconnects, so a key
// GC'd before the device comes back online would let the replay create a
// duplicate. 24h was far too short for a multi-day offline trip; default 30d,
// overridable via IDEMPOTENCY_TTL_SECONDS.
const DEFAULT_IDEMPOTENCY_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 days
let idempotencyCleanupTask: ScheduledTask | null = null;

function idempotencyTtlSeconds(): number {
  const n = Number(process.env.IDEMPOTENCY_TTL_SECONDS);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_IDEMPOTENCY_TTL_SECONDS;
}

interface PurgeDb {
  prepare(sql: string): { run(...args: unknown[]): { changes: number } };
}

/** Delete idempotency keys older than the configured TTL. Returns rows removed.
 *  The db is injectable for testing; the cron job uses the default. */
function purgeExpiredIdempotencyKeys(
  now: number = Date.now(),
  ttlSeconds: number = idempotencyTtlSeconds(),
  database: PurgeDb = require('./db/database').db,
): number {
  const cutoff = Math.floor(now / 1000) - ttlSeconds;
  const result = database.prepare('DELETE FROM idempotency_keys WHERE created_at < ?').run(cutoff);
  return result.changes;
}

function startIdempotencyCleanup(): void {
  if (idempotencyCleanupTask) { idempotencyCleanupTask.stop(); idempotencyCleanupTask = null; }

  const tz = process.env.TZ || 'UTC';
  idempotencyCleanupTask = cron.schedule('0 3 * * *', () => {
    try {
      const removed = purgeExpiredIdempotencyKeys();
      if (removed > 0) {
        logInfo(`Idempotency cleanup: removed ${removed} expired key(s)`);
      }
    } catch (err: unknown) {
      logError(`Idempotency cleanup: ${err instanceof Error ? err.message : err}`);
    }
  }, { timezone: tz });
}

// Trek photo cache cleanup: every 2 hours — evict disk files and DB rows past their 1h TTL
let trekFamilyPhotoCacheTask: ScheduledTask | null = null;

function startTrekPhotoCacheCleanup(): void {
  if (trekFamilyPhotoCacheTask) { trekFamilyPhotoCacheTask.stop(); trekFamilyPhotoCacheTask = null; }

  // Run once immediately on startup to evict any entries left over from a previous run
  try {
    const { sweepExpired } = require('./services/memories/trekFamilyPhotoCache');
    sweepExpired();
  } catch { /* cache dir may not exist yet — harmless */ }

  trekFamilyPhotoCacheTask = cron.schedule('0 */2 * * *', () => {
    try {
      const { sweepExpired } = require('./services/memories/trekFamilyPhotoCache');
      sweepExpired();
    } catch (err: unknown) {
      logError(`Trek photo cache cleanup: ${err instanceof Error ? err.message : err}`);
    }
  });
}

// Place-photo (Google/Wikimedia) cache cleanup: nightly — reclaim cached files and
// meta rows no place references anymore (deleted places/trips, overwritten image_url).
let placePhotoCacheTask: ScheduledTask | null = null;

function startPlacePhotoCacheCleanup(): void {
  if (placePhotoCacheTask) { placePhotoCacheTask.stop(); placePhotoCacheTask = null; }

  const sweep = () => {
    try {
      const { sweepOrphans } = require('./services/placePhotoCache');
      const removed = sweepOrphans();
      if (removed > 0) logInfo(`Place-photo cache cleanup: removed ${removed} orphaned file(s)/row(s)`);
    } catch (err: unknown) {
      logError(`Place-photo cache cleanup: ${err instanceof Error ? err.message : err}`);
    }
  };

  // Run once on startup to reclaim orphans left over from before this sweeper existed.
  sweep();

  const tz = process.env.TZ || 'UTC';
  placePhotoCacheTask = cron.schedule('30 3 * * *', sweep, { timezone: tz });
}

// AirTrail sync: poll connected instances on an interval and reconcile linked
// flights both ways (#214). The per-tick enable gate (addon + setting) lives in
// runAirtrailSync, so toggling the addon takes effect without a restart.
let airtrailSyncTask: ScheduledTask | null = null;

function startAirTrailSync(): void {
  if (airtrailSyncTask) { airtrailSyncTask.stop(); airtrailSyncTask = null; }

  const { db } = require('./db/database');
  const getSetting = (key: string) => (db.prepare('SELECT value FROM app_settings WHERE key = ?').get(key) as { value: string } | undefined)?.value;
  const raw = parseInt(getSetting('airtrail_poll_interval_minutes') || '5', 10);
  const minutes = Number.isFinite(raw) && raw >= 1 && raw <= 59 ? raw : 5;
  const tz = process.env.TZ || 'UTC';
  logInfo(`AirTrail sync: scheduled every ${minutes}m`);

  airtrailSyncTask = cron.schedule(`*/${minutes} * * * *`, async () => {
    try {
      const { runAirtrailSync } = require('./services/airtrail/airtrailSync');
      await runAirtrailSync();
    } catch (err: unknown) {
      logError(`AirTrail sync tick failed: ${err instanceof Error ? err.message : err}`);
    }
  }, { timezone: tz });
}

function stop(): void {
  if (currentTask) { currentTask.stop(); currentTask = null; }
  if (demoTask) { demoTask.stop(); demoTask = null; }
  if (reminderTask) { reminderTask.stop(); reminderTask = null; }
  if (missingTransportTask) { missingTransportTask.stop(); missingTransportTask = null; }
  if (documentExpiryTask) { documentExpiryTask.stop(); documentExpiryTask = null; }
  if (ageBandReminderTask) { ageBandReminderTask.stop(); ageBandReminderTask = null; }
  if (versionCheckTask) { versionCheckTask.stop(); versionCheckTask = null; }
  if (idempotencyCleanupTask) { idempotencyCleanupTask.stop(); idempotencyCleanupTask = null; }
  if (trekFamilyPhotoCacheTask) { trekFamilyPhotoCacheTask.stop(); trekFamilyPhotoCacheTask = null; }
  if (placePhotoCacheTask) { placePhotoCacheTask.stop(); placePhotoCacheTask = null; }
  if (airtrailSyncTask) { airtrailSyncTask.stop(); airtrailSyncTask = null; }
}

export { start, stop, startDemoReset, startTripReminders, startMissingTransportReminders, startTodoReminders, startDocumentExpiryReminders, startAgeBandReminders, startVersionCheck, startIdempotencyCleanup, purgeExpiredIdempotencyKeys, startTrekPhotoCacheCleanup, startPlacePhotoCacheCleanup, startAirTrailSync, loadSettings, saveSettings, VALID_INTERVALS };
