import { jsPDF } from "jspdf";
import fs from "fs";

// ── Earth theme ──
const c = {
  bg: "#F7F3ED",
  text: "#2C1810",
  muted: "#8A7A6A",
  accent: "#8B6914",
  accentAlt: "#A67C2E",
  card: "#FFFEFB",
  cardBorder: "#EDE6DA",
  decor: "#F0EBE2",
};

const W = 960, H = 540;
const LX = 80;
const RX = W - 80;
const CW = RX - LX;

function rgb(hex: string) {
  return { r: parseInt(hex.slice(1, 3), 16), g: parseInt(hex.slice(3, 5), 16), b: parseInt(hex.slice(5, 7), 16) };
}
function fill(p: jsPDF, hex: string) { const { r, g, b } = rgb(hex); p.setFillColor(r, g, b); }
function ink(p: jsPDF, hex: string) { const { r, g, b } = rgb(hex); p.setTextColor(r, g, b); }
function stroke(p: jsPDF, hex: string, w = 0.5) { const { r, g, b } = rgb(hex); p.setDrawColor(r, g, b); p.setLineWidth(w); }

// ── Base rendering ──

function bg(p: jsPDF) {
  fill(p, c.bg); p.rect(0, 0, W, H, "F");
  fill(p, c.accent); p.rect(0, H - 2, W, 2, "F");
}

function decor(p: jsPDF) {
  fill(p, c.decor);
  p.circle(W + 20, -60, 220, "F");
  p.circle(-40, H + 40, 160, "F");
}

function slideNum(p: jsPDF, n: number, total: number) {
  p.setFontSize(9); p.setFont("helvetica", "normal"); ink(p, c.muted);
  p.text(`${n} / ${total}`, W - 40, H - 18, { align: "right" });
}

function heading(p: jsPDF, text: string, x: number, y: number, size = 34, align: "left" | "center" = "left") {
  p.setFontSize(size); p.setFont("helvetica", "bold"); ink(p, c.text);
  const lines = p.splitTextToSize(text, align === "center" ? 720 : CW);
  p.text(lines, align === "center" ? W / 2 : x, y, { align });
  return y + lines.length * size * 1.25;
}

function body(p: jsPDF, text: string, x: number, y: number, maxW = CW, size = 18) {
  p.setFontSize(size); p.setFont("helvetica", "normal"); ink(p, c.muted);
  const lines = p.splitTextToSize(text, maxW);
  p.text(lines, x, y);
  return y + lines.length * size * 1.5;
}

function card(p: jsPDF, x: number, y: number, w: number, h: number, radius = 10) {
  fill(p, c.card); p.roundedRect(x, y, w, h, radius, radius, "F");
  stroke(p, c.cardBorder, 0.4); p.roundedRect(x, y, w, h, radius, radius, "S");
}

// ── Icon drawing functions (all drawn at center cx, cy, size ~18px) ──

type IconFn = (p: jsPDF, cx: number, cy: number) => void;

