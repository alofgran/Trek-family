import { describe, it, expect, vi, beforeEach } from 'vitest';

// Prevent node-cron from scheduling anything at import time
vi.mock('node-cron', () => ({
  default: { schedule: vi.fn(), validate: vi.fn(() => true) },
  schedule: vi.fn(),
  validate: vi.fn(() => true),
}));
// Prevent archiver from causing side effects
vi.mock('archiver', () => ({ default: vi.fn() }));
// Prevent fs side effects (creating directories, reading files)
vi.mock('node:fs', () => ({
  default: {
    existsSync: vi.fn(() => false),
    mkdirSync: vi.fn(),
    readFileSync: vi.fn(() => '{}'),
    writeFileSync: vi.fn(),
    readdirSync: vi.fn(() => []),
    statSync: vi.fn(() => ({ mtime: new Date(), size: 0 })),
    unlinkSync: vi.fn(),
    createWriteStream: vi.fn(() => ({ on: vi.fn(), pipe: vi.fn() })),
  },
  existsSync: vi.fn(() => false),
  mkdirSync: vi.fn(),
  readFileSync: vi.fn(() => '{}'),
  writeFileSync: vi.fn(),
  readdirSync: vi.fn(() => []),
  statSync: vi.fn(() => ({ mtime: new Date(), size: 0 })),
  unlinkSync: vi.fn(),
  createWriteStream: vi.fn(() => ({ on: vi.fn(), pipe: vi.fn() })),
}));
vi.mock('../../../src/db/database', () => ({
  db: { prepare: () => ({ all: vi.fn(() => []), get: vi.fn(), run: vi.fn() }) },
}));
vi.mock('../../../src/config', () => ({ JWT_SECRET: 'test-secret', ENCRYPTION_KEY: '0'.repeat(64) }));
vi.mock('../../src/services/auditLog', () => ({
  logInfo: vi.fn(),
  logError: vi.fn(),
}));

import fs from 'node:fs';
import { buildCronExpression, cleanupOldBackups } from '../../src/scheduler';
import { isPassportInsufficientForTrip } from '../../src/services/documentValidityService';
import { requiredPassportValidityDays } from '@trek-family/shared';

interface BackupSettings {
  enabled: boolean;
  interval: string;
  keep_days: number;
  hour: number;
  day_of_week: number;
  day_of_month: number;
}

function settings(overrides: Partial<BackupSettings> = {}): BackupSettings {
  return {
    enabled: true,
    interval: 'daily',
    keep_days: 7,
    hour: 2,
    day_of_week: 0,
    day_of_month: 1,
    ...overrides,
  };
}

describe('buildCronExpression', () => {
  describe('hourly', () => {
    it('returns 0 * * * * regardless of hour/dow/dom', () => {
      expect(buildCronExpression(settings({ interval: 'hourly', hour: 5, day_of_week: 3, day_of_month: 15 }))).toBe('0 * * * *');
    });
  });

  describe('daily', () => {
    it('returns 0 <hour> * * *', () => {
      expect(buildCronExpression(settings({ interval: 'daily', hour: 3 }))).toBe('0 3 * * *');
    });

    it('handles midnight (hour 0)', () => {
      expect(buildCronExpression(settings({ interval: 'daily', hour: 0 }))).toBe('0 0 * * *');
    });

    it('handles last valid hour (23)', () => {
      expect(buildCronExpression(settings({ interval: 'daily', hour: 23 }))).toBe('0 23 * * *');
    });

    it('falls back to hour 2 for invalid hour (24)', () => {
      expect(buildCronExpression(settings({ interval: 'daily', hour: 24 }))).toBe('0 2 * * *');
    });

    it('falls back to hour 2 for negative hour', () => {
      expect(buildCronExpression(settings({ interval: 'daily', hour: -1 }))).toBe('0 2 * * *');
    });
  });

  describe('weekly', () => {
    it('returns 0 <hour> * * <dow>', () => {
      expect(buildCronExpression(settings({ interval: 'weekly', hour: 5, day_of_week: 3 }))).toBe('0 5 * * 3');
    });

    it('handles Sunday (dow 0)', () => {
      expect(buildCronExpression(settings({ interval: 'weekly', hour: 2, day_of_week: 0 }))).toBe('0 2 * * 0');
    });

    it('handles Saturday (dow 6)', () => {
      expect(buildCronExpression(settings({ interval: 'weekly', hour: 2, day_of_week: 6 }))).toBe('0 2 * * 6');
    });

    it('falls back to dow 0 for invalid day_of_week (7)', () => {
      expect(buildCronExpression(settings({ interval: 'weekly', hour: 2, day_of_week: 7 }))).toBe('0 2 * * 0');
    });
  });

  describe('monthly', () => {
    it('returns 0 <hour> <dom> * *', () => {
      expect(buildCronExpression(settings({ interval: 'monthly', hour: 2, day_of_month: 15 }))).toBe('0 2 15 * *');
    });

    it('handles day_of_month 1', () => {
      expect(buildCronExpression(settings({ interval: 'monthly', hour: 2, day_of_month: 1 }))).toBe('0 2 1 * *');
    });

    it('handles max valid day_of_month (28)', () => {
      expect(buildCronExpression(settings({ interval: 'monthly', hour: 2, day_of_month: 28 }))).toBe('0 2 28 * *');
    });

    it('falls back to dom 1 for day_of_month 29', () => {
      expect(buildCronExpression(settings({ interval: 'monthly', hour: 2, day_of_month: 29 }))).toBe('0 2 1 * *');
    });

    it('falls back to dom 1 for day_of_month 0', () => {
      expect(buildCronExpression(settings({ interval: 'monthly', hour: 2, day_of_month: 0 }))).toBe('0 2 1 * *');
    });
  });

  describe('unknown interval', () => {
    it('defaults to daily pattern', () => {
      expect(buildCronExpression(settings({ interval: 'unknown', hour: 4 }))).toBe('0 4 * * *');
    });
  });
});

