import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  NativeSelect,
  NativeSelectOption,
} from '@/components/ui/native-select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { CsvTable } from '@/lib/codeplug';

const PAGE_SIZE = 50;

export function CsvTableExplorer({ tables }: { tables: CsvTable[] }) {
  const [selected, setSelected] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);
  const [record, setRecord] = useState(0);
  const table = tables.find((table) => table.name === selected) ?? tables[0];
  const settings = table?.name.toLowerCase() === 'optionalsetting.csv';
  const results = useMemo(() => {
    if (!table) return [];
    const search = query.trim().toLowerCase();
    const rows = settings
      ? table.rows.length
        ? table.headers.map((header, index) => [
            header || `Column ${index + 1}`,
            table.rows[record]?.[index] ?? '',
          ])
        : []
      : table.rows;
    return rows
      .map((values, index) => ({ values, index }))
      .filter(
        ({ values }) =>
          !search ||
          values.some((value) => value.toLowerCase().includes(search)),
      );
  }, [table, settings, query, record]);
  const pages = Math.max(1, Math.ceil(results.length / PAGE_SIZE));
  const currentPage = Math.min(page, pages - 1);
  const headers = settings
    ? ['Setting', 'Exported value']
    : (table?.headers ?? []);

  return (
    <Card className="min-w-0">
      <CardHeader>
        <CardTitle>CSV tables</CardTitle>
        <CardDescription>
          Inspect every imported file, including settings and unfamiliar CPS
          tables. Values are displayed as exported; numeric codes are not
          decoded.
        </CardDescription>
      </CardHeader>
      <CardContent className="min-w-0 space-y-4">
        {!table ? (
          <p className="text-sm text-muted-foreground">
            Load CSV files to inspect their original columns here. The demo
            includes a small synthetic settings example.
          </p>
        ) : (
          <>
            <div className="flex flex-wrap gap-3">
              <NativeSelect
                aria-label="CSV file"
                value={table.name}
                onChange={(event) => {
                  setSelected(event.target.value);
                  setQuery('');
                  setPage(0);
                  setRecord(0);
                }}
              >
                {tables.map((table) => (
                  <NativeSelectOption key={table.name} value={table.name}>
                    {table.name} ({table.rows.length} rows)
                  </NativeSelectOption>
                ))}
              </NativeSelect>
              <Input
                className="max-w-sm"
                aria-label="Search CSV table"
                placeholder={
                  settings
                    ? 'Search setting names or values…'
                    : 'Search all row values…'
                }
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setPage(0);
                }}
              />
              {settings && table.rows.length > 1 && (
                <NativeSelect
                  aria-label="Settings record"
                  value={record}
                  onChange={(event) => {
                    setRecord(Number(event.target.value));
                    setPage(0);
                  }}
                >
                  {table.rows.map((_, index) => (
                    <NativeSelectOption key={index} value={index}>
                      Record {index + 1}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              {table.rows.length} source rows · {table.headers.length} columns ·{' '}
              {tables.length} files loaded
            </p>
            {table.warnings.map((warning) => (
              <p
                key={warning}
                className="rounded-lg bg-[var(--signal-amber-soft)] p-3 text-sm text-[var(--signal-amber-foreground)]"
              >
                {warning}
              </p>
            ))}
            <div className="max-h-[65vh] overflow-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    {headers.map((header, index) => (
                      <TableHead key={index}>
                        {header || `Column ${index + 1}`}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {results
                    .slice(
                      currentPage * PAGE_SIZE,
                      (currentPage + 1) * PAGE_SIZE,
                    )
                    .map(({ values, index }) => (
                      <TableRow key={index}>
                        <TableCell className="text-muted-foreground">
                          {index + 1}
                        </TableCell>
                        {headers.map((_, column) => (
                          <TableCell
                            key={column}
                            className="max-w-lg whitespace-pre-wrap break-words font-mono text-xs"
                          >
                            {values[column] || (
                              <span className="text-muted-foreground">
                                (empty)
                              </span>
                            )}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </div>
            {!results.length && (
              <p className="text-sm text-muted-foreground">
                {table.rows.length
                  ? 'No matching rows.'
                  : 'This file has no data rows.'}
              </p>
            )}
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage === 0}
                onClick={() => setPage(currentPage - 1)}
              >
                Previous
              </Button>
              <span>
                {results.length} {settings ? 'settings' : 'rows'} · Page{' '}
                {currentPage + 1} of {pages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage + 1 >= pages}
                onClick={() => setPage(currentPage + 1)}
              >
                Next
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
