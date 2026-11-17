/**
 * Provider-agnostic LLM client (plain fetch, no SDKs).
 * Set ONE of: GROQ_API_KEY, OPENAI_API_KEY, ANTHROPIC_API_KEY, GEMINI_API_KEY
 * Optional: AI_PROVIDER (force one), AI_MODEL (override the default model).
 */

const DEFAULT_MODELS = {
  groq: 'llama-3.3-70b-versatile',
  openai: 'gpt-4o-mini',
  anthropic: 'claude-haiku-5-5',
  gemini: 'gemini-2.0-flash',
};

export function llmConfig() {
  const env = process.env;
  const keys = {
    groq: env.GROQ_API_KEY,
    openai: env.OPENAI_API_KEY,
    anthropic: env.ANTHROPIC_API_KEY,
    gemini: env.GEMINI_API_KEY,
  };
  let provider = env.AI_PROVIDER && keys[env.AI_PROVIDER] ? env.AI_PROVIDER : null;
  if (!provider) provider = ['groq', 'anthropic', 'openai', 'gemini'].find((p) => keys[p]) || null;
  if (!provider) return { live: false, provider: null, model: null };
  return { live: true, provider, model: env.AI_MODEL || DEFAULT_MODELS[provider], key: keys[provider] };
}

export const llmStatus = () => {
  const c = llmConfig();
  return { live: c.live, provider: c.provider, model: c.model };
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function post(url, headers, body, attempt = 0) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 30000);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    if ((res.status === 429 || res.status >= 500) && attempt < 2) {
      const wait = Number(res.headers.get('retry-after')) * 1000 || 1500 * (attempt + 1);
      await sleep(Math.min(wait, 6000));
      return post(url, headers, body, attempt + 1);
    }
    const text = await res.text();
    if (!res.ok) throw new Error(`LLM ${res.status}: ${text.slice(0, 200)}`);
    return JSON.parse(text);
  } finally {
    clearTimeout(timer);
  }
}

async function raw({ system, user, json, maxTokens, temperature }) {
  const c = llmConfig();
  if (!c.live) throw new Error('No LLM key configured');
  if (c.provider === 'groq' || c.provider === 'openai') {
    const base = c.provider === 'groq' ? 'https://api.groq.com/openai/v1' : 'https://api.openai.com/v1';
    const data = await post(`${base}/chat/completions`, { authorization: `Bearer ${c.key}` }, {
      model: c.model,
      temperature,
      max_tokens: maxTokens,
      ...(json ? { response_format: { type: 'json_object' } } : {}),
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    });
    return data.choices?.[0]?.message?.content ?? '';
  }
  if (c.provider === 'anthropic') {
    const data = await post('https://api.anthropic.com/v1/messages', { 'x-api-key': c.key, 'anthropic-version': '2023-06-01' }, {
      model: c.model,
      max_tokens: maxTokens,
      temperature,
      system,
      messages: [{ role: 'user', content: user }],
    });
    return (data.content || []).map((b) => b.text || '').join('');
  }
  if (c.provider === 'gemini') {
    const data = await post(
      `https://generativelanguage.googleapis.com/v1beta/models/${c.model}:generateContent?key=${c.key}`,
      {},
      {
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: 'user', parts: [{ text: user }] }],
        generationConfig: { temperature, maxOutputTokens: maxTokens, ...(json ? { responseMimeType: 'application/json' } : {}) },
      },
    );
    return (data.candidates?.[0]?.content?.parts || []).map((p) => p.text || '').join('');
  }
  throw new Error('Unknown provider');
}

function extractJSON(text) {
  const t = text.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  try {
    return JSON.parse(t);
  } catch {
    const s = t.indexOf('{');
    const e = t.lastIndexOf('}');
    if (s >= 0 && e > s) return JSON.parse(t.slice(s, e + 1));
    throw new Error('Model did not return JSON');
  }
}

export async function completeJSON({ system, user, maxTokens = 1000, temperature = 0.2 }) {
  const text = await raw({ system: system + '\n\nRespond with a single valid JSON object and nothing else.', user, json: true, maxTokens, temperature });
  return extractJSON(text);
}

export async function completeText({ system, user, maxTokens = 700, temperature = 0.5 }) {
  return (await raw({ system, user, json: false, maxTokens, temperature })).trim();
}