describe('cleanupOldBackups', () => {
  const DAY = 24 * 60 * 60 * 1000;
  const NOW = new Date('2026-04-27T02:00:00Z').getTime();

  function isoFilename(daysAgo: number, prefix: 'auto-backup' | 'backup' = 'auto-backup'): string {
    const d = new Date(NOW - daysAgo * DAY);
    const stamp = d.toISOString().replace(/[:.]/g, '-').slice(0, 19);
    return `${prefix}-${stamp}.zip`;
  }

  beforeEach(() => {
    vi.mocked(fs.readdirSync).mockReset();
    vi.mocked(fs.statSync).mockReset();
    vi.mocked(fs.unlinkSync as ReturnType<typeof vi.fn>).mockReset();
    (vi.mocked(fs.statSync) as ReturnType<typeof vi.fn>).mockReturnValue({ mtime: new Date(), mtimeMs: NOW, birthtimeMs: NOW, size: 0 });
  });

  it('never deletes manual backup-*.zip files regardless of age', () => {
    const manual = isoFilename(365 * 5, 'backup');
    const auto = isoFilename(0);
    vi.mocked(fs.readdirSync).mockReturnValue([manual, auto] as unknown as string[]);
    cleanupOldBackups(7, NOW);
    const deleted = (vi.mocked(fs.unlinkSync as ReturnType<typeof vi.fn>)).mock.calls.map((c: unknown[]) => c[0] as string);
    expect(deleted.some((p: string) => p.includes(manual))).toBe(false);
  });

  it('keeps auto-backups newer than retention', () => {
    const recent = isoFilename(3);
    vi.mocked(fs.readdirSync).mockReturnValue([recent] as unknown as string[]);
    cleanupOldBackups(7, NOW);
    expect(vi.mocked(fs.unlinkSync as ReturnType<typeof vi.fn>)).not.toHaveBeenCalled();
  });

  it('deletes auto-backups older than retention', () => {
    const old = isoFilename(30);
    vi.mocked(fs.readdirSync).mockReturnValue([old] as unknown as string[]);
    cleanupOldBackups(7, NOW);
    expect(vi.mocked(fs.unlinkSync as ReturnType<typeof vi.fn>)).toHaveBeenCalledOnce();
    const [calledPath] = (vi.mocked(fs.unlinkSync as ReturnType<typeof vi.fn>)).mock.calls[0] as string[];
    expect(calledPath).toContain(old);
  });

  it('overlayfs regression: birthtimeMs=0 does not delete a same-day backup', () => {
    const fresh = isoFilename(0);
    vi.mocked(fs.readdirSync).mockReturnValue([fresh] as unknown as string[]);
    (vi.mocked(fs.statSync) as ReturnType<typeof vi.fn>).mockReturnValue({ birthtimeMs: 0, mtimeMs: NOW, mtime: new Date(NOW), size: 100 });
    cleanupOldBackups(7, NOW);
    expect(vi.mocked(fs.unlinkSync as ReturnType<typeof vi.fn>)).not.toHaveBeenCalled();
  });

  it('malformed filename falls back to mtimeMs: keeps recent file', () => {
    vi.mocked(fs.readdirSync).mockReturnValue(['auto-backup-garbage.zip'] as unknown as string[]);
    (vi.mocked(fs.statSync) as ReturnType<typeof vi.fn>).mockReturnValue({ birthtimeMs: 0, mtimeMs: NOW - 1 * DAY, mtime: new Date(NOW - 1 * DAY), size: 0 });
    cleanupOldBackups(7, NOW);
    expect(vi.mocked(fs.unlinkSync as ReturnType<typeof vi.fn>)).not.toHaveBeenCalled();
  });

  it('malformed filename falls back to mtimeMs: deletes stale file', () => {
    vi.mocked(fs.readdirSync).mockReturnValue(['auto-backup-garbage.zip'] as unknown as string[]);
    (vi.mocked(fs.statSync) as ReturnType<typeof vi.fn>).mockReturnValue({ birthtimeMs: 0, mtimeMs: NOW - 30 * DAY, mtime: new Date(NOW - 30 * DAY), size: 0 });
    cleanupOldBackups(7, NOW);
    expect(vi.mocked(fs.unlinkSync as ReturnType<typeof vi.fn>)).toHaveBeenCalledOnce();
  });

  it('ignores non-zip files and does not crash', () => {
    const old = isoFilename(30);
    vi.mocked(fs.readdirSync).mockReturnValue([old, 'notes.txt'] as unknown as string[]);
    cleanupOldBackups(7, NOW);
    const calls = (vi.mocked(fs.unlinkSync as ReturnType<typeof vi.fn>)).mock.calls as string[][];
    expect(calls.every(([p]: string[]) => !p.includes('notes.txt'))).toBe(true);
    expect(calls.length).toBe(1);
  });

  it('swallows readdirSync errors without throwing', () => {
    vi.mocked(fs.readdirSync).mockImplementation(() => { throw new Error('ENOENT'); });
    expect(() => cleanupOldBackups(7, NOW)).not.toThrow();
  });
});

