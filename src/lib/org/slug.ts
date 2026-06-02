/**
 * Slugify an org name into a URL-safe base. Callers append a short unique
 * suffix (e.g. `${slugify(name)}-${nanoid(6)}`) to guarantee global uniqueness.
 */
export function slugify(name: string): string {
  const base = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");
  return base || "org";
}
