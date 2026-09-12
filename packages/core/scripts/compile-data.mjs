#!/usr/bin/env node
// Compiles packages/core/data/devices/*.json5 + packages/core/data/media.json5
// into runtime artifacts:
//
//   - data/devices.json — flat aggregated DeviceRegistry artifact for
//     non-TS consumers (validators, external doc generators).
//   - data/media.json   — flat aggregated media list, same role.
//   - src/devices.generated.ts — typed re-export of the device data.
//   - src/media.generated.ts   — typed re-export of the media data.
//
// All four outputs are gitignored; the script regenerates them on
// every prebuild / pretest / pretypecheck step.

import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import JSON5 from 'json5';
import { expandVerifications, mapLegacyStatus } from '@thermal-label/contracts';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = resolve(SCRIPT_DIR, '..');
const DEVICES_DIR = resolve(PACKAGE_ROOT, 'data/devices');
const MEDIA_FILE = resolve(PACKAGE_ROOT, 'data/media.json5');
const DEVICES_JSON = resolve(PACKAGE_ROOT, 'data/devices.json');
const MEDIA_JSON = resolve(PACKAGE_ROOT, 'data/media.json');
const DEVICES_TS = resolve(PACKAGE_ROOT, 'src/devices.generated.ts');
const MEDIA_TS = resolve(PACKAGE_ROOT, 'src/media.generated.ts');

const DRIVER = 'marklife';
const KEY_RE = /^[A-Z][A-Z0-9_]*$/;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
// SupportStatus contracts allow only verified|partial|broken|untested.
// Deferred-encoder protocols use 'broken' + a quirks note.
const LEGACY_SUPPORT_STATUS = new Set(['verified', 'partial', 'broken', 'untested']);
const VERIFICATION_RUNGS = new Set(['verified', 'partial', 'unsupported']);
const MAX_ISSUES_PER_CELL = 2;
const TRANSPORT_KEYS = new Set(['usb', 'tcp', 'serial', 'bluetooth-spp', 'bluetooth-gatt']);
const PROTOCOLS = new Set([
  'marklife-yxq',
  'marklife-jbig',
  'marklife-tspl',
  'marklife-escpos',
  'marklife-cpcl',
  'marklife-l11',
]);
// Encoders deferred (per DECISIONS.md). Entries on these protocols
// should ship with `support.status: 'broken'` + a `quirks` note.
//   - marklife-jbig: WASM build of libjbigkit pending (D4)
// marklife-l11 and marklife-cpcl are both implemented now; only the
// JBIG payload encoder remains deferred (DECISIONS.md § D4).
const DEFERRED_PROTOCOLS = new Set(['marklife-jbig']);
const COMPRESSIONS = new Set(['zlib', 'jbig', 'lzo-mode-3', 'none']);
const BIT_POLARITIES = new Set(['1=dark', '0=dark']);
const BLE_PROFILES = new Set(['A', 'B', 'C', null]);
const PHYSICAL_SIZES = new Set([0.5, 2.0, 3.0, 4.0]);
const MEDIA_TYPE = new Set(['die-cut', 'continuous']);
const KNOWN_TARGET_MODELS = new Set([
  'narrow-tape',
  'mobile-2in',
  'desktop-3in',
  'industrial-4in',
]);
const MEDIA_CATEGORY = new Set(['shipping', 'address', 'multi-purpose', 'continuous']);
const SPP_UUID = '00001101-0000-1000-8000-00805f9b34fb';

// BLE profile ↔ service UUID consistency check.
const BLE_PROFILE_SERVICE_UUID = {
  A: '0000ff00-0000-1000-8000-00805f9b34fb',
  B: '49535343-fe7d-4ae5-8fa9-9fafd205e455',
  C: '0000fd00-0000-1000-8000-00805f9b34fb',
};

const errors = [];
const warnings = [];
const todoFlags = [];
const fail = (where, msg) => errors.push(`${where}: ${msg}`);
const warn = (where, msg) => warnings.push(`${where}: ${msg}`);

function countTodoLines(rawText, file) {
  const lines = rawText.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (/\bTODO\b/.test(lines[i])) {
      todoFlags.push({ file, line: i + 1, text: lines[i].trim() });
    }
  }
}

