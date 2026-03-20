# Positive Vibes — Voice & Globe Feature Design

## Overview

Replace the existing text-chat UI in the Positive Vibes page with a hands-free voice conversation experience. The centrepiece is an animated point-cloud globe that reacts to conversation state. After the conversation the user can save the full transcript to Google Docs.

---

## 1. Architecture

The feature touches four layers:

1. **Globe component** (`components/positive-vibes-globe.tsx`) — self-contained Canvas 2D animation driven by an `audioLevel` prop (0–1).
2. **Positive Vibes page** (`app/positive-vibes/page.tsx`) — orchestrates mic, speech synthesis, globe, and transcript. Replaces the current text-chat layout.
3. **Chat API route** (`app/api/positive-vibes/chat/route.ts`) — switches from `generateContent` to `generateContentStream` and returns a streaming response.
4. **Save-transcript API route** (`app/api/positive-vibes/save-transcript/route.ts`) — new route that calls Google Docs API to create a Doc from the transcript.

---

## 2. Globe Component

**File:** `components/positive-vibes-globe.tsx`

### Props

```ts
interface GlobeProps {
  state: 'idle' | 'listening' | 'speaking' | 'done'
  audioLevel: number   // 0–1, drives ripple when speaking
  size?: number        // canvas px, default 300
}
```

### Visual behaviour

| State     | Dot colour          | Ripple                                  | Glow       |
|-----------|---------------------|-----------------------------------------|------------|
| idle      | Green               | None                                    | Green      |
| listening | Blue                | Gentle constant sway (targetRipple=0.28)| Blue       |
| speaking  | Yellow              | Tracks `audioLevel` × 0.85             | Yellow     |
| done      | Green               | Fades to 0                              | Green      |

- **Points:** 1400 Fibonacci-spiral points on a sphere surface.
- **Dot size:** `0.15 + depth × 0.75` px — tiny, depth-scaled.
- **Rotation:** Slow continuous Y-axis rotation; speed varies by state.
- **Ripple:** Layered sine-wave surface displacement scaled by ripple amount. Zero displacement when `audioLevel === 0` in speaking state.
- **Floating particles:** 32 particles around sphere edge, visible only when `ripple > 0.12`.
- **Glow:** `shadowBlur` on front-facing dots when `ripple > 0.12`.

### Audio level source

- **Listening state:** `SpeechRecognition` is active; globe uses fixed gentle sway (`audioLevel` ignored).
- **Speaking state:** Use `SpeechSynthesisUtterance` lifecycle events to drive `audioLevel`:
  - `onstart` → set `audioLevel = 1`
  - `onend` / `onpause` → set `audioLevel = 0`
  - The globe component smooths transitions internally (`smoothAudio += (audioLevel - smoothAudio) * 0.08` each frame), so the binary 0/1 signal produces natural fade in/out.
  - Note: Capturing actual TTS output level via `AudioContext.destination` is not feasible in browsers (the destination is a sink, not a source), and `ScriptProcessorNode` is deprecated. The utterance event approach is the correct solution.

---

## 3. Voice Input (Speech-to-Text)

**API:** Web Speech API `SpeechRecognition` (Chrome/Edge; free, no key).

- `continuous: false`, `interimResults: false`.
- On `onresult`: capture transcript, stop recognition, call Gemini.
- On `onerror` (`not-allowed`, `network`): surface error label below globe; do not crash.
- Auto-restarts mic after AI finishes speaking (auto-loop).
- User can also tap mic button to start/stop manually.

---

## 4. Voice Output (Text-to-Speech) + Streaming

**API:** Web Speech API `SpeechSynthesis` (all browsers; free, no key).

### Streaming flow

1. Page sends messages array to `POST /api/positive-vibes/chat`.
2. Route streams Gemini tokens as **raw text chunks** in a `ReadableStream` (plain `text/plain` content-type; no SSE envelope).
3. Client reads chunks with `response.body.getReader()` + `TextDecoder`, accumulates a sentence buffer.
4. When a sentence boundary (`.`, `!`, `?`) is detected, enqueue a `SpeechSynthesisUtterance`.
5. Each utterance fires `onend` → if queue is empty and stream is done, transition to auto-loop.

