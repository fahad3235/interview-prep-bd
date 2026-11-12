# TEST_RESULTS.md — interview-prep-bd

Run date: 2026-11-12 (12:00 slot, Asia/Dhaka). All tests run for real on this
machine; nothing invented.

## Unit tests — 53/53 green

Command: `node tests/logic.test.js`

- Bank: 40 questions, 8 per category, difficulty mix easy 15 / medium 19 /
  hard 6; every question has ≥2 EN bullets with matching BN count and a
  non-empty tip in both languages; no duplicate ids; dup-id and bad-category
  banks rejected.
- Filters: all 40; tech 8; hard 6; hr+easy 4; search "salary" → q12;
  search "OOP" → q17; search "বেতন" → q12; no-match 0; unknown cat 0.
- Mock sets: same seed → identical set; different seed → different order;
  5 distinct ids; category-scoped sets stay in category; 8 from tech ok;
  9 from tech → notEnough; count 0 → badCount.
- Scoring: [5,4,5] → 4.67 Excellent; [4,4,3] → Good; [3,3,3] → Fair;
  [1,2,1] → practice; [] → noRatings; out-of-range ratings ignored.
- fmtTime: 0 → 00:00; 90 → 01:30; 120 → 02:00; 3661 → 61:01; negative → 00:00.
- Progress: reviewed 3 / bookmarked 1 → pct 8%; per-category counts exact.
- Export/import: round-trip ok; wrong app/version/bad JSON/bad lang/dup
  ids/bad sessions all rejected; same id in reviewed AND bookmarked is valid.
- Bengali digits: 123 → ১২৩; 2026 → ২০২৬.

Repairs during testing (real bugs, fixed and re-verified):
1. `validateImport` rejected a payload where the same question id appeared
   in both `reviewed` and `bookmarked` (legitimate: a question can be both).
   Fixed to check duplicates within each list only; added a unit test.
2. Test-side fix: export assertions expected `"app": "…"` with a space;
   `JSON.stringify` emits `"app":"…"`. Fixed the assertions.
3. Test hook gap: `window.__ipb.importPayload` only validated without
   applying the data, so the smoke import check could not restore state.
   Fixed the hook to apply validated data (same path as file import).

## Headless-Chrome smoke tests — 49/49 green

Command: `node tests/smoke.js` (raw CDP, headless_shell-1187, file://)

Hand-verified in the browser: 40 cards render; search "salary" → 1 card;
tech filter → 8; tech+hard → 1; answer toggle reveals the model-answer
outline; bookmark + bookmarked-only → 1 card; reviewed chip appears;
flashcards: Card 1 of 40 → flip shows answer → Next → Card 2 of 40 →
tech filter → Card 1 of 8; mock interview (5 questions, 120 s): label
"Question 1 of 5", timer mm:ss, rate 5 on all five → result "5 / 5",
"Excellent", summary mentions 5 questions; progress: reviewed 1,
bookmarked 1, total 40, 5 category bars, 1 session "5/5"; export/erase/
import round-trip with wrong-app rejection and data intact; BN toggle →
Bengali title + ৪০ digits, persists after reload, back to EN; footer
mentions offline; 390px no horizontal overflow on all 4 tabs; zero
non-file network requests; 0 console/page errors.

## ASCII-safety check

All sources pure ASCII after the escape pass (Bengali as `\uXXXX` in JS,
`&#…;` in HTML) — verified with `grep -P '[^\x00-\x7F]'` returning zero
matches across js/, index.html, tests/. This keeps the GitHub push API
from corrupting Bengali text in transit (2026-10-11 run #25 lesson).
