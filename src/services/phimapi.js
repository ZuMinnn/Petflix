const PHIMAPI_BASE = 'https://phimapi.com';

// Cache với expiry time
const CACHE_EXPIRY = 10 * 60 * 1000; // 10 minutes
const cache = new Map();

const getCachedData = (key) => {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_EXPIRY) {
    return cached.data;
  }
  cache.delete(key);
  return null;
};

const setCachedData = (key, data) => {
  cache.set(key, {
    data,
    timestamp: Date.now()
  });
};

export async function fetchLatestMoviesV3(page = 1) {
  const cacheKey = `latest_v3_${page}`;
  const cached = getCachedData(cacheKey);
  if (cached) return cached;
  
  const url = `${PHIMAPI_BASE}/danh-sach/phim-moi-cap-nhat-v3?page=${encodeURIComponent(page)}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`PhimAPI latest movies failed: ${response.status}`);
  }
  const data = await response.json();
  setCachedData(cacheKey, data);
  return data;
}

export async function fetchMovieDetailBySlug(slug) {
  const cacheKey = `detail_${slug}`;
  const cached = getCachedData(cacheKey);
  if (cached) return cached;
  
  const url = `${PHIMAPI_BASE}/phim/${encodeURIComponent(slug)}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`PhimAPI detail failed: ${response.status}`);
  }
  const data = await response.json();
  setCachedData(cacheKey, data);
  return data;
}

export async function searchMovies({ keyword, page = 1, limit = 24, sort_field = '_id', sort_type = 'asc', sort_lang, category, country, year } = {}) {
  if (!keyword) return { items: [] };
  const params = new URLSearchParams();
  params.set('keyword', keyword);
  params.set('page', String(page));
  params.set('limit', String(limit));
  if (sort_field) params.set('sort_field', sort_field);
  if (sort_type) params.set('sort_type', sort_type);
  if (sort_lang) params.set('sort_lang', sort_lang);
  if (category) params.set('category', category);
  if (country) params.set('country', country);
  if (year) params.set('year', String(year));
  const url = `${PHIMAPI_BASE}/v1/api/tim-kiem?${params.toString()}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`PhimAPI search failed: ${response.status}`);
  }
  return response.json();
}

// Fetch anime movies (viễn tưởng + nhật bản)
export async function fetchAnimeMovies(page = 1, limit = 20) {
  const cacheKey = `anime_${page}_${limit}`;
  const cached = getCachedData(cacheKey);
  if (cached) return cached;
  
  const params = new URLSearchParams();
  params.set('page', String(page));
  params.set('limit', String(limit));
  params.set('category', 'vien-tuong');
  params.set('country', 'nhat-ban');
  params.set('sort_field', 'modified.time');
  params.set('sort_type', 'desc');
  
  const url = `${PHIMAPI_BASE}/v1/api/danh-sach/phim-le?${params.toString()}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`PhimAPI anime failed: ${response.status}`);
  }
  const data = await response.json();
  setCachedData(cacheKey, data);
  return data;
}

// Fetch movies by category
export async function fetchMoviesByCategory(category, page = 1, limit = 20) {
  const cacheKey = `category_${category}_${page}_${limit}`;
  const cached = getCachedData(cacheKey);
  if (cached) return cached;
  
  // Try V1 API first
  try {
    const params = new URLSearchParams();
    params.set('page', String(page));
    params.set('limit', String(limit));
    params.set('sort_field', 'modified.time');
    params.set('sort_type', 'desc');
    
    const url = `${PHIMAPI_BASE}/v1/api/danh-sach/${category}?${params.toString()}`;
    console.log('Trying V1 API:', url);
    
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`PhimAPI V1 failed: ${response.status}`);
    }
    const data = await response.json();
    console.log('V1 API success:', data);
    setCachedData(cacheKey, data);
    return data;
  } catch (error) {
    console.warn('V1 API failed, trying fallback:', error);
    
    // Fallback: Try latest movies API with filtering
    try {
      const fallbackData = await fetchLatestMoviesV3(page);
      console.log('Fallback API success:', fallbackData);
      setCachedData(cacheKey, fallbackData);
      return fallbackData;
    } catch (fallbackError) {
      console.error('All APIs failed:', fallbackError);
      throw new Error(`PhimAPI category failed: ${error.message}`);
    }
  }
}


