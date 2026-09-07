import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import '@/app/globals.css';

import { CodeplugExplorer } from '@/components/codeplug-explorer';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <CodeplugExplorer />
  </StrictMode>,
);
