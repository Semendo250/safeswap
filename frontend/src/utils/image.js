// Asks Cloudinary for a smaller, modern-format copy of a photo instead of the full-size original
export function optimizeImage(url, width) {
  if (typeof url !== 'string' || !url.includes('/image/upload/')) return url;
  // Already has a transformation, leave it alone
  if (/\/image\/upload\/[^/]*(f_auto|q_auto|w_\d+)/.test(url)) return url;
  const transform = `f_auto,q_auto${width ? `,w_${width},c_limit` : ''}`;
  return url.replace('/image/upload/', `/image/upload/${transform}/`);
}