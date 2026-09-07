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

if (unresolved.length > 0) {
  throw new Error(
    `Refusing to build: unresolved synthetic fixture references: ${unresolved.join(', ')}`,
  );
}

const expectedCounts = {
  channels: sample.channels.length,
  analog: sample.channels.filter((channel) => channel.mode === 'Analog').length,
  dmr: sample.channels.filter((channel) => channel.mode === 'DMR').length,
  zones: sample.zones.length,
  scans: sample.scans.length,
  talkgroups: sample.talkgroups.length,
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

console.log(
  `Public-data check passed: ${sample.channels.length} synthetic channels.`,
);
