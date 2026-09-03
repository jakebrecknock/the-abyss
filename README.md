# The Abyss — Infinite Dive

A standalone sea-themed rarity trivia game with AI-generated questions and AI-judged answers.

## What makes this version different

- Questions are generated dynamically instead of pulled from a finite bank.
- The generator is instructed to reject narrow prompts and prefer answer universes of 40+ valid answers.
- Recent questions are stored in the browser and sent back to the generator to discourage repeats.
- The seven questions in a dive try to use different categories.
- Answer judging is semantic, so typos, aliases, punctuation differences, transliterations, and obvious misspellings can still count.
- Wrong guesses do **not** consume API latency: the timer pauses while the model judges, then resumes with the time that remained.
- Scores are 10 / 30 / 60 / 85 / 100, with 85 intentionally representing a genuinely obscure but attainable answer and 100 reserved for specialist-level knowledge.
- After a valid answer or timeout, the game reveals two 100-point examples.
- Best score, dives completed, and up to 500 recently seen prompts persist in localStorage.

## Requirements

- Node.js 18+
- A Vercel account (free tier is fine for hosting)
- An OpenAI API key with API billing enabled

The API key stays server-side. Do not put it into `index.html`.

## Run locally

```bash
npm install
cp .env.example .env.local
```

Edit `.env.local` and add your real API key, then:

```bash
npx vercel dev
```

Open the local URL printed by Vercel.

## Deploy to Vercel

Install dependencies:

```bash
npm install
```

Log in and link/deploy:

```bash
npx vercel
```

Add the secret API key to the Vercel project:

```bash
npx vercel env add OPENAI_API_KEY
```

Optionally add `OPENAI_MODEL` too. Then deploy production:

```bash
npx vercel --prod
```

Vercel will give you a public URL you can share.

## Cost control

Every question normally uses one model call, and every submitted answer uses another. Invalid retries therefore use additional calls. The default model is `gpt-5.6-terra`; change `OPENAI_MODEL` in Vercel if you prefer a cheaper or more capable model.

## Architecture

Browser:
- immersive game UI
- 25-second gameplay timer
- recent-question history
- score and dive state

Serverless API:
- `/api/question` generates broad, fresh prompts
- `/api/judge` validates typo-tolerantly, scores rarity, and returns 100-point examples

OpenAI:
- Responses API
- Structured Outputs / JSON Schema

## Important note on “infinite”

There is no fixed question or accepted-answer database in this build. Questions and judgments are generated dynamically, so the playable content is effectively unbounded. The browser keeps recent prompt history to reduce repeats, but no generative system can mathematically guarantee that a semantically similar prompt will never appear again over an infinite number of games.
