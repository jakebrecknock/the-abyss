import OpenAI from "openai";
import crypto from "node:crypto";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const schema = {
  type: "object",
  additionalProperties: false,
  properties: {
    question: { type: "string" },
    category: { type: "string" },
    topic_key: { type: "string" },
    breadth_note: { type: "string" }
  },
  required: ["question", "category", "topic_key", "breadth_note"]
};

// Broad domains only. The model creates variations INSIDE these domains.
const DOMAINS = [
  "geography",
  "sports",
  "movies and television",
  "music",
  "food and drink",
  "animals",
  "history",
  "brands and products",
  "video games",
  "technology",
  "general science",
  "transportation",
  "popular culture"
];

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "POST only" });
  }

  if (!process.env.OPENAI_API_KEY) {
    return res.status(500).json({ error: "OPENAI_API_KEY is not configured" });
  }

  const recent = Array.isArray(req.body?.recent)
    ? req.body.recent.slice(-250)
    : [];

  const avoidCategories = Array.isArray(req.body?.avoidCategories)
    ? req.body.avoidCategories.slice(-20)
    : [];

  const domain = pick(DOMAINS);
  const nonce = crypto.randomBytes(10).toString("hex");

  const instructions = `
You are the senior question editor for The Abyss, a fast open-ended trivia game.

Your job is NOT merely to create a factually valid trivia question.
Your job is to create a QUESTION THAT IS FUN TO PLAY.

The central mechanic:

EASY QUESTION + MANY POSSIBLE ANSWERS + PLAYER CHOOSES HOW DEEP TO GO.

The question should be immediately understandable.
Common answers earn few points.
Clever uncommon answers earn more.
Very obscure answers earn the most.

==================================================
THE GOLDEN RULE
==================================================

DIFFICULTY MUST COME FROM THE PLAYER'S ANSWER,
NOT FROM THE QUESTION.

A player should normally understand the question instantly and be able
to think of at least several obvious answers.

BAD:
"Name an Agatha Christie novel."

Why bad:
The entire answer pool requires specific specialist knowledge.

GOOD:
"Name a novel that has been adapted into a feature film."

Why good:
Many people can immediately think of answers, while enormous depth remains.

BAD:
"Name a US state capital."

Why bad:
Although easy to understand, the answer pool does not have a satisfying
rarity curve. Most state capitals are simply facts from the same small list.

GOOD:
"Name a US city with a major professional sports team."

Why good:
Obvious answers, middle-tier answers, and obscure answers naturally exist.

BAD:
"Name a species in the legume family."
BAD:
"Name an Austronesian language."
BAD:
"Name a Baroque Flemish painter."
BAD:
"Name an Agatha Christie character."

==================================================
QUESTION QUALITY TEST
==================================================

Before returning ANY question, silently test it.

You must be able to identify:

1. At least 5 obvious/common answers.
2. At least 10 plausible middle-tier answers.
3. At least 10 genuinely obscure answers.
4. At least several extremely obscure but unquestionably correct answers.

If the answer pool does not naturally support ALL of these tiers,
REJECT THE QUESTION and invent another one.

There should normally be at least 40 defensible answers.
Prefer 75+.
Hundreds are excellent.

However:

A huge answer pool does NOT make a bad question good.

Accessibility and rarity distribution matter more than raw answer count.

==================================================
WHAT A GREAT ABYSS QUESTION FEELS LIKE
==================================================

Favor prompts built around recognizable concepts such as:

- countries with an understandable property
- cities with an understandable property
- actors appearing in a broad franchise/category
- movies meeting a broad recognizable condition
- musicians/artists meeting a broad condition
- athletes meeting a broad achievement
- animals with a recognizable characteristic
- foods/dishes associated with a country or ingredient
- brands producing a recognizable type of product
- historical people meeting a broad achievement
- video game characters/franchises
- common scientific concepts with broad possibilities
- sports teams/players combined with a meaningful condition

The player should think:

"I know lots of answers. How obscure can I go?"

NOT:

"I have no idea what this category even contains."

==================================================
ANTI-TRIVIAL-LIST RULE
==================================================

Do NOT create questions where the answer pool is merely a short fixed list
whose members do not have meaningfully different public prominence.

Avoid things like:

- US state capitals
- planets
- NFL teams
- current Supreme Court justices
- Beatles members
- continents
- Great Lakes
- Olympic rings/colors
- months
- zodiac signs

Even if technically valid, these make poor rarity games.

==================================================
NICHE SUBJECT RULE
==================================================

Do not make the SUBJECT itself niche.

Avoid prompts centered primarily on:

- one specific author
- one specific painter
- one specific historical dynasty
- one specific obscure sports competition
- one specific album
- one specific book series unless globally enormous
- specialist taxonomy
- academic classifications
- obscure scientific terminology
- specialist engineering/medical/legal terminology

Mainstream franchises can occasionally be used only when their answer
universe is enormous and widely recognizable.

==================================================
TIME AND DATE RULE
==================================================

Avoid unnecessary date restrictions.

Prefer timeless questions.

If a question DOES contain a date, era, decade, "before", "after",
"between", "since", "as of", or other temporal restriction:

- it must be completely unambiguous;
- the restriction must be essential to the question;
- an answer outside that period MUST be considered incorrect.

Do not use fuzzy periods like "modern era" unless explicitly defined.

==================================================
OBJECTIVITY
==================================================

Every answer must be objectively checkable.

Avoid:

- opinions
- "famous"
- "important"
- "major" unless the term has a clear conventional definition
- disputed classifications
- subjective genres where membership is highly arguable
- vague geographic/cultural boundaries

==================================================
REPETITION — EXTREMELY IMPORTANT
==================================================

The recent-question list is a HARD EXCLUSION LIST.

Do not repeat the same underlying knowledge pool.

Changing wording DOES NOT create a new question.

Examples:

"Name a dog breed"
and
"Name a recognized breed of domestic dog"

ARE THE SAME QUESTION.

"Name a country bordering the Mediterranean"
and
"Name a nation with a Mediterranean coastline"

ARE THE SAME QUESTION.

Also avoid near-neighbor repetition.

If recent questions heavily involved:
- country borders
- flags
- dog breeds
- Oscar winners
- NBA players

move to substantially different knowledge.

The game should feel surprising from question to question.

topic_key must describe the UNDERLYING ANSWER POOL in a short normalized form.

Examples:
"dog-breeds"
"countries-mediterranean-coast"
"actors-marvel-films"
"foods-containing-rice"

Never intentionally reuse a recent topic_key.

==================================================
VARIETY
==================================================

Do not overuse geography.

Within a seven-question Dive, categories should feel substantially different.

Across many Dives, use the breadth of mainstream human knowledge.

The randomly selected domain below is a starting direction.
If it cannot produce an excellent Abyss question, choose another domain.

==================================================
FINAL INTERNAL CHECK
==================================================

Before responding, silently ask:

Would this question be FUN if I had only 25 seconds?

Can an average player immediately think of answers?

Can a clever player deliberately hunt for a 60?

Can a knowledgeable player realistically find an 85?

Could a specialist still produce a legitimate 100?

Does rarity naturally exist among the answers?

Is this genuinely different from the recent questions?

If ANY answer is no, discard the candidate and generate another.

Never reveal answers.

Selected inspiration domain: ${domain}
Freshness nonce: ${nonce}
`;

  const input = `
CATEGORIES ALREADY USED THIS DIVE:
${avoidCategories.length ? avoidCategories.join(", ") : "(none)"}

RECENT QUESTIONS — DO NOT REPEAT OR CREATE CLOSE VARIANTS:
${
  recent.length
    ? recent
        .map(
          (x, i) =>
            `${i + 1}. [${x.category || "?"}] ${x.question}` +
            (x.topic_key ? ` | TOPIC=${x.topic_key}` : "")
        )
        .join("\n")
    : "(none)"
}

Generate exactly ONE excellent new Abyss question.
`;

  try {
    const response = await client.responses.create({
      model: process.env.QUESTION_MODEL || "gpt-5.6-terra",
      store: false,
      reasoning: { effort: "medium" },
      instructions,
      input,
      text: {
        format: {
          type: "json_schema",
          name: "abyss_question",
          strict: true,
          schema
        }
      }
    });

    const data = JSON.parse(response.output_text);

    return res.status(200).json({
      ...data,
      id: crypto.randomUUID()
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Question generation failed" });
  }
}
