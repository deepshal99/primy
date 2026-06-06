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

describe("extended layouts", () => {
  const r = (layout: string, raw: string) => renderSlideHtml({ layout, raw } as any, theme);

  test("statement renders a centered single claim", () => {
    const html = r("statement", "<h1>We will define the category.</h1>");
    expect(html).toContain('class="statement"');
    expect(html).toContain("We will define the category.");
  });

  test("featureGrid renders feature cards with titles", () => {
    const html = r("featureGrid", '<h2>What you get</h2><feature title="Automation"><p>Runs itself</p></feature><feature title="Analytics"><p>Know more</p></feature>');
    expect(html).toContain("feat-row");
    expect(html).toContain("Automation");
    expect(html).toContain("Runs itself");
  });

  test("agenda renders a numbered list", () => {
    const html = r("agenda", "<h2>Agenda</h2><item>Problem</item><item>Solution</item><item>Ask</item>");
    expect(html).toContain('class="agenda"');
    expect((html.match(/class="num"/g) || []).length).toBe(3);
    expect(html).toContain("01");
    expect(html).toContain("03");
  });

  test("timeline renders steps with labels", () => {
    const html = r("timeline", '<h2>Roadmap</h2><step label="Q1"><b>Launch</b> beta</step><step label="Q2">scale</step>');
    expect(html).toContain("tl-row");
    expect(html).toContain("Q1");
    expect(html).toContain("Launch");
  });

  test("twoColumn now supports a third column", () => {
    const html = r("twoColumn", '<h2>Tiers</h2><column title="Free">a</column><column title="Pro">b</column><column title="Team">c</column>');
    expect((html.match(/class="col"/g) || []).length).toBe(3);
  });

  test("layout aliases route to the right renderer", () => {
    expect(parseDeckDsl('<deck><slide layout="roadmap"><h2>x</h2></slide></deck>').slides[0].layout).toBe("timeline");
    expect(parseDeckDsl('<deck><slide layout="features"><h2>x</h2></slide></deck>').slides[0].layout).toBe("featureGrid");
    // "cta" now routes to the dedicated closing/CTA layout (better than the
    // generic statement it used to fall into).
    expect(parseDeckDsl('<deck><slide layout="cta"><h1>x</h1></slide></deck>').slides[0].layout).toBe("closing");
    expect(parseDeckDsl('<deck><slide layout="numbered"><h2>x</h2></slide></deck>').slides[0].layout).toBe("agenda");
    // new layouts + aliases
    expect(parseDeckDsl('<deck><slide layout="metric"><h2>x</h2></slide></deck>').slides[0].layout).toBe("bigStat");
    expect(parseDeckDsl('<deck><slide layout="graph"><h2>x</h2></slide></deck>').slides[0].layout).toBe("chart");
    expect(parseDeckDsl('<deck><slide layout="founders"><h2>x</h2></slide></deck>').slides[0].layout).toBe("team");
  });
});