describe('isPassportInsufficientForTrip', () => {
  const LEAD_DAYS = 90;
  const DAY = 24 * 60 * 60 * 1000;

  it('flags a passport expiring before a Schengen trip\'s 3-month-post-departure cutoff', () => {
    // Trip ends 2026-06-01, France requires 90 days beyond that -> cutoff 2026-08-30
    const insufficient = isPassportInsufficientForTrip('2026-08-01', '2026-06-01', ['FR'], requiredPassportValidityDays, LEAD_DAYS);
    expect(insufficient).toBe(true);
  });

  it('does not flag a passport that clears the Schengen 3-month cutoff', () => {
    const sufficient = isPassportInsufficientForTrip('2026-12-01', '2026-06-01', ['FR'], requiredPassportValidityDays, LEAD_DAYS);
    expect(sufficient).toBe(false);
  });

  it('flags a passport for the 6-month default even though it is not "expiring soon" in absolute terms', () => {
    // Trip is 4 months away, destination unresolved -> 180-day default cutoff.
    // A passport expiring in 5 months clears LEAD_DAYS (90d) easily but not the country rule.
    const now = new Date('2026-01-01').getTime();
    const tripEnd = new Date(now + 120 * DAY).toISOString().slice(0, 10); // trip ends in 4 months
    const expiry = new Date(now + 150 * DAY).toISOString().slice(0, 10); // passport expires in 5 months
    const insufficient = isPassportInsufficientForTrip(expiry, tripEnd, [], requiredPassportValidityDays, LEAD_DAYS, now);
    expect(insufficient).toBe(true);
  });

  it('duration-of-stay-only destination (e.g. US): sufficient if valid through the trip, even with no extra buffer', () => {
    const sufficient = isPassportInsufficientForTrip('2026-06-02', '2026-06-01', ['US'], requiredPassportValidityDays, LEAD_DAYS);
    expect(sufficient).toBe(false);
  });

  it('duration-of-stay-only destination: insufficient if it expires before the trip even ends', () => {
    const insufficient = isPassportInsufficientForTrip('2026-05-31', '2026-06-01', ['US'], requiredPassportValidityDays, LEAD_DAYS);
    expect(insufficient).toBe(true);
  });

  it('multi-country trip uses the strictest (max) requirement across resolved countries', () => {
    // US (0 days) + FR (90 days) -> the 90-day requirement wins
    const tripEnd = '2026-06-01';
    const expiryJustOverUS = '2026-06-05'; // clears US, would fail FR's 90-day requirement
    const insufficient = isPassportInsufficientForTrip(expiryJustOverUS, tripEnd, ['US', 'FR'], requiredPassportValidityDays, LEAD_DAYS);
    expect(insufficient).toBe(true);
  });

  it('falls back to the flat lead-time window when the trip has no end_date', () => {
    const now = new Date('2026-01-01').getTime();
    const withinWindow = new Date(now + 30 * DAY).toISOString().slice(0, 10);
    const outsideWindow = new Date(now + 200 * DAY).toISOString().slice(0, 10);
    expect(isPassportInsufficientForTrip(withinWindow, null, ['FR'], requiredPassportValidityDays, LEAD_DAYS, now)).toBe(true);
    expect(isPassportInsufficientForTrip(outsideWindow, null, ['FR'], requiredPassportValidityDays, LEAD_DAYS, now)).toBe(false);
  });
});
