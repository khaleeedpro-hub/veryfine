import { Router, Request, Response } from 'express';
import { generateSupportResponse } from '../services/aiService';

const router = Router();

// POST /api/ai/chat
router.post('/chat', async (req: Request, res: Response) => {
  try {
    const { message, history } = req.body;

    if (!message || typeof message !== 'string') {
      res.status(400).json({ error: 'Message text is required.' });
      return;
    }

    const reply = await generateSupportResponse(message, history || []);
    res.json({ reply });
  } catch (err) {
    console.error('AI Chat Error:', err);
    res.status(500).json({ error: 'AI Assistant temporary processing error.' });
  }
});

export default router;
