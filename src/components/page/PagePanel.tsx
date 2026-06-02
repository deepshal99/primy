"use client";

import { useState, useRef, useEffect } from "react";
import { useAppStore } from "@/lib/store";
import { openEntity } from "@/lib/entityLinks";
import type { EntityType } from "@/lib/types";
import { Code2, Eye, Maximize2, X } from "lucide-react";

/**
 * Injected into the previewed page so internal entity links open the entity
 * IN-APP instead of navigating to a route that doesn't exist (e.g. /doc/<id>,
 * which 404s). Runs inside the sandboxed (cross-origin) iframe, so it talks to
 * the parent purely via postMessage. Recognises both the canonical
 * `drafta://<type>/<id>` scheme and the legacy `/doc|/table|/deck|/page/<id>`
 * paths the model sometimes emits, mapping doc→ku and sheet→table.
 */
const ENTITY_LINK_INTERCEPTOR = `<script>(function(){
  function resolve(href){
    if(!href) return null;
    var m = href.match(/^(?:drafta:|primy:)\\/\\/(ku|table|deck|page)\\/([\\w-]+)/i);
    if(m) return { type: m[1].toLowerCase(), id: m[2] };
    m = href.match(/^\\/(doc|document|ku|table|sheet|deck|page)\\/([\\w-]+)/i);
    if(m){ var t = m[1].toLowerCase(); if(t==='doc'||t==='document') t='ku'; else if(t==='sheet') t='table'; return { type: t, id: m[2] }; }
    return null;
  }
  document.addEventListener('click', function(e){
    var a = e.target && e.target.closest ? e.target.closest('a') : null;
    if(!a) return;
    var ref = resolve(a.getAttribute('href'));
    if(!ref) return;
    e.preventDefault();
    e.stopPropagation();
    try { parent.postMessage({ source:'primy-page', type:'open-entity', entityType: ref.type, entityId: ref.id }, '*'); } catch(_){}
  }, true);
})();</script>`;

/** Append the link interceptor to the page markup without mutating what's saved. */
function withLinkInterceptor(html: string): string {
  if (!html) return html;
  const idx = html.lastIndexOf("</body>");
  return idx === -1
    ? html + ENTITY_LINK_INTERCEPTOR
    : html.slice(0, idx) + ENTITY_LINK_INTERCEPTOR + html.slice(idx);
}

/**
 * Renders an HTML "visual document" page. The markup is shown in a sandboxed
 * iframe (isolated styles + scripts), with a Preview ⇄ Edit-HTML toggle and a
 * Present (fullscreen) mode. Edits flow through the store's updatePageHtml so
 * they persist via the normal debounced save.
 */
export function PagePanel() {
  const pageHtml = useAppStore((s) => s.pageHtml);
  const pageVersion = useAppStore((s) => s.pageVersion);
  const updatePageHtml = useAppStore((s) => s.updatePageHtml);

  const [mode, setMode] = useState<"preview" | "code">("preview");
  const [present, setPresent] = useState(false);
  const [draft, setDraft] = useState(pageHtml);

  // Re-sync the editor draft when the page changes underneath us (open, AI op, undo)
  const draftRef = useRef(draft);
  draftRef.current = draft;
  useEffect(() => {
    setDraft(pageHtml);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageVersion]);

  // Esc exits present mode
  useEffect(() => {
    if (!present) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPresent(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [present]);

  // Entity-link clicks inside the previewed page arrive as postMessages from the
  // sandboxed iframe (see ENTITY_LINK_INTERCEPTOR). Open the target in-app rather
  // than letting the link 404 in a new tab.
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      const data = e.data;
      if (!data || data.source !== "primy-page" || data.type !== "open-entity") return;
      const type = data.entityType as EntityType;
      const id = typeof data.entityId === "string" ? data.entityId : "";
      if (!id || (type !== "ku" && type !== "table" && type !== "deck" && type !== "page")) return;
      openEntity(type, id);
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  const hasContent = pageHtml.trim().length > 0;

  const frame = (
    <iframe
      // key forces a fresh document when content changes (avoids stale scripts)
      key={pageVersion}
      title="HTML page preview"
      srcDoc={withLinkInterceptor(pageHtml)}
      sandbox="allow-scripts allow-popups allow-forms"
      className="w-full h-full border-0 bg-white"
    />
  );

  if (present) {
    return (
      <div className="fixed inset-0 z-[60] bg-white flex flex-col animate-fade-in">
        <div className="flex items-center justify-between px-4 h-[44px] border-b border-[rgba(0,0,0,0.08)] flex-shrink-0">
          <span className="text-[12px] font-medium text-[#737373]">Presenting</span>
          <button
            onClick={() => setPresent(false)}
            className="inline-flex items-center gap-1.5 h-[28px] px-2.5 rounded-md text-[12px] text-[#525252] hover:bg-[#f5f5f5] transition-colors t-fast"
          >
            <X size={14} /> Exit
          </button>
        </div>
        <div className="flex-1 overflow-hidden">{frame}</div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Page toolbar */}
      <div className="flex items-center justify-between px-3 h-[40px] border-b border-[#f0efec] flex-shrink-0">
        <div className="inline-flex items-center rounded-md bg-[#f5f4f2] p-0.5">
          <button
            onClick={() => setMode("preview")}
            className={`inline-flex items-center gap-1.5 h-[26px] px-2.5 rounded-[5px] text-[12px] font-medium transition-colors t-fast ${
              mode === "preview" ? "bg-white text-[#171717] shadow-[0_1px_2px_rgba(0,0,0,0.06)]" : "text-[#737373] hover:text-[#525252]"
            }`}
          >
            <Eye size={13} /> Preview
          </button>
          <button
            onClick={() => setMode("code")}
            className={`inline-flex items-center gap-1.5 h-[26px] px-2.5 rounded-[5px] text-[12px] font-medium transition-colors t-fast ${
              mode === "code" ? "bg-white text-[#171717] shadow-[0_1px_2px_rgba(0,0,0,0.06)]" : "text-[#737373] hover:text-[#525252]"
            }`}
          >
            <Code2 size={13} /> HTML
          </button>
        </div>

        <button
          onClick={() => setPresent(true)}
          disabled={!hasContent}
          className="inline-flex items-center gap-1.5 h-[28px] px-2.5 rounded-md text-[12px] font-medium text-[#525252] hover:bg-[#f5f5f5] disabled:opacity-40 disabled:cursor-not-allowed transition-colors t-fast"
        >
          <Maximize2 size={13} /> Present
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-hidden">
        {!hasContent ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-center max-w-[320px] px-6">
              <div className="w-12 h-12 rounded-xl bg-[#f3eeff] flex items-center justify-center mx-auto mb-4">
                <Eye size={20} className="text-[#9061ff]" />
              </div>
              <p className="text-[14px] font-medium text-[#171717] mb-1">This page is empty</p>
              <p className="text-[13px] text-[#737373] leading-relaxed">
                Ask the assistant to turn a document into a visual page, or paste HTML in the editor.
              </p>
            </div>
          </div>
        ) : mode === "preview" ? (
          frame
        ) : (
          <textarea
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              updatePageHtml(e.target.value);
            }}
            spellCheck={false}
            className="w-full h-full resize-none border-0 outline-none p-4 font-mono text-[12.5px] leading-relaxed text-[#1a1a1a] bg-[#fafafa]"
            placeholder="<!doctype html> ..."
          />
        )}
      </div>
    </div>
  );
}
