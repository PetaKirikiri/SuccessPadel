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
const phoneDev = process.env.VITE_DEV_PHONE === '1'

export default defineConfig({
  plugins: [react(), tailwindcss(), viteDebugIngestPlugin()],
  build: {
    cssTarget: 'chrome61',
  },
  server: {
    host: phoneDev ? true : undefined,
    port: 5173,
    strictPort: true,
    // LAN HMR only for npm run dev:phone — avoids ws://172.x on localhost Mac dev.
    hmr: phoneDev && lan ? { host: lan, port: 5173 } : undefined,
  },
})
