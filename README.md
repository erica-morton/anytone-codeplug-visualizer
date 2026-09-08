# AnyTone Codeplug Visualizer

A local-first browser app for understanding AnyTone CPS table exports. It makes
the relationship between zones, channels, scan lists, and DMR talkgroups
visible before you edit or write a codeplug to a radio.

The bundled data is a small, intentionally synthetic fixture. It is not a real
codeplug and must not be programmed into a radio.

## Run locally

Requires Node.js 24 or newer, the version pinned in `.nvmrc` and used by CI.
With nvm, `nvm use` picks it up.

```bash
npm install
npm run dev
```

Open the local address printed by the development server, normally
<http://localhost:5173>.

For a production build:

```bash
npm run build
npm run preview
```

## Checks

The same checks run on every pull request and before every deploy.

```bash
npm run lint       # oxlint, including type-aware rules
npm run typecheck  # tsc --noEmit
npm test           # lib logic (node --test) and components (vitest)
npm run format     # oxfmt, writes changes
```

`npm run build` additionally refuses to proceed unless the bundled fixture is
the synthetic data described under Privacy.

## Load another codeplug

The app starts empty. A first-launch guide explains the workflow and can be
reopened with **Help**. Choose **Load my CSVs** or **Try demo** to begin.

Use **Load CPS CSVs** and select any files together from an AnyTone CPS
**Export All** directory. These files have dedicated relationship views:

- `Channel.CSV`
- `Zone.CSV`
- `ScanList.CSV`
- `TalkGroups.CSV`
- `RadioIDList.CSV` (optional, used for the display identity)
- `GPSRoaming.CSV` (optional, shows GPS-driven zone geofences)

No particular combination is required. Channel-only imports show all channels
without zones. **CSV tables** preserves every imported file and column, including
`OptionalSetting.csv`, receive groups, and unfamiliar export types. It offers
search, row counts, and pagination; OptionalSetting uses a searchable setting/value
view. Numeric settings remain raw CPS codes, not interpreted radio behavior.
Blank or duplicate headers and uneven row widths are flagged and preserved.
Select one codeplug's files at a time; each load replaces the current import.

The files are parsed in your browser. The app does not upload the codeplug or
send it to a server. Reloading the page discards the imported tables and
returns to an empty workspace. **Unload** also clears the loaded data. The demo
is loaded only when explicitly chosen.

## Record changes

Select a channel, choose whether the note applies to that channel, its zone, or
the whole codeplug, and add the change. Notes are stored in that browser's local
storage. The **Changes** tab can copy or download a Markdown handoff suitable
for a codeplug-editing session.

## Privacy

Do not commit personal CPS exports or generated codeplugs. The repository
ignores all CSV files, `.LST`, and `.rdt` files. The
production build also refuses to proceed unless the bundled data is the
synthetic `DEMO / 0000000` fixture and every channel is marked synthetic.

If you want a JSON copy for local development, write it beneath the ignored
`local-data/` directory:

```bash
python3 scripts/build_sample.py \
  --bundle "/path/to/AnyTone/CPS/export" \
  --output local-data/codeplug.json
```

The application itself should normally load personal exports through **Load
CPS CSVs**, keeping the data browser-only.

## Current scope

- Reads CPS CSV table exports; it does not read `.rdt` or `.LST` files directly.
- Visualizes which scan list is attached to the currently selected channel.
- Resolves active `GPSRoaming.CSV` entries back to their destination zones
  and displays each center and radius.
- Does not write to a radio or mutate imported files.
- Change notes are planning artifacts, not automatic CPS edits.

## License

MIT
