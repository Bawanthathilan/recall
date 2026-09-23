# Recall roadmap

Design source: Claude Design artifact "Flashcard App UI" (7 screens).
Phases 1–4 run in Expo Go. From Phase 5 (shipping) on, the app uses development builds:
JavaScript-only changes ship as over-the-air updates (EAS Update); features with new native
code (e.g. audio recording) need a new store build. Phase 8 adds a backend.

## ✅ Phase 1 — Foundation
- [x] Expo + TypeScript + Expo Router, theme tokens
- [x] SQLite: decks, cards (FSRS fields), review_logs
- [x] Onboarding, Today, Study (ts-fsrs intervals), Create (Basic)
- [x] Sample deck

## ✅ Phase 2 — Match the mockup + editing
- [x] Theme: ink primary buttons, extra tokens from the mockup, Ionicons
- [x] Onboarding: 6-goal grid, logo, 3 steps (goals → name → daily new cards)
- [x] Today: greeting, streak pill, dark hero card with time estimate, deck rows with icon + mastery bar
- [x] Tab bar: Today · Decks · ＋ · Stats · Explore (Stats/Explore placeholders)
- [x] Decks tab: deck detail, search cards, new/rename/delete deck
- [x] Card editor (new + edit + delete), opened from ＋, deck detail, and the Study screen
- [x] Study: progress bar, answer layout, written-out intervals, Edit, Flag, Undo
- [x] Settings screen (name, goals, daily new cards)

## ✅ Phase 3 — Card types
- [x] Notes vs cards schema split (migration v3, tested against a real SQLite db), tags
- [x] Code cards (Prism syntax highlighting, language label)
- [x] Cloze (incl. hints and clozes inside `code`), Basic + reversed
- [x] Vocabulary cards (reading, transliteration, example, type the meaning; optional reverse)
- [x] Editor toolbar (bold, code block, cloze) and per-type editor
- [x] Unit tests: `npm test` (notes, markup, highlighting, FSRS, migrations)

## ✅ Phase 4 — Progress & habit
- [x] Progress screen: retention, reviews, best streak, 16-week heatmap (tap a day), 7-day forecast, deck filter
- [x] Exam deadlines per deck (migration v4), per-deck new cards/day, pace card with "Use N a day"
- [x] Daily reminder notifications (next 7 days planned locally; skips days you've studied or have nothing due)

## Phase 5 — Ship v1.0  ← next
Local-only app, no backend. Goal: real people using it.
- [x] Hide unfinished UI: Explore tab hidden until Phase 7; Settings takes its tab slot
- [x] App icon, splash, favicon, notification icon (`node scripts/make-icons.mjs`)
- [x] Bundle ID `com.bawantha.recall`, iPhone only, expo-notifications plugin, `eas.json`
      (versions managed by EAS, build numbers auto-increment)
- [ ] Development build running on the iOS Simulator (`npx expo run:ios`) and Android
- [ ] Crash reporting, E2E tests of the main flows, large-deck performance (10,000+ cards)
- [ ] Privacy policy (data stays on the device), store listings and screenshots
- [ ] TestFlight + Play internal testing, then store submission
- [x] EAS Update configured (channels per build profile; runtime = app version)
- [ ] First `eas update` published to TestFlight testers

## Phase 6 — Language & media
- [ ] Text-to-speech with 0.5× speed, Japanese fonts
- [ ] Images and audio on cards, record pronunciation (new store build)
- [ ] Math formulas

## Phase 7 — Import, export, Explore
- [ ] Anki .apkg import, CSV import, export/backup
- [ ] Explore tab with starter decks per goal

## Phase 8 — AI, accounts, sync
- [ ] Backend + sign-in, offline-first sync
- [ ] "Explain it differently" and "Generate cards from PDF" (Claude API via backend)
- [ ] Image occlusion, personalised FSRS parameters

## Open decisions
- "Mastered" = card in Review state with FSRS stability ≥ 21 days (default, change if you like)
- Onboarding steps 2–3 = name + new cards/day (mockup only designs step 1)
- Anki import link and "Explain it differently" hidden until Phases 7 and 8
- Web: `accessibilityState` isn't mapped to `aria-*`; consider switching to `aria-checked`/`aria-selected` props
- Decks and Explore screens aren't in the mockup yet — built in the same style for now
- Image occlusion card type moved to Phase 8 (needs image support + drawing UI)
- A note's type can't be changed after creating (fields differ per type)
- Vocab text uses the system font until Noto Sans JP arrives in Phase 6
- Exam decks: FSRS may still schedule a review after the exam date; an "exam mode" that caps intervals could come later
- Reminders are local notifications (work in Expo Go). Android shows them with the card icon in the accent colour
- Bundle ID `com.bawantha.recall` can still change until the first store upload — after that it's permanent
- iPhone only for v1.0 (`supportsTablet: false`): an iPad version needs its own screenshots and layout checks
- v1.0 ships before export (Phase 7): a user's cards live only on their phone (plus the phone's own
  iCloud / Google backup). Consider pulling a simple export into Phase 5 if that's a concern.