**Voice settings:** `rate: 0.95`, `pitch: 1.0`; use first available `en` voice.

---

## 5. Conversation State Machine

```
idle ──[tap mic]──► listening ──[speech end]──► speaking ──[TTS done]──► idle (auto-loop)
                                                          └──[tap mic]──► listening (interrupt)
                          └──[tap mic]──► idle (cancel)

[End session button] available in all states → done
done ──[tap mic]──► listening (new round)
```

- The **End** button is visible in all states (`idle`, `listening`, `speaking`). Tapping it always transitions to `done` and cancels any in-progress recognition or speech.
- `speaking → idle` (auto-loop) fires only after all queued utterances finish AND the stream is complete.
- After `done`, show "Save to Google Docs" button.

---

## 6. UI Layout

The page replaces the current text-chat layout:

```
┌─────────────────────────────────┐
│  ← Dashboard  ✨  Positive Vibes│  (header, unchanged)
│  ✦ "Breathe. This too..."       │  (quote banner, unchanged)
├─────────────────────────────────┤
│                                 │
│         [Globe — 300px]         │
│                                 │
│     "Tap the mic to begin"      │  (state label)
│                                 │
│           🎙  [End]             │  (mic button + end button)
│                                 │
│     [Save to Google Docs]       │  (visible only in done state)
│                                 │
└─────────────────────────────────┘
```

- Background: `#0d1a14` (dark green-black), matching the globe's aesthetic.
- Mic button: 56 × 56px circle; pulses blue when listening, still when idle.
- End button: small text button beside mic; tapping it moves to `done` state.
- Error label: small italic text below state label, fades in/out.

---

## 7. Save Transcript to Google Docs

### OAuth scopes (additions to existing Google provider)

```
https://www.googleapis.com/auth/documents
https://www.googleapis.com/auth/drive.file
```

These are added to the existing `next-auth` Google provider scope list.

### API route

**File:** `app/api/positive-vibes/save-transcript/route.ts`

- `POST` with `{ transcript: Message[] }` body.
- Auth-gated via `auth()`.
- Calls `https://docs.googleapis.com/v1/documents` to create a new Doc titled `"Positive Vibes — <date>"`.
- Populates the Doc body with speaker-labelled lines (`You: …` / `Assistant: …`).
- Returns `{ url: string }` — the Google Docs edit URL.
- Client opens the URL in a new tab.

### Transcript format stored in page state

```ts
type Message = { role: 'user' | 'model'; content: string }
```

Uses `'model'` (not `'assistant'`) to match the Gemini API and the existing chat route validation. The save-transcript route maps `'model'` → `"Assistant"` when writing display lines to the Google Doc.

---

## 8. Streaming Chat API Route Changes

**File:** `app/api/positive-vibes/chat/route.ts`

- Switch from `generateContent` to `generateContentStream`.
- Return a `ReadableStream` with raw text chunks (no SSE envelope needed — client reads raw bytes).
- Keep existing auth guard, system prompt, and error handling.
- Keep `null` body defensive parsing fix already in place.

---

## 9. Error Handling

| Scenario | Behaviour |
|---|---|
| SpeechRecognition not supported | Show "Voice not supported in this browser" banner; hide mic button |
| Mic permission denied | State label: "Mic access denied — check browser settings" |
| Gemini API error | State label: "Something went wrong, try again"; return to idle |
| Google Docs API error | Toast: "Couldn't save — try again"; URL not opened |
| No internet | Gemini fetch fails; handled same as API error |

---

## 10. Out of Scope

- Chat history persistence (no database).
- Mobile push-to-talk (tap to start/stop is sufficient).
- Custom voice selection UI.
- Editing the transcript before saving.
- In-page transcript review panel — users review the conversation in Google Docs after saving. No transcript display on the page itself.
- Visual distinction between `idle` and `done` globe states — both are green/calm; the state label and Save button provide sufficient context.
