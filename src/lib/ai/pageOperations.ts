import type { PageOperation } from "@/lib/types";

/**
 * Apply UPDATE page operations to the currently-open page's HTML.
 *
 * Pages are full-document HTML, so an UPDATE carries the complete new markup
 * (last UPDATE wins — full replacement). CREATE / DELETE / RENAME are handled
 * at the project level in the store, not here.
 */
export function applyPageOps(currentHtml: string, operations: PageOperation[]): string {
  let html = currentHtml;
  for (const op of operations) {
    if (op.type === "UPDATE" && typeof op.html === "string") {
      html = op.html;
    }
  }
  return html;
}
