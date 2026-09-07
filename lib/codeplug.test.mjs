import assert from 'node:assert/strict';
import { test } from 'node:test';
import { codeplugFromCpsFiles, parseCsv } from './codeplug.ts';

const file = (name, text) => new File([text], name);

test('CSV preserves quoted commas, escaped quotes, newlines, BOM and empty values', () => {
  const table = parseCsv(
    '\uFEFF"Name","Value","Blank"\r\n"A, B","line 1\n""line 2""",\r\n',
    'Extra.csv',
  );
  assert.deepEqual(table.headers, ['Name', 'Value', 'Blank']);
  assert.deepEqual(table.rows, [['A, B', 'line 1\n"line 2"', '']]);
  assert.deepEqual(table.warnings, []);
});

test('unnamed, duplicate and extra columns retain every value', () => {
  const table = parseCsv('Name,,Name\na,b,c,d\nx,y', 'Extra.csv');
  assert.deepEqual(table.headers, ['Name', '', 'Name', '']);
  assert.deepEqual(table.rows, [
    ['a', 'b', 'c', 'd'],
    ['x', 'y'],
  ]);
  assert.equal(table.warnings.length, 3);
});

test('empty and header-only files remain inspectable', async () => {
  const result = await codeplugFromCpsFiles([
    file('Empty.csv', ''),
    file('OptionalSetting.csv', 'Gps,Beep'),
  ]);
  assert.equal(result.tables.length, 2);
  assert.deepEqual(result.tables[1].headers, ['Gps', 'Beep']);
  assert.equal(result.channels.length, 0);
});

test('rows containing only empty columns are preserved', () => {
  assert.deepEqual(parseCsv('A,B\n,\n', 'EmptyValues.csv').rows, [['', '']]);
});

test('settings-only and unknown files need no core tables', async () => {
  const result = await codeplugFromCpsFiles([
    file('OPTIONALSETTING.CSV', 'Gps,Beep\n1,0'),
    file('Future.csv', 'New Field\nnew value'),
  ]);
  assert.equal(result.tables.length, 2);
  assert.deepEqual(result.tables[0].rows, [['1', '0']]);
  assert.equal(result.counts.channels, 0);
  assert.equal(result.tables[1].rows[0][0], 'new value');
});

test('channel-only imports provide safe absent fields', async () => {
  const result = await codeplugFromCpsFiles([
    file(
      'channel.csv',
      'Channel Name,Channel Type,Receive Frequency\nDemo,Analog,146.520',
    ),
  ]);
  assert.equal(result.channels[0].name, 'Demo');
  assert.equal(result.channels[0].contact, '');
  assert.equal(result.channels[0].scan, '');
  assert.deepEqual(result.channels[0].zones, []);
});

test('core relationships survive an additional settings table', async () => {
  const result = await codeplugFromCpsFiles([
    file(
      'Channel.CSV',
      'No.,Channel Name,Channel Type,Receive Frequency,Scan List,Contact\n1,Demo,Digital,440.000,Demo scan,Demo TG',
    ),
    file('Zone.CSV', 'No.,Zone Name,Zone Channel Member\n1,Demo zone,Demo|'),
    file('ScanList.CSV', 'Scan List Name,Scan Channel Member\nDemo scan,Demo|'),
    file('TalkGroups.CSV', 'Name,Radio ID\nDemo TG,999'),
    file('OptionalSetting.csv', 'Gps\n0'),
    file(
      'GPSRoaming.CSV',
      'OnOff,Zone,Latitude Degree,Longtitude Degree,East or West,Radius(Meter)\n1,0,40,100,1,1000',
    ),
  ]);
  assert.deepEqual(result.channels[0].zones, ['Demo zone']);
  assert.equal(result.channels[0].mode, 'DMR');
  assert.deepEqual(result.scans[0].members, ['Demo']);
  assert.equal(result.talkgroups[0].name, result.channels[0].contact);
  assert.equal(result.gpsRoaming[0].zoneName, 'Demo zone');
  assert.equal(result.gpsRoaming[0].longitude, -100);
  assert.equal(result.tables.length, 6);
});

test('unexpected known schemas remain available with a warning', async () => {
  const result = await codeplugFromCpsFiles([
    file('Channel.CSV', 'Other\nvalue'),
  ]);
  assert.equal(result.channels.length, 0);
  assert.deepEqual(result.tables[0].rows, [['value']]);
  assert.match(result.tables[0].warnings[0], /expected CPS headers/);
});

test('rejects ambiguous selections and truncated quoted CSVs', async () => {
  await assert.rejects(codeplugFromCpsFiles([]), /one or more/);
  await assert.rejects(codeplugFromCpsFiles([file('data.rdt', '')]), /CSV/);
  await assert.rejects(
    codeplugFromCpsFiles([file('Extra.csv', ''), file('extra.CSV', '')]),
    /duplicate/,
  );
  await assert.rejects(
    codeplugFromCpsFiles([file('Extra.csv', 'Name\n"unfinished')]),
    /closing quote/,
  );
});
