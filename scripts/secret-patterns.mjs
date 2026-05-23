export const TOKEN_LIKE_PATTERN_SOURCE = String.raw`\b(?:gh[pousr]_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,}|sk-[A-Za-z0-9_-]{20,}|npm_[A-Za-z0-9_-]{20,}|xox[baprs]-[A-Za-z0-9-]{10,}|Bearer\s+[A-Za-z0-9._~+/-]{10,})\b`;

export function tokenLikePattern(flags = "iu") {
  return new RegExp(TOKEN_LIKE_PATTERN_SOURCE, flags);
}