const icons: Record<string, IconFn> = {
  // Two overlapping tabs
  tabs: (p, cx, cy) => {
    stroke(p, c.accent, 1.2);
    p.roundedRect(cx - 7, cy - 5, 12, 10, 1.5, 1.5, "S");
    fill(p, c.bg); p.roundedRect(cx - 3, cy - 9, 12, 10, 1.5, 1.5, "F");
    stroke(p, c.accent, 1.2); p.roundedRect(cx - 3, cy - 9, 12, 10, 1.5, 1.5, "S");
  },
  // Grid (spreadsheet)
  grid: (p, cx, cy) => {
    stroke(p, c.accent, 1.2);
    p.rect(cx - 8, cy - 8, 16, 16);
    p.line(cx, cy - 8, cx, cy + 8);
    p.line(cx - 8, cy, cx + 8, cy);
  },
  // Presentation screen
  screen: (p, cx, cy) => {
    stroke(p, c.accent, 1.2);
    p.roundedRect(cx - 9, cy - 7, 18, 12, 1.5, 1.5, "S");
    p.line(cx, cy + 5, cx, cy + 10);
    p.line(cx - 5, cy + 10, cx + 5, cy + 10);
  },
  // Magnifying glass
  search: (p, cx, cy) => {
    stroke(p, c.accent, 1.4);
    p.circle(cx - 2, cy - 2, 6);
    p.line(cx + 3, cy + 3, cx + 8, cy + 8);
  },
  // Document with lines
  doc: (p, cx, cy) => {
    stroke(p, c.accent, 1.2);
    p.roundedRect(cx - 7, cy - 9, 14, 18, 1.5, 1.5, "S");
    p.line(cx - 3, cy - 3, cx + 3, cy - 3);
    p.line(cx - 3, cy + 1, cx + 3, cy + 1);
    p.line(cx - 3, cy + 5, cx + 1, cy + 5);
  },
  // Connected nodes (diagram)
  nodes: (p, cx, cy) => {
    stroke(p, c.accent, 1.2);
    fill(p, c.accent);
    p.circle(cx - 6, cy - 5, 3, "F");
    p.circle(cx + 6, cy - 5, 3, "F");
    p.circle(cx, cy + 6, 3, "F");
    stroke(p, c.accent, 0.8);
    p.line(cx - 4, cy - 3, cx - 1, cy + 3);
    p.line(cx + 4, cy - 3, cx + 1, cy + 3);
  },
  // Globe
  globe: (p, cx, cy) => {
    stroke(p, c.accent, 1.2);
    p.circle(cx, cy, 8);
    p.ellipse(cx, cy, 4, 8);
    p.line(cx - 8, cy, cx + 8, cy);
  },
  // Rocket
  rocket: (p, cx, cy) => {
    stroke(p, c.accent, 1.4);
    p.roundedRect(cx - 3, cy - 9, 6, 14, 3, 3, "S");
    p.line(cx - 3, cy + 2, cx - 6, cy + 6);
    p.line(cx + 3, cy + 2, cx + 6, cy + 6);
    fill(p, c.accent); p.circle(cx, cy - 3, 1.5, "F");
  },
  // Pencil
  pencil: (p, cx, cy) => {
    stroke(p, c.accent, 1.4);
    p.line(cx - 6, cy + 6, cx + 5, cy - 5);
    p.line(cx + 5, cy - 5, cx + 7, cy - 7);
    p.line(cx - 6, cy + 6, cx - 8, cy + 4);
    fill(p, c.accent); p.circle(cx - 7, cy + 5, 1.2, "F");
  },
  // Clipboard / checklist
  clipboard: (p, cx, cy) => {
    stroke(p, c.accent, 1.2);
    p.roundedRect(cx - 7, cy - 7, 14, 16, 1.5, 1.5, "S");
    p.roundedRect(cx - 3, cy - 10, 6, 4, 1, 1, "S");
    p.line(cx - 3, cy, cx + 3, cy);
    p.line(cx - 3, cy + 4, cx + 3, cy + 4);
  },
  // Open book
  book: (p, cx, cy) => {
    stroke(p, c.accent, 1.2);
    p.line(cx, cy - 8, cx, cy + 8);
    // Left page curve
    p.line(cx, cy - 8, cx - 9, cy - 5);
    p.line(cx - 9, cy - 5, cx - 9, cy + 5);
    p.line(cx - 9, cy + 5, cx, cy + 8);
    // Right page curve
    p.line(cx, cy - 8, cx + 9, cy - 5);
    p.line(cx + 9, cy - 5, cx + 9, cy + 5);
    p.line(cx + 9, cy + 5, cx, cy + 8);
  },
  // Heart
  heart: (p, cx, cy) => {
    fill(p, c.accent);
    p.circle(cx - 4, cy - 3, 4, "F");
    p.circle(cx + 4, cy - 3, 4, "F");
    p.triangle(cx - 8, cy - 1, cx + 8, cy - 1, cx, cy + 8, "F");
  },
  // Code brackets
  code: (p, cx, cy) => {
    stroke(p, c.accent, 1.6);
    p.line(cx - 5, cy - 7, cx - 9, cy);
    p.line(cx - 9, cy, cx - 5, cy + 7);
    p.line(cx + 5, cy - 7, cx + 9, cy);
    p.line(cx + 9, cy, cx + 5, cy + 7);
  },
  // Sparkle / AI star
  sparkle: (p, cx, cy) => {
    fill(p, c.accent);
    // 4-point star shape via triangles
    p.triangle(cx, cy - 9, cx - 2, cy, cx + 2, cy, "F");
    p.triangle(cx, cy + 9, cx - 2, cy, cx + 2, cy, "F");
    p.triangle(cx - 9, cy, cx, cy - 2, cx, cy + 2, "F");
    p.triangle(cx + 9, cy, cx, cy - 2, cx, cy + 2, "F");
  },
  // Database cylinder
  database: (p, cx, cy) => {
    stroke(p, c.accent, 1.2);
    p.ellipse(cx, cy - 6, 8, 3);
    p.line(cx - 8, cy - 6, cx - 8, cy + 5);
    p.line(cx + 8, cy - 6, cx + 8, cy + 5);
    p.ellipse(cx, cy + 5, 8, 3);
  },
  // Layers stack
  layers: (p, cx, cy) => {
    stroke(p, c.accent, 1.2);
    p.line(cx, cy - 8, cx - 10, cy - 2); p.line(cx, cy - 8, cx + 10, cy - 2);
    p.line(cx - 10, cy - 2, cx, cy + 2); p.line(cx + 10, cy - 2, cx, cy + 2);
    stroke(p, c.accent, 1);
    p.line(cx - 10, cy + 2, cx, cy + 6); p.line(cx + 10, cy + 2, cx, cy + 6);
  },
  // Download arrow
  download: (p, cx, cy) => {
    stroke(p, c.accent, 1.4);
    p.line(cx, cy - 8, cx, cy + 3);
    p.line(cx - 5, cy - 1, cx, cy + 4);
    p.line(cx + 5, cy - 1, cx, cy + 4);
    p.line(cx - 7, cy + 7, cx + 7, cy + 7);
  },
  // People (two heads)
  people: (p, cx, cy) => {
    stroke(p, c.accent, 1.2);
    p.circle(cx - 4, cy - 5, 3.5);
    p.circle(cx + 4, cy - 5, 3.5);
    // Bodies (arcs approximated with lines)
    p.line(cx - 9, cy + 6, cx - 8, cy + 1);
    p.line(cx - 8, cy + 1, cx - 4, cy - 1);
    p.line(cx + 9, cy + 6, cx + 8, cy + 1);
    p.line(cx + 8, cy + 1, cx + 4, cy - 1);
  },
  // Robot / AI agent
  robot: (p, cx, cy) => {
    stroke(p, c.accent, 1.2);
    p.roundedRect(cx - 7, cy - 5, 14, 12, 2, 2, "S");
    fill(p, c.accent);
    p.circle(cx - 3, cy, 1.5, "F");
    p.circle(cx + 3, cy, 1.5, "F");
    p.line(cx, cy - 10, cx, cy - 5);
    p.circle(cx, cy - 10, 1.5, "F");
  },
  // Template grid with plus
  template: (p, cx, cy) => {
    stroke(p, c.accent, 1.2);
    p.roundedRect(cx - 8, cy - 8, 16, 16, 1.5, 1.5, "S");
    p.line(cx, cy - 8, cx, cy + 8);
    p.line(cx - 8, cy, cx + 8, cy);
    fill(p, c.accent); p.circle(cx + 5, cy + 5, 2, "F");
  },
  // Link / chain
  link: (p, cx, cy) => {
    stroke(p, c.accent, 1.4);
    p.roundedRect(cx - 9, cy - 3, 10, 6, 3, 3, "S");
    p.roundedRect(cx - 1, cy - 3, 10, 6, 3, 3, "S");
  },
  // Microphone
  mic: (p, cx, cy) => {
    stroke(p, c.accent, 1.3);
    p.roundedRect(cx - 3, cy - 9, 6, 12, 3, 3, "S");
    p.line(cx - 7, cy + 1, cx - 7, cy + 3);
    p.line(cx + 7, cy + 1, cx + 7, cy + 3);
    p.line(cx - 7, cy + 3, cx - 3, cy + 6);
    p.line(cx + 7, cy + 3, cx + 3, cy + 6);
    p.line(cx, cy + 6, cx, cy + 9);
  },
};

