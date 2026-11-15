// Supabase Edge Function: coach-cues
// Drafts short coaching cues for an exercise using Claude.
// The trainer reviews and edits them before clients ever see them.
//
// Secret needed (Supabase > Edge Functions > Secrets): ANTHROPIC_API_KEY

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const { name, muscle_group, equipment, instructions } = await req.json();
    if (!name || typeof name !== "string" || name.length > 120) {
      return json({ error: "Exercise name is required." }, 400);
    }

    const key = Deno.env.get("ANTHROPIC_API_KEY");
    if (!key) return json({ error: "AI key not set up yet." }, 500);

    const prompt =
      `You are an experienced, safety-first personal trainer.\n` +
      `Exercise: ${name}\nMuscle group: ${muscle_group ?? "n/a"}\n` +
      `Equipment: ${(equipment ?? []).join(", ") || "bodyweight"}\n` +
      `Trainer notes: ${instructions ?? "none"}\n\n` +
      `Write 5 short form cues a client can read mid-set (max 8 words each), ` +
      `e.g. "Keep your back flat", "Drive through your heels". ` +
      `Cover setup, movement, breathing and one common mistake. ` +
      `Return ONLY a JSON array of strings.`;

    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-5-5",
        max_tokens: 300,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!r.ok) return json({ error: "AI service error", detail: await r.text() }, 502);
    const data = await r.json();
    const text: string = data?.content?.[0]?.text ?? "[]";
    const match = text.match(/\[[\s\S]*\]/);
    const cues = match ? JSON.parse(match[0]) : [];
    return json({ cues: cues.filter((c: unknown) => typeof c === "string").slice(0, 6) });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "content-type": "application/json" },
  });
}
