# Positive Vibes — Design Spec
**Date:** 2026-03-19
**Status:** Approved

---

## Overview

Positive Vibes is a two-mode tool in the dashboard. In its passive state (dashboard card), it displays an inspiring quote that refreshes every hour — no click required. When opened, it becomes a full-screen conversational companion: a mindful coach AI that listens, encourages, and helps the user reframe negative thinking. It uses the free ZenQuotes API for quotes and Gemini for conversation.

---

## Dual-Mode Concept

### Mode 1 — Dashboard Card (passive)
The Positive Vibes card on the main dashboard fetches and displays a live quote from ZenQuotes. It refreshes every hour client-side using a timestamp stored in `localStorage`. The card shows:
- Sparkle emoji icon (✨) in a sage gradient tile
- The quote in italic
- The author
- A subtle "↻ hourly" refresh indicator
- "Positive Vibes" label in sage green

The card is fully functional without being clicked. It provides daily value just by being visible on the dashboard.

### Mode 2 — Conversation Page (active)
Clicking the card navigates to `/positive-vibes`. This is a full-screen chat interface with a mindful coach AI powered by Gemini. The current quote is shown as a banner at the top of each session for grounding. The session is fresh on each visit (no history persistence, no localStorage pattern tracking). The conversation clears on page refresh.

---

## Quote System

**Source:** ZenQuotes API — `https://zenquotes.io/api/quotes` (completely free, no API key required). Returns an array of quotes with `q` (quote) and `a` (author) fields.

**Caching strategy:**
- On first load, fetch a batch of quotes and store them in `localStorage` under `positive_vibes_quotes` (array) and `positive_vibes_fetched_at` (timestamp)
- Serve quotes from the cached batch one per hour, cycling through by index stored in `positive_vibes_index`
- When the batch is exhausted or 24 hours have passed, fetch a fresh batch
- This avoids calling the API every hour and respects ZenQuotes' rate limits

**Quote API route:** `GET /api/positive-vibes/quotes` — server-side proxy to ZenQuotes. Proxying avoids CORS issues with direct client-side fetching.

---

## Conversation System

**Model:** `gemini-2.5-flash` via existing `@google/genai` SDK

**System prompt:**
> You are a warm, mindful coach. Your role is to listen, encourage, and help the user gently reframe negative thinking. You do not give advice unless asked. You reflect back what you hear, ask gentle clarifying questions, and hold space for the user's feelings. Your tone is calm, grounded, and compassionate — like a trusted friend who also happens to have deep wisdom. Never be dismissive. Never rush to fix. Let the user feel heard first.
>
> Begin each conversation by acknowledging the quote of the day if the user references it, but do not force it.

**Session state:** Messages array in React state only — cleared on page refresh. No cross-session memory.

**API route:** `POST /api/positive-vibes/chat` — accepts `{ messages }`, returns `{ reply }`. Auth-gated (same pattern as other routes).

---

## UI Design

### Colour Palette (Sage Green)
- **Background:** `#f2f6f2`
- **Surface:** `#ffffff`
- **Border:** `#c8d8c8`
- **Subtle border:** `#e4efe4`
- **Primary (user bubbles, buttons):** `#4a7c59`
- **Quote banner bg:** `#f2f6f2`
- **Quote banner text:** `#4a7c59`
- **AI reply bg:** `#f2f6f2`
- **AI reply text:** `#444444`
- **Muted text:** `#b0c8b0`
- **Input bg:** `#f2f6f2`
- **Page bg (chat):** `#fafcfa`

### Dashboard Card Layout
- Same `GlowCard` component with `glowColor: "green"` (add to spotlight-card if not present, or use `"blue"` as fallback)
- Instead of a static description, render the live quote: italic text, author below, refresh indicator at bottom
- Card height stays consistent with other dashboard cards (`h-64`)
- Quote text truncated with ellipsis if too long (max 3 lines)

### Conversation Page Layout
```
┌────────────────────────────────────────┐
│ ← Dashboard  |  ✨  Positive Vibes     │  ← sticky header, sage gradient
├────────────────────────────────────────┤
│  ✦ "Quote text" — Author               │  ← quote banner, always visible
├────────────────────────────────────────┤
│                                        │
│           [user message bubble] →      │
│                                        │
│ ← [AI reply card]                      │
│                                        │
├────────────────────────────────────────┤
│ [input textarea]          [Send ✦]     │  ← fixed bottom bar
└────────────────────────────────────────┘
```

**User messages:** Right-aligned, `bg-[#4a7c59]` green, white text, border-radius `12px 12px 2px 12px`

**AI replies:** Left-aligned, `bg-[#f2f6f2]`, `border border-[#c8d8c8]`, border-radius `0 12px 12px 12px`, text `#444`

**Loading:** 3 animated bounce dots in `#b0c8b0` inside an AI reply shell

**Error:** Soft red inline card — non-blocking, styled to match the calm theme

---

## App Grid Integration

Add to `components/app-grid.tsx`:

```ts
{
  href: "/positive-vibes",
  icon: Sparkles,  // from lucide-react
  title: "Positive Vibes",
  description: "quote",  // special marker — rendered as live quote instead of static text
  glowColor: "green" as const,
}
```

The `AppGrid` component needs a small update: if `description === "quote"`, render a `<QuoteDisplay />` client component instead of a `<p>` tag. `QuoteDisplay` handles the localStorage caching and hourly refresh logic.

**GlowCard green variant:** Add `green: { base: 140, spread: 150 }` to the `glowColorMap` in `components/ui/spotlight-card.tsx`.

---

## File Structure

```
app/
  positive-vibes/
    page.tsx                    ← conversation chat UI
  api/
    positive-vibes/
      quotes/
        route.ts                ← GET /api/positive-vibes/quotes (ZenQuotes proxy)
      chat/
        route.ts                ← POST /api/positive-vibes/chat (Gemini conversation)
components/
  quote-display.tsx             ← client component: quote fetching, caching, hourly refresh
  app-grid.tsx                  ← add Positive Vibes card, handle "quote" description
components/ui/
  spotlight-card.tsx            ← add "green" to glowColorMap
```

---

## Quote Caching (localStorage)

| Key | Value | Notes |
|-----|-------|-------|
| `positive_vibes_quotes` | `Quote[]` (JSON) | Batch of quotes from ZenQuotes |
| `positive_vibes_fetched_at` | ISO timestamp | When the batch was fetched |
| `positive_vibes_index` | number | Index of current quote in batch |
| `positive_vibes_last_rotated` | ISO timestamp | When the quote last changed |

**Rotation logic:**
1. On mount, check `positive_vibes_last_rotated`
2. If more than 1 hour has passed (or no rotation yet), increment index and update `last_rotated`
3. If index exceeds batch length or batch is empty or >24h old, fetch new batch via `/api/positive-vibes/quotes`
4. Display `quotes[index]`

---

## Error Handling

- **ZenQuotes unavailable:** Show a hardcoded fallback quote on the dashboard card: `{ q: "Breathe. This too shall pass.", a: "Unknown" }`
- **Chat API error:** Display inline error card in the chat — styled in soft red, non-breaking
- **Empty input:** Send button disabled
- **localStorage unavailable:** Degrade gracefully — fetch quote fresh on each render, skip caching

---

## Out of Scope

- Conversation history persistence across sessions
- User-selectable quote categories
- Saving favourite quotes
- Authentication gating on the quotes endpoint (public data, no cost to proxy)
- Auth gating on quotes route (no sensitive data or API key exposure)