// ── Icon bullet row — icon + text ──

function iconRow(p: jsPDF, icon: IconFn, text: string, x: number, y: number) {
  // Draw icon in a subtle circle bg
  fill(p, c.decor);
  p.circle(x + 14, y + 12, 14, "F");
  icon(p, x + 14, y + 12);

  // Text to the right
  p.setFontSize(17);
  p.setFont("helvetica", "normal");
  ink(p, c.text);
  p.text(text, x + 38, y + 16);
  return y + 40;
}

// ── Icon + bold label + desc row ──

function iconLabelRow(p: jsPDF, icon: IconFn, label: string, desc: string, x: number, y: number) {
  fill(p, c.decor);
  p.circle(x + 14, y + 14, 14, "F");
  icon(p, x + 14, y + 14);

  p.setFontSize(17);
  p.setFont("helvetica", "bold");
  ink(p, c.text);
  p.text(label, x + 38, y + 13);

  p.setFontSize(14);
  p.setFont("helvetica", "normal");
  ink(p, c.muted);
  p.text(desc, x + 38, y + 28);

  return y + 48;
}

// ── Slide definitions ──

const slideFns: Array<(p: jsPDF, n: number, total: number) => void> = [];
function add(fn: (p: jsPDF, n: number, total: number) => void) { slideFns.push(fn); }

