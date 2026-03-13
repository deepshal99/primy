# Drafta AI — Vision & Roadmap

## Vision
Drafta AI is the AI-native workspace that replaces the Google Suite for individuals and small teams. Instead of switching between Docs, Sheets, Slides, and ChatGPT, users work in a single chat-driven environment where AI understands their full context and creates the right artifact in the right format.

## Core Thesis
- The office suite is overdue for an AI-native rebuild
- Chat is the universal interface — users describe what they want, AI produces it
- Context is the moat — the more you use Drafta, the better it understands your work
- Multi-format output from single input is the killer feature

## Current State (v1)
- Documents (Plate.js rich text)
- Spreadsheets (Fortune Sheet)
- Diagrams (Mermaid + Excalidraw)
- Presentation Decks (custom slide system)
- AI chat with full project context injection
- Project-based organization

## Planned Milestones

### v1.1 — Polish & Stability
- [ ] Spreadsheet migration: Fortune Sheet → Univer
- [ ] Export improvements: server-side PDF via Puppeteer
- [ ] Mobile responsive pass
- [ ] Performance optimization for large projects

### v1.2 — Collaboration
- [ ] Real-time collaboration (Yjs + PartyKit)
- [ ] Sharing & permissions (view/edit/comment)
- [ ] Comments and annotations on all entity types

### v1.3 — Intelligence
- [ ] Semantic search across all project content
- [ ] Cross-entity references (link a chart to a sheet range)
- [ ] AI memory across sessions (project-level learning)
- [ ] Template library (decks, docs, sheets)

### v2.0 — Platform
- [ ] Plugin/extension system
- [ ] API for programmatic access
- [ ] Team workspaces with admin controls
- [ ] Custom AI model selection (bring your own key)

## Non-Goals (for now)
- Enterprise/large team features (SSO, audit logs)
- Offline-first architecture
- Native mobile apps (web-first)
- Real-time database/Airtable replacement
