export type ChannelMode = 'Analog' | 'DMR';

export type Channel = {
  number: number;
  name: string;
  mode: ChannelMode;
  rx: string;
  tx: string;
  power: string;
  bandwidth: string;
  decode: string;
  encode: string;
  squelch: string;
  contact: string;
  callType: string;
  tg: string;
  colorCode: string;
  slot: string;
  scan: string;
  rxGroup: string;
  txProhibit: boolean;
  autoScan: boolean;
  zones: string[];
  callsign: string;
  city: string;
  state: string;
  notes: string;
  network: string;
  status: string;
  kind: string;
};

export type Zone = {
  number: number;
  name: string;
  members: string[];
  aChannel: string;
  bChannel: string;
};

export type ScanList = {
  number: number;
  name: string;
  members: string[];
  revert: string;
  lookbackA: string;
  lookbackB: string;
  dropout: string;
  dwell: string;
};

export type Talkgroup = {
  number: number;
  name: string;
  id: string;
  callType: string;
};

export type CodeplugData = {
  identity: { callsign: string; dmrId: string };
  radio: string;
  cps: string;
  controls: { pf1Short: string; pf1Long: string };
  counts: {
    channels: number;
    analog: number;
    dmr: number;
    zones: number;
    scans: number;
    talkgroups: number;
  };
  channels: Channel[];
  zones: Zone[];
  scans: ScanList[];
  talkgroups: Talkgroup[];
};

type CsvRow = Record<string, string>;

function parseCsv(text: string): CsvRow[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    const next = text[index + 1];

    if (character === '"') {
      if (quoted && next === '"') {
        field += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
      continue;
    }

    if (character === ',' && !quoted) {
      row.push(field);
      field = '';
      continue;
    }

    if ((character === '\n' || character === '\r') && !quoted) {
      if (character === '\r' && next === '\n') index += 1;
      row.push(field);
      if (row.some((value) => value.length > 0)) rows.push(row);
      row = [];
      field = '';
      continue;
    }

    field += character;
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  if (!rows.length) return [];
  const headers = rows[0].map((header, index) =>
    index === 0 ? header.replace(/^\uFEFF/, '') : header,
  );

  return rows
    .slice(1)
    .map((values) =>
      Object.fromEntries(
        headers.map((header, index) => [header, values[index] ?? '']),
      ),
    );
}

function members(value: string): string[] {
  return value.split('|').filter(Boolean);
}

function asNumber(value: string, fallback: number): number {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function findFile(files: File[], expected: string): File | undefined {
  return files.find(
    (file) => file.name.toLowerCase() === expected.toLowerCase(),
  );
}

export async function codeplugFromCpsFiles(
  fileList: FileList,
): Promise<CodeplugData> {
  const files = Array.from(fileList);
  const requiredNames = [
    'Channel.CSV',
    'Zone.CSV',
    'ScanList.CSV',
    'TalkGroups.CSV',
  ];
  const missing = requiredNames.filter((name) => !findFile(files, name));

  if (missing.length) {
    throw new Error(`Select these CPS files together: ${missing.join(', ')}`);
  }

  const contents = new Map<string, string>();
  await Promise.all(
    files.map(async (file) => {
      contents.set(file.name.toLowerCase(), await file.text());
    }),
  );

  const rowsFor = (name: string) =>
    parseCsv(contents.get(name.toLowerCase()) ?? '');
  const channelRows = rowsFor('Channel.CSV');
  const zoneRows = rowsFor('Zone.CSV');
  const scanRows = rowsFor('ScanList.CSV');
  const talkgroupRows = rowsFor('TalkGroups.CSV');
  const radioIdRows = rowsFor('RadioIDList.CSV');

  const zones: Zone[] = zoneRows.map((row, index) => ({
    number: asNumber(row['No.'], index + 1),
    name: row['Zone Name'],
    members: members(row['Zone Channel Member']),
    aChannel: row['A Channel'],
    bChannel: row['B Channel'],
  }));

  const memberships = new Map<string, string[]>();
  zones.forEach((zone) => {
    zone.members.forEach((channelName) => {
      memberships.set(channelName, [
        ...(memberships.get(channelName) ?? []),
        zone.name,
      ]);
    });
  });

  const channels: Channel[] = channelRows.map((row, index) => ({
    number: asNumber(row['No.'], index + 1),
    name: row['Channel Name'],
    mode: row['Channel Type']?.includes('Digital') ? 'DMR' : 'Analog',
    rx: row['Receive Frequency'],
    tx: row['Transmit Frequency'],
    power: row['Transmit Power'],
    bandwidth: row['Band Width'],
    decode: row['CTCSS/DCS Decode'],
    encode: row['CTCSS/DCS Encode'],
    squelch: row['Squelch Mode'],
    contact: row.Contact,
    callType: row['Contact Call Type'],
    tg: row['Contact TG/DMR ID'],
    colorCode: row['RX Color Code'],
    slot: row.Slot,
    scan: row['Scan List'] === 'None' ? '' : row['Scan List'],
    rxGroup:
      row['Receive Group List'] === 'None' ? '' : row['Receive Group List'],
    txProhibit: row['PTT Prohibit'] === 'On',
    autoScan: row['Auto Scan'] === 'On',
    zones: memberships.get(row['Channel Name']) ?? [],
    callsign: '',
    city: '',
    state: '',
    notes: '',
    network: '',
    status: '',
    kind: '',
  }));

  const scans: ScanList[] = scanRows.map((row, index) => ({
    number: asNumber(row['No.'], index + 1),
    name: row['Scan List Name'],
    members: members(row['Scan Channel Member']),
    revert: row['Revert Channel'],
    lookbackA: row['Look Back Time A[s]'],
    lookbackB: row['Look Back Time B[s]'],
    dropout: row['Dropout Delay Time[s]'],
    dwell: row['Dwell Time[s]'],
  }));

  const talkgroups: Talkgroup[] = talkgroupRows.map((row, index) => ({
    number: asNumber(row['No.'], index + 1),
    name: row.Name,
    id: row['Radio ID'],
    callType: row['Call Type'],
  }));

  const analog = channels.filter((channel) => channel.mode === 'Analog').length;
  const identity = radioIdRows[0];

  return {
    identity: {
      callsign: identity?.Name || 'Imported codeplug',
      dmrId: identity?.['Radio ID'] || '—',
    },
    radio: 'AnyTone CPS export',
    cps:
      channelRows[0] && 'TxCC' in channelRows[0]
        ? 'v4-compatible schema'
        : 'CPS table export',
    controls: {
      pf1Short: 'Not included in table export',
      pf1Long: 'Not included in table export',
    },
    counts: {
      channels: channels.length,
      analog,
      dmr: channels.length - analog,
      zones: zones.length,
      scans: scans.length,
      talkgroups: talkgroups.length,
    },
    channels,
    zones,
    scans,
    talkgroups,
  };
}
