export const CATEGORY_CONFIG = {
  'bluearchive': 'bluearchive.json',
  'miku': 'miku.json',
};

export const BASE_JSON_URL = 'https://api-vercel.blockhaity.dpdns.org/img/';

export const REDIRECT_TARGET = 'https://api.blockhaity.qzz.io';

export const GITHUB_PROXY_DOMAINS = [
  'github.com',
  'raw.githubusercontent.com',
  'gist.github.com',
  'objects.githubusercontent.com',
  'githubassets.com',
];

export const GITHUB_REPO = 'BlueArchiveArisHelper/BAAH';
export const GITHUB_API_URL = `https://api.github.com/repos/${GITHUB_REPO}/releases`;
export const BACKUP_API_URL = 'https://api-vercel.blockhaity.dpdns.org/cache/baah.json';

export const CACHE_TTL = 86400;

export const GITHUB_RAW_BASE = 'https://raw.githubusercontent.com/BlockHaity/api/main';

export const AGNES_API_TARGET = {
  base: 'https://apihub.agnes-ai.com',
};

export const AGNES_MODEL_MAP = {
  'agnes-2.5-flash': 'agnes-2.5-flash',
  'agnes-2.0-flash': 'agnes-2.0-flash',
  'agnes-2.5-pro-alpha': 'agnes-2.5-pro-alpha',
  'agnes-image-2.0-flash': 'agnes-image-2.0-flash',
  'agnes-image-2.1-flash': 'agnes-image-2.1-flash',
  'agnes-video-v2.0': 'agnes-video-v2.0',
};

export const AGNES_DEFAULT_MODEL = 'agnes-2.5-flash';

export const AGNES_MODEL_ENDPOINTS = {
  '/chat/completions': 'chat',
  '/images/generations': 'image',
  '/images/edits': 'image',
  '/images/variations': 'image',
  '/embeddings': 'embedding',
  '/audio/speech': 'audio',
  '/audio/transcriptions': 'audio',
  '/audio/translations': 'audio',
  '/fine-tuning': 'chat',
  '/completions': 'chat',
};

export const AGNES_MODEL_FALLBACKS = {
  chat: 'agnes-2.5-flash',
  image: 'agnes-image-2.0-flash',
  embedding: 'agnes-2.5-flash',
  audio: 'agnes-2.5-flash',
};