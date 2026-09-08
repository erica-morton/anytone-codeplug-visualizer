'use client';

import {
  AlertTriangle,
  BatteryMedium,
  ChevronRight,
  Copy,
  Download,
  FileUp,
  MapPinned,
  Plus,
  RadioTower,
  ScanLine,
  Search,
  Trash2,
} from 'lucide-react';
import { ChangeEvent, useEffect, useMemo, useRef, useState } from 'react';

import sampleData from '@/data/sample-codeplug.json';
import { AppFooter } from '@/components/app-footer';
import { GettingStarted } from '@/components/getting-started';
import { CsvTableExplorer } from '@/components/csv-table-explorer';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardAction,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import {
  Channel,
  CodeplugData,
  GpsRoamingEntry,
  ScanList,
  Talkgroup,
  codeplugFromCpsFiles,
  emptyCodeplug,
} from '@/lib/codeplug';

type ChannelView = 'zone' | 'scan';
type MainView =
  | 'channels'
  | 'scans'
  | 'talkgroups'
  | 'gps'
  | 'tables'
  | 'changes';
type ChangeScope = 'channel' | 'zone' | 'codeplug';

type ChangeNote = {
  id: string;
  scope: ChangeScope;
  zone: string;
  channel: string;
  note: string;
  createdAt: string;
};

const demoData: CodeplugData = {
  ...(sampleData as CodeplugData),
  tables: [
    {
      name: 'OptionalSetting.csv',
      headers: ['Beep', 'Language', 'Gps'],
      rows: [['1', '0', '0']],
      warnings: [
        'Synthetic settings for exploring the viewer; not radio programming defaults.',
      ],
    },
  ],
};
const CHANGE_STORAGE_KEY = 'anytone-codeplug-visualizer.changes.v1';
const GUIDE_STORAGE_KEY = 'anytone-codeplug-visualizer.guide.v1';

function placeFor(channel: Channel): string {
  const place = [channel.city, channel.state].filter(Boolean).join(', ');
  return [place, channel.callsign].filter(Boolean).join(' · ') || '—';
}

function accessFor(channel: Channel): string {
  if (channel.mode === 'DMR') {
    return `CC ${channel.colorCode} · TS ${channel.slot}`;
  }

  const encode =
    channel.encode && channel.encode !== 'Off'
      ? `TX ${channel.encode}`
      : 'No TX tone';
  const decode =
    channel.decode && channel.decode !== 'Off' ? ` · RX ${channel.decode}` : '';
  return encode + decode;
}

function destinationFor(channel: Channel): string {
  if (channel.mode !== 'DMR') return '—';
  const callType = channel.callType === 'Private Call' ? ' · private' : '';
  return `${channel.contact} · ${channel.tg}${callType}`;
}

function makeChangeMarkdown(
  data: CodeplugData,
  sourceName: string,
  changes: ChangeNote[],
): string {
  const items = changes
    .map((change, index) => {
      const context = [
        `Scope: ${change.scope}`,
        `Zone: ${change.zone || 'n/a'}`,
        change.channel ? `Channel: ${change.channel}` : '',
      ]
        .filter(Boolean)
        .join(' | ');
      return `${index + 1}. ${change.note}\n   - ${context}`;
    })
    .join('\n');

  return `# AnyTone codeplug change request

- Source: ${sourceName}
- Identity: ${data.identity.callsign} / DMR ID ${data.identity.dmrId}
- Radio: ${data.radio}
- Counts: ${data.counts.channels} channels, ${data.counts.zones} zones, ${data.counts.scans} scan lists
- GPS roaming: ${data.counts.gpsRoaming} active geofences

## Requested changes

${items || 'No changes recorded.'}

Please update the source-of-truth files, regenerate the CPS package, and validate all channel, zone, scan-list, and talkgroup references.
`;
}

