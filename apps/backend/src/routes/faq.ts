import express, { type Request, type Response, type Router } from 'express';
import { asyncHandler } from '../utils/errors.js';
import { sendSuccess } from '../utils/response.js';
import { getChatAiSettings } from '../services/ai-settings.service.js';

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/faq?market=GEORGIA — the questions and answers the office chose to
// publish (Chat assistant → Questions and answers → "Show on the website").
//
// One source for both: the chat assistant answers from the same entries, so
// the site and the assistant never contradict each other. Public, read-only,
// and holds nothing that was not ticked for publication.
// ─────────────────────────────────────────────────────────────────────────────

const router: Router = express.Router();

router.get(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const market = req.query.market === 'LEBANON' ? 'LEBANON' : 'GEORGIA';
    const { knowledge } = await getChatAiSettings();
    sendSuccess(
      res,
      knowledge
        .filter((k) => k.publish && (k.market === market || k.market === 'ALL'))
        .map((k) => ({ question: k.question, answer: k.answer }))
    );
  })
);

export default router;
