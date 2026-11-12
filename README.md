# Interview Prep BD 🎓

An offline, bilingual (English / বাংলা) interview preparation app for fresh
graduates in Bangladesh. Practice with a 40-question bank, flip through
flashcards, run timed mock interviews with self-ratings, and track progress —
all in the browser, no account, no network.

Live demo: https://fahad3235.github.io/interview-prep-bd/

## Problem

Fresh graduates in Bangladesh often walk into their first interview having
never practised out loud: they know the subject but freeze on "Tell me about
yourself", give one-line answers, or have no questions for the interviewer.
This app turns preparation into a short daily routine — read a model-answer
outline, say it out loud, rate yourself, and watch the weak spots shrink.

## Features

1. **Question bank (40 questions, 5 categories)** — About You, HR &
   Behavioural, Technical (CS), Situational / STAR, Closing. Filter by
   category and difficulty (Easy / Medium / Hard), free-text search in
   English or বাংলা, bookmark questions, mark them reviewed.
2. **Model-answer outlines + tips** — every question ships with a 2–3 point
   outline and one practical tip, in both languages. Outlines are guidance,
   not scripts: the app tells you to answer in your own words.
3. **Flashcards** — flip a card to reveal the outline, move next/previous,
   shuffle the deck, filter by category.
4. **Mock interview** — pick 3, 5 or 8 questions from any category, with a
   per-question countdown timer (60 / 120 / 180 s). Rate each answer 1–5,
   get an average score with a plain-language verdict (Excellent / Good /
   Fair / Needs practice), and a per-question breakdown. Sessions are saved
   to history.
5. **Progress** — reviewed / bookmarked counts, per-category progress bars,
   mock-session history with date, score and time.
6. **Data portability** — JSON export / strict import (wrong app, wrong
   version, bad language, duplicate ids, bad sessions all rejected with
   data intact) and typed-`DELETE` erase-all.
7. **Bilingual UI** — EN/বাংলা toggle persisted across reloads, Bengali
   digits in all counts, 390px mobile layout, zero network requests.

## Stack

Vanilla HTML / CSS / JavaScript. No framework, no build step, no
dependencies. All source files are pure ASCII — Bengali text is stored as
`\uXXXX` escapes in JavaScript and numeric character references in HTML
(this keeps GitHub's file push API from corrupting text in transit).

## Prerequisites

Any modern browser. For the tests: Node.js 18+ and a Chromium binary.

## Run locally

Open `index.html` in a browser, or serve the folder:

```bash
npx serve .
# or
python3 -m http.server 8000
```

## Testing

```bash
node tests/logic.test.js   # 53 logic assertions (bank, filters, mock sets, scoring, progress, import)
node tests/smoke.js        # 49 headless-Chrome checks (raw CDP, file://)
```

See [TEST_RESULTS.md](TEST_RESULTS.md) for the recorded results.

## Content notes

- The 40 questions and their outlines are original editorial content written
  for this app. They are common interview questions, not copied from any
  single source.
- Salary guidance is deliberately generic ("research a range first") — the
  app does not state any salary figure, because market rates change and
  vary by company.
- The app carries a disclaimer in the footer: outlines are guidance, not
  scripts to memorise, and salary/company facts should be verified before
  an interview.

## Limitations

- Self-ratings are subjective by design — the app cannot judge your spoken
  answer, only record how you rated it.
- No audio recording or speech feedback (offline, no microphone use).
- Question bank is fixed at 40; there is no user-added question feature yet.

## Deployment

GitHub Pages (main branch, root). No build step — push and enable Pages.

## Status

Complete MVP. Tests green (see TEST_RESULTS.md).