function validateDeviceEntry(entry, file) {
  const where = `${file}`;

  if (typeof entry?.key !== 'string' || !KEY_RE.test(entry.key)) {
    fail(where, `key must match /^[A-Z][A-Z0-9_]*$/, got "${String(entry?.key)}"`);
  }
  if (typeof entry?.name !== 'string') fail(where, 'name must be a string');
  if (entry?.family !== DRIVER) fail(where, `family must be "${DRIVER}"`);

  if (!entry?.transports || typeof entry.transports !== 'object') {
    fail(where, 'transports must be an object');
  } else {
    for (const k of Object.keys(entry.transports)) {
      if (!TRANSPORT_KEYS.has(k)) fail(where, `transports.${k} is not a known transport key`);
    }
    const spp = entry.transports['bluetooth-spp'];
    if (spp !== undefined) {
      if (typeof spp.namePrefix !== 'string') {
        warn(where, 'transports.bluetooth-spp.namePrefix should be a string');
      }
    }
    const gatt = entry.transports['bluetooth-gatt'];
    if (gatt !== undefined) {
      if (typeof gatt.serviceUuid !== 'string') {
        fail(where, 'transports.bluetooth-gatt.serviceUuid must be a string');
      }
      if (typeof gatt.txCharacteristicUuid !== 'string') {
        fail(where, 'transports.bluetooth-gatt.txCharacteristicUuid must be a string');
      }
    }
  }

  if (!Array.isArray(entry?.engines) || entry.engines.length === 0) {
    fail(where, 'engines must be a non-empty array');
  } else {
    const seenRoles = new Set();
    for (const [i, eng] of entry.engines.entries()) {
      const ewhere = `${where} engines[${i}]`;
      if (typeof eng?.role !== 'string') fail(ewhere, 'role must be a string');
      else if (seenRoles.has(eng.role)) fail(ewhere, `duplicate role "${eng.role}"`);
      else seenRoles.add(eng.role);
      if (!PROTOCOLS.has(eng?.protocol)) {
        fail(
          ewhere,
          `protocol must be one of ${[...PROTOCOLS].join('|')}, got "${String(eng?.protocol)}"`,
        );
      }
      if (typeof eng?.dpi !== 'number') fail(ewhere, 'dpi must be a number');
      if (typeof eng?.headDots !== 'number') {
        fail(ewhere, 'headDots must be a number (best-guess from physicalSizeClass acceptable)');
      }
      const caps = eng?.capabilities;
      if (caps !== undefined) {
        if (caps.compression !== undefined && !COMPRESSIONS.has(caps.compression)) {
          fail(ewhere, `capabilities.compression must be one of ${[...COMPRESSIONS].join('|')}`);
        }
        if (caps.bitPolarity !== undefined && !BIT_POLARITIES.has(caps.bitPolarity)) {
          fail(ewhere, `capabilities.bitPolarity must be one of ${[...BIT_POLARITIES].join('|')}`);
        }
        if (caps.protocolId !== undefined) {
          if (!Number.isInteger(caps.protocolId) || caps.protocolId < 0 || caps.protocolId > 12) {
            fail(ewhere, 'capabilities.protocolId must be an integer 0..12');
          }
        }
        if (caps.physicalSizeClass !== undefined && !PHYSICAL_SIZES.has(caps.physicalSizeClass)) {
          fail(
            ewhere,
            `capabilities.physicalSizeClass must be one of ${[...PHYSICAL_SIZES].join('|')}`,
          );
        }
        if (caps.bleProfile !== undefined && !BLE_PROFILES.has(caps.bleProfile)) {
          fail(ewhere, `capabilities.bleProfile must be one of A|B|C|null`);
        }
        // BLE profile ↔ service UUID consistency check
        if (
          caps.bleProfile &&
          BLE_PROFILE_SERVICE_UUID[caps.bleProfile] &&
          entry.transports?.['bluetooth-gatt']?.serviceUuid &&
          entry.transports['bluetooth-gatt'].serviceUuid.toLowerCase() !==
            BLE_PROFILE_SERVICE_UUID[caps.bleProfile]
        ) {
          fail(
            ewhere,
            `bleProfile "${caps.bleProfile}" should map to service UUID ` +
              `"${BLE_PROFILE_SERVICE_UUID[caps.bleProfile]}", got ` +
              `"${entry.transports['bluetooth-gatt'].serviceUuid}"`,
          );
        }
      }
      if (DEFERRED_PROTOCOLS.has(eng?.protocol) && entry.support?.status !== 'broken') {
        warn(ewhere, `protocol "${eng.protocol}" is deferred — support.status should be 'broken' (with a quirks note)`);
      }
    }
  }

  if (!entry?.support || typeof entry.support !== 'object') {
    fail(where, 'support must be an object');
  } else if (!LEGACY_SUPPORT_STATUS.has(entry.support.status)) {
    fail(where, `support.status must be one of ${[...LEGACY_SUPPORT_STATUS].join('|')}`);
  }

  // Optional `verifications` block — new shape, runs alongside legacy
  // `support` during the alias transition (see plan #0).
  if (entry?.verifications !== undefined) {
    if (typeof entry.verifications !== 'object' || Array.isArray(entry.verifications)) {
      fail(where, 'verifications must be a keyed object');
    } else {
      const declared = new Set(Object.keys(entry.transports ?? {}));
      for (const [k, cell] of Object.entries(entry.verifications)) {
        const cwhere = `${where} verifications.${k}`;
        if (!TRANSPORT_KEYS.has(k)) {
          fail(cwhere, 'unknown transport key');
          continue;
        }
        if (!declared.has(k)) {
          fail(cwhere, 'transport not declared on this device');
        }
        if (!cell || typeof cell !== 'object') {
          fail(cwhere, 'cell must be an object');
          continue;
        }
        if (!VERIFICATION_RUNGS.has(cell.status)) {
          fail(cwhere, `status must be one of ${[...VERIFICATION_RUNGS].join('|')}`);
        }
        if (cell.issues !== undefined) {
          if (!Array.isArray(cell.issues)) {
            fail(cwhere, 'issues must be an array');
          } else {
            if (cell.issues.length > MAX_ISSUES_PER_CELL) {
              fail(cwhere, `issues may have at most ${MAX_ISSUES_PER_CELL} entries`);
            }
            for (const n of cell.issues) {
              if (!Number.isInteger(n) || n <= 0) {
                fail(cwhere, 'issues entries must be positive integers');
              }
            }
          }
        }
        if (cell.reason !== undefined && typeof cell.reason !== 'string') {
          fail(cwhere, 'reason must be a string');
        }
        if (cell.lastReported !== undefined && !ISO_DATE_RE.test(cell.lastReported ?? '')) {
          fail(cwhere, 'lastReported must be ISO date YYYY-MM-DD');
        }
      }
    }
  }
}