// ── 1. Title ──
add((p) => {
  bg(p); decor(p);
  heading(p, "Drafta AI", W / 2, 250, 56, "center");
  p.setFontSize(20); p.setFont("helvetica", "normal"); ink(p, c.muted);
  p.text("One Chat. Every Tool. Zero Tab-Switching.", W / 2, 310, { align: "center" });
});

// ── 2. Sound Familiar? ──
add((p, n, tot) => {
  bg(p); decor(p); slideNum(p, n, tot);
  let y = heading(p, "Sound Familiar?", LX, 90);
  y += 24;

  const items: [IconFn, string][] = [
    [icons.tabs, "Chat with AI in Tab 1. Copy. Open Google Docs in Tab 2. Paste. Format."],
    [icons.grid, "Need a spreadsheet? Open Sheets. Re-explain everything from scratch."],
    [icons.screen, "Client wants slides? Launch Canva. Start over. Again."],
    [icons.search, "Boss asks 'what did we decide?' Good luck searching 6 different tools."],
  ];
  items.forEach(([icon, text]) => { y = iconRow(p, icon, text, LX, y); });
});

// ── 3. Great Tools. Terrible Together. ──
add((p, n, tot) => {
  bg(p); decor(p); slideNum(p, n, tot);
  let y = heading(p, "Great Tools. Terrible Together.", LX, 90);
  y += 32;

  const colW = (CW - 32) / 2;
  card(p, LX, y, colW, 260, 12);
  card(p, LX + colW + 32, y, colW, 260, 12);

  p.setFontSize(12); p.setFont("helvetica", "bold"); ink(p, c.accent);
  p.text("THE TOOLS", LX + 24, y + 30);
  body(p, "ChatGPT, Notion, Google Docs, Sheets, Canva, Mermaid, Slides...", LX + 24, y + 52, colW - 48, 16);
  body(p, "Each one is brilliant at one thing. We're not here to replace them.", LX + 24, y + 130, colW - 48, 16);

  const rx = LX + colW + 32;
  p.setFontSize(12); p.setFont("helvetica", "bold"); ink(p, c.accent);
  p.text("THE PROBLEM", rx + 24, y + 30);
  body(p, "It's the gaps between them.", rx + 24, y + 52, colW - 48, 16);
  body(p, "Your context is scattered across tabs. Your AI has amnesia in every new chat. Your work lives in 10 different places.", rx + 24, y + 96, colW - 48, 16);
});