export function CodeplugExplorer() {
  const [data, setData] = useState<CodeplugData>(emptyCodeplug);
  const [sourceName, setSourceName] = useState('');
  const [importing, setImporting] = useState(false);
  const [loadVersion, setLoadVersion] = useState(0);
  const [guideOpen, setGuideOpen] = useState(() => {
    try {
      return window.localStorage.getItem(GUIDE_STORAGE_KEY) !== 'seen';
    } catch {
      return true;
    }
  });
  const [mainView, setMainView] = useState<MainView>('channels');
  const [zoneName, setZoneName] = useState('');
  const [channelName, setChannelName] = useState('');
  const [channelView, setChannelView] = useState<ChannelView>('zone');
  const [zoneSearch, setZoneSearch] = useState('');
  const [channelSearch, setChannelSearch] = useState('');
  const [modeFilter, setModeFilter] = useState<'All' | 'Analog' | 'DMR'>('All');
  const [importError, setImportError] = useState('');
  const [changeScope, setChangeScope] = useState<ChangeScope>('channel');
  const [changeDraft, setChangeDraft] = useState('');
  const [changes, setChanges] = useState<ChangeNote[]>([]);
  const [changesLoaded, setChangesLoaded] = useState(false);
  const [copyStatus, setCopyStatus] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const byName = useMemo(
    () => new Map(data.channels.map((channel) => [channel.name, channel])),
    [data.channels],
  );
  const scanByName = useMemo(
    () => new Map(data.scans.map((scan) => [scan.name, scan])),
    [data.scans],
  );
  const zone =
    data.zones.find((candidate) => candidate.name === zoneName) ??
    data.zones[0];
  const selectedChannel =
    byName.get(channelName) ??
    byName.get(zone?.members[0] ?? '') ??
    data.channels[0];
  const selectedScan = selectedChannel?.scan
    ? scanByName.get(selectedChannel.scan)
    : undefined;

  const filteredZones = useMemo(() => {
    const query = zoneSearch.trim().toLowerCase();
    if (!query) return data.zones;
    return data.zones.filter((candidate) =>
      candidate.name.toLowerCase().includes(query),
    );
  }, [data.zones, zoneSearch]);

  const visibleChannels = useMemo(() => {
    const names =
      channelView === 'scan' && selectedScan
        ? selectedScan.members
        : (zone?.members ?? data.channels.map((channel) => channel.name));
    const query = channelSearch.trim().toLowerCase();

    return names
      .map((name) => byName.get(name))
      .filter((channel): channel is Channel => Boolean(channel))
      .filter((channel) => modeFilter === 'All' || channel.mode === modeFilter)
      .filter((channel) => {
        if (!query) return true;
        return [
          channel.name,
          channel.city,
          channel.state,
          channel.callsign,
          channel.rx,
          channel.tx,
          channel.contact,
          channel.tg,
          channel.scan,
          channel.notes,
        ].some((value) => value.toLowerCase().includes(query));
      });
  }, [
    byName,
    channelSearch,
    channelView,
    modeFilter,
    selectedScan,
    zone,
    data.channels,
  ]);

  useEffect(() => {
    const loadChanges = window.setTimeout(() => {
      try {
        const stored = window.localStorage.getItem(CHANGE_STORAGE_KEY);
        if (stored) setChanges(JSON.parse(stored) as ChangeNote[]);
      } catch {
        // A damaged or unavailable local store should not block the explorer.
      } finally {
        setChangesLoaded(true);
      }
    }, 0);

    return () => window.clearTimeout(loadChanges);
  }, []);

  useEffect(() => {
    if (!changesLoaded) return;
    try {
      window.localStorage.setItem(CHANGE_STORAGE_KEY, JSON.stringify(changes));
    } catch {
      /* Browsing still works when storage is unavailable. */
    }
  }, [changes, changesLoaded]);

  function selectZone(nextZoneName: string) {
    const nextZone = data.zones.find(
      (candidate) => candidate.name === nextZoneName,
    );
    if (!nextZone) return;
    setZoneName(nextZone.name);
    setChannelName(nextZone.members[0] ?? '');
    setChannelView('zone');
    setChannelSearch('');
    setModeFilter('All');
  }

  function openChannel(
    nextChannelName: string,
    nextView: ChannelView = 'zone',
  ) {
    const preferredZone =
      data.zones.find(
        (candidate) =>
          candidate.name !== '00 QUICK' &&
          candidate.members.includes(nextChannelName),
      ) ??
      data.zones.find((candidate) =>
        candidate.members.includes(nextChannelName),
      );
    if (preferredZone) setZoneName(preferredZone.name);
    setChannelName(nextChannelName);
    setChannelView(nextView);
    setModeFilter('All');
    setChannelSearch('');
    setMainView('channels');
  }

  function loadData(imported: CodeplugData, source: string) {
    setLoadVersion((version) => version + 1);
    setData(imported);
    setSourceName(source);
    setZoneName(imported.zones[0]?.name ?? '');
    setChannelName(
      imported.zones[0]?.members[0] ?? imported.channels[0]?.name ?? '',
    );
    setChannelView('zone');
    setMainView(imported.channels.length || !source ? 'channels' : 'tables');
    setZoneSearch('');
    setChannelSearch('');
    setModeFilter('All');
    setChangeDraft('');
    setChangeScope('channel');
    setCopyStatus('');
    setImportError('');
  }

  function closeGuide() {
    setGuideOpen(false);
    try {
      window.localStorage.setItem(GUIDE_STORAGE_KEY, 'seen');
    } catch {
      /* The guide may show again if storage is unavailable. */
    }
  }

  async function importFiles(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    if (!input.files?.length) return;
    setImportError('');
    setImporting(true);
    try {
      const imported = await codeplugFromCpsFiles(input.files);
      loadData(imported, 'Imported CPS tables');
    } catch (error) {
      setImportError(
        error instanceof Error
          ? error.message
          : 'The CPS files could not be read.',
      );
    } finally {
      input.value = '';
      setImporting(false);
    }
  }

  function addChange() {
    const note = changeDraft.trim();
    if (!note || !selectedChannel || (changeScope === 'zone' && !zone)) return;
    setChanges((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        scope: changeScope,
        zone: zone?.name ?? '',
        channel: changeScope === 'channel' ? selectedChannel.name : '',
        note,
        createdAt: new Date().toISOString(),
      },
    ]);
    setChangeDraft('');
    setCopyStatus('Change saved locally.');
  }

  async function copyChanges() {
    const markdown = makeChangeMarkdown(data, sourceName, changes);
    try {
      await navigator.clipboard.writeText(markdown);
      setCopyStatus('Change request copied.');
    } catch {
      setCopyStatus('Clipboard access was blocked. Use Download instead.');
    }
  }

  function downloadChanges() {
    const markdown = makeChangeMarkdown(data, sourceName, changes);
    const url = URL.createObjectURL(
      new Blob([markdown], { type: 'text/markdown' }),
    );
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'anytone-codeplug-changes.md';
    anchor.click();
    URL.revokeObjectURL(url);
    setCopyStatus('Change request downloaded.');
  }

  function removeChange(id: string) {
    setChanges((current) => current.filter((change) => change.id !== id));
  }

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <GettingStarted
        open={guideOpen}
        hasData={Boolean(sourceName)}
        onClose={closeGuide}
        onImport={() => fileInputRef.current?.click()}
        onDemo={() => loadData(demoData, 'Synthetic demo sample')}
      />
      <div className="h-1 bg-[linear-gradient(90deg,var(--signal-green),var(--signal-amber),var(--signal-red))]" />
      <header className="sticky top-0 z-20 border-b bg-background/92 backdrop-blur-lg">
        <div className="mx-auto flex max-w-[1500px] flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground shadow-sm">
              <RadioTower className="size-5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-lg font-semibold tracking-tight sm:text-xl">
                Codeplug Visualizer
              </h1>
              <p className="truncate text-xs text-muted-foreground sm:text-sm">
                {sourceName
                  ? `${data.identity.callsign} · DMR ${data.identity.dmrId} · ${sourceName}`
                  : 'No codeplug loaded · Your files stay in your browser'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".csv"
              hidden
              onChange={importFiles}
            />
            <Button
              variant="outline"
              disabled={importing}
              onClick={() => fileInputRef.current?.click()}
            >
              <FileUp data-icon="inline-start" />{' '}
              {importing ? 'Loading…' : 'Load CPS CSVs'}
            </Button>
            <Button
              variant="ghost"
              disabled={importing}
              onClick={() => loadData(demoData, 'Synthetic demo sample')}
            >
              Load demo
            </Button>
            {sourceName && (
              <Button
                variant="ghost"
                disabled={importing}
                onClick={() => loadData(emptyCodeplug, '')}
              >
                Unload
              </Button>
            )}
            <Button variant="ghost" onClick={() => setGuideOpen(true)}>
              Help
            </Button>
          </div>
          {importError ? (
            <div
              className="flex basis-full items-center gap-2 text-sm text-destructive"
              role="alert"
            >
              <AlertTriangle className="size-4" aria-hidden="true" />{' '}
              {importError}
            </div>
          ) : null}
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1500px] space-y-5 px-4 py-5 sm:px-6 lg:px-8">
        {!sourceName ? (
          <Card className="mx-auto my-10 max-w-2xl">
            <CardHeader>
              <CardTitle>Choose a codeplug to explore</CardTitle>
              <CardDescription>
                Load your AnyTone CPS CSV exports or try the synthetic demo.
                Nothing is loaded automatically.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <Button
                  disabled={importing}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <FileUp data-icon="inline-start" /> Load my CSVs
                </Button>
                <Button
                  variant="outline"
                  disabled={importing}
                  onClick={() => loadData(demoData, 'Synthetic demo sample')}
                >
                  Try demo
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">
                Select any CSVs together from a CPS Export All folder. Each load
                replaces the current files. Reloading returns here; saved change
                notes stay in this browser.
              </p>
            </CardContent>
          </Card>
        ) : null}
        {sourceName === 'Synthetic demo sample' && (
          <p className="text-sm text-muted-foreground">
            Synthetic demo for exploring the app. Do not program this data into
            a radio.
          </p>
        )}
        <section
          className="grid grid-cols-2 gap-3 lg:grid-cols-4"
          aria-label="Codeplug totals"
        >
          <Metric
            label="Channels"
            value={data.counts.channels}
            detail={`${data.counts.analog} analog · ${data.counts.dmr} DMR`}
          />
          <Metric
            label="Zones"
            value={data.counts.zones}
            detail="radio channel groups"
          />
          <Metric
            label="Scan lists"
            value={data.counts.scans}
            detail="channel scan sets"
          />
          <Metric
            label="Talkgroups"
            value={data.counts.talkgroups}
            detail={`${changes.length} planned changes`}
          />
        </section>

        <Tabs
          value={mainView}
          onValueChange={(value) => setMainView(value as MainView)}
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <TabsList
              variant="line"
              className="max-w-full flex-wrap justify-start gap-y-2 pb-1 group-data-horizontal/tabs:h-auto [&>[data-slot=tabs-trigger]]:h-8 [&>[data-slot=tabs-trigger]]:flex-none"
            >
              <TabsTrigger value="channels">Zones &amp; channels</TabsTrigger>
              <TabsTrigger value="scans">Scan lists</TabsTrigger>
              <TabsTrigger value="talkgroups">DMR talkgroups</TabsTrigger>
              <TabsTrigger value="gps">
                GPS roaming ({data.gpsRoaming.length})
              </TabsTrigger>
              <TabsTrigger value="changes">
                Changes ({changes.length})
              </TabsTrigger>
              <TabsTrigger value="tables">
                CSV tables ({data.tables?.length ?? 0})
              </TabsTrigger>
            </TabsList>
            {sourceName && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <ScanLine
                  className="size-4 text-[var(--signal-green)]"
                  aria-hidden="true"
                />
                PF1 short: {data.controls.pf1Short}
                <span aria-hidden="true">·</span>
                <BatteryMedium
                  className="size-4 text-[var(--signal-amber)]"
                  aria-hidden="true"
                />
                long: {data.controls.pf1Long}
              </div>
            )}
          </div>

          <TabsContent value="channels" className="mt-4">
            {!data.channels.length ? (
              <Card>
                <CardHeader>
                  <CardTitle>No channels loaded</CardTitle>
                  <CardDescription>
                    Load Channel.CSV to explore channels. Other imported files
                    are available in CSV tables.
                  </CardDescription>
                </CardHeader>
              </Card>
            ) : (
              <div className="grid items-start gap-4 lg:grid-cols-[250px_minmax(0,1fr)]">
                <Card className="lg:sticky lg:top-20">
                  <CardHeader>
                    <CardTitle>Zones</CardTitle>
                    <CardDescription>
                      Select the group shown on the radio.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="relative">
                      <Search
                        className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                        aria-hidden="true"
                      />
                      <Input
                        aria-label="Filter zones"
                        value={zoneSearch}
                        onChange={(event) => setZoneSearch(event.target.value)}
                        placeholder="Filter zones"
                        className="pl-8"
                      />
                    </div>
                    <div className="max-h-[60vh] space-y-1 overflow-y-auto pr-1">
                      {filteredZones.map((candidate) => (
                        <Button
                          key={candidate.name}
                          variant={
                            candidate.name === zone?.name
                              ? 'secondary'
                              : 'ghost'
                          }
                          className="h-auto w-full justify-between py-2 text-left"
                          onClick={() => selectZone(candidate.name)}
                        >
                          <span className="min-w-0 truncate">
                            {candidate.name}
                          </span>
                          <span className="font-mono text-xs text-muted-foreground">
                            {candidate.members.length}
                          </span>
                        </Button>
                      ))}
                      {!data.zones.length && (
                        <p className="text-sm text-muted-foreground">
                          No zones loaded. Showing all channels.
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>

                <div className="min-w-0 space-y-4">
                  {selectedChannel && (
                    <ScanPathCard
                      zoneName={zone?.name ?? 'All channels'}
                      hasZone={Boolean(zone)}
                      channel={selectedChannel}
                      scan={selectedScan}
                      changeScope={changeScope}
                      setChangeScope={setChangeScope}
                      changeDraft={changeDraft}
                      setChangeDraft={setChangeDraft}
                      addChange={addChange}
                    />
                  )}

                  <Card>
                    <CardHeader>
                      <CardTitle>
                        {channelView === 'zone'
                          ? (zone?.name ?? 'All channels')
                          : selectedScan?.name}
                      </CardTitle>
                      <CardDescription>
                        {channelView === 'zone'
                          ? `${zone?.members.length ?? data.channels.length} programmed channels`
                          : `${selectedScan?.members.length ?? 0} channels in the scan list attached to ${selectedChannel?.name}`}
                      </CardDescription>
                      <CardAction>
                        <div className="flex rounded-lg bg-muted p-0.5">
                          <Button
                            size="sm"
                            variant={
                              channelView === 'zone' ? 'default' : 'ghost'
                            }
                            onClick={() => setChannelView('zone')}
                          >
                            Zone
                          </Button>
                          <Button
                            size="sm"
                            variant={
                              channelView === 'scan' ? 'default' : 'ghost'
                            }
                            disabled={!selectedScan}
                            onClick={() => setChannelView('scan')}
                          >
                            Scan set
                          </Button>
                        </div>
                      </CardAction>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_150px]">
                        <div className="relative">
                          <Search
                            className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                            aria-hidden="true"
                          />
                          <Input
                            aria-label="Filter channels"
                            value={channelSearch}
                            onChange={(event) =>
                              setChannelSearch(event.target.value)
                            }
                            placeholder="Name, city, frequency, TG…"
                            className="pl-8"
                          />
                        </div>
                        <NativeSelect
                          aria-label="Filter channel mode"
                          value={modeFilter}
                          onChange={(event) =>
                            setModeFilter(
                              event.target.value as typeof modeFilter,
                            )
                          }
                          className="w-full"
                        >
                          <NativeSelectOption value="All">
                            All modes
                          </NativeSelectOption>
                          <NativeSelectOption value="Analog">
                            Analog
                          </NativeSelectOption>
                          <NativeSelectOption value="DMR">
                            DMR
                          </NativeSelectOption>
                        </NativeSelect>
                      </div>

                      <ChannelTable
                        channels={visibleChannels}
                        selected={selectedChannel?.name ?? ''}
                        onSelect={setChannelName}
                      />
                      <p
                        className="text-xs text-muted-foreground"
                        aria-live="polite"
                      >
                        {visibleChannels.length} of{' '}
                        {channelView === 'zone'
                          ? (zone?.members.length ?? data.channels.length)
                          : (selectedScan?.members.length ?? 0)}{' '}
                        shown
                      </p>
                    </CardContent>
                  </Card>
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="scans" className="mt-4">
            <ScanListTable
              scans={data.scans}
              onOpen={(scan) => openChannel(scan.members[0], 'scan')}
            />
          </TabsContent>

          <TabsContent value="talkgroups" className="mt-4">
            <TalkgroupTable
              talkgroups={data.talkgroups}
              channels={data.channels}
              onOpen={(channel) => openChannel(channel.name)}
            />
          </TabsContent>

          <TabsContent value="gps" className="mt-4">
            <GpsRoamingTable entries={data.gpsRoaming} />
          </TabsContent>
          <TabsContent value="tables" className="mt-4">
            <CsvTableExplorer key={loadVersion} tables={data.tables ?? []} />
          </TabsContent>

          <TabsContent value="changes" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Planned changes</CardTitle>
                <CardDescription>
                  Saved only in this browser until you export or clear them.
                </CardDescription>
                <CardAction>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={!changes.length}
                      onClick={copyChanges}
                    >
                      <Copy data-icon="inline-start" /> Copy
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={!changes.length}
                      onClick={downloadChanges}
                    >
                      <Download data-icon="inline-start" /> Download
                    </Button>
                  </div>
                </CardAction>
              </CardHeader>
              <CardContent>
                {changes.length ? (
                  <div className="space-y-2">
                    {changes.map((change) => (
                      <div
                        key={change.id}
                        className="flex items-start justify-between gap-3 rounded-lg border bg-muted/25 p-3"
                      >
                        <div className="min-w-0">
                          <div className="mb-1 flex flex-wrap gap-1.5">
                            <Badge variant="outline">{change.scope}</Badge>
                            {change.zone ? (
                              <Badge variant="secondary">{change.zone}</Badge>
                            ) : null}
                            {change.channel ? (
                              <Badge variant="secondary">
                                {change.channel}
                              </Badge>
                            ) : null}
                          </div>
                          <p className="whitespace-pre-wrap text-sm">
                            {change.note}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="Remove change"
                          onClick={() => removeChange(change.id)}
                        >
                          <Trash2 aria-hidden="true" />
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="grid min-h-48 place-items-center text-center">
                    <div>
                      <Plus
                        className="mx-auto mb-2 size-6 text-muted-foreground"
                        aria-hidden="true"
                      />
                      <p className="font-medium">No changes recorded yet</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Select a channel and add a note from its scan card.
                      </p>
                    </div>
                  </div>
                )}
                <p
                  className="mt-3 text-sm text-muted-foreground"
                  aria-live="polite"
                >
                  {copyStatus}
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
      <AppFooter />
    </div>
  );
}

function GpsRoamingTable({ entries }: { entries: GpsRoamingEntry[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>GPS zone switching</CardTitle>
        <CardDescription>
          Active geofences from GPSRoaming.CSV. Entering a circle selects its
          normal zone; this is separate from DMR repeater roaming.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-start gap-2 rounded-lg bg-[var(--signal-amber-soft)] px-3 py-2 text-sm text-[var(--signal-amber-foreground)]">
          <AlertTriangle
            className="mt-0.5 size-4 shrink-0"
            aria-hidden="true"
          />
          <span>
            GPSRoaming.CSV stores the circles, but it does not prove that the
            radio-wide GPS and GPS Roaming switches are on. Confirm those under
            Optional Setting → GPS/Ranging in CPS.
          </span>
        </div>
        {entries.length ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Entry</TableHead>
                <TableHead>Destination zone</TableHead>
                <TableHead>Center</TableHead>
                <TableHead>Radius</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((entry) => (
                <TableRow key={entry.number}>
                  <TableCell className="font-mono">#{entry.number}</TableCell>
                  <TableCell>
                    <span className="font-medium">{entry.zoneName}</span>
                    <span className="ml-2 text-xs text-muted-foreground">
                      Zone.CSV #{entry.zoneNumber}
                    </span>
                  </TableCell>
                  <TableCell className="font-mono text-xs tabular-nums">
                    {entry.latitude.toFixed(5)}, {entry.longitude.toFixed(5)}
                  </TableCell>
                  <TableCell className="font-mono text-xs tabular-nums">
                    {(entry.radiusMeters / 1000).toFixed(0)} km ·{' '}
                    {(entry.radiusMeters / 1609.344).toFixed(0)} mi
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="grid min-h-48 place-items-center text-center">
            <div>
              <MapPinned
                className="mx-auto mb-2 size-6 text-muted-foreground"
                aria-hidden="true"
              />
              <p className="font-medium">No GPS roaming table loaded</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Select GPSRoaming.CSV with the other CPS CSV files to inspect
                automatic zone switching.
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Metric({
  label,
  value,
  detail,
}: {
  label: string;
  value: number;
  detail: string;
}) {
  return (
    <Card size="sm" className="relative overflow-hidden">
      <div className="absolute inset-y-0 left-0 w-1 bg-primary" />
      <CardContent>
        <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
          {label}
        </p>
        <p className="mt-1 font-mono text-2xl font-semibold tabular-nums">
          {value}
        </p>
        <p className="text-xs text-muted-foreground">{detail}</p>
      </CardContent>
    </Card>
  );
}

function ScanPathCard({
  zoneName,
  hasZone,
  channel,
  scan,
  changeScope,
  setChangeScope,
  changeDraft,
  setChangeDraft,
  addChange,
}: {
  zoneName: string;
  hasZone: boolean;
  channel: Channel;
  scan?: ScanList;
  changeScope: ChangeScope;
  setChangeScope: (scope: ChangeScope) => void;
  changeDraft: string;
  setChangeDraft: (draft: string) => void;
  addChange: () => void;
}) {
  return (
    <Card className="overflow-visible border-l-4 border-l-primary">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ScanLine className="size-4 text-primary" aria-hidden="true" />{' '}
          Channel scan path
        </CardTitle>
        <CardDescription>
          {zoneName} · channel #{channel.number}
        </CardDescription>
        <CardAction>
          <Badge variant={channel.mode === 'DMR' ? 'secondary' : 'outline'}>
            {channel.mode}
          </Badge>
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid items-center gap-2 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto_minmax(0,1fr)]">
          <PathNode label="Current channel" value={channel.name} />
          <ChevronRight
            className="hidden size-4 text-muted-foreground sm:block"
            aria-hidden="true"
          />
          <PathNode
            label="Attached scan list"
            value={scan?.name || 'No scan list'}
          />
          <ChevronRight
            className="hidden size-4 text-muted-foreground sm:block"
            aria-hidden="true"
          />
          <PathNode
            label="Result"
            value={
              scan
                ? `${scan.members.length} channels`
                : 'No scan members loaded'
            }
          />
        </div>

        {scan ? (
          <div className="flex flex-wrap gap-1.5">
            {scan.members.map((member) => (
              <Badge key={member} variant="secondary" className="font-mono">
                {member}
              </Badge>
            ))}
          </div>
        ) : (
          <div className="flex items-center gap-2 rounded-lg bg-[var(--signal-amber-soft)] px-3 py-2 text-sm text-[var(--signal-amber-foreground)]">
            <AlertTriangle className="size-4 shrink-0" aria-hidden="true" />
            This channel has no loaded scan list. Check its assignment in CPS,
            or include ScanList.CSV with your import.
          </div>
        )}

        <div className="grid gap-3 border-t pt-4 sm:grid-cols-2 xl:grid-cols-4">
          <Detail
            label="RX / TX MHz"
            value={`${channel.rx} / ${channel.tx}`}
            mono
          />
          <Detail label="Access" value={accessFor(channel)} />
          <Detail label="Destination" value={destinationFor(channel)} />
          <Detail
            label="Location"
            value={placeFor(channel)}
            icon={<MapPinned className="size-3.5" aria-hidden="true" />}
          />
        </div>
        {channel.notes ? (
          <p className="text-xs text-muted-foreground">{channel.notes}</p>
        ) : null}

        <div className="grid gap-2 border-t pt-4 md:grid-cols-[140px_minmax(0,1fr)_auto]">
          <NativeSelect
            aria-label="Change scope"
            value={changeScope}
            onChange={(event) =>
              setChangeScope(event.target.value as ChangeScope)
            }
            className="w-full"
          >
            <NativeSelectOption value="channel">
              This channel
            </NativeSelectOption>
            <NativeSelectOption value="zone" disabled={!hasZone}>
              This zone
            </NativeSelectOption>
            <NativeSelectOption value="codeplug">
              Whole codeplug
            </NativeSelectOption>
          </NativeSelect>
          <Textarea
            aria-label="Describe the change"
            value={changeDraft}
            onChange={(event) => setChangeDraft(event.target.value)}
            placeholder="What felt wrong when you used it?"
            className="min-h-8"
          />
          <Button disabled={!changeDraft.trim()} onClick={addChange}>
            <Plus data-icon="inline-start" /> Add change
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function PathNode({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-lg bg-muted/60 px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="truncate font-medium">{value}</p>
    </div>
  );
}

function Detail({
  label,
  value,
  mono,
  icon,
}: {
  label: string;
  value: string;
  mono?: boolean;
  icon?: React.ReactNode;
}) {
  return (
    <div className="min-w-0">
      <p className="flex items-center gap-1 text-xs text-muted-foreground">
        {icon}
        {label}
      </p>
      <p
        className={
          mono ? 'truncate font-mono text-sm tabular-nums' : 'truncate text-sm'
        }
      >
        {value}
      </p>
    </div>
  );
}

function ChannelTable({
  channels,
  selected,
  onSelect,
}: {
  channels: Channel[];
  selected: string;
  onSelect: (name: string) => void;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Channel</TableHead>
          <TableHead>Mode</TableHead>
          <TableHead>Location</TableHead>
          <TableHead>RX / TX MHz</TableHead>
          <TableHead>Access</TableHead>
          <TableHead>Destination</TableHead>
          <TableHead>Scan list</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {channels.map((channel) => (
          <TableRow
            key={channel.name}
            data-state={channel.name === selected ? 'selected' : undefined}
            // The whole row is the click target. The row already paints a
            // full-width selected state, so limiting the hit area to the name
            // button made every other column look selectable but do nothing.
            // The button below stays for keyboard and screen-reader users; it
            // re-selects the same channel, which is a no-op.
            onClick={() => onSelect(channel.name)}
            className="cursor-pointer"
          >
            <TableCell>
              <Button
                variant="ghost"
                className="h-auto justify-start px-1 py-1"
                onClick={() => onSelect(channel.name)}
              >
                <span className="text-left">
                  <span className="block font-mono font-medium">
                    {channel.name}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    #{channel.number}
                  </span>
                </span>
              </Button>
            </TableCell>
            <TableCell>
              <Badge variant={channel.mode === 'DMR' ? 'secondary' : 'outline'}>
                {channel.mode}
              </Badge>
              {channel.txProhibit ? (
                <span className="mt-1 block text-xs text-destructive">
                  RX only
                </span>
              ) : null}
            </TableCell>
            <TableCell>{placeFor(channel)}</TableCell>
            <TableCell className="font-mono text-xs tabular-nums">
              {channel.rx}
              <br />
              {channel.tx}
            </TableCell>
            <TableCell>{accessFor(channel)}</TableCell>
            <TableCell>{destinationFor(channel)}</TableCell>
            <TableCell>{channel.scan || '—'}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function ScanListTable({
  scans,
  onOpen,
}: {
  scans: ScanList[];
  onOpen: (scan: ScanList) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Scan lists</CardTitle>
        <CardDescription>
          The actual channel sets used when Scan is assigned to a radio key.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Channels</TableHead>
              <TableHead>Revert</TableHead>
              <TableHead>Timing A / B / dropout / dwell</TableHead>
              <TableHead>Members</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {scans.map((scan) => (
              <TableRow key={scan.name}>
                <TableCell>
                  <Button
                    variant="ghost"
                    className="font-medium"
                    onClick={() => onOpen(scan)}
                  >
                    {scan.name}
                  </Button>
                </TableCell>
                <TableCell className="text-right font-mono">
                  {scan.members.length}
                </TableCell>
                <TableCell>{scan.revert}</TableCell>
                <TableCell className="font-mono text-xs">
                  {scan.lookbackA} / {scan.lookbackB} / {scan.dropout} /{' '}
                  {scan.dwell} s
                </TableCell>
                <TableCell className="max-w-2xl whitespace-normal">
                  <div className="flex flex-wrap gap-1">
                    {scan.members.map((member) => (
                      <Badge
                        key={member}
                        variant="secondary"
                        className="font-mono"
                      >
                        {member}
                      </Badge>
                    ))}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function TalkgroupTable({
  talkgroups,
  channels,
  onOpen,
}: {
  talkgroups: Talkgroup[];
  channels: Channel[];
  onOpen: (channel: Channel) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>DMR talkgroup contacts</CardTitle>
        <CardDescription>
          Contacts are destinations; each programmed channel also chooses a
          repeater, color code, and slot.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Contact</TableHead>
              <TableHead>TG / ID</TableHead>
              <TableHead>Call type</TableHead>
              <TableHead>Programmed channels</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {talkgroups.map((talkgroup) => {
              const matches = channels.filter(
                (channel) =>
                  channel.mode === 'DMR' && channel.contact === talkgroup.name,
              );
              return (
                <TableRow key={`${talkgroup.id}-${talkgroup.name}`}>
                  <TableCell>
                    {matches[0] ? (
                      <Button
                        variant="ghost"
                        className="font-medium"
                        onClick={() => onOpen(matches[0])}
                      >
                        {talkgroup.name}
                      </Button>
                    ) : (
                      talkgroup.name
                    )}
                  </TableCell>
                  <TableCell className="font-mono tabular-nums">
                    {talkgroup.id}
                  </TableCell>
                  <TableCell>{talkgroup.callType}</TableCell>
                  <TableCell className="text-right font-mono">
                    {matches.length}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