// Synthesise a `verifications` block from the legacy `support` field
// when no explicit `verifications` is authored. Prefers per-transport
// `support.transports.<t>` when authored; otherwise falls back to the
// device-level `support.status`. Returns an empty object when the
// effective status is `'untested'` (no claim).
//
// `mapLegacyStatus` is imported from `@thermal-label/contracts`.
function legacyToVerifications(entry) {
  const declared = Object.keys(entry?.transports ?? {});
  const supportTransports = entry?.support?.transports;
  const out = {};
  if (supportTransports && typeof supportTransports === 'object') {
    for (const t of declared) {
      const mapped = mapLegacyStatus(supportTransports[t]);
      if (mapped) out[t] = { status: mapped };
    }
    // If author specified per-transport entries, trust the granularity
    // — do not fall back to device-level status for unmentioned transports.
    if (Object.keys(supportTransports).length > 0) return out;
  }
  const deviceStatus = mapLegacyStatus(entry?.support?.status);
  if (!deviceStatus) return {};
  for (const t of declared) {
    if (out[t] === undefined) out[t] = { status: deviceStatus };
  }
  return out;
}

function validateMediaEntry(entry, idx) {
  const where = `media[${idx}]${entry?.key ? ` (${entry.key})` : ''}`;

  if (typeof entry?.key !== 'string' || !KEY_RE.test(entry.key)) {
    fail(where, 'key must match /^[A-Z][A-Z0-9_]*$/');
  }
  if (typeof entry?.id !== 'string') fail(where, 'id must be a string');
  if (typeof entry?.name !== 'string') fail(where, 'name must be a string');
  if (!MEDIA_CATEGORY.has(entry?.category)) {
    fail(where, `category must be one of ${[...MEDIA_CATEGORY].join('|')}`);
  }
  if (typeof entry?.widthMm !== 'number') fail(where, 'widthMm must be a number');
  if (!MEDIA_TYPE.has(entry?.type)) fail(where, `type must be one of ${[...MEDIA_TYPE].join('|')}`);

  if (entry?.type === 'die-cut') {
    if (typeof entry.heightMm !== 'number') fail(where, 'die-cut media must declare heightMm');
  } else if (entry?.type === 'continuous') {
    if (entry.heightMm !== undefined) fail(where, 'continuous media must omit heightMm');
  }

  if (!Array.isArray(entry?.targetModels) || entry.targetModels.length === 0) {
    fail(where, 'targetModels must be a non-empty array');
  } else {
    for (const t of entry.targetModels) {
      if (!KNOWN_TARGET_MODELS.has(t)) {
        fail(where, `targetModels entry "${t}" is not a known substrate tag`);
      }
    }
  }

  if (entry?.skus !== undefined && !Array.isArray(entry.skus)) {
    fail(where, 'skus must be an array if present');
  }
}

