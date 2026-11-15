// Supabase Edge Function: coach-ai
// "Ask AI" for the coach: suggestions based on a short summary of her clients' data.
// Only the signed-in coach can use it, so nobody else can run up the AI bill.
// The app sends first names and training data only: no emails, phone numbers or health answers.
//
// Secret needed (Supabase > Edge Functions > Secrets): ANTHROPIC_API_KEY

import { createClient } from "jsr:@supabase/supabase-js@2";

const MODEL = "claude-sonnet-5-5"; // swap for "claude-haiku-5-5" to cut cost further
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SYSTEM = `You are an assistant to a qualified personal trainer in South Africa. She coaches a small group of clients through her app.
Give practical, specific suggestions she can act on today, based only on the data provided. Be concise: short paragraphs or dashes, no tables, no emojis.
Use South African English spelling. Use the clients' first names.
Safety first: never diagnose. If the data mentions pain, injury, illness, pregnancy or a flagged health check, suggest gentler options and that the client checks with a doctor or physio.
When suggesting workouts, use sets, reps and rest, match the client's equipment, and progress gradually (about 5-10% load, or 1-2 reps, a week).
When drafting messages, write them in a warm, encouraging coach's voice the trainer can send as-is.
If the data doesn't support an answer, say what's missing instead of guessing.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    });
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return json({ error: "Please sign in." }, 401);
    const { data: me } = await sb.from("profiles").select("role").eq("id", user.id).single();
    if (me?.role !== "trainer") return json({ error: "Only the coach can use Ask AI." }, 403);

    const { question, context } = await req.json();
    if (typeof question !== "string" || !question.trim() || question.length > 1000) return json({ error: "Ask a question (up to 1000 characters)." }, 400);
    if (typeof context !== "string" || context.length > 30000) return json({ error: "Too much data in one go." }, 400);

    const key = Deno.env.get("ANTHROPIC_API_KEY");
    if (!key) return json({ error: "AI key not set up yet." }, 500);

    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1200,
        system: SYSTEM,
        messages: [{ role: "user", content: `Client data from the app:\n${context}\n\nCoach's question: ${question}` }],
      }),
    });
    if (!r.ok) return json({ error: "AI service error", detail: await r.text() }, 502);
    const data = await r.json();
    const text = (data?.content ?? []).filter((b: { type: string }) => b.type === "text").map((b: { text: string }) => b.text).join("\n").trim();
    return json({ text });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, "content-type": "application/json" } });
}
