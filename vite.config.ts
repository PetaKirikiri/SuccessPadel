import os from 'node:os'
import postcss from 'postcss'
import { defineConfig, type Plugin } from 'vite'
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

function flattenCssLayers(css: string): string {
  const root = postcss.parse(css)

  root.walkAtRules('layer', (rule) => {
    if (rule.nodes?.length) {
      rule.replaceWith(...rule.nodes)
    } else {
      rule.remove()
    }
  })

  return root.toString()
}

function legacyTvCssPlugin(): Plugin {
  return {
    name: 'success-padel-legacy-tv-css',
    enforce: 'post',
    generateBundle(_, bundle) {
      for (const asset of Object.values(bundle)) {
        if (asset.type !== 'asset' || !asset.fileName.endsWith('.css')) continue
        asset.source = flattenCssLayers(String(asset.source))
      }
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), viteDebugIngestPlugin(), legacyTvCssPlugin()],
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
