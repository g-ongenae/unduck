export type ParsedQuery = { shortcut?: string; terms: string };

/**
 * Finds the first whitespace-delimited `!bang` token, or a `bang!` token at the start or end of the
 * query, that `isBang` accepts. Unrecognized bangs are left in the search terms.
 */
export function parseQuery(query: string, isBang: (shortcut: string) => boolean): ParsedQuery {
  const tokens = query.trim().split(/\s+/).filter(Boolean);
  const accepts = (index: number, pattern: RegExp) => {
    const shortcut = tokens[index]?.match(pattern)?.[1]?.toLowerCase();
    return shortcut && isBang(shortcut) ? shortcut : undefined;
  };
  const candidates = [
    ...tokens.map((_, index) => [index, /^!([^\s!]+)$/] as const),
    [0, /^([^\s!]+)!$/] as const,
    [tokens.length - 1, /^([^\s!]+)!$/] as const,
  ];
  for (const [index, pattern] of candidates) {
    const shortcut = accepts(index, pattern);
    if (shortcut) return { shortcut, terms: tokens.filter((_, i) => i !== index).join(" ") };
  }
  return { terms: tokens.join(" ") };
}
