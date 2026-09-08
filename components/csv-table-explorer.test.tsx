import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, test } from 'vitest';

import type { CsvTable } from '@/lib/codeplug';

import { CsvTableExplorer } from './csv-table-explorer';

/**
 * CsvTableExplorer is the fallback view that keeps every imported file
 * inspectable, including CPS tables the parser has no model for. It takes its
 * tables as a prop, so these drive it directly rather than through the app.
 */

const table = (over: Partial<CsvTable> & { name: string }): CsvTable => ({
  headers: ['A', 'B'],
  rows: [],
  warnings: [],
  ...over,
});

/** The data grid, excluding the header row. */
function bodyRows() {
  const body = screen.getByRole('table').querySelector('tbody');
  return [...(body?.querySelectorAll('tr') ?? [])];
}

test('with no tables it explains what to load rather than rendering an empty grid', () => {
  render(<CsvTableExplorer tables={[]} />);
  expect(screen.getByText(/Load CSV files to inspect/)).toBeInTheDocument();
  expect(screen.queryByRole('table')).not.toBeInTheDocument();
});

test('a file with headers but no rows says so', () => {
  render(
    <CsvTableExplorer tables={[table({ name: 'Empty.csv', rows: [] })]} />,
  );
  expect(screen.getByText('This file has no data rows.')).toBeInTheDocument();
});

test('unnamed columns fall back to a positional label and empty cells are marked', () => {
  render(
    <CsvTableExplorer
      tables={[
        table({ name: 'Odd.csv', headers: ['A', ''], rows: [['one', '']] }),
      ]}
    />,
  );
  expect(screen.getByRole('columnheader', { name: 'Column 2' })).toBeInTheDocument();
  // An empty value must be visibly marked, not rendered as a blank cell.
  expect(screen.getByText('(empty)')).toBeInTheDocument();
});

test('parser warnings are surfaced to the reader', () => {
  render(
    <CsvTableExplorer
      tables={[
        table({
          name: 'Weird.csv',
          rows: [['x', 'y']],
          warnings: ['Row 1 has more values than headers'],
        }),
      ]}
    />,
  );
  expect(
    screen.getByText('Row 1 has more values than headers'),
  ).toBeInTheDocument();
});

test('switching file shows that file and clears the active search', async () => {
  const user = userEvent.setup();
  render(
    <CsvTableExplorer
      tables={[
        table({ name: 'One.csv', rows: [['alpha', 'a']] }),
        table({ name: 'Two.csv', rows: [['beta', 'b']] }),
      ]}
    />,
  );

  const search = screen.getByRole('textbox', { name: 'Search CSV table' });
  await user.type(search, 'alpha');
  expect(bodyRows()).toHaveLength(1);

  await user.selectOptions(
    screen.getByRole('combobox', { name: 'CSV file' }),
    'Two.csv',
  );

  expect(search).toHaveValue('');
  expect(screen.getByText('beta')).toBeInTheDocument();
  expect(screen.queryByText('alpha')).not.toBeInTheDocument();
});

test('search filters rows and reports when nothing matches', async () => {
  const user = userEvent.setup();
  render(
    <CsvTableExplorer
      tables={[
        table({
          name: 'Rows.csv',
          rows: [
            ['alpha', 'one'],
            ['beta', 'two'],
          ],
        }),
      ]}
    />,
  );
  expect(bodyRows()).toHaveLength(2);

  const search = screen.getByRole('textbox', { name: 'Search CSV table' });
  await user.type(search, 'beta');
  expect(bodyRows()).toHaveLength(1);

  await user.clear(search);
  await user.type(search, 'nothing-here');
  expect(screen.getByText('No matching rows.')).toBeInTheDocument();
});

test('a settings file is transposed into setting and value pairs', () => {
  render(
    <CsvTableExplorer
      tables={[
        table({
          name: 'OptionalSetting.csv',
          headers: ['Gps', 'Beep'],
          rows: [['1', '0']],
        }),
      ]}
    />,
  );

  // Not the raw row layout: one line per setting instead.
  expect(screen.getByRole('columnheader', { name: 'Setting' })).toBeInTheDocument();
  expect(
    screen.getByRole('columnheader', { name: 'Exported value' }),
  ).toBeInTheDocument();
  expect(bodyRows()).toHaveLength(2);
  expect(within(bodyRows()[0]).getByText('Gps')).toBeInTheDocument();
});

test('a settings file with one record offers no record picker', () => {
  render(
    <CsvTableExplorer
      tables={[
        table({
          name: 'OptionalSetting.csv',
          headers: ['Gps'],
          rows: [['1']],
        }),
      ]}
    />,
  );
  expect(
    screen.queryByRole('combobox', { name: 'Settings record' }),
  ).not.toBeInTheDocument();
});

test('a settings file with several records can switch between them', async () => {
  const user = userEvent.setup();
  render(
    <CsvTableExplorer
      tables={[
        table({
          name: 'OptionalSetting.csv',
          headers: ['Gps'],
          rows: [['on'], ['off']],
        }),
      ]}
    />,
  );

  expect(screen.getByText('on')).toBeInTheDocument();
  await user.selectOptions(
    screen.getByRole('combobox', { name: 'Settings record' }),
    '1',
  );
  expect(screen.getByText('off')).toBeInTheDocument();
  expect(screen.queryByText('on')).not.toBeInTheDocument();
});

test('rows are paged at fifty per page', async () => {
  const user = userEvent.setup();
  render(
    <CsvTableExplorer
      tables={[
        table({
          name: 'Big.csv',
          rows: Array.from({ length: 51 }, (_, i) => [`row-${i + 1}`, 'x']),
        }),
      ]}
    />,
  );

  expect(bodyRows()).toHaveLength(50);
  expect(screen.getByText(/51 rows · Page 1 of 2/)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled();

  await user.click(screen.getByRole('button', { name: 'Next' }));

  expect(bodyRows()).toHaveLength(1);
  expect(screen.getByText('row-51')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Previous' })).toBeEnabled();
});
