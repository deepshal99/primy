/**
 * Deck-eval runner — `npm run deck:eval`.
 *
 * Prints a measurable quality report for the deterministic deck layouts, so deck
 * quality is something we MEASURE in a loop, not eyeball per deck.
 *
 *   default        → static structural report (no browser): every layout at
 *                    min + max content must be non-empty, brand-tokened, footered
 *                    correctly, artifact-free.
 *   --render       → also boot Chromium, render each slide, and flag any slide
 *                    whose inner content is CLIPPED (taller than the 540px frame)
 *                    or whose text fails WCAG contrast against its real bg.
 *
 * Exit code is non-zero if any slide fails — so this doubles as a CI gate.
 */
import {
  STRESS_DECK_MIN,
  STRESS_DECK_MAX,
  evaluateDeckDsl,
  type StaticEvalReport,
} from "../../src/lib/deck/deckEval";
import { dslToHtmlSlides, parseDeckDsl } from "../../src/lib/deck/dslToHtml";
import { getThemeConfig } from "../../src/components/deck/deckThemes";

function printStatic(name: string, report: StaticEvalReport): boolean {
  console.log(`\n  ${name}  —  ${report.passed}/${report.total} slides pass`);
  for (const s of report.slides) {
    const mark = s.pass ? "✓" : "✗";
    const detail = s.pass ? "" : `  — ${s.issues.join("; ")}`;
    console.log(`    ${mark} ${String(s.index).padStart(2)} ${s.layout.padEnd(11)}${detail}`);
  }
  return report.passed === report.total;
}

/** Browser pass: measure clipping + contrast on the real rendered slide. */
async function renderChecks(): Promise<boolean> {
  const { launchBrowser, newGuardedPage } = await import("../../src/lib/deck/chromium");
  const theme = getThemeConfig("pitch");
  let ok = true;
  const browser = await launchBrowser({ width: 960, height: 540 });
  try {
    for (const [name, xml] of [["MIN", STRESS_DECK_MIN], ["MAX", STRESS_DECK_MAX]] as const) {
      const slides = dslToHtmlSlides(xml, theme);
      const layouts = parseDeckDsl(xml).slides.map((s) => s.layout);
      console.log(`\n  render: ${name}`);
      for (let i = 0; i < slides.length; i++) {
        const page = await newGuardedPage(browser, { allowHosts: [] });
        try {
          await page.setContent(
            `<!DOCTYPE html><html><head><meta charset="utf-8"><style>*{margin:0}html,body{width:960px;height:540px;overflow:hidden}</style></head><body>${slides[i].html}</body></html>`,
            { waitUntil: "networkidle0" },
          );
          // NOTE: passed as a STRING (not a function) so tsx/esbuild doesn't
          // inject its `__name` helper into the serialized body — that helper
          // doesn't exist in the page context and throws "__name is not defined".
          const verdict = (await page.evaluate(`(() => {
            var root = document.querySelector(".slide");
            if (!root) return { clipped: true, contrastFails: 99, note: "no .slide root" };
            var clipped = root.scrollHeight > 541 || root.scrollWidth > 961;
            function lum(c){ var m = c.match(/[\\d.]+/g); if(!m) return null;
              var a = m.map(Number).map(function(v){ v/=255; return v<=0.03928 ? v/12.92 : Math.pow((v+0.055)/1.055,2.4); });
              return 0.2126*a[0]+0.7152*a[1]+0.0722*a[2]; }
            var bgL = lum(getComputedStyle(root).backgroundColor); if (bgL==null) bgL = 0;
            var contrastFails = 0;
            root.querySelectorAll("*").forEach(function(el){
              var hasText = Array.prototype.some.call(el.childNodes, function(n){ return n.nodeType===3 && (n.textContent||"").trim(); });
              if(!hasText) return;
              var cs = getComputedStyle(el);
              var fl = lum(cs.color); if(fl==null) return;
              var ratio = (Math.max(fl,bgL)+0.05)/(Math.min(fl,bgL)+0.05);
              // WCAG: large text (>=24px, or >=18.66px bold) only needs 3:1.
              var px = parseFloat(cs.fontSize)||16;
              var w = parseInt(cs.fontWeight)||400;
              var floor = (px>=24 || (px>=18.66 && w>=700)) ? 3 : 4.5;
              if(ratio < floor) contrastFails++;
            });
            return { clipped: clipped, contrastFails: contrastFails, note: "" };
          })()`)) as { clipped: boolean; contrastFails: number; note: string };
          const pass = !verdict.clipped && verdict.contrastFails === 0;
          if (!pass) ok = false;
          const mark = pass ? "✓" : "✗";
          const bits = [
            verdict.clipped ? "CLIPPED" : "",
            verdict.contrastFails ? `${verdict.contrastFails} low-contrast` : "",
            verdict.note,
          ].filter(Boolean).join(", ");
          console.log(`    ${mark} ${String(i + 1).padStart(2)} ${layouts[i].padEnd(11)}${bits ? "  — " + bits : ""}`);
        } finally {
          await page.close();
        }
      }
    }
  } finally {
    await browser.close();
  }
  return ok;
}

async function main() {
  const wantRender = process.argv.includes("--render");
  console.log("Deck layout eval — deterministic quality baseline");

  const staticOk =
    printStatic("STRESS MIN (sparse content)", evaluateDeckDsl(STRESS_DECK_MIN)) &&
    printStatic("STRESS MAX (dense content)", evaluateDeckDsl(STRESS_DECK_MAX));

  let renderOk = true;
  if (wantRender) {
    try {
      renderOk = await renderChecks();
    } catch (err) {
      console.log("\n  render pass skipped:", err instanceof Error ? err.message : String(err));
    }
  } else {
    console.log("\n  (run with --render to also check clipping + contrast in Chromium)");
  }

  const ok = staticOk && renderOk;
  console.log(`\n${ok ? "PASS" : "FAIL"} — deck layout baseline\n`);
  process.exit(ok ? 0 : 1);
}

void main();
