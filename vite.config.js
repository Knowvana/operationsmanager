import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// ============================================================================
// Path Aliases — These are the "import shortcuts" for the entire app.
// Instead of: import Button from '../../../shared/components/Button'
// You write:  import { Button } from '@shared'
//
// WHY: Decouples file location from import paths. If you move a file,
//      only the alias mapping changes — not every import in the codebase.
// ============================================================================
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@core':    path.resolve(__dirname, './src/core'),
      '@modules': path.resolve(__dirname, './src/modules'),
      '@shared':  path.resolve(__dirname, './src/shared'),
      '@config':  path.resolve(__dirname, './src/config'),
    },
  },
});
