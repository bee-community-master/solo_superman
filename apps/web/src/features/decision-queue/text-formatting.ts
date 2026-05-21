export function formatListWithFallback(items: readonly string[], fallback: string) {
  return items.length ? items.join(", ") : fallback;
}
