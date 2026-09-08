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
  return screen.getByText('Current channel').parentElement?.textContent?.replace(
    'Current channel',
    '',
  );
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