// ─── devices ──────────────────────────────────────────────────────────

const deviceFiles = readdirSync(DEVICES_DIR)
  .filter(f => f.endsWith('.json5'))
  .sort();
const devices = [];
const seenDeviceKeys = new Set();

for (const file of deviceFiles) {
  let entry;
  let raw;
  try {
    raw = readFileSync(resolve(DEVICES_DIR, file), 'utf8');
    entry = JSON5.parse(raw);
  } catch (err) {
    fail(file, `parse error: ${err.message}`);
    continue;
  }
  countTodoLines(raw, file);
  validateDeviceEntry(entry, file);
  if (entry?.key && seenDeviceKeys.has(entry.key)) fail(file, `duplicate key "${entry.key}"`);
  if (entry?.key && file !== `${entry.key}.json5`) {
    fail(file, `filename must match key (expected ${entry.key}.json5)`);
  }
  if (entry?.key) seenDeviceKeys.add(entry.key);
  devices.push(entry);
}

// ─── media ────────────────────────────────────────────────────────────

let mediaList = [];
try {
  const raw = readFileSync(MEDIA_FILE, 'utf8');
  mediaList = JSON5.parse(raw);
  countTodoLines(raw, 'media.json5');
  if (!Array.isArray(mediaList)) {
    fail('media.json5', 'top-level value must be an array');
    mediaList = [];
  }
} catch (err) {
  fail('media.json5', `parse error: ${err.message}`);
}

const seenMediaKeys = new Set();
const seenMediaIds = new Set();
mediaList.forEach((entry, i) => {
  validateMediaEntry(entry, i);
  if (entry?.key) {
    if (seenMediaKeys.has(entry.key)) fail(`media[${i}]`, `duplicate key "${entry.key}"`);
    seenMediaKeys.add(entry.key);
  }
  if (entry?.id) {
    if (seenMediaIds.has(entry.id)) fail(`media[${i}]`, `duplicate id "${entry.id}"`);
    seenMediaIds.add(entry.id);
  }
});

// ─── emit ─────────────────────────────────────────────────────────────

if (errors.length > 0) {
  console.error(`[compile-data] ${errors.length} error(s):`);
  for (const e of errors) console.error('  - ' + e);
  process.exit(1);
}

if (warnings.length > 0) {
  console.warn(`[compile-data] ${warnings.length} warning(s):`);
  for (const w of warnings) console.warn('  - ' + w);
}

// Build a registry shadow where each device has a populated
// `verifications` field — explicit when authored, synthesised from
// legacy `support` otherwise — so the contracts `expandVerifications`
// sees one consistent shape.
const synthesizedDevices = devices.map(d => {
  const v =
    d.verifications && Object.keys(d.verifications).length > 0
      ? d.verifications
      : legacyToVerifications(d);
  return { ...d, verifications: v };
});

const expanded = expandVerifications({
  schemaVersion: 1,
  driver: DRIVER,
  devices: synthesizedDevices,
});

// Lean device entries for the bundled TS: drop authoring-only blocks
// (`verifications`) and stamp the rolled-up `supportStatus`.
const leanDevices = devices.map((d, i) => {
  const { verifications: _v, ...rest } = d;
  return { ...rest, supportStatus: expanded.devices[i].supportStatus };
});

