/**
 * Returns `value` if it is a safe path inside this site, else `fallback`.
 * Stops "open redirect" tricks such as ?next=https://evil.example or ?next=//evil.example.
 */
export function safeNext(value: unknown, fallback = "/account"): string {
  if (typeof value !== "string" || value.length > 512) return fallback;
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return fallback;
  if (/[\u0000-\u001f]/.test(value)) return fallback;
  return value;
}
