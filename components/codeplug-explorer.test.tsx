import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, test } from 'vitest';

import { CodeplugExplorer } from './codeplug-explorer';

/**
 * Regression cover for the channel list. Selection was once wired only to the
 * channel-name button while the row painted a full-width selected state, so
 * every other column looked selectable and silently did nothing. In a
 * seven-column table that swallowed most clicks and made the selection look
 * stuck on the first channel in the zone.
 *
 * These drive the real component rather than ChannelTable, which is module
 * private, so they exercise the same path a person does.
 */

async function loadDemo() {
  const user = userEvent.setup();
  render(<CodeplugExplorer />);
  // The onboarding guide opens first and offers the demo.
  await user.click(screen.getAllByRole('button', { name: /try demo/i })[0]);
  return user;
}

/** The channel table is the one with a "Scan list" column header. */
function channelTable() {
  const header = screen.getAllByRole('columnheader', { name: 'Scan list' })[0];
  const table = header.closest('table');
  if (!table) throw new Error('channel table not found');
  return table;
}

function channelRows() {
  const body = channelTable().querySelector('tbody');
  if (!body) throw new Error('channel table has no body');
  return [...body.querySelectorAll('tr')];
}

function rowFor(name: string) {
  const row = channelRows().find((candidate) =>
    candidate.querySelector('td')?.textContent?.startsWith(name),
  );
  if (!row) throw new Error(`no row for ${name}`);
  return row;
}

/** The name shown in the detail panel above the table. */
function currentChannel() {
  return screen
    .getByText('Current channel')
    .parentElement?.textContent?.replace('Current channel', '');
}

beforeEach(() => {
  localStorage.clear();
});

test('the demo loads and starts on the first channel of the first zone', async () => {
  await loadDemo();
  expect(currentChannel()).toBe('DEMO-VHF');
  expect(channelRows()).toHaveLength(4);
  expect(rowFor('DEMO-VHF')).toHaveAttribute('data-state', 'selected');
});

test('every column in a channel row selects that channel, not just the name', async () => {
  const user = await loadDemo();
  const columns = [...channelTable().querySelectorAll('thead th')].map(
    (th) => th.textContent ?? '',
  );
  expect(columns.length).toBeGreaterThan(1);

  for (const [index, column] of columns.entries()) {
    // Reset to the first channel so each column is an independent check.
    await user.click(rowFor('DEMO-VHF').querySelectorAll('td')[0]);
    expect(currentChannel()).toBe('DEMO-VHF');

    const cell = rowFor('2M-CALL').querySelectorAll('td')[index];
    await user.click(cell);

    expect(
      currentChannel(),
      `clicking the "${column}" column should select the channel`,
    ).toBe('2M-CALL');
    expect(rowFor('2M-CALL')).toHaveAttribute('data-state', 'selected');
    expect(rowFor('DEMO-VHF')).not.toHaveAttribute('data-state', 'selected');
  }
});

test('the channel name stays a real button for keyboard and screen readers', async () => {
  const user = await loadDemo();
  const button = within(rowFor('DMR LOCAL')).getByRole('button', {
    name: /DMR LOCAL/,
  });

  button.focus();
  expect(button).toHaveFocus();

  await user.keyboard('{Enter}');
  expect(currentChannel()).toBe('DMR LOCAL');
});

test('switching zone moves the selection to that zone first channel', async () => {
  const user = await loadDemo();
  expect(currentChannel()).toBe('DEMO-VHF');

  // 10 DMR DEMO is used deliberately: its first member differs from the
  // starting zone's. 01 LOCAL also begins with DEMO-VHF, so switching to it
  // correctly changes nothing and would not prove the selection moved.
  await user.click(screen.getByRole('button', { name: /10 DMR DEMO/ }));

  expect(currentChannel()).toBe('DMR LOCAL');
  expect(rowFor('DMR LOCAL')).toHaveAttribute('data-state', 'selected');
  // The list now shows that zone's three channels, not the previous four.
  expect(channelRows()).toHaveLength(3);
});

/* ---------------------------------------------------------------------------
 * Phase 2: the rest of the interactive surface -- view toggle, filtering, and
 * the change-note flow that produces the app's only real output.
 * ------------------------------------------------------------------------ */

/** The "N of M shown" line under the channel table. */
function shownCount() {
  return screen
    .getByText(/\d+ of \d+\s*shown/)
    .textContent?.replace(/\s+/g, ' ')
    .trim();
}

async function openChangesTab(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('tab', { name: /^Changes \(/ }));
}

test('the scan set view lists the attached scan list, not the zone', async () => {
  const user = await loadDemo();
  // Starts on 00 DEMO: four channels. DEMO-VHF's scan list is Local Scan,
  // which has two members, so the counts must genuinely differ.
  expect(channelRows()).toHaveLength(4);

  await user.click(screen.getByRole('button', { name: 'Scan set' }));
  expect(channelRows().map((r) => r.querySelector('td')?.textContent)).toEqual([
    expect.stringContaining('DEMO-VHF'),
    expect.stringContaining('DEMO-UHF'),
  ]);

  await user.click(screen.getByRole('button', { name: 'Zone' }));
  expect(channelRows()).toHaveLength(4);
});

