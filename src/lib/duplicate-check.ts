/** Case-insensitive, trimmed name comparison — used everywhere a
 * composer warns about adding a second not-yet-completed item with the
 * same name as an existing one (almost always an accidental duplicate —
 * a double-tap on "Add", or forgetting one was already on the list).
 * Completed/checked/done items are deliberately excluded from that
 * check by every call site: reusing a name once something's actually
 * finished is normal (a recurring chore done for this period, a bought
 * grocery item, a paid bill), not a duplicate worth blocking. */
export function isSameName(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}
