import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Polling avoids Linux inotify ENOSPC failures on machines where another app
// has exhausted the per-user filesystem watcher quota.
export default defineConfig({
  plugins: [react()],
  server: { watch: { usePolling: true, interval: 500 } },
});
