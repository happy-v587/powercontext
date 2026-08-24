const SECRET_PATTERNS = [
  /-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----[\s\S]*?(?:-----END [A-Z0-9 ]*PRIVATE KEY-----|$)/giu,
  /(?<![\w-])["']?\b(?:api[_ -]?key|access[_ -]?key|client[_ -]?secret|secret(?:[_ -]?key)?|password|passwd|passphrase|token|authorization|cookie)\b["']?\s*[:=]\s*(?:"[^"\r\n]*"|'[^'\r\n]*'|`[^`\r\n]*`|[^\s,;}\]]+)/giu,
  /(?<![\w-])bearer\s+[A-Za-z0-9._~+/=-]{8,}(?![\w-])/giu,
  /(?<![\w-])(?:sk-[A-Za-z0-9][A-Za-z0-9_-]{7,}|github_pat_[A-Za-z0-9_]{8,}|gh[pousr]_[A-Za-z0-9_]{8,}|xox[baprs]-[A-Za-z0-9-]{8,})(?![\w-])/giu,
] as const

export function scrubSecrets(text: string): string {
  return SECRET_PATTERNS.reduce((value, pattern) => value.replace(pattern, '[REDACTED]'), text)
}

export function containsSecret(text: string): boolean {
  return scrubSecrets(text) !== text
}
