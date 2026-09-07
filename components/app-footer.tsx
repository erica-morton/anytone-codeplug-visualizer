const repoUrl = 'https://github.com/erica-morton/anytone-codeplug-visualizer';
const linkClass = 'underline underline-offset-4 hover:text-foreground';

export function AppFooter() {
  return (
    <footer className="mt-auto border-t px-4 py-6 text-xs text-muted-foreground sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-[1500px] flex-wrap items-center justify-between gap-x-6 gap-y-3">
        <div className="space-y-2">
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="font-mono">
              v{__APP_VERSION__} · {__GIT_HASH__}
              {__LOCAL_CHANGES__ ? ' (local changes)' : ''}
            </span>
            <a className={linkClass} href={repoUrl}>
              GitHub
            </a>
          </p>
          <p>
            © 2026 Erica Morton. All rights reserved except as granted under the{' '}
            <a className={linkClass} href={`${repoUrl}/blob/main/LICENSE`}>
              MIT License
            </a>
            .
          </p>
        </div>
        <p>
          Made with{' '}
          <span aria-hidden="true">
            ❤️
          </span>{' '}
          <span className="sr-only">love </span>
          by{' '}
          <a className={linkClass} href="https://kj5rmr.com">
            KJ5RMR
          </a>
        </p>
      </div>
    </footer>
  );
}
