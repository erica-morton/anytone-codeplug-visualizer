import '@testing-library/jest-dom/vitest';

import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// jsdom does not implement <dialog>. The onboarding guide calls showModal(),
// so without this every test that renders the explorer throws on mount.
if (!HTMLDialogElement.prototype.showModal) {
  HTMLDialogElement.prototype.showModal = function showModal() {
    this.open = true;
  };
  HTMLDialogElement.prototype.show = function show() {
    this.open = true;
  };
  HTMLDialogElement.prototype.close = function close(returnValue?: string) {
    this.open = false;
    if (returnValue !== undefined) this.returnValue = returnValue;
    this.dispatchEvent(new Event('close'));
  };
}

afterEach(() => {
  cleanup();
  // The explorer persists change notes to localStorage, so state would
  // otherwise leak between tests.
  localStorage.clear();
});
