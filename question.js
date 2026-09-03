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
  "world geography","history","science","biology","chemistry","physics","astronomy",
  "sports","soccer","golf","basketball","baseball","motorsport","movies","television",
  "music","literature","language","food","cooking","animals","plants","nature",
  "technology","computing","video games","tabletop games","art","architecture",
  "mythology","transportation","brands and products","fashion","culture","travel"
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
- The prompt must have a LARGE legitimate answer universe. Aim for at least 40 valid answers; 75+ is better; hundreds or thousands are excellent.
- Reject tiny closed lists. Never ask things equivalent to "name an NFL team", "name a planet", "name a moon of Jupiter", "name a Beatles member", or any prompt with only a handful of answers.
- The prompt must be objectively judgeable and phrased so there is a clear criterion for validity.
- Avoid traps, technical ambiguity, disputed definitions, and requirements that depend on a specific current date unless unavoidable.
- Prefer prompts where both ordinary and deeply obscure correct answers exist, so the 10/30/60/85/100 rarity scale can breathe.
- Keep topics varied: geography, science, history, sports, culture, entertainment, food, language, nature, technology, art, games, etc.
- Do NOT give examples or reveal answers.
- Do NOT recycle, paraphrase, narrow, broaden, or cosmetically rewrite any recent prompt.
- Avoid using a category already used in this seven-question dive if a different category can work.
- Keep the question concise, usually "Name a …" or another one-answer form.
- breadth_note should briefly explain why the answer universe is broad WITHOUT revealing an answer.
- Think through the candidate prompt and silently reject it if it likely has fewer than 40 defensible answers.

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
