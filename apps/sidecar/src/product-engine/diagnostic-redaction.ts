const SECRET_ASSIGNMENT_KEY_PATTERN =
  /(?:^|[^a-z0-9])(?:api[_-]?key|authorization|auth[_-]?token|access[_-]?token|refresh[_-]?token|id[_-]?token|token|secret|password|passwd|private[_-]?key)(?:$|[^a-z0-9])/iu;
const SECRET_ASSIGNMENT_PATTERN = /([A-Za-z0-9_./:-]*[A-Za-z0-9_./-])(\s*[:=]\s*)\S+/gu;

export function redactSensitiveDiagnosticText(text: string, options: { readonly redactLocalPaths?: boolean } = {}) {
  let redacted = text
    .replace(SECRET_ASSIGNMENT_PATTERN, (match, key: string, separator: string) =>
      SECRET_ASSIGNMENT_KEY_PATTERN.test(key) ? `${key}${separator}[REDACTED]` : match
    )
    .replace(/\b([A-Za-z0-9_-]*(?:api[_-]?key|authorization|password|secret|token)[A-Za-z0-9_-]*)\s*([:=])\s*[^\s&]+/giu, "$1$2[REDACTED]")
    .replace(/([?&][^=&#\s]*(?:api[_-]?key|authorization|password|secret|token)[^=&#\s]*=)[^&#\s]+/giu, "$1[REDACTED]")
    .replace(/\bBearer\s+[A-Za-z0-9._~+/-]{10,}/gu, "Bearer [REDACTED]")
    .replace(/\b(?:gh[pousr]_|github_pat_)[A-Za-z0-9_]{20,}/gu, "[REDACTED_GITHUB_TOKEN]")
    .replace(/\bsk-[A-Za-z0-9_-]{16,}/gu, "sk-[REDACTED]")
    .replace(/\bxox[baprs]-[A-Za-z0-9-]{10,}/gu, "xox[REDACTED]");

  if (options.redactLocalPaths) {
    redacted = redacted
      .replace(/(?:\/Users|\/var\/folders|\/tmp)\/[^\s)]+/gu, "[REDACTED_PATH]")
      .replace(/[A-Z]:\\[^\s)]+/gu, "[REDACTED_PATH]");
  }

  return redacted;
}
