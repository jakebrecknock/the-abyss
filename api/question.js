import OpenAI from "openai";
import crypto from "node:crypto";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const schema = {
  type: "object",
  additionalProperties: false,
  properties: {
    question: { type: "string" },
    category: { type: "string" },
    breadth_note: { type: "string" }
  },
  required: ["question","category","breadth_note"]
};

const DOMAINS = [
  "geography",
  "history",
  "general science",
  "sports",
  "movies and television",
  "music",
  "books and literature",
  "food and drink",
  "animals and nature",
  "technology",
  "video games",
  "tabletop games",
  "art and architecture",
  "mythology",
  "transportation",
  "brands and products",
  "fashion and culture"
];

function pick(arr){ return arr[Math.floor(Math.random()*arr.length)]; }

export default async function handler(req,res){
  if(req.method!=="POST") return res.status(405).json({error:"POST only"});
  if(!process.env.OPENAI_API_KEY) return res.status(500).json({error:"OPENAI_API_KEY is not configured"});

  const recent = Array.isArray(req.body?.recent) ? req.body.recent.slice(-120) : [];
  const avoidCategories = Array.isArray(req.body?.avoidCategories) ? req.body.avoidCategories.slice(-10) : [];
  const domain = pick(DOMAINS);
  const nonce = crypto.randomBytes(8).toString("hex");

  const instructions = `You design rounds for an original game called The Abyss.
Generate ONE fresh open-ended trivia prompt.

NON-NEGOTIABLE QUALITY RULES:
- The question itself must be EASY TO UNDERSTAND and broadly accessible to a general trivia player.
- Difficulty must come from choosing a rare answer, NOT from understanding an obscure category.
- Most generated prompts should feel like something you could hear at a normal pub trivia night.
- A normal adult should be able to think of at least 3 plausible answers within about 5 seconds.
- Prefer familiar categories: countries, cities, animals, foods, movies, actors, musicians, sports, brands, historical figures, common science, games, books, vehicles, landmarks, etc.
- Strongly avoid taxonomy, scientific family/genus/classification questions, obscure academic terminology, specialist technical categories, niche historical classifications, and other categories requiring specialized education.
- Before accepting a prompt, silently identify 5 COMMON answers. If that is difficult, reject the prompt.
- There must still be enough obscure correct answers for the 60/85/100 tiers.
- Aim for at least 40 legitimate answers, but DO NOT sacrifice accessibility just to get a huge answer universe.
- Prefer a simple 50-answer category over a difficult 500-answer category.
- Do not give examples or reveal answers.

REPETITION RULES:
- Treat semantically similar prompts as repeats even if worded differently.
- Do not reuse the same underlying answer pool from a recent prompt.
- If a recent question asked about dog breeds, do not ask another dog-breed question.
- If a recent question asked about countries with a property, avoid another closely related country-property prompt.
- Avoid repeating the same subject family within at least the next 20 prompts.
- Variety of underlying knowledge matters more than merely changing wording.

Use this randomly selected domain as inspiration, not a requirement: ${domain}
Random freshness nonce: ${nonce}`;

  const input = `Categories already used this dive:
${avoidCategories.length ? avoidCategories.join(", ") : "(none)"}

Recent prompts to avoid:
${recent.length ? recent.map((x,i)=>`${i+1}. [${x.category||"?"}] ${x.question}`).join("\n") : "(none yet)"}

Create a new prompt now.`;

  try{
    const response = await client.responses.create({
      model: process.env.OPENAI_MODEL || "gpt-5.6-terra",
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
    return res.status(200).json({...data,id:crypto.randomUUID()});
  }catch(err){
    console.error(err);
    return res.status(500).json({error:"Question generation failed"});
  }
}
