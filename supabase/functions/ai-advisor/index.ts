import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY") ?? "";
const GEMINI_MODEL = Deno.env.get("GEMINI_MODEL") ?? "gemini-2.5-flash";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const MAX_HISTORY = 18;
const MAX_OUTPUT_TOKENS = 4096;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "No autorizado" }, 401);

    const token = authHeader.replace("Bearer ", "");
    const sb = createClient(SUPABASE_URL, SUPABASE_KEY);
    const { data: { user }, error: authErr } = await sb.auth.getUser(token);
    if (authErr || !user) return json({ error: "Token inválido o expirado" }, 401);

    const { message, history = [] } = await req.json();
    if (!message || typeof message !== "string" || !message.trim()) {
      return json({ error: "El mensaje no puede estar vacío" }, 400);
    }

    const ctx = await buildContext(sb, user.id);
    const limited: Content[] = (Array.isArray(history) ? history.slice(-MAX_HISTORY) : [])
      .filter((item: { role?: string; content?: string }) => item.role && item.content)
      .map((item: { role: string; content: string }) => ({
        role: item.role === "assistant" ? "model" : "user",
        parts: [{ text: String(item.content) }],
      }));
    const contents: Content[] = [
      ...limited,
      { role: "user", parts: [{ text: message.trim() }] },
    ];

    const first = await generate(contents, buildSystemPrompt(ctx));
    let reply = first.text;
    let finishReason = first.finishReason;
    let continued = false;

    if (finishReason === "MAX_TOKENS" && reply) {
      const next = await generate([
        ...contents,
        { role: "model", parts: [{ text: reply }] },
        {
          role: "user",
          parts: [{
            text: "Continuá exactamente desde donde se cortó. No repitas lo ya escrito y cerrá la respuesta de forma completa.",
          }],
        },
      ], buildSystemPrompt(ctx));
      reply = [reply, next.text].filter(Boolean).join("\n");
      finishReason = next.finishReason;
      continued = true;
    }

    if (!reply) {
      console.error("[ai-advisor] Respuesta vacía de Gemini:", finishReason);
      return json({ error: "La IA no pudo generar una respuesta. Intentá de nuevo." }, 502);
    }

    const truncated = finishReason === "MAX_TOKENS";
    return json({ reply: reply.trim(), model: GEMINI_MODEL, finishReason, continued, truncated });
  } catch (err) {
    console.error("[ai-advisor] Error interno:", err);
    return json({ error: "Error interno del servidor" }, 500);
  }
});

type Content = {
  role: "user" | "model";
  parts: Array<{ text: string }>;
};

async function generate(contents: Content[], systemPrompt: string) {
  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: systemPrompt }] },
      contents,
      generationConfig: {
        maxOutputTokens: MAX_OUTPUT_TOKENS,
        temperature: 0.7,
      },
    }),
  });

  if (!response.ok) {
    console.error("[ai-advisor] Gemini error:", response.status, await response.text());
    throw new Error("Error al conectar con la IA");
  }

  const data = await response.json();
  const candidate = data?.candidates?.[0];
  const text = (candidate?.content?.parts ?? [])
    .map((part: { text?: string }) => part.text ?? "")
    .join("")
    .trim();
  return {
    text,
    finishReason: candidate?.finishReason ?? data?.promptFeedback?.blockReason ?? "UNKNOWN",
  };
}

function json(body: object, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

async function buildContext(sb: any, userId: string): Promise<string> {
  try {
    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();
    const pad = (value: number) => String(value).padStart(2, "0");
    const from = `${year}-${pad(month)}-01`;
    const to = month === 12 ? `${year + 1}-01-01` : `${year}-${pad(month + 1)}-01`;

    const [business, transactions, fixedCosts, leads, products, campaigns] = await Promise.all([
      sb.from("negocios").select("nom,rub,cli,dif,can,prec").eq("user_id", userId).single(),
      sb.from("transacciones").select("tipo,monto").eq("user_id", userId).gte("fecha", from).lt("fecha", to),
      sb.from("gastos_fijos").select("mon").eq("user_id", userId),
      sb.from("leads").select("estado").eq("user_id", userId),
      sb.from("productos").select("id").eq("user_id", userId),
      sb.from("campanas").select("inv,cli,ing").eq("user_id", userId),
    ]);

    const currentBusiness = business.data ?? {};
    const currentTransactions = transactions.data ?? [];
    const currentFixedCosts = fixedCosts.data ?? [];
    const currentLeads = leads.data ?? [];
    const currentProducts = products.data ?? [];
    const currentCampaigns = campaigns.data ?? [];
    const income = currentTransactions
      .filter((item: { tipo: string }) => item.tipo === "ingreso")
      .reduce((total: number, item: { monto: number }) => total + item.monto, 0);
    const expenses = currentTransactions
      .filter((item: { tipo: string }) => item.tipo === "egreso")
      .reduce((total: number, item: { monto: number }) => total + item.monto, 0);
    const totalFixedCosts = currentFixedCosts
      .reduce((total: number, item: { mon: number }) => total + item.mon, 0);

    return [
      `NEGOCIO: ${currentBusiness.nom ?? "Sin nombre"} | Rubro: ${currentBusiness.rub ?? "?"} | Cliente objetivo: ${currentBusiness.cli ?? "?"} | Diferenciador: ${currentBusiness.dif ?? "?"} | Canales: ${currentBusiness.can ?? "?"} | Precio promedio: $${currentBusiness.prec ?? 0}`,
      `FINANZAS (${month}/${year}): Ingresos $${income} | Egresos $${expenses} | Ganancia $${income - expenses} | Gastos fijos mensuales $${totalFixedCosts}`,
      `PIPELINE: ${currentLeads.length} leads (${currentLeads.filter((item: { estado: string }) => item.estado === "cliente").length} clientes)`,
      `PRODUCTOS: ${currentProducts.length} en catálogo | CAMPAÑAS: ${currentCampaigns.length} registradas`,
    ].join("\n");
  } catch (err) {
    console.warn("[ai-advisor] No se pudo construir contexto:", err);
    return "No hay datos cargados en Kairós todavía.";
  }
}

function buildSystemPrompt(ctx: string): string {
  return `Eres un asesor de negocios experto, directo y práctico. Responde en español neutro latinoamericano, sin voseo, modismos ni regionalismos. Usa un tono claro, profesional y cercano. No inventes datos. Si faltan datos cargados en Kairós, indícalo claramente.

Prioriza la comodidad de lectura:
- Responde preguntas simples en 1 a 3 oraciones.
- Por defecto, usa entre 120 y 250 palabras, párrafos cortos y hasta 6 viñetas.
- Amplía la respuesta sólo cuando el usuario pida expresamente una guía, análisis detallado o más profundidad.
- Si el tema es amplio, entrega primero lo esencial y ofrece ampliar un punto específico.
- Termina las ideas y conclusiones; nunca cortes una oración ni agregues marcadores de cierre artificiales.

Tu objetivo es ayudar al usuario a tomar mejores decisiones sobre ventas, costos, finanzas, productos, publicidad, organización y crecimiento del negocio.

Contexto actual del negocio del usuario:
${ctx}`;
}
