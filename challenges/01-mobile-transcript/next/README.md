# UI Challenge 01 — The Transcript Reader on a Phone (Next Pass)

**Contributor:** Bama Charan Chhandogi  
**Interactive Prototype:** Open `index.html` in any browser or mobile simulator (supports 320px, 375px, 390px viewports).

---

## 1. What was wrong with the current design (`after/`)

During real-device mobile testing (documented in issues [#109](https://github.com/neugence/whipscribe-buildathon/issues/109), [#110](https://github.com/neugence/whipscribe-buildathon/issues/110), and [#111](https://github.com/neugence/whipscribe-buildathon/issues/111)), we surfaced several structural flaws:

1. **Floating Dock Stacking & Collisions (Issue #109):**  
   Entering "Edit lines" renders a floating dark bar (`Undo / Redo / 1 change / Discard / Save changes`) directly on top of the green "Loved it? Keep going" promo card and sits immediately above the sticky audio player. On a phone screen, three concurrent docks leave almost zero visible lines for actual reading or editing.
2. **Persistent Sticky Upsell Gating:**  
   The "Keep reading" bar sits permanently fixed above the audio player, consuming 120px+ of viewport space throughout the user's entire session, even while reading the first 10 seconds of a free preview.
3. **State Desync on Save:**  
   Saving transcript edits did not update the header badge, leaving the user with an alarming orange `Unsaved edits` indicator even after successful persistence.
4. **Print Justification on Mobile:**  
   Justified text in narrow columns (243px–320px) creates uneven word spacing ("rivers of white") and jagged line wraps.
5. **No Processing State:**  
   The current screens had no design for what a user sees while Whisper is actively transcribing on the GPU.

---

## 2. Answers to the Core Challenge Questions

### What is the one thing a person on a phone came here to do, and how many taps away is it now?
* **The Goal:** Read what was said and listen to the audio proof.
* **The Fix:** Zero taps. The player and transcript text are synchronized immediately on load. The active spoken line highlights automatically as the audio advances. Tapping any line's timestamp jumps playback directly to that second.

### The "Keep reading" bar and the player take the bottom of the screen. Is that the right trade?
* **No.** Permanently stacking an upsell banner above a sticky player creates a claustrophobic viewport. When the virtual keyboard opens, the layout breaks.
* **The Fix:** Decouple them. The audio player stays pinned to the bottom as a compact, blur-backed dock. The preview limit is placed **inline** directly at the boundary where the free audio ends (e.g. at 1:05), accompanied by a clean one-click top-up card. It never occludes active reading.

### The More menu has nine items. Which belong there, and which should not exist on a phone?
* **Kept in Sheet:**
  - *Reading settings* (Timestamps toggle, font size)
  - *Export options* (PDF, TXT, SRT)
  - *Delete recording* (destructive, kept at bottom in red)
* **Promoted to Direct Actions:**
  - *Search* (promoted to a dedicated search icon in the top header)
  - *Edit lines* (contextual tool)
* **Removed / Consolidated:**
  - *Quiz me* belongs inside the Summary/AI Chat tab, not in general reader options.
  - *Details & Rename* are consolidated into a tap on the header filename.

### What does the reader look like while processing?
* Designed in `index.html` (State 5):
  - Subtle pulsing Whisper engine icon.
  - Progress bar with percentage and real-time status: *"Whisper GPU model active · 90% processed"*.
  - Diarization chunk counter (*"Chunk 4 of 4 · diarizing 4 speakers"*).

### 4 Speakers at 320 px
* Tested at 320px viewport in `index.html`:
  - Uses compact colored avatar dots (`sp-1` through `sp-4`) next to speaker names.
  - Left-aligned text (ragged right) eliminates hyphenation and text squishing.
  - Timestamps live in a compact monospace pill aligned to the right.

### Text selection on a phone
* Selecting a line reveals a lightweight floating dark bubble with 3 instant actions:
  1. `📋 Copy Quote` (copies text + timestamp attribute)
  2. `▶ Play` (plays audio starting from that exact phrase)
  3. `✨ Ask AI` (pipes selected excerpt directly into the AI Chat tab)

---

## 3. How to verify

1. Open `challenges/01-mobile-transcript/next/index.html` in Chrome, Safari, or Brave.
2. Use the controller buttons at the top to toggle between:
   - **320px, 375px, and 390px** viewports.
   - **Default 4-speaker layout**.
   - **Search overlay** with match counter.
   - **Edit Mode** (notice how the edit bar replaces the audio dock rather than colliding).
   - **Live Transcribing State**.
3. Tap **Play (▶)** to test live audio progress bar syncing and automatic speaker highlight.
