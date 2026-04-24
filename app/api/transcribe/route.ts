import { NextResponse } from 'next/server';
import Groq from 'groq-sdk';

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as Blob;
    const apiKey = formData.get("apiKey") as string;

    if (!file || !apiKey) return NextResponse.json({ error: "Missing file or API key" }, { status: 400 });

    const groq = new Groq({ apiKey });
    
    // Convert Blob to File object for the SDK
    const audioFile = new File([file], "audio.webm", { type: "audio/webm" });

    const transcription = await groq.audio.transcriptions.create({
      file: audioFile,
      model: "whisper-large-v3",
    });

    return NextResponse.json({ text: transcription.text });
  } catch (error) {
    console.error("Transcription error:", error);
    return NextResponse.json({ error: "Failed to transcribe" }, { status: 500 });
  }
}