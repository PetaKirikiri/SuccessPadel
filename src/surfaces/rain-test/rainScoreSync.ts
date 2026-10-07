import { readRainScores, validRainScore, type RainScore, type RainScores } from './rainScores'

export type OnlineRainScore = {
  game_number: number; court_slot: number; team_a: number | null; team_b: number | null; revision: number
}
type Edit = { score: RainScore; revision: number; token: number }
type Pending = Record<string, Edit>
export type RainSyncView = { scores: RainScores; ready: boolean; status: string; conflicts: string[] }
export type RainScoreRemote = {
  read(): Promise<OnlineRainScore[]>
  save(key: string, edit: Edit): Promise<OnlineRainScore>
}
const rowKey = (row: OnlineRainScore) => `${row.game_number}:rain-court-${row.court_slot}`
const rowScore = (row: OnlineRainScore): RainScore | null => row.team_a == null ? null : ({ teamAPoints: row.team_a, teamBPoints: row.team_b! })

/** Local outbox + versioned server writes. Polling never replaces an unsaved edit. */
export class RainScoreSync {
  private rows: Record<string, OnlineRainScore> = {}
  private pending: Pending = {}
  private conflicts = new Set<string>()
  private legacy: RainScores = {}
  private ready = false
  private running: Promise<void> | null = null
  private token = 0
  private status = 'Connecting to saved scores…'
  private storageError = false
  private stopped = false

  private storage: Pick<Storage, 'getItem' | 'setItem'>
  private key: string
  private remote: RainScoreRemote
  private notify: (view: RainSyncView) => void

  constructor(storage: Pick<Storage, 'getItem' | 'setItem'>, key: string,
    remote: RainScoreRemote, notify: (view: RainSyncView) => void) {
    this.storage = storage
    this.key = key
    this.remote = remote
    this.notify = notify
    try {
      this.legacy = readRainScores(storage.getItem(key))
      const raw = storage.getItem(`${key}:online-v1`)
      if (raw) {
        const saved = JSON.parse(raw)
        if (saved.version !== 1 || !saved.pending || !saved.rows) throw new Error('Invalid saved scores')
        for (const [id, edit] of Object.entries(saved.pending) as [string, Edit][]) {
          if (!/^[1-9]:rain-court-[12]$/.test(id) || !validRainScore(edit.score) || !Number.isInteger(edit.revision) || edit.revision < 0) throw new Error('Invalid pending score')
          this.pending[id] = edit
          this.token = Math.max(this.token, edit.token)
        }
        this.rows = saved.rows
        // Once connected, browser cache is never re-imported as new results.
        this.legacy = {}
      }
    } catch {
      this.storageError = true
      this.status = 'Saved browser data could not be read. Keep this page open; score editing is paused.'
    }
  }

  view(): RainSyncView {
    const scores: RainScores = { ...this.legacy }
    for (const [key, row] of Object.entries(this.rows)) {
      const score = rowScore(row)
      if (score) scores[key] = score
    }
    for (const [key, edit] of Object.entries(this.pending)) scores[key] = edit.score
    return { scores, ready: this.ready && !this.storageError, status: this.status, conflicts: [...this.conflicts] }
  }
  private emit() { this.notify(this.view()) }
  stop() { this.stopped = true }
  private persist() {
    this.storage.setItem(`${this.key}:online-v1`, JSON.stringify({ version: 1, rows: this.rows, pending: this.pending }))
    // The atomic envelope above is authoritative. A legacy-cache quota failure
    // must not turn a durably queued edit into a reported failed save.
    try { this.storage.setItem(this.key, JSON.stringify(this.view().scores)) } catch { /* envelope retained */ }
  }

  edit(key: string, score: RainScore) {
    if (!this.ready || this.storageError || !this.rows[key]) throw new Error('Wait for saved scores to load.')
    if (!validRainScore(score)) throw new Error('Enter whole-number scores between 0 and 99.')
    const previous = this.pending[key]
    this.pending[key] = { score, revision: previous?.revision ?? this.rows[key].revision, token: ++this.token }
    try { this.persist() } catch (error) {
      if (previous) this.pending[key] = previous
      else delete this.pending[key]
      this.status = 'Score not saved: browser storage is unavailable. Keep this page open.'
      this.emit()
      throw error
    }
    this.status = 'Saved on this device · Syncing…'
    this.emit()
    void this.sync()
  }

  resolve(key: string, useLocal: boolean) {
    if (!this.conflicts.has(key)) return
    const previous = this.pending[key]
    if (useLocal) this.pending[key] = { ...previous!, revision: this.rows[key]!.revision, token: ++this.token }
    else delete this.pending[key]
    try {
      // Preserve the discarded local score as a recovery copy.
      this.storage.setItem(`${this.key}:conflict-backup:${key}`, JSON.stringify(previous))
      this.persist()
    } catch (error) { this.pending[key] = previous!; throw error }
    this.conflicts.delete(key)
    this.emit()
    void this.sync()
  }

  sync(): Promise<void> {
    if (this.stopped) return Promise.resolve()
    if (this.running) return this.running
    this.running = this.performSync().finally(() => { this.running = null })
    return this.running
  }
  private async performSync() {
    if (this.storageError) { this.emit(); return }
    try {
      const rows = await this.remote.read()
      if (this.stopped) return
      if (rows.length !== 18 || new Set(rows.map(rowKey)).size !== 18) throw new Error('The saved draw is incomplete.')
      this.rows = Object.fromEntries(rows.map(row => [rowKey(row), row]))
      for (const [key, score] of Object.entries(this.legacy)) {
        const row = this.rows[key]
        if (row && row.team_a == null && !this.pending[key]) this.pending[key] = { score, revision: row.revision, token: ++this.token }
        else if (row && (row.team_a !== score.teamAPoints || row.team_b !== score.teamBPoints) && !this.pending[key]) {
          this.pending[key] = { score, revision: 0, token: ++this.token }
          this.conflicts.add(key)
        }
      }
      this.legacy = {}
      this.persist()
      this.ready = true
      for (;;) {
        const next = Object.entries(this.pending).find(([key]) => !this.conflicts.has(key))
        if (!next) break
        const [key, edit] = next
        try {
          const row = await this.remote.save(key, edit)
          if (this.stopped) return
          this.rows[key] = row
          if (this.pending[key]?.token === edit.token) delete this.pending[key]
          else if (this.pending[key]) this.pending[key].revision = row.revision
          this.persist()
        } catch (error) {
          if ((error as { code?: string }).code !== '40001') throw error
          this.conflicts.add(key)
          const latest = await this.remote.read()
          if (this.stopped) return
          this.rows = Object.fromEntries(latest.map(row => [rowKey(row), row]))
          this.persist()
        }
      }
      this.status = this.conflicts.size ? 'A score changed on another device. Choose which score to keep below.' : 'All scores saved online'
    } catch (error) {
      if (this.stopped) return
      if ((error as { code?: string }).code === 'DRAW_MISMATCH') {
        this.ready = false
        this.status = 'Score editing paused: the online rain draw is inactive or does not match this page. No assignments were changed.'
      } else this.status = this.ready ? 'Connection interrupted · Scores kept on this device; retrying automatically' : 'Cannot connect to saved scores yet · Retrying automatically'
    }
    this.emit()
  }

  onlineScore(key: string) { return rowScore(this.rows[key]!) }
}
