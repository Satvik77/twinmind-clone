import { NextResponse } from 'next/server';
import Groq from 'groq-sdk';

export async function POST(req: Request) {
  try {
    const { context, apiKey } = await req.json();
    if (!apiKey) return NextResponse.json({ error: "Missing API key" }, { status: 400 });

    const groq = new Groq({ apiKey });

    const systemPrompt = `
      You are an elite, always-on AI meeting copilot listening to a live transcript.
      Analyze the recent context and provide EXACTLY 3 highly relevant suggestions.
      Mix the types: Question, Talking Point, Fact-Check, or Clarification.
      
      You MUST return ONLY a valid JSON array of exactly 3 objects. Format:
      [
        {
          "type": "fact-check",
          "preview": "Verify the revenue numbers just mentioned.",
          "expansion_prompt": "The user just mentioned revenue numbers. Provide a detailed breakdown and fact-check based on the transcript."
        }
      ]
      Keep 'preview' under 12 words. Do not wrap in markdown code blocks. Just raw JSON.
    `;

    const chatCompletion = await groq.chat.completions.create({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Recent Transcript Context: ${context}` }
      ],
      model: "llama-3.3-70b-versatile",
      temperature: 0.2,
      response_format: { type: "json_object" } // Using JSON mode if supported, otherwise strict prompting handles it
    });

    let suggestionsContent = chatCompletion.choices[0]?.message?.content || "[]";
    
    // Clean up potential markdown formatting from the LLM response
    suggestionsContent = suggestionsContent.replace(/```json\n/g, "").replace(/```/g, "");

    const parsed = JSON.parse(suggestionsContent);
    // If it returned an object wrapping the array, extract it
    const finalArray = Array.isArray(parsed) ? parsed : Object.values(parsed)[0];

    return NextResponse.json({ suggestions: finalArray });
  } catch (error) {
    console.error("Suggestion error:", error);
    return NextResponse.json({ error: "Failed to generate suggestions" }, { status: 500 });
  }
}