import { NextResponse } from "next/server";
import { Chroma } from "@langchain/community/vectorstores/chroma";
import { OpenAIEmbeddings } from "@langchain/openai";

const embeddings = new OpenAIEmbeddings({
  model: "text-embedding-3-large"
});

const vectorStore = new Chroma(embeddings, {
  collectionName: "educa-ai",
  url: "http://localhost:8000", // Optional, will default to this value
  collectionMetadata: {
    "hnsw:space": "cosine",
  }, // Optional, can be used to specify the distance method of the embedding space https://docs.trychroma.com/usage-guide#changing-the-distance-function
});

export async function POST(req: Request) {
  const { ageGroup } = await req.json();
  if (!ageGroup) return NextResponse.json({ error: 'Missing Program' }, { status: 400 });
  try {
    const intro = await vectorStore.similaritySearch(
      "¡Bienvenido al asistente de sesiones de entrenamiento de tenis!",
      1,
      {
        "$and": [ 
          { "page": 0 } , 
          { "ageGroup": ageGroup} 
        ]
      }
    );

    // Extract embedded suggestions []
    const jsonMatch = intro[0].pageContent.match(/```json([\s\S]*?)```/);
    const suggestions = jsonMatch ? JSON.parse(jsonMatch[1].trim()) : [];
    const pageContent = intro[0].pageContent
      .replace(/```json[\s\S]*?```/, "").trim();

    return NextResponse.json({
      pageContent,
      suggestions
    });
  } catch(error: any) {
    console.log(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