test('the mode filter narrows the list and updates the shown count', async () => {
  const user = await loadDemo();
  expect(shownCount()).toBe('4 of 4 shown');

  // Of 00 DEMO's four channels only DMR LOCAL is digital.
  await user.selectOptions(
    screen.getByRole('combobox', { name: 'Filter channel mode' }),
    'DMR',
  );
  expect(channelRows()).toHaveLength(1);
  expect(rowFor('DMR LOCAL')).toBeInTheDocument();
  expect(shownCount()).toBe('1 of 4 shown');

  await user.selectOptions(
    screen.getByRole('combobox', { name: 'Filter channel mode' }),
    'All',
  );
  expect(channelRows()).toHaveLength(4);
});

test('searching narrows the channel list', async () => {
  const user = await loadDemo();
  await user.type(
    screen.getByRole('textbox', { name: 'Filter channels' }),
    '2M',
  );

  expect(channelRows()).toHaveLength(1);
  expect(rowFor('2M-CALL')).toBeInTheDocument();
  expect(shownCount()).toBe('1 of 4 shown');
});

test('a change note can be added and removed', async () => {
  const user = await loadDemo();
  await user.type(
    screen.getByRole('textbox', { name: 'Describe the change' }),
    'Bump the CTCSS tone',
  );
  await user.click(screen.getByRole('button', { name: /Add change/ }));

  expect(
    screen.getByRole('tab', { name: /^Changes \(1\)/ }),
  ).toBeInTheDocument();

  await openChangesTab(user);
  expect(screen.getByText('Bump the CTCSS tone')).toBeInTheDocument();

  await user.click(screen.getByRole('button', { name: 'Remove change' }));
  expect(
    screen.getByRole('tab', { name: /^Changes \(0\)/ }),
  ).toBeInTheDocument();
  expect(screen.queryByText('Bump the CTCSS tone')).not.toBeInTheDocument();
});

test('the exported Markdown carries the identity, counts and note context', async () => {
  const user = await loadDemo();
  await user.type(
    screen.getByRole('textbox', { name: 'Describe the change' }),
    'Retune the repeater offset',
  );
  await user.click(screen.getByRole('button', { name: /Add change/ }));
  await openChangesTab(user);
  await user.click(screen.getByRole('button', { name: 'Copy' }));

  const markdown = await navigator.clipboard.readText();
  expect(markdown).toContain('# AnyTone codeplug change request');
  expect(markdown).toContain('Identity: DEMO / DMR ID 0000000');
  expect(markdown).toContain('Counts: 8 channels, 5 zones, 3 scan lists');
  expect(markdown).toContain('1. Retune the repeater offset');
  // A channel-scoped note pins all three coordinates.
  expect(markdown).toContain(
    'Scope: channel | Zone: 00 DEMO | Channel: DEMO-VHF',
  );
});

test('a zone-scoped note records the zone and omits the channel', async () => {
  const user = await loadDemo();
  await user.selectOptions(
    screen.getByRole('combobox', { name: 'Change scope' }),
    'zone',
  );
  await user.type(
    screen.getByRole('textbox', { name: 'Describe the change' }),
    'Reorder this zone',
  );
  await user.click(screen.getByRole('button', { name: /Add change/ }));
  await openChangesTab(user);
  await user.click(screen.getByRole('button', { name: 'Copy' }));

  const markdown = await navigator.clipboard.readText();
  expect(markdown).toContain('Scope: zone | Zone: 00 DEMO');
  expect(markdown).not.toContain('Channel: DEMO-VHF');
});

/* ---------------------------------------------------------------------------
 * Phase 3: the CSV import path. lib/codeplug.test.mjs proves the parser; these
 * prove the app wires it up -- that a good import reaches the screen and a bad
 * one surfaces the parser's reason instead of failing silently.
 * ------------------------------------------------------------------------ */

function fileInput() {
  const input = document.querySelector<HTMLInputElement>('input[type="file"]');
  if (!input) throw new Error('file input not found');
  return input;
}

const csv = (name: string, body: string) =>
  new File([body], name, { type: 'text/csv' });

test('importing CPS files loads them and labels the source', async () => {
  const user = userEvent.setup({ applyAccept: false });
  render(<CodeplugExplorer />);

  await user.upload(fileInput(), [
    csv(
      'Channel.CSV',
      'No.,Channel Name,Channel Type,Receive Frequency,Scan List\n' +
        '1,SYNTH-A,A-Analog,146.520,Synth Scan\n' +
        '2,SYNTH-B,D-Digital,440.100,Synth Scan',
    ),
    csv(
      'Zone.CSV',
      'No.,Zone Name,Zone Channel Member\n1,SYNTH ZONE,SYNTH-A|SYNTH-B',
    ),
  ]);

  expect(await screen.findByText(/Imported CPS tables/)).toBeInTheDocument();
  expect(
    screen.getByRole('button', { name: /SYNTH ZONE/ }),
  ).toBeInTheDocument();
  expect(rowFor('SYNTH-A')).toBeInTheDocument();
  expect(rowFor('SYNTH-B')).toBeInTheDocument();
  // The parser's mode mapping has to survive the round trip through the UI.
  expect(currentChannel()).toBe('SYNTH-A');
});

test('an unreadable import surfaces the parser reason instead of failing quietly', async () => {
  const user = userEvent.setup({ applyAccept: false });
  render(<CodeplugExplorer />);

  // A quoted field that is never closed: the parser rejects this by design.
  await user.upload(fileInput(), [csv('Extra.csv', 'Name\n"unfinished')]);

  const alert = await screen.findByRole('alert');
  expect(alert).toHaveTextContent(/closing quote/i);
  // A failed import must not leave a half-loaded codeplug behind.
  expect(screen.queryByText(/Imported CPS tables/)).not.toBeInTheDocument();
});
