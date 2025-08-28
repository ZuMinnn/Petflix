export function buildEmbedUrl(movieId) {
  if (!movieId) return '';
  const template = import.meta.env.VITE_PLAYER_EMBED_URL_TEMPLATE || '';
  if (!template) {
    return '';
  }
  return template.replace('{id}', movieId);
}


