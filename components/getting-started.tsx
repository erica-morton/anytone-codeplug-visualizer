import { useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';

export function GettingStarted({
  open,
  hasData,
  onClose,
  onImport,
  onDemo,
}: {
  open: boolean;
  hasData: boolean;
  onClose: () => void;
  onImport: () => void;
  onDemo: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (open && !ref.current?.open) ref.current?.showModal();
    if (!open && ref.current?.open) ref.current?.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onCancel={onClose}
      onClose={onClose}
      aria-labelledby="guide-title"
      aria-describedby="guide-description"
      className="fixed inset-0 m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-xl overflow-y-auto rounded-xl border bg-card p-6 text-card-foreground shadow-xl backdrop:bg-black/50"
    >
      <h2 id="guide-title" className="text-xl font-semibold">
        Get to know your codeplug
      </h2>
      <p id="guide-description" className="mt-2 text-sm text-muted-foreground">
        Explore AnyTone CPS exports and plan changes before opening CPS.
      </p>
      <ol className="my-6 list-decimal space-y-4 pl-5 text-sm">
        <li>
          <strong>Choose your data.</strong> Export CSV tables from CPS and
          select them together using Load CPS CSVs. A single file works too, or
          try the synthetic demo.
        </li>
        <li>
          <strong>Follow the connections.</strong> Choose a zone and channel to
          inspect frequencies, talkgroups, and its attached scan list. Use the
          other tabs for scan lists and GPS roaming.
        </li>
        <li>
          <strong>Explore every file.</strong> CSV tables preserves all imported
          columns. Search settings in OptionalSetting.csv or browse any other
          export, including unfamiliar tables. Values are shown as exported;
          numeric settings may be CPS codes.
        </li>
        <li>
          <strong>Plan your edits.</strong> Add channel, zone, or codeplug notes
          and export them from Changes as a Markdown handoff. Notes stay in this
          browser until removed.
        </li>
      </ol>
      <p className="mb-5 text-sm text-muted-foreground">
        Files are read locally in your browser. Reloading starts empty again.
        The app does not upload exports, change files, or program your radio.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button
          onClick={() => {
            onClose();
            onImport();
          }}
        >
          Load my CSVs
        </Button>
        <Button
          variant="outline"
          onClick={() => {
            onClose();
            onDemo();
          }}
        >
          Try demo
        </Button>
        <Button variant="ghost" onClick={onClose}>
          {hasData ? 'Close guide' : 'Start empty'}
        </Button>
      </div>
      <p className="mt-4 text-xs text-muted-foreground">
        Reopen this guide anytime with Help.
      </p>
    </dialog>
  );
}
