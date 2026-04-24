import { NextResponse } from 'next/server';
import Groq from 'groq-sdk';

export async function POST(req: Request) {
  try {
    const { prompt, apiKey } = await req.json();
    if (!apiKey) return NextResponse.json({ error: "Missing API key" }, { status: 400 });

    const groq = new Groq({ apiKey });

    const chatCompletion = await groq.chat.completions.create({
      messages: [
        { role: "system", content: "You are a helpful, brilliant AI meeting assistant. Answer the user's prompt based thoroughly on the provided context." },
        { role: "user", content: prompt }
      ],
      model: "llama-3.3-70b-versatile",
      temperature: 0.7,
    });

    return NextResponse.json({ answer: chatCompletion.choices[0]?.message?.content });
  } catch (error) {
    console.error("Chat error:", error);
    return NextResponse.json({ error: "Failed to generate chat response" }, { status: 500 });
  }
}