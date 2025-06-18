/**
 * Generate a unique identifier
 * This is a simple implementation that generates IDs similar to cuid
 */
export function cuid(): string {
  const timestamp = Date.now().toString(36);
  const randomPart = Math.random().toString(36).substring(2, 9);
  const counter = (Math.floor(Math.random() * 1000000)).toString(36);
  
  return `c${timestamp}${randomPart}${counter}`;
}

/**
 * Generate a slug (shorter unique identifier)
 */
export function slug(): string {
  const timestamp = Date.now().toString(36).substring(-4);
  const randomPart = Math.random().toString(36).substring(2, 6);
  
  return `${timestamp}${randomPart}`;
}