// Rich device entries for the JSON projection: keep `verifications`
// + stamp the expanded `verificationGrid` and rolled-up `supportStatus`.
const richDevices = devices.map((d, i) => ({
  ...d,
  verificationGrid: expanded.devices[i].verificationGrid,
  supportStatus: expanded.devices[i].supportStatus,
}));

const richRegistry = { schemaVersion: 1, driver: DRIVER, devices: richDevices };
writeFileSync(DEVICES_JSON, JSON.stringify(richRegistry, null, 2) + '\n');

writeFileSync(
  MEDIA_JSON,
  JSON.stringify({ schemaVersion: 1, driver: DRIVER, media: mediaList }, null, 2) + '\n',
);

const leanRegistry = { schemaVersion: 1, driver: DRIVER, devices: leanDevices };
const deviceEntries = leanDevices.map((d, i) => `  ${d.key}: REGISTRY.devices[${i}],`).join('\n');
const deviceKeyUnion = leanDevices.length > 0 ? leanDevices.map(d => `'${d.key}'`).join(' | ') : 'never';
const devicesBody = `// AUTO-GENERATED by scripts/compile-data.mjs from data/devices/*.json5.
// Edit those files, not this one. Run \`pnpm run compile-data\`.

import type { DeviceEntry, DeviceRegistry } from '@thermal-label/contracts';

/**
 * Render-time effective status — superset of the contracts' stored
 * verification rungs that includes \`'expected'\` (propagated lift)
 * and \`'unverified'\` (no claim). Mirrors \`EffectiveStatus\` in
 * @thermal-label/contracts ≥ 0.6; literal here so codegen does not
 * require the matching contracts version on consumers' machines.
 */
export type EffectiveStatus = 'verified' | 'partial' | 'unsupported' | 'expected' | 'unverified';

/** Each entry carries a rolled-up \`supportStatus\` from the verification grid. */
export type RegistryDeviceEntry = DeviceEntry & { supportStatus: EffectiveStatus };

/** Registry shape with \`supportStatus\` stamped on each device. */
export type RegistryWithStatus = Omit<DeviceRegistry, 'devices'> & {
  devices: readonly RegistryDeviceEntry[];
};

export const REGISTRY = ${JSON.stringify(leanRegistry, null, 2)} as const satisfies RegistryWithStatus;

export type DeviceKey = ${deviceKeyUnion};

export const DEVICES: Record<DeviceKey, RegistryDeviceEntry> = {
${deviceEntries}
};
`;
writeFileSync(DEVICES_TS, devicesBody);

function emitMediaEntry(entry) {
  const { key: _key, ...rest } = entry;
  const inner = JSON.stringify(rest, null, 2).replace(/\n/g, '\n  ');
  return `  ${entry.key}: ${inner},`;
}
const mediaEntriesObj = mediaList.map(emitMediaEntry).join('\n');
const mediaKeyUnion = mediaList.length > 0 ? mediaList.map(m => `'${m.key}'`).join(' | ') : 'never';
const mediaBody = `// AUTO-GENERATED by scripts/compile-data.mjs from data/media.json5.
// Edit that file, not this one. Run \`pnpm run compile-data\`.

import type { MarklifeAnyMedia } from './types.js';

export type MediaKey = ${mediaKeyUnion};

export const MEDIA = {
${mediaEntriesObj}
} as const satisfies Record<MediaKey, MarklifeAnyMedia>;
`;
writeFileSync(MEDIA_TS, mediaBody);

console.log(
  `[compile-data] OK — ${devices.length} devices + ${mediaList.length} media → ` +
    `${DEVICES_JSON}, ${MEDIA_JSON}, ${DEVICES_TS}, ${MEDIA_TS}`,
);

if (todoFlags.length > 0) {
  console.log(`[compile-data] ${todoFlags.length} TODO marker(s) — data still incomplete:`);
  const byFile = new Map();
  for (const t of todoFlags) {
    if (!byFile.has(t.file)) byFile.set(t.file, []);
    byFile.get(t.file).push(t);
  }
  for (const [file, ts] of byFile) {
    console.log(`  ${file} (${ts.length}):`);
    for (const t of ts) console.log(`    L${t.line}: ${t.text}`);
  }
}
