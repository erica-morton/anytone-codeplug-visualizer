# AnyTone Codeplug Visualizer

A local-first browser app for understanding AnyTone CPS table exports. It makes
the relationship between zones, channels, scan lists, and DMR talkgroups
visible before you edit or write a codeplug to a radio.

The bundled data is a small, intentionally synthetic fixture. It is not a real
codeplug and must not be programmed into a radio.

## Run locally

Requires Node.js 22.13 or newer.

```bash
npm install
npm run dev
```

Open the local address printed by the development server, normally
<http://localhost:3000>.

For a production build:

```bash
npm run build
npm start
```

## Load another codeplug

Use **Load CPS CSVs** and select these files together from an AnyTone CPS
**Export All** directory:

- `Channel.CSV`
- `Zone.CSV`
- `ScanList.CSV`
- `TalkGroups.CSV`
- `RadioIDList.CSV` (optional, used for the display identity)

The files are parsed in your browser. The app does not upload the codeplug or
send it to a server. Reloading the page discards the imported tables and
restores the synthetic demo.

## Record changes

Select a channel, choose whether the note applies to that channel, its zone, or
the whole codeplug, and add the change. Notes are stored in that browser's local
storage. The **Changes** tab can copy or download a Markdown handoff suitable
for a codeplug-editing session.

## Privacy

Do not commit personal CPS exports or generated codeplugs. The repository
ignores the standard CPS export filenames, `.LST`, and `.rdt` files. The
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
- Does not write to a radio or mutate imported files.
- Change notes are planning artifacts, not automatic CPS edits.

## License

MIT
