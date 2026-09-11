import { handleFeedback } from '../server/coaching/feedback.mjs'
export default function handler(req,res) { return handleFeedback(req,res) }
