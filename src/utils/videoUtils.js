// Video utility functions for handling video URLs and errors

/**
 * Validates if a video URL is accessible
 * @param {string} url - The video URL to validate
 * @returns {Promise<boolean>} - True if URL is accessible
 */
export const validateVideoUrl = async (url) => {
  if (!url) return false;
  
  try {
    // Check if URL is valid
    new URL(url);
    
    // Try to fetch with CORS handling
    const response = await fetch(url, { 
      method: 'HEAD',
      mode: 'no-cors',
      cache: 'no-cache'
    });
    
    return true;
  } catch (error) {
    return false;
  }
};

/**
 * Checks if a URL is an M3U8 stream
 * @param {string} url - The URL to check
 * @returns {boolean} - True if URL is M3U8
 */
export const isM3U8Url = (url) => {
  if (!url) return false;
  return url.includes('.m3u8') || url.includes('m3u8');
};

/**
 * Checks if a URL is an embed URL
 * @param {string} url - The URL to check
 * @returns {boolean} - True if URL is embed
 */
export const isEmbedUrl = (url) => {
  if (!url) return false;
  const embedDomains = [
    'player.phimapi.com',
    'embed.',
    'iframe.',
    'player.'
  ];
  return embedDomains.some(domain => url.includes(domain));
};

/**
 * Gets the best available video source
 * @param {Object} sources - Object containing video sources
 * @returns {Object} - Best available source
 */
export const getBestVideoSource = async (sources) => {
  const { link_m3u8, link_embed } = sources;
  
  // If only one source available, return it
  if (!link_m3u8 && link_embed) {
    return { type: 'embed', url: link_embed };
  }
  if (link_m3u8 && !link_embed) {
    return { type: 'm3u8', url: link_m3u8 };
  }
  
  // If both available, try to validate embed first
  if (link_embed) {
    const isValidEmbed = await validateVideoUrl(link_embed);
    if (isValidEmbed) {
      return { type: 'embed', url: link_embed };
    }
  }
  
  // Fallback to M3U8
  if (link_m3u8) {
    return { type: 'm3u8', url: link_m3u8 };
  }
  
  return null;
};

/**
 * Creates a retry mechanism with exponential backoff
 * @param {Function} fn - Function to retry
 * @param {number} maxRetries - Maximum number of retries
 * @param {number} baseDelay - Base delay in milliseconds
 * @returns {Promise} - Result of the function
 */
export const retryWithBackoff = async (fn, maxRetries = 3, baseDelay = 1000) => {
  let lastError;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      if (i === maxRetries - 1) {
        throw lastError;
      }
      
      // Exponential backoff: 1s, 2s, 4s, etc.
      const delay = baseDelay * Math.pow(2, i);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError;
};

/**
 * Formats error messages for display
 * @param {Error} error - The error object
 * @returns {string} - Formatted error message
 */
export const formatVideoError = (error) => {
  if (!error) return 'Lỗi không xác định';
  
  const message = error.message || error.toString();
  
  // Common error patterns
  if (message.includes('ERR_NAME_NOT_RESOLVED')) {
    return 'Không thể kết nối đến server video. Vui lòng kiểm tra kết nối mạng.';
  }
  
  if (message.includes('CORS')) {
    return 'Lỗi bảo mật khi tải video. Vui lòng thử nguồn khác.';
  }
  
  if (message.includes('404')) {
    return 'Video không tồn tại hoặc đã bị xóa.';
  }
  
  if (message.includes('403')) {
    return 'Không có quyền truy cập video này.';
  }
  
  if (message.includes('timeout')) {
    return 'Tải video quá lâu. Vui lòng thử lại.';
  }
  
  return 'Lỗi phát video. Vui lòng thử lại.';
};

/**
 * Checks if browser supports HLS
 * @returns {boolean} - True if HLS is supported
 */
export const isHLSSupported = () => {
  const video = document.createElement('video');
  return video.canPlayType('application/vnd.apple.mpegURL') || 
         (window.Hls && window.Hls.isSupported());
};

/**
 * Creates a fallback video source list
 * @param {Object} sources - Original sources
 * @returns {Array} - Array of fallback sources
 */
export const createFallbackSources = (sources) => {
  const fallbacks = [];
  
  if (sources.link_embed) {
    fallbacks.push({ type: 'embed', url: sources.link_embed, priority: 1 });
  }
  
  if (sources.link_m3u8) {
    fallbacks.push({ type: 'm3u8', url: sources.link_m3u8, priority: 2 });
  }
  
  // Add any additional fallback sources here
  // fallbacks.push({ type: 'mp4', url: sources.link_mp4, priority: 3 });
  
  return fallbacks.sort((a, b) => a.priority - b.priority);
};
