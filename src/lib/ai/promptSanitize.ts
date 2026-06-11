/**
 * Strip context-injection tags from untrusted text before it is interpolated
 * into the chat prompt. Applied to the typed message AND to every stored or
 * uploaded payload we inject (doc/sheet/deck content, file text, titles), so
 * content can't break out of its fenced context block and impersonate system
 * instructions (indirect prompt injection via shared workspaces or uploads).
 */
export function sanitizeUserContent(text: unknown): string {
  return String(text ?? "")
    .replace(/<\/?relevant_document[^>]*>/g, "")
    .replace(/<\/?relevant_table[^>]*>/g, "")
    .replace(/<\/?project_context[^>]*>/g, "")
    .replace(/<\/?current_sheet_data[^>]*>/g, "")
    .replace(/<\/?current_doc_content[^>]*>/g, "")
    .replace(/<\/?project_memory[^>]*>/g, "")
    .replace(/<\/?uploaded_file[^>]*>/g, "")
    .replace(/<\/?mentioned_deck[^>]*>/g, "")
    .replace(/<\/?active_entity[^>]*>/g, "")
    .replace(/<\/?deck_phase[^>]*>/g, "");
}
