import OpenAI from "openai";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const schema = {
  type: "object",
  additionalProperties: false,
  properties: {
    valid: { type: "boolean" },
    canonical_answer: { type: "string" },
    score: { type: "integer", enum: [0,10,30,60,85,100] },
    reason: { type: "string" },
    feedback: { type: "string" },
    examples_100: {
      type: "array",
      minItems: 0,
      maxItems: 2,
      items: { type: "string" }
    }
  },
  required: ["valid","canonical_answer","score","reason","feedback","examples_100"]
};

const instructions = `You are the answer judge for an original trivia rarity game called The Abyss.

You receive a question, category, and either a player's answer or a timeout event.

VALIDATION:
- Judge meaning, not exact spelling.
- Accept obvious typos, phonetic misspellings, missing punctuation/accents, singular/plural slips, abbreviations, common aliases, alternate transliterations, and answers that are unmistakably intended.
- Example behavior: "malanois" should be understood as "Malinois"; "c sharp" as "C#".
- Do NOT forgive an answer into a different fact if the intended answer is genuinely ambiguous.
- If the answer does not satisfy the actual criterion, valid=false and score=0.
- On an invalid attempt, NEVER reveal potential answers or 100-point examples because the player is allowed to retry with remaining time.

SCORING — use exactly 10, 30, 60, 85, or 100:
10 = extremely obvious / likely among the first few answers from a general player.
30 = common, familiar, easy to recall.
60 = uncommon but still broadly recognizable; solid trivia knowledge.
85 = genuinely obscure, impressive, deep-cut knowledge. IMPORTANT: do not make 85 excessively hard. If a knowledgeable person would plausibly say "that's a really good obscure answer", 85 is appropriate.
100 = specialist-level, exceptionally deep, or bizarrely specific-but-correct knowledge. Reserve this for answers most strong trivia players would not produce.
Do not score based merely on answer length or foreignness. Score based on likely recall frequency and cultural prominence in the context of the prompt.
When uncertain between 60 and 85, choose 85 if the answer is clearly outside ordinary general knowledge.
When uncertain between 85 and 100, choose 85 unless the answer is truly specialist-level.

AFTER A VALID ANSWER OR TIMEOUT:
- Return exactly two defensible 100-point examples when possible.
- Examples must unquestionably satisfy the prompt and should genuinely deserve 100 under the rubric.
- Never use the player's own answer as a 100-point example unless it itself scored 100.
- Keep reason to one concise sentence.
- feedback is for invalid attempts and should briefly say why it did not fit without giving away answers.

For timeout mode: valid=false, score=0, canonical_answer="", reason="", feedback="", and return two 100-point examples.
For valid answer mode: examples_100 must contain two examples.
For invalid answer mode: examples_100 must be empty.`;

export default async function handler(req,res){
  if(req.method!=="POST") return res.status(405).json({error:"POST only"});
  if(!process.env.OPENAI_API_KEY) return res.status(500).json({error:"OPENAI_API_KEY is not configured"});

  const mode = req.body?.mode === "timeout" ? "timeout" : "answer";
  const question = String(req.body?.question || "").slice(0,500);
  const category = String(req.body?.category || "").slice(0,120);
  const answer = String(req.body?.answer || "").slice(0,300);

  if(!question) return res.status(400).json({error:"Missing question"});
  if(mode==="answer" && !answer.trim()) return res.status(400).json({error:"Missing answer"});

  const input = mode==="timeout"
    ? `MODE: timeout\nCATEGORY: ${category}\nQUESTION: ${question}\nThe timer expired. Reveal two 100-point examples.`
    : `MODE: answer\nCATEGORY: ${category}\nQUESTION: ${question}\nPLAYER ANSWER: ${answer}\nJudge validity and rarity.`;

  try{
    const response = await client.responses.create({
      model: process.env.OPENAI_MODEL || "gpt-5.6-luna",
      store: false,
      reasoning: { effort: "none" },
      instructions,
      input,
      text: {
        format: {
          type: "json_schema",
          name: "abyss_judgement",
          strict: true,
          schema
        }
      }
    });
    const data = JSON.parse(response.output_text);

    // Enforce game invariants server-side even if a model response is weird.
    if(mode==="timeout"){
      data.valid=false; data.score=0; data.canonical_answer=""; data.reason=""; data.feedback="";
    } else if(!data.valid){
      data.score=0; data.examples_100=[];
    } else {
      if(![10,30,60,85,100].includes(data.score)) data.score=60;
    }
    return res.status(200).json(data);
  }catch(err){
    console.error(err);
    return res.status(500).json({error:"Answer judging failed"});
  }
}
