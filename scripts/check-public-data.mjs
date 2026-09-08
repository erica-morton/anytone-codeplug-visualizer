import fs from 'node:fs';

const samplePath = new URL('../data/sample-codeplug.json', import.meta.url);
const sample = JSON.parse(fs.readFileSync(samplePath, 'utf8'));

if (
  sample.identity?.callsign !== 'DEMO' ||
  sample.identity?.dmrId !== '0000000'
) {
  throw new Error(
    'Refusing to build: the bundled sample must use DEMO / 0000000.',
  );
}

if (
  !Array.isArray(sample.channels) ||
  sample.channels.length === 0 ||
  sample.channels.length > 20 ||
  sample.channels.some(
    (channel) =>
      channel.kind !== 'synthetic' ||
      channel.status !== 'demo' ||
      !String(channel.notes).startsWith('Synthetic fixture'),
  )
) {
  throw new Error(
    'Refusing to build: every bundled channel must be marked synthetic.',
  );
}

const channelNames = new Set(sample.channels.map((channel) => channel.name));
const unresolved = [...sample.zones, ...sample.scans].flatMap((group) =>
  group.members
    .filter((member) => !channelNames.has(member))
    .map((member) => `${group.name}: ${member}`),
);
const zoneNames = new Set(sample.zones.map((zone) => zone.name));
const unresolvedGps = (sample.gpsRoaming ?? [])
  .filter((entry) => !zoneNames.has(entry.zoneName))
  .map((entry) => `GPS roaming #${entry.number}: ${entry.zoneName}`);

if (unresolved.length > 0 || unresolvedGps.length > 0) {
  throw new Error(
    `Refusing to build: unresolved synthetic fixture references: ${[
      ...unresolved,
      ...unresolvedGps,
    ].join(', ')}`,
  );
}

const expectedCounts = {
  channels: sample.channels.length,
  analog: sample.channels.filter((channel) => channel.mode === 'Analog').length,
  dmr: sample.channels.filter((channel) => channel.mode === 'DMR').length,
  zones: sample.zones.length,
  scans: sample.scans.length,
  talkgroups: sample.talkgroups.length,
  gpsRoaming: sample.gpsRoaming.length,
};

if (
  Object.entries(expectedCounts).some(
    ([key, value]) => sample.counts?.[key] !== value,
  )
) {
  throw new Error(
    'Refusing to build: synthetic fixture counts are inconsistent.',
  );
}

// ---------------------------------------------------------------------------
// Nothing but the sanctioned fixture may be a codeplug.
//
// The checks above prove data/sample-codeplug.json is synthetic, but they only
// ever looked at that one path. A real export dropped anywhere else --
// data/my-plug.json, a stray file at the root -- would have built and deployed
// untouched. A codeplug carries a callsign, a DMR ID and, through GPS roaming,
// home coordinates, so the sweep below refuses the build if anything outside
// the sanctioned path is shaped like one.
// ---------------------------------------------------------------------------

const SANCTIONED = 'data/sample-codeplug.json';
const SKIP_DIRS = new Set([
  '.git',
  'node_modules',
  'dist',
  'out',
  'coverage',
  'local-data',
  'private',
  '.github',
]);

const repoRoot = new URL('../', import.meta.url);

/** A codeplug is identified by its radio identity plus a channel list. */
function looksLikeCodeplug(text) {
  // Cheap text gate first so package-lock.json and friends are never parsed.
  if (!text.includes('"identity"') || !text.includes('"channels"'))
    return false;
  try {
    const value = JSON.parse(text);
    return (
      Boolean(value?.identity) &&
      (value.identity.dmrId !== undefined ||
        value.identity.callsign !== undefined) &&
      Array.isArray(value.channels)
    );
  } catch {
    return false;
  }
}

function walk(dir, relative = '') {
  const found = [];
  for (const entry of fs.readdirSync(new URL(dir), { withFileTypes: true })) {
    if (entry.name.startsWith('.') && entry.name !== '.github') {
      if (SKIP_DIRS.has(entry.name)) continue;
    }
    if (SKIP_DIRS.has(entry.name)) continue;
    const childRelative = relative ? `${relative}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      found.push(...walk(new URL(`${entry.name}/`, dir), childRelative));
    } else if (entry.name.endsWith('.json')) {
      found.push(childRelative);
    }
  }
  return found;
}

const strays = walk(repoRoot).filter(
  (file) =>
    file !== SANCTIONED &&
    looksLikeCodeplug(fs.readFileSync(new URL(file, repoRoot), 'utf8')),
);

if (strays.length > 0) {
  throw new Error(
    `Refusing to build: codeplug data outside ${SANCTIONED}: ${strays.join(', ')}. ` +
      'Move personal exports under local-data/, which is ignored.',
  );
}

console.log(
  `Public-data check passed: ${sample.channels.length} synthetic channels, no stray codeplugs.`,
);