// ── 4. Quote — The aha moment ──
add((p, n, tot) => {
  bg(p); decor(p); slideNum(p, n, tot);

  p.setFontSize(140); p.setFont("helvetica", "bold"); ink(p, c.accent);
  p.setGState(new (p as any).GState({ opacity: 0.15 }));
  p.text("\u201C", W / 2, 185, { align: "center" });
  p.setGState(new (p as any).GState({ opacity: 1 }));

  p.setFontSize(23); p.setFont("helvetica", "italic"); ink(p, c.text);
  const lines = p.splitTextToSize(
    "What if the AI actually remembered what you were working on — and could create docs, sheets, charts, and slides, all in one place?", 580
  );
  p.text(lines, W / 2, 240, { align: "center" });

  const attrY = 240 + lines.length * 30 + 36;
  fill(p, c.accent); p.roundedRect(W / 2 - 16, attrY, 32, 2, 1, 1, "F");
  p.setFontSize(13); p.setFont("helvetica", "normal"); ink(p, c.muted);
  p.text("The question that started everything", W / 2, attrY + 22, { align: "center" });
});

// ── 5. Who We Built This For ──
add((p, n, tot) => {
  bg(p); decor(p); slideNum(p, n, tot);
  let y = heading(p, "Who We Built This For", LX, 90);
  y += 24;

  const items: [IconFn, string][] = [
    [icons.rocket, "Founders drafting pitch decks and financial models side by side"],
    [icons.pencil, "Content teams producing blogs, calendars, and social plans from one brief"],
    [icons.clipboard, "Product managers writing specs, tracking tasks, and visualizing flows"],
    [icons.book, "Students and researchers organizing notes, data, and presentations"],
    [icons.heart, "Anyone tired of copy-pasting between AI and their actual work"],
  ];
  items.forEach(([icon, text]) => { y = iconRow(p, icon, text, LX, y); });
});

// ── 6. Section — So Here's What We Made ──
add((p, n, tot) => {
  bg(p); decor(p); slideNum(p, n, tot);

  stroke(p, c.cardBorder, 1);
  p.line(W / 2 - 60, 250, W / 2 - 16, 250);
  p.line(W / 2 + 16, 250, W / 2 + 60, 250);
  stroke(p, c.accent, 1.5);
  p.circle(W / 2, 250, 5);

  heading(p, "So Here's What We Made", W / 2, 286, 42, "center");
});

// ── 7. One Chat. Five Superpowers. ──
add((p, n, tot) => {
  bg(p); decor(p); slideNum(p, n, tot);
  let y = heading(p, "One Chat. Five Superpowers.", LX, 90);
  y += 22;

  const items: [IconFn, string, string][] = [
    [icons.doc, "Documents", "Rich editor, AI writes and edits sections, exports to DOCX and PDF"],
    [icons.grid, "Spreadsheets", "Excel-like with formulas and dropdowns, AI fills data, exports to XLSX"],
    [icons.nodes, "Diagrams", "Flowcharts, mind maps, org charts, data charts — one message"],
    [icons.screen, "Presentations", "12 themed decks with Google Fonts, stats cards, PPTX export"],
    [icons.globe, "Web Search", "AI searches the web live and cites sources inline"],
  ];
  items.forEach(([icon, label, desc]) => { y = iconLabelRow(p, icon, label, desc, LX, y); });
});

