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
- Sparkle icon in a sage gradient tile
- The quote in italic (max 3 lines, ellipsis overflow)
- The author below the quote
- A subtle "↻ hourly" label bottom-right
- "Positive Vibes" label bottom-left in sage green

The card is fully functional without being clicked. It provides daily value just by being visible on the dashboard.

### Mode 2 — Conversation Page (active)
Clicking the card navigates to `/positive-vibes`. This is a full-screen chat interface with a mindful coach AI powered by Gemini. The current quote is shown as a banner at the top of each session for grounding. The session is fresh on each visit (no history persistence). The conversation clears on page refresh.

---

## Quote System

**Quote type:**
```typescript
interface Quote {
  q: string  // quote text
  a: string  // author name
}
```

**Source:** ZenQuotes API — `https://zenquotes.io/api/quotes` (free, no API key). Returns `Quote[]`.

**Caching strategy (localStorage):**

| Key | Type | Purpose |
|-----|------|---------|
| `positive_vibes_quotes` | `Quote[]` (JSON) | Cached batch of quotes |
| `positive_vibes_fetched_at` | ISO string | When the batch was fetched |
| `positive_vibes_index` | number | Current quote index in batch |
| `positive_vibes_last_rotated` | ISO string | When the quote last changed |

**Rotation logic (run on mount in `QuoteDisplay`):**
1. Read `positive_vibes_last_rotated` from localStorage
2. If more than 1 hour has passed since last rotation (or no rotation yet), increment `positive_vibes_index` by 1 and update `positive_vibes_last_rotated` to now
3. If `positive_vibes_index` **equals or exceeds** the batch length, or the batch is empty, or `positive_vibes_fetched_at` is more than 24 hours ago — fetch a fresh batch via `/api/positive-vibes/quotes`, reset index to 0, update `fetched_at`
4. Display `quotes[index]`

**Quote API route:** `GET /api/positive-vibes/quotes` — server-side proxy to ZenQuotes. No auth required (proxying public data with no API key).

**Response:** `Quote[]` — the raw ZenQuotes array passed through as-is.

**Error response:** `{ error: string }` with HTTP 500 if ZenQuotes is unreachable.

---

## Conversation System

**Model:** `gemini-2.5-flash` via existing `@google/genai` SDK

**System prompt delivery:** Pass as `config.systemInstruction` in the `ai.models.generateContent()` call — same pattern used in other routes in this codebase.

**System prompt text:**
> You are a warm, mindful coach. Your role is to listen, encourage, and help the user gently reframe negative thinking. You do not give advice unless asked. You reflect back what you hear, ask gentle clarifying questions, and hold space for the user's feelings. Your tone is calm, grounded, and compassionate — like a trusted friend who also happens to have deep wisdom. Never be dismissive. Never rush to fix. Let the user feel heard first.
>
> Begin each conversation by acknowledging the quote of the day if the user references it, but do not force it.

**Session state:** Messages array in React state only — cleared on page refresh. No cross-session memory.

**Response mode:** Non-streaming. Wait for the full reply before displaying. The loading state (animated dots) covers the wait time.

**Max input length:** 1000 characters. Enforce client-side (disable Send if input exceeds limit, show character count warning at 900+).

### Chat API Contract

**Route:** `POST /api/positive-vibes/chat`

**Auth:** Required. Same `auth()` guard as all other AI routes — returns `{ error: "Not authenticated" }` with HTTP 401 if no valid session.

**Request body:**
```json
{
  "messages": [
    { "role": "user", "content": "I've been feeling overwhelmed lately..." },
    { "role": "model", "content": "I hear you. What feels heaviest right now?" }
  ]
}
```

Each message: `{ role: "user" | "model", content: string }`. Full conversation history sent on every request. The route maps directly to Gemini's `contents` format (role `"user"` → `"user"`, role `"model"` → `"model"`).

**Success response:** `{ reply: string }` — the assistant's plain text reply.

**Error response:** `{ error: string }` with HTTP 400 (bad input) or HTTP 500 (Gemini failure).

**Validation:** `messages` must be present and an array. Each element must have `role` of `"user"` or `"model"` and a string `content`. Returns HTTP 400 `{ error: "invalid messages format" }` otherwise.

---

## UI Design

