/**
 * dslToHtml — ALLWEONE-style XML DSL → Primy HtmlDeckSlide (option-C spike).
 */
import { describe, expect, test } from "vitest";
import { parseDeckDsl, dslToHtmlSlides, renderSlideHtml } from "@/lib/deck/dslToHtml";
import { deckThemes } from "@/components/deck/deckThemes";

const theme = deckThemes.pitch;

const SAMPLE = `
<deck theme="pitch" title="Q3 Strategy">
  <slide layout="title">
    <eyebrow>Q3 2026</eyebrow>
    <h1>Scaling to $2M ARR</h1>
    <subtitle>From product-market fit to repeatable growth</subtitle>
  </slide>
  <slide layout="bullets">
    <h2>Where we are today</h2>
    <bullet><b>1,200 paying customers</b> — up 3x from Q2</bullet>
    <bullet><b>$48K MRR</b> — 92% gross margin</bullet>
  </slide>
  <slide layout="stats">
    <h2>The numbers</h2>
    <stat value="3x" label="QoQ customer growth"/>
    <stat value="$48K" label="Monthly recurring revenue"/>
  </slide>
  <slide layout="quote">
    <quote>Primy replaced three tools in my stack.</quote>
    <cite>Sarah Chen, Fractional CMO</cite>
  </slide>
</deck>`;

describe("parseDeckDsl", () => {
  test("reads deck title/theme and every slide with its layout", () => {
    const parsed = parseDeckDsl(SAMPLE);
    expect(parsed.title).toBe("Q3 Strategy");
    expect(parsed.theme).toBe("pitch");
    expect(parsed.slides.map((s) => s.layout)).toEqual(["title", "bullets", "stats", "quote"]);
  });

  test("normalizes layout aliases and defaults unknown to bullets", () => {
    const p = parseDeckDsl(`<deck><slide layout="cover"><h1>x</h1></slide><slide layout="frobnicate"><h2>y</h2></slide></deck>`);
    expect(p.slides[0].layout).toBe("title");
    expect(p.slides[1].layout).toBe("bullets");
  });

  test("tolerates stray code fences and missing deck wrapper", () => {
    const p = parseDeckDsl('```xml\n<slide layout="section"><h1>Go-to-market</h1></slide>\n```');
    expect(p.slides).toHaveLength(1);
    expect(p.slides[0].layout).toBe("section");
  });
});

describe("dslToHtmlSlides", () => {
  test("produces one HtmlDeckSlide per slide with a self-contained 960x540 doc", () => {
    const slides = dslToHtmlSlides(SAMPLE, theme);
    expect(slides).toHaveLength(4);
    for (const s of slides) {
      expect(s.id).toBeTruthy();
      expect(s.editableFields).toEqual([]);
      expect(s.html).toContain("960px");
      // Emitted as a fragment (style + slide div), NOT a full document — the
      // renderer's shadow-root + DOMPurify(WHOLE_DOCUMENT:false) drops <head>.
      expect(s.html).toContain("<style>");
      expect(s.html).toContain('<div class="slide"');
      expect(s.html).not.toContain("<head>");
      // <style> is nested inside the slide root (survives DOMPurify), not at top
      expect(s.html.indexOf("<style>")).toBeGreaterThan(s.html.indexOf('<div class="slide"'));
    }
  });

  test("injects the theme tokens so the polish loop + renderer see them", () => {
    const [first] = dslToHtmlSlides(SAMPLE, theme);
    expect(first.html).toContain(`--accent:${theme.accent}`);
    expect(first.html).toContain(`--bg:${theme.bg}`);
  });

  test("renders the content fields into the markup", () => {
    const html = renderSlideHtml({ layout: "stats", raw: '<h2>Numbers</h2><stat value="3x" label="growth"/>' }, theme);
    expect(html).toContain("3x");
    expect(html).toContain("growth");
    expect(html).toContain("stat-v");
  });

  test("empty deck → no slides (no throw)", () => {
    expect(dslToHtmlSlides("<deck></deck>", theme)).toEqual([]);
  });
});
