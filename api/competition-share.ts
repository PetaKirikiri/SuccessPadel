import { handleCompetitionPage } from '../server/sharing/competitionPage.js'
import type { IncomingMessage, ServerResponse } from 'node:http'

export default function handler(req: IncomingMessage, res: ServerResponse) {
  return handleCompetitionPage(req, res)
}