### Colour Palette (Sage Green)
- **Page background:** `#f2f6f2`
- **Surface (cards, chat area):** `#ffffff`
- **Border:** `#c8d8c8`
- **Subtle border:** `#e4efe4`
- **Primary (user bubbles, buttons, labels):** `#4a7c59`
- **Quote banner bg:** `#f2f6f2`
- **Quote banner text:** `#4a7c59`
- **AI reply bg:** `#f2f6f2`
- **AI reply text:** `#444444`
- **Muted text / loading dots:** `#b0c8b0`
- **Input bg:** `#f2f6f2`
- **Input bar bg:** `#fafcfa`

### Dashboard Card Internal Layout
```
┌─────────────────────────────┐  h-64
│ [✨ sage icon 36×36]         │
│                             │
│ "Quote text in italic..."   │  max 3 lines, overflow ellipsis
│ — Author                    │
│                             │
│ Positive Vibes  ↻ hourly    │  ← bottom row: label left, indicator right
└─────────────────────────────┘
```
The `QuoteDisplay` component renders this content inside the existing `GlowCard` shell. The card maintains `h-64` consistent with other dashboard cards.

### App Grid Integration

`components/app-grid.tsx` currently passes `description` as a string to a `<p>` tag inside each card. For Positive Vibes, instead of a static description, the card should render a `<QuoteDisplay />` component.

**Implementation approach:** Add a `renderContent` optional field to the app config type. If `renderContent` is provided, render it instead of the `<p>` description. For Positive Vibes:

```typescript
{
  href: "/positive-vibes",
  icon: Sparkles,  // from lucide-react
  title: "Positive Vibes",
  description: "Your daily dose of calm and inspiration.",  // fallback for non-JS / SSR
  renderContent: () => <QuoteDisplay />,  // replaces description when available
  glowColor: "green" as const,
}
```

`QuoteDisplay` is a `"use client"` component. `AppGrid` is already `"use client"`, so embedding `QuoteDisplay` directly does not require making any server components client-side.

**GlowCard green variant:** Add to `glowColorMap` in `components/ui/spotlight-card.tsx`:
```typescript
green: { base: 140, spread: 150 }
```
Also add `"green"` to the `glowColor` union type: `'blue' | 'purple' | 'green' | 'red' | 'orange'`.

### Conversation Page Layout
```
┌────────────────────────────────────────┐
│ ← Dashboard  |  ✨  Positive Vibes     │  ← sticky header, sage gradient bg
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
│ x / 1000 chars                         │  ← shown at 900+
└────────────────────────────────────────┘
```

**User messages:** Right-aligned, `bg-[#4a7c59]` green, white text, border-radius `12px 12px 2px 12px`

**AI replies:** Left-aligned, `bg-[#f2f6f2]`, `border border-[#c8d8c8]`, border-radius `0 12px 12px 12px`, text `#444`, `whitespace-pre-wrap`

**Loading:** 3 animated bounce dots in `#b0c8b0` inside an AI reply shell (same pattern as Mentor)

**Error:** Soft inline card — `bg-[#fff8f0]`, `border border-[#f5c6a0]`, border-radius matching AI reply, text in `#c47c2a`. Non-blocking.

---

## File Structure

```
app/
  positive-vibes/
    page.tsx                    ← conversation chat UI (client component)
  api/
    positive-vibes/
      quotes/
        route.ts                ← GET /api/positive-vibes/quotes (ZenQuotes proxy, no auth)
      chat/
        route.ts                ← POST /api/positive-vibes/chat (Gemini, auth required)
components/
  quote-display.tsx             ← "use client" — quote fetching, caching, hourly refresh
  app-grid.tsx                  ← add Positive Vibes card with renderContent support
components/ui/
  spotlight-card.tsx            ← add "green" to glowColorMap and type union
```

---

## Error Handling

- **ZenQuotes unavailable:** `QuoteDisplay` and conversation page banner fall back to hardcoded quote: `{ q: "Breathe. This too shall pass.", a: "Unknown" }`
- **Chat API error:** Inline warning card in the chat (orange-toned, non-breaking)
- **Empty input:** Send button disabled
- **Input over 1000 chars:** Send button disabled; character count shown in muted red
- **localStorage unavailable:** Degrade gracefully — fetch quote fresh on each render, skip caching

---

## Out of Scope

- Conversation history persistence across sessions
- User-selectable quote categories
- Saving favourite quotes
- Authentication on the quotes route (public data, no API key exposed)
