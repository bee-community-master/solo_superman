export function uniqueTextItems(items: readonly string[]) {
  return [...new Set(items)];
}
