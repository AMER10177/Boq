// Vercel serverless function: /api/analyze  (put it at api/analyze.js in the repo)
// Uses the Google Gemini API free tier. The key lives ONLY in Vercel environment
// variables, never in index.html or the repo.
//   GEMINI_API_KEY  (required)  key from Google AI Studio
//   GEMINI_MODEL    (optional)  default gemini-3.5-flash-lite (free tier, reads images and PDFs)
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  const key = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite';
  if (!key) return res.status(500).json({ error: 'GEMINI_API_KEY not set' });
  const { message = '', file, prompt = '' } = req.body || {};
  if (!file || !file.data) return res.status(400).json({ error: 'file required' });
  if (!['application/pdf', 'image/jpeg', 'image/png', 'image/webp'].includes(file.mime)) return res.status(400).json({ error: 'unsupported type' });
  if (file.data.length > 5.5e6) return res.status(413).json({ error: 'file too large' });
  const body = {
    contents: [{ parts: [
      { inline_data: { mime_type: file.mime, data: file.data } },
      { text: String(prompt).slice(0, 4000) + '\n' + String(message).slice(0, 1000) }
    ] }],
    generationConfig: { responseMimeType: 'application/json', maxOutputTokens: 4000 }
  };
  let r;
  try {
    r = await fetch('https://generativelanguage.googleapis.com/v1beta/models/' + encodeURIComponent(model) + ':generateContent', {
      method: 'POST',
      headers: { 'x-goog-api-key': key, 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
  } catch (e) { return res.status(502).json({ error: 'network error' }); }
  if (r.status === 429) return res.status(429).json({ error: 'free limit reached, try later' });
  if (!r.ok) return res.status(502).json({ error: 'AI provider error ' + r.status });
  const j = await r.json();
  const text = ((((j.candidates || [])[0] || {}).content || {}).parts || []).map(p => p.text || '').join('');
  const a = text.indexOf('{'), b = text.lastIndexOf('}');
  let data = null; try { data = JSON.parse(text.slice(a, b + 1)); } catch (e) {}
  res.status(200).json({ reply: data ? 'تم التحليل. راجع المعاينة ثم اضغط تطبيق.' : text.slice(0, 1500), data });
}
