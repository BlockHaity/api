import { FISH_AUDIO_BASE_URL } from '../config.js';
import { errorResponse } from '../utils.js';

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

function resolveOpenAIPath(pathname) {
  let path = pathname.replace(/^\/fish-audio-api\/openai/, '') || '/';
  if (path === '/' || path === '') return '';
  if (!path.startsWith('/')) path = '/' + path;
  return path;
}

export async function handleFishAudioOpenAI(request) {
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: CORS_HEADERS });
  }

  const url = new URL(request.url);
  const path = resolveOpenAIPath(url.pathname);
  const auth = request.headers.get('Authorization') || '';

  try {
    if (path === '/v1/audio/speech' || path === '/audio/speech') {
      return await handleTTS(request, auth);
    }
    if (path === '/v1/audio/transcriptions' || path === '/audio/transcriptions') {
      return await handleSTT(request, auth);
    }
    return errorResponse(
      'OpenAI 兼容端点不存在，支持: /v1/audio/speech, /v1/audio/transcriptions',
      404
    );
  } catch (error) {
    console.error('Fish Audio OpenAI converter error:', error);
    return errorResponse(`转换失败: ${error.message}`, 500);
  }
}

async function handleTTS(request, auth) {
  let body;
  try {
    body = await request.json();
  } catch (e) {
    return errorResponse('请求体必须是 JSON', 400);
  }

  const { model, input, voice, response_format, speed } = body;

  if (!input) {
    return errorResponse('缺少 input 参数', 400);
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

  const response = await fetch(`${FISH_AUDIO_BASE_URL}/v1/tts`, {
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

async function handleSTT(request, auth) {
  let formData;
  try {
    formData = await request.formData();
  } catch (e) {
    return errorResponse('请求体必须是 multipart/form-data', 400);
  }

  const audio = formData.get('file') || formData.get('audio');
  if (!audio) {
    return errorResponse('缺少 file 参数', 400);
  }

  const language = formData.get('language');
  const responseFormat = formData.get('response_format') || 'json';

  const fishFormData = new FormData();
  fishFormData.append('audio', audio, audio.name || 'audio.wav');
  if (language) fishFormData.append('language', language);

  const response = await fetch(`${FISH_AUDIO_BASE_URL}/v1/asr`, {
    method: 'POST',
    headers: { Authorization: auth },
    body: fishFormData,
  });

  const corsHeaders = { 'Access-Control-Allow-Origin': '*' };

  if (!response.ok) {
    const errorText = await response.text();
    return new Response(errorText, {
      status: response.status,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }

  const data = await response.json();

  if (responseFormat === 'text') {
    return new Response(data.text || '', {
      status: 200,
      headers: { 'Content-Type': 'text/plain; charset=utf-8', ...corsHeaders },
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
        headers: { 'Content-Type': 'application/json; charset=utf-8', ...corsHeaders },
      }
    );
  }

  return new Response(JSON.stringify({ text: data.text || '' }), {
    status: 200,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...corsHeaders },
  });
}
