export const config = { runtime: 'edge' };

function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

function jsonHeaders(origin) {
  return {
    ...corsHeaders(origin),
    'Content-Type': 'application/json',
  };
}

export default async function handler(req) {
  const origin = req.headers.get('origin') || '*';

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders(origin) });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: jsonHeaders(origin),
    });
  }

  try {
    const raw = await req.text();
    const body = raw ? JSON.parse(raw) : {};
    const { messages } = body;

    if (!Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: 'Messages array is required' }), {
        status: 400,
        headers: jsonHeaders(origin),
      });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'Server misconfiguration: missing OPENAI_API_KEY' }), {
        status: 500,
        headers: jsonHeaders(origin),
      });
    }

    const resp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages,
        max_tokens: 500,
      }),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      return new Response(JSON.stringify({ error: 'OpenAI API error', details: errText }), {
        status: resp.status,
        headers: jsonHeaders(origin),
      });
    }

    const data = await resp.json();
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: jsonHeaders(origin),
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Internal server error', message: String(err && err.message || err) }), {
      status: 500,
      headers: jsonHeaders(origin),
    });
  }
}
