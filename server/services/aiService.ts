import { GoogleGenAI } from '@google/genai';

export async function generateSupportResponse(userMessage: string, conversationHistory: { role: string; text: string }[] = []): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return "Thank you for reaching out! I am the AuraInvest AI Support Assistant. System guidance: Our platform provides structured USD reward plans (VIP 1-4), secure internal wallet transfers (up to $50/day limit), deposit methods (min $20, max $10,000), and 4-digit PIN protected withdrawals. How can I assist you today?";
  }

  try {
    const ai = new GoogleGenAI({ apiKey });

    const systemInstruction = `You are AuraInvest's official AI Financial & Platform Support Assistant.
AuraInvest is a regulated USD capital investment and rewards platform.

Key Knowledge Base & Platform Rules:
1. VIP Investment Plans:
   - VIP 1: $20 investment, $1.00 daily earning rate, 120 days duration.
   - VIP 2: $50 investment, $2.50 daily earning rate, 120 days duration.
   - VIP 3: $100 investment, $5.00 daily earning rate, 120 days duration.
   - VIP 4: $200 investment, $10.00 daily earning rate, 120 days duration.
   - VIP 5 & VIP 6: High-tier plans currently listed as "Coming Soon" (configurable by administration).

2. Financial Controls & Limits:
   - Deposit Limits: Minimum $20, Maximum $10,000 per transaction.
   - Internal Transfers: Users can transfer funds to other registered users using their unique Wallet Address (e.g. WALLET-XXXXXXXX).
     - Daily transfer limit: Maximum $50 per day total.
     - Daily transfer count: Maximum 2 transfers per day.
   - Withdrawals: Require a 4-digit Withdrawal PIN. If a user resets their PIN, a security cooldown is applied before withdrawals are permitted.
   - Compliance & Risk: Risk disclosures must be transparent. Returns depend on plan duration and active status. Investment returns are subject to platform terms and risk factors.

3. Role:
   - Provide clear, professional, empathetic, and concise responses.
   - Help users navigate deposits, withdrawals, internal transfers, VIP investments, security PINs, and account settings.
   - Never guarantee unverified returns or encourage reckless financial behavior. Always include transparent risk awareness when asked about earnings.`;

    const contents = conversationHistory.map(item => ({
      role: item.role === 'user' ? 'user' : 'model',
      parts: [{ text: item.text }]
    }));

    contents.push({
      role: 'user',
      parts: [{ text: userMessage }]
    });

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents,
      config: {
        systemInstruction,
        temperature: 0.7,
        maxOutputTokens: 600,
      }
    });

    return response.text || "I'm here to assist with your AuraInvest questions. Please let me know how I can help!";
  } catch (err: any) {
    console.error('Gemini AI support error:', err);
    return "I am experiencing a brief communication delay. To answer your query: AuraInvest supports deposits from $20 to $10,000, 4-digit PIN protected withdrawals, and internal transfers up to $50/day. Please try rephrasing your question or check our Help topics!";
  }
}
