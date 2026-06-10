import fs from 'node:fs'
import path from 'node:path'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Plugin } from 'vite'

const LOG_DIR = path.join(process.cwd(), '.debug')
const LOG_FILE = path.join(LOG_DIR, 'ingest.jsonl')
const CURSOR_DEBUG_LOGS: Record<string, string> = {
  c0312c: path.join(process.cwd(), '.cursor', 'debug-c0312c.log'),
  ce1aed: path.join(process.cwd(), '.cursor', 'debug-ce1aed.log'),
}

function appendCursorDebugLog(sessionId: string, record: Record<string, unknown>) {
  const logFile = CURSOR_DEBUG_LOGS[sessionId]
  if (!logFile) return
  const payload = record.payload
  if (!payload || typeof payload !== 'object') return
  fs.mkdirSync(path.dirname(logFile), { recursive: true })
  fs.appendFileSync(
    logFile,
    `${JSON.stringify({ ...payload, receivedAt: record.receivedAt, clientIp: record.clientIp })}\n`,
  )
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (chunk) => chunks.push(Buffer.from(chunk)))
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

function sendCors(res: ServerResponse, status: number) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Debug-Session-Id')
  res.statusCode = status
  res.end()
}

export function viteDebugIngestPlugin(): Plugin {
  return {
    name: 'sp-debug-ingest',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url?.split('?')[0]
        if (url !== '/api/debug/ingest') return next()

        if (req.method === 'OPTIONS') {
          sendCors(res, 204)
          return
        }

        if (req.method !== 'POST') {
          sendCors(res, 405)
          return
        }

        try {
          const raw = await readBody(req)
          const sessionId = String(req.headers['x-debug-session-id'] ?? 'default')
          const record = {
            receivedAt: new Date().toISOString(),
            sessionId,
            clientIp: req.socket.remoteAddress ?? null,
            payload: raw ? JSON.parse(raw) : null,
          }
          fs.mkdirSync(LOG_DIR, { recursive: true })
          fs.appendFileSync(LOG_FILE, `${JSON.stringify(record)}\n`)
          appendCursorDebugLog(sessionId, record)

          const channel =
            typeof record.payload === 'object' &&
            record.payload &&
            'channel' in record.payload
              ? String((record.payload as { channel: string }).channel)
              : typeof record.payload === 'object' &&
                  record.payload &&
                  'location' in record.payload
                ? String((record.payload as { location: string }).location)
                : 'unknown'
          const message =
            typeof record.payload === 'object' &&
            record.payload &&
            'message' in record.payload
              ? String((record.payload as { message: string }).message)
              : ''
          console.log(`[debug-ingest] ${sessionId} · ${channel} · ${message}`)
        } catch (err) {
          console.warn('[debug-ingest] failed', err)
        }

        sendCors(res, 204)
      })
    },
  }
}
