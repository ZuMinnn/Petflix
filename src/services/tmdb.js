const TMDB_BASE = 'https://api.themoviedb.org/3';
const TMDB_IMAGE_BASE = import.meta.env.VITE_TMDB_IMAGE_BASE || 'https://image.tmdb.org/t/p';
const TMDB_TOKEN = import.meta.env.VITE_TMDB_TOKEN;

// Persistent cache using localStorage
const CACHE_EXPIRY = 24 * 60 * 60 * 1000; // 24 hours
const tmdbCache = new Map();

const getCachedData = (key) => {
  try {
    const cached = localStorage.getItem(`tmdb_${key}`);
    if (cached) {
      const { data, timestamp } = JSON.parse(cached);
      if (Date.now() - timestamp < CACHE_EXPIRY) {
        return data;
      }
      localStorage.removeItem(`tmdb_${key}`);
    }
  } catch (e) {}
  return null;
};

const setCachedData = (key, data) => {
  try {
    localStorage.setItem(`tmdb_${key}`, JSON.stringify({
      data,
      timestamp: Date.now()
    }));
  } catch (e) {}
}; // key: `${mediaType}:${tmdbId}` -> response json

export function hasTmdbAuth() {
  return Boolean(TMDB_TOKEN);
}

function getHeaders() {
  if (!TMDB_TOKEN) return {};
  return {
    accept: 'application/json',
    Authorization: `Bearer ${TMDB_TOKEN}`,
  };
}

export async function fetchTmdbById(tmdbId, mediaType = 'movie') {
  if (!tmdbId) return null;
  if (!hasTmdbAuth()) return null; // Avoid unauthenticated calls that 401
  
  const cacheKey = `${mediaType}:${tmdbId}`;
  
  // Check persistent cache first
  const cachedData = getCachedData(cacheKey);
  if (cachedData) {
    return cachedData;
  }
  
  // Check memory cache
  if (tmdbCache.has(cacheKey)) return tmdbCache.get(cacheKey);
  
  const url = `${TMDB_BASE}/${mediaType}/${tmdbId}?language=en-US`;
  const response = await fetch(url, { headers: getHeaders() });
  if (!response.ok) return null;
  const json = await response.json();
  
  // Cache in both memory and localStorage
  tmdbCache.set(cacheKey, json);
  setCachedData(cacheKey, json);
  
  return json;
}

export function buildTmdbImagePath(path, size = 'w500') {
  if (!path) return '';
  return `${TMDB_IMAGE_BASE}/${size}${path}`;
}


