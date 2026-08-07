export const config = {
  runtime: 'edge',
};

const TARGET_BASE = 'https://api.fish.audio';

const OPENAI_VOICES = new Set([
  'alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer',
  'coral', 'sage', 'ash', 'ballad',
]);

const MODEL_MAP = {
  'tts-1': 's2.1-pro-free',
  'tts-1-hd': 's2.1-pro',
  'tts-1-free': 's2.1-pro-free',
};

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400',
};

function resolveOpenAIPath(url) {
  let proxyPath;
  const __path = url.searchParams.get('__path');
  if (__path !== null) {
    proxyPath = '/' + __path.replace(/^\/+/, '');
  } else {
    proxyPath = url.pathname.replace(/^\/api\/fish-audio-openai|^\/fish-audio-api\/openai/, '') || '/';
  }
  if (proxyPath === '/' || proxyPath === '') return '';
  if (!proxyPath.startsWith('/')) proxyPath = '/' + proxyPath;
  return proxyPath;
}

export default async function handler(req) {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: CORS_HEADERS });
  }

  const url = new URL(req.url);
  const path = resolveOpenAIPath(url);
  const auth = req.headers.get('Authorization') || '';

  try {
    if (path === '/v1/audio/speech' || path === '/audio/speech') {
      return await handleTTS(req, auth);
    }
    if (path === '/v1/audio/transcriptions' || path === '/audio/transcriptions') {
      return await handleSTT(req, auth);
    }
    return new Response(
      JSON.stringify({
        error: 'OpenAI 兼容端点不存在，支持: /v1/audio/speech, /v1/audio/transcriptions',
      }),
      { status: 404, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } }
    );
  } catch (error) {
    console.error('Fish Audio OpenAI converter error:', error);
    return new Response(JSON.stringify({ error: `转换失败: ${error.message}` }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
    });
  }
}

async function handleTTS(req, auth) {
  let body;
  try {
    body = await req.json();
  } catch (e) {
    return new Response(JSON.stringify({ error: '请求体必须是 JSON' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
    });
  }

  const { model, input, voice, response_format, speed } = body;

  if (!input) {
    return new Response(JSON.stringify({ error: '缺少 input 参数' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
    });
  }

  const fishModel =
    MODEL_MAP[model] ||
    (model && !model.startsWith('tts-') ? model : 's2.1-pro-free');

  const fishBody = {
    text: input,
    format: response_format || 'mp3',
  };

  if (voice && !OPENAI_VOICES.has(voice)) {
    fishBody.reference_id = voice;
  }

  if (speed !== undefined && speed !== null) {
    fishBody.prosody_speed = speed;
  }

  const response = await fetch(`${TARGET_BASE}/v1/tts`, {
    method: 'POST',
    headers: {
      Authorization: auth,
      'Content-Type': 'application/json',
      model: fishModel,
    },
    body: JSON.stringify(fishBody),
  });

  const responseHeaders = new Headers();
  const contentType = response.headers.get('content-type');
  if (contentType) responseHeaders.set('content-type', contentType);
  Object.entries(CORS_HEADERS).forEach(([k, v]) => responseHeaders.set(k, v));

  if (!response.ok) {
    const errorText = await response.text();
    return new Response(errorText, {
      status: response.status,
      headers: responseHeaders,
    });
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: responseHeaders,
  });
}

async function handleSTT(req, auth) {
  let formData;
  try {
    formData = await req.formData();
  } catch (e) {
    return new Response(JSON.stringify({ error: '请求体必须是 multipart/form-data' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
    });
  }

  const audio = formData.get('file') || formData.get('audio');
  if (!audio) {
    return new Response(JSON.stringify({ error: '缺少 file 参数' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
    });
  }

  const language = formData.get('language');
  const responseFormat = formData.get('response_format') || 'json';

  const fishFormData = new FormData();
  fishFormData.append('audio', audio, audio.name || 'audio.wav');
  if (language) fishFormData.append('language', language);

  const response = await fetch(`${TARGET_BASE}/v1/asr`, {
    method: 'POST',
    headers: { Authorization: auth },
    body: fishFormData,
  });

  if (!response.ok) {
    const errorText = await response.text();
    return new Response(errorText, {
      status: response.status,
      headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
    });
  }

  const data = await response.json();

  if (responseFormat === 'text') {
    return new Response(data.text || '', {
      status: 200,
      headers: { 'Content-Type': 'text/plain; charset=utf-8', ...CORS_HEADERS },
    });
  }

  if (responseFormat === 'verbose_json') {
    return new Response(
      JSON.stringify({
        task: 'transcribe',
        language: data.language_code || null,
        duration: data.duration || 0,
        text: data.text || '',
        segments: data.segments || [],
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json; charset=utf-8', ...CORS_HEADERS },
      }
    );
  }

  return new Response(JSON.stringify({ text: data.text || '' }), {
    status: 200,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...CORS_HEADERS },
  });
}
