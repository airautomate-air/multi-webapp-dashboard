# Mentor — Design Spec
**Date:** 2026-03-19
**Status:** Approved

---

## Overview

Mentor is a chat-based webapp in the multi-app dashboard. It acts as a ruthless AI mentor — no praise, no softening. When the user shares an idea, plan, or piece of work, Mentor steelmans it, identifies real weaknesses, asks hard questions, and delivers direct verdicts. It tracks behavioral patterns silently across sessions using localStorage and injects them into every new session as context.

---

## Interaction Model

**Mode:** Conversational chat (back-and-forth dialogue)
**Session state:** Conversation history lives in React state only — cleared on page refresh
**Cross-session memory:** Patterns only, stored in localStorage under `mentor_patterns`

The user types freely — ideas, plans, written work, anything. Mentor responds every turn with structured feedback. There is no "submit full document" step; the interaction is fluid dialogue.

---

## Pattern Tracking

- After each Mentor response, the client checks for pattern signals — explicit statements from Mentor about recurring behavior (e.g., "I notice you consistently avoid talking about distribution")
- Detected patterns are appended to `localStorage['mentor_patterns']` (array of strings), deduplicating against existing entries
- On every new session, stored patterns are injected silently into the system prompt: `"Known patterns about this user: [list]"`
- Patterns are invisible to the user — no UI to view or manage them
- Pattern extraction is done via a secondary lightweight Claude call after each Mentor response, asking it to output any newly identified patterns as JSON

---

## System Prompt

The full mentor system prompt is:

> You are my ruthless mentor. Your job is not to make me feel good. Your job is to make me better. When I share an idea, plan, or piece of work, tell me what is actually wrong with it.
>
> Do not lead with praise. Do not soften the blow. If the idea is weak, say it is weak. If I am deluding myself, call it out directly.
>
> **1. No Validation Loops** — Never agree with me just because I said something confidently. If I am wrong, tell me directly.
>
> **2. Steelman, Then Destroy** — Present the strongest possible version of my idea first. Then identify the real weaknesses and break them down.
>
> **3. Ask Hard Questions** — If my thinking is shallow, expose the gap with difficult questions instead of filling it for me.
>
> **4. Give Verdicts** — Do not give vague considerations. Give a direct conclusion: "This is a bad idea because X." or "The real problem is Y."
>
> **5. Track My Patterns** — If I repeat the same mistake, name the pattern and call it out clearly so I can see my blind spots.
>
> **6. High Standards Always** — Do not grade me on a curve. Judge my work against the best possible version of what it could be.
>
> You are not here to be liked. You are here to be useful. Every response should leave me sharper than before, even if it stings.

When patterns exist, prepend to the system prompt:
> "Known patterns about this user: [pattern1], [pattern2], ..."

---

## API Design

### `POST /api/mentor`

**Request body:**
```json
{
  "messages": [
    { "role": "user", "content": "..." },
    { "role": "assistant", "content": "..." }
  ],
  "patterns": ["pattern1", "pattern2"]
}
```

**Response:**
```json
{
  "reply": "Mentor's response text"
}
```

**Behavior:**
- Constructs system prompt from the mentor persona + injected patterns
- Passes full `messages` array to Claude (claude-sonnet-4-6)
- Returns the assistant's reply as plain text in `reply`
- Errors return `{ "error": "..." }` with appropriate HTTP status

### `POST /api/mentor/extract-patterns`

**Request body:**
```json
{
  "mentorReply": "..."
}
```

**Response:**
```json
{
  "patterns": ["newly identified pattern"]
}
```

**Behavior:**
- Sends the Mentor's reply to Claude with a minimal prompt asking it to extract any newly identified behavioral patterns as a JSON array
- Returns empty array if none found
- Called client-side after every Mentor response, silently

---

## UI Design

### Visual Theme
- **Background:** `#0a0a0a` (near-black)
- **Surface:** `#0f0f0f` header, `#111` message cards, `#0c0c0c` input bar
- **Borders:** `#1f1f1f` subtle, `#c0392b` red accent on Mentor replies
- **Text:** `#ccc` user messages, `#bbb` mentor body, `#e74c3c` verdict labels, `#e67e22` hard question labels
- **Button:** `#c0392b` red Submit

### Layout
```
┌─────────────────────────────────────┐
│ ← Dashboard  |  Mentor              │  ← sticky header, dark
├─────────────────────────────────────┤
│                                     │
│   [session intro banner]            │
│                                     │
│           [user message bubble] →   │
│                                     │
│ ← [mentor reply card]               │
│    Verdict: ...  (red)              │
│    Steelman: ...                    │
│    Real Problem: ...                │
│    Hard Question: ... (orange)      │
│                                     │
│           [user message bubble] →   │
│                                     │
├─────────────────────────────────────┤
│ [input textarea]         [Submit →] │  ← fixed bottom bar
└─────────────────────────────────────┘
```

### Message Components

**User message:** Right-aligned, `bg-[#1e1e1e]` bubble, `border border-[#2a2a2a]`, text `text-[#ccc]`, border-radius `12px 12px 2px 12px`

**Mentor reply:** Left-aligned card, `bg-[#111]`, `border border-[#1f1f1f]`, `border-l-[3px] border-l-[#c0392b]`, border-radius `0 12px 12px 0`. Sections labeled with small uppercase labels: VERDICT (red), STEELMAN (gray), REAL PROBLEM (gray), HARD QUESTION (orange).

**Session banner:** Centered, small, `border border-[#1a1a1a]` pill. Text: "New session — Mentor knows your patterns." (hidden if no patterns stored yet)

**Loading state:** Animated ellipsis or pulse indicator inside a Mentor reply card shell while awaiting response.

---

## App Grid Integration

Add to `components/app-grid.tsx`:

```ts
{
  href: "/mentor",
  icon: Brain,
  title: "Mentor",
  description: "Share an idea, plan, or piece of work. Get ruthless feedback — no praise, no curve. Just truth.",
  glowColor: "purple"
}
```

Import `Brain` from `lucide-react`.

---

## File Structure

```
app/
  mentor/
    page.tsx               ← chat UI, client component
  api/
    mentor/
      route.ts             ← POST /api/mentor
      extract-patterns/
        route.ts           ← POST /api/mentor/extract-patterns
components/
  app-grid.tsx             ← add Mentor card
```

---

## Error Handling

- API errors surface as a Mentor-styled error message in the chat (not a toast or modal): dark card with red border, text in `text-red-400`
- Empty input: Submit button disabled
- Pattern extraction failure: silent — skip updating localStorage, do not break the chat flow

---

## Out of Scope

- Viewing or managing stored patterns (user explicitly chose invisible)
- Full conversation history persistence (patterns-only persistence chosen)
- Google Drive integration
- File/image uploads
- Authentication gating (consistent with other tools — sign-in prompt only, not hard block)
