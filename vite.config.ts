import os from 'node:os'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { viteDebugIngestPlugin } from './scripts/viteDebugIngestPlugin'

function lanAddress(): string | undefined {
  for (const iface of Object.values(os.networkInterfaces())) {
    if (!iface) continue
    for (const net of iface) {
      if (net.family === 'IPv4' && !net.internal) return net.address
    }
  }
  return undefined
}

const lan = lanAddress()

export default defineConfig({
  plugins: [react(), tailwindcss(), viteDebugIngestPlugin()],
  server: {
    host: true,
    port: 5173,
    strictPort: true,
    hmr: lan ? { host: lan, port: 5173 } : undefined,
  },
})