// ── 8. How We Built It ──
add((p, n, tot) => {
  bg(p); decor(p); slideNum(p, n, tot);
  let y = heading(p, "How We Built It", LX, 90);
  y += 24;

  const items: [IconFn, string][] = [
    [icons.code, "Next.js 16 + React 19 — fast, modern, server-rendered"],
    [icons.sparkle, "Google Gemini AI — streaming responses with live web search"],
    [icons.database, "Neon Postgres + Drizzle ORM — serverless, scalable, type-safe"],
    [icons.layers, "Fortune Sheet, Tiptap, Mermaid, Recharts — best-in-class editors"],
    [icons.download, "pptxgenjs, jsPDF, SheetJS, docx — native export for everything"],
  ];
  items.forEach(([icon, text]) => { y = iconRow(p, icon, text, LX, y); });
});

// ── 9. Where We're Headed ──
add((p, n, tot) => {
  bg(p); decor(p); slideNum(p, n, tot);
  let y = heading(p, "Where We're Headed", LX, 90);
  y += 24;

  const items: [IconFn, string][] = [
    [icons.people, "Real-time collaboration — multiplayer editing across all file types"],
    [icons.robot, "AI agents that autonomously research and build project assets"],
    [icons.template, "Template marketplace — pre-built decks, docs, and sheet templates"],
    [icons.link, "Integrations — Slack, Gmail, Notion import, calendar sync"],
    [icons.mic, "Voice-to-workspace — talk and watch your project build itself"],
  ];
  items.forEach(([icon, text]) => { y = iconRow(p, icon, text, LX, y); });
});

// ── 10. The Impact ──
add((p, n, tot) => {
  bg(p); decor(p); slideNum(p, n, tot);
  let y = heading(p, "The Impact", LX, 100);
  y += 36;

  const paras = [
    "Every project starts as a conversation. Drafta turns that conversation into real deliverables — documents, data, visuals, presentations — without ever leaving the chat.",
    "No more copy-pasting. No more re-explaining. No more context lost between tabs.",
    "Just one place where your AI knows your entire project and builds with you.",
  ];
  paras.forEach((para) => { y = body(p, para, LX, y, CW - 40, 19) + 10; });
});

// ── 11. Quote — Team mission ──
add((p, n, tot) => {
  bg(p); decor(p); slideNum(p, n, tot);

  p.setFontSize(140); p.setFont("helvetica", "bold"); ink(p, c.accent);
  p.setGState(new (p as any).GState({ opacity: 0.15 }));
  p.text("\u201C", W / 2, 185, { align: "center" });
  p.setGState(new (p as any).GState({ opacity: 1 }));

  p.setFontSize(23); p.setFont("helvetica", "italic"); ink(p, c.text);
  const lines = p.splitTextToSize(
    "We didn't want to build another AI chatbot. We wanted to build the workspace that makes every other tab unnecessary.", 580
  );
  p.text(lines, W / 2, 240, { align: "center" });

  const attrY = 240 + lines.length * 30 + 36;
  fill(p, c.accent); p.roundedRect(W / 2 - 16, attrY, 32, 2, 1, 1, "F");
  p.setFontSize(13); p.setFont("helvetica", "normal"); ink(p, c.muted);
  p.text("The Drafta Team", W / 2, attrY + 22, { align: "center" });
});

// ── 12. Closing ──
add((p) => {
  bg(p); decor(p);
  heading(p, "Let's Build Something", W / 2, 252, 48, "center");
  p.setFontSize(19); p.setFont("helvetica", "normal"); ink(p, c.muted);
  p.text("drafta-ai.vercel.app", W / 2, 306, { align: "center" });
});

// ── Generate PDF ──
const total = slideFns.length;
const pdf = new jsPDF({ orientation: "landscape", unit: "pt", format: [W, H] });

slideFns.forEach((render, i) => {
  if (i > 0) pdf.addPage([W, H], "landscape");
  render(pdf, i + 1, total);
});

const buf = Buffer.from(pdf.output("arraybuffer"));
fs.writeFileSync("deck/Drafta-AI-Deck.pdf", buf);
console.log(`Done — deck/Drafta-AI-Deck.pdf (${(buf.length / 1024).toFixed(0)} KB, ${total} slides)`);
