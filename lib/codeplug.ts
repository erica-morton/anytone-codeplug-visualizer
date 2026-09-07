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

export type GpsRoamingEntry = {
  number: number;
  zoneIndex: number;
  zoneNumber: number;
  zoneName: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
};

export type CodeplugData = {
  tables?: CsvTable[];
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
    gpsRoaming: number;
  };
  channels: Channel[];
  zones: Zone[];
  scans: ScanList[];
  talkgroups: Talkgroup[];
  gpsRoaming: GpsRoamingEntry[];
};

type CsvRow = Record<string, string>;

export type CsvTable = {
  name: string;
  headers: string[];
  rows: string[][];
  warnings: string[];
};

export const emptyCodeplug: CodeplugData = {
  identity: { callsign: '', dmrId: '' },
  radio: '',
  cps: '',
  controls: { pf1Short: 'Unknown', pf1Long: 'Unknown' },
  counts: {
    channels: 0,
    analog: 0,
    dmr: 0,
    zones: 0,
    scans: 0,
    talkgroups: 0,
    gpsRoaming: 0,
  },
  channels: [],
  zones: [],
  scans: [],
  talkgroups: [],
  gpsRoaming: [],
  tables: [],
};

export function parseCsv(text: string, name: string): CsvTable {
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
      if (row.length > 1 || row.some((value) => value.length > 0))
        rows.push(row);
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

  if (quoted)
    throw new Error(`${name}: an opening quote has no closing quote.`);
  if (!rows.length)
    return { name, headers: [], rows: [], warnings: ['This file is empty.'] };
  const headers = rows[0].map((header, index) =>
    index === 0 ? header.replace(/^\uFEFF/, '') : header,
  );

  const values = rows.slice(1);
  const warnings: string[] = [];
  if (headers.some((header) => !header.trim()))
    warnings.push('Some columns have no header; column numbers identify them.');
  if (new Set(headers).size !== headers.length)
    warnings.push('Duplicate headers are preserved as separate columns.');
  if (values.some((row) => row.length !== headers.length))
    warnings.push(
      'Some rows have a different number of values than the header. All values are preserved.',
    );
  const width = values.reduce(
    (max, row) => Math.max(max, row.length),
    headers.length,
  );
  while (headers.length < width) headers.push('');
  return { name, headers, rows: values, warnings };
}

function members(value: string): string[] {
  return value.split('|').filter(Boolean);
}

function asNumber(value: string, fallback: number): number {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function asFloat(value: string): number {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function gpsCoordinate(
  degree: string,
  wholeMinutes: string,
  minuteHundredths: string,
  negative: string,
): number {
  const minutes = asFloat(wholeMinutes) + asFloat(minuteHundredths) / 100;
  const value = asFloat(degree) + minutes / 60;
  return negative === '1' ? -value : value;
}

export async function codeplugFromCpsFiles(
  fileList: FileList | File[],
): Promise<CodeplugData> {
  const files = Array.from(fileList);
  if (!files.length || files.some((file) => !/\.csv$/i.test(file.name))) {
    throw new Error('Select one or more CPS CSV files.');
  }
  if (
    new Set(files.map((file) => file.name.toLowerCase())).size !== files.length
  ) {
    throw new Error(
      'Select files from one codeplug at a time; duplicate filenames were found.',
    );
  }
  const tables = await Promise.all(
    files.map(async (file) => parseCsv(await file.text(), file.name)),
  );
  const rowsFor = (name: string): CsvRow[] => {
    const table = tables.find(
      (table) => table.name.toLowerCase() === name.toLowerCase(),
    );
    if (!table) return [];
    const required: Record<string, string[]> = {
      'Channel.CSV': ['Channel Name', 'Channel Type', 'Receive Frequency'],
      'Zone.CSV': ['Zone Name', 'Zone Channel Member'],
      'ScanList.CSV': ['Scan List Name', 'Scan Channel Member'],
      'TalkGroups.CSV': ['Name', 'Radio ID'],
      'RadioIDList.CSV': ['Name', 'Radio ID'],
      'GPSRoaming.CSV': ['OnOff', 'Zone'],
    };
    if (
      table.rows.length &&
      required[name]?.some((header) => !table.headers.includes(header))
    ) {
      table.warnings.push(
        'The expected CPS headers were not found. Inspect this file in CSV tables.',
      );
      return [];
    }
    return table.rows.map(
      (values) =>
        new Proxy(
          Object.fromEntries(
            table.headers.map((header, index) => [header, values[index] ?? '']),
          ),
          { get: (row, key: string) => row[key] ?? '' },
        ),
    );
  };
  const channelRows = rowsFor('Channel.CSV');
  const zoneRows = rowsFor('Zone.CSV');
  const scanRows = rowsFor('ScanList.CSV');
  const talkgroupRows = rowsFor('TalkGroups.CSV');
  const radioIdRows = rowsFor('RadioIDList.CSV');
  const gpsRoamingRows = rowsFor('GPSRoaming.CSV');

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

  const zoneByNumber = new Map(zones.map((zone) => [zone.number, zone]));
  const gpsRoaming: GpsRoamingEntry[] = gpsRoamingRows
    .map((row, index) => ({ row, index }))
    .filter(({ row }) => row.OnOff === '1')
    .map(({ row, index }) => {
      const zoneIndex = asNumber(row.Zone, -1);
      const zoneNumber = zoneIndex + 1;
      return {
        number: index + 1,
        zoneIndex,
        zoneNumber,
        zoneName:
          zoneByNumber.get(zoneNumber)?.name ??
          `Unresolved zone #${zoneNumber}`,
        latitude: gpsCoordinate(
          row['Latitude Degree'],
          row['Latitude Minute'],
          row['Latitude Minute1'],
          row['North or South'],
        ),
        longitude: gpsCoordinate(
          row['Longtitude Degree'],
          row['Longtitude Minute'],
          row['Longtitude Minute1'],
          row['East or West'],
        ),
        radiusMeters: asNumber(row['Radius(Meter)'], 0),
      };
    });

  const analog = channels.filter((channel) => channel.mode === 'Analog').length;
  const identity = radioIdRows[0];

  return {
    tables,
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
      pf1Short: 'Not decoded from CSV',
      pf1Long: 'Not decoded from CSV',
    },
    counts: {
      channels: channels.length,
      analog,
      dmr: channels.length - analog,
      zones: zones.length,
      scans: scans.length,
      talkgroups: talkgroups.length,
      gpsRoaming: gpsRoaming.length,
    },
    channels,
    zones,
    scans,
    talkgroups,
    gpsRoaming,
  };
}
