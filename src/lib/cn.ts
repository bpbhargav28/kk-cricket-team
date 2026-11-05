/**
 * Tiny className joiner — avoids pulling in clsx for a five-line helper.
 *
 * Accepts the falsy values that `&&` guards produce (including `0`, which
 * `a.length && 'cls'` yields for an empty array) and drops them.
 */
export function cn(...parts: Array<string | number | false | null | undefined>): string {
  return parts.filter((p): p is string => typeof p === 'string' && p.length > 0).join(' ')
}
