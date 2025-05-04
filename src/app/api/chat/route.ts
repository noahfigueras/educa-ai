import { NextResponse } from "next/server";
import { ChatOpenAI } from "@langchain/openai";
import { OpenAIEmbeddings } from "@langchain/openai";
import { Chroma } from "@langchain/community/vectorstores/chroma";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { StateGraph } from "@langchain/langgraph";
import { Document } from "@langchain/core/documents";
import { Annotation } from "@langchain/langgraph";
import { z } from "zod";
import type { UserInfo } from "@/app/types";

const llm = new ChatOpenAI({
  temperature: 0,
  modelName: "gpt-4o-mini", // or "gpt-3.5-turbo"
  streaming: true,
});
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

// Prompt Templating
const SYSTEM_PROMPT = `
Eres un entrenador de tenis experto con años de experiencia en el desarrollo de 
jugadores de todos los niveles, desde iniciación hasta alto rendimiento. 
Tu función es ayudar a los entrenadores humanos a planificar y mejorar sus 
sesiones de entrenamiento.

  Tu conocimiento incluye:
  - Principios técnico-tácticos del tenis.
  - Preparación física y mental adaptada por edad y nivel.
  - Ejercicios variados (situacionales, progresivos, lúdicos, analíticos, etc.).
  - Programación de sesiones por trimestre, semana y día.
  - Adaptación de contenidos en función de la edad, nivel y objetivos del jugador o grupo.

  Utiliza siempre el contexto que se te proporciona, incluyendo ejercicios y objetivos técnicos o tácticos. 

  Tu estilo debe ser claro, directo y profesional.
  Si no tiene suficient informacion para responder, siempre pregunta al usuario que sea mas especifico con la edad, objetivo del entrenamiento, tiempos, etc.

  Nunca inventes ejercicios o datos que no aparezcan en el contexto del contenido. 
  Si un ejercicio o sesión no está explícitamente en el contexto no lo sugieras nunca. 

  Tu objetivo es que el entrenador humano pueda entender mejor los conceptos, 
  organizar sus entrenamientos, proponer ejercicios y obtener ideas efectivas para sus sesiones.

  Contexto: {context}
`;

const promptTemplate = ChatPromptTemplate.fromMessages([
  ["system", SYSTEM_PROMPT],
  ["human", "{question}"],
]);

// STATE GRAPH (Langraph)
const InputStateAnnotation = Annotation.Root({
  question: Annotation<string>,
});

const StateAnnotation = Annotation.Root({
  question: Annotation<string>,
  search: Annotation<z.infer<typeof searchSchema>>,
  context: Annotation<Document[]>,
  answer: Annotation<string>,
});

// Query Analysis Schema
const searchSchema = z.object({
  query: z.string().describe("Search query to run."),
  ageGroup: z.enum([
    "6 AÑOS", 
    "7 AÑOS", 
    "8 AÑOS",
    "9 AÑOS",
    "10 AÑOS",
    "11 AÑOS",
    "12 AÑOS",
    "13 AÑOS",
    "14 AÑOS",
    "15 AÑOS",
    "16 AÑOS",
    "17 AÑOS",
    "18 AÑOS",
  ]).describe("Age to query."),
});

const structuredLlm = llm.withStructuredOutput(searchSchema);

// Node1 - Query Analysis
const analyzeQuery = async (state: typeof InputStateAnnotation.State) => {
  const result = await structuredLlm.invoke(state.question);
  return { search: result };
};

// Node2 - Retrieval of Embeddings
const retrieve = async (state: typeof StateAnnotation.State) => {
  //const filter = (doc: any) => doc.metadata.ageGroup === state.search.ageGroup;
  const retrievedDocs = await vectorStore.similaritySearch(
    state.search.query,
    2,
    {
      ageGroup: state.search.ageGroup
    }
  );
  return { context: retrievedDocs };
}

// Node3 - Prompt Generation
const generate = async (state: typeof StateAnnotation.State) => {
  const docsContent = state.context.map((doc) => doc.pageContent).join("\n");
  const messages = await promptTemplate.invoke({
    question: state.question,
    context: docsContent,
  });
  const response = await llm.invoke(messages);
  return {answer: response.content };
}

const graph = new StateGraph(StateAnnotation)
.addNode("analyzeQuery", analyzeQuery)
.addNode("retrieveQA", retrieve)
.addNode("generateQA", generate)
.addEdge("__start__", "analyzeQuery")
.addEdge("analyzeQuery", "retrieveQA")
.addEdge("retrieveQA", "generateQA")
.addEdge("generateQA", "__end__")
.compile();

export async function POST(req: Request) {
  const { question, userInfo } = await req.json();
  if (!question) return NextResponse.json({ error: 'Missing question' }, { status: 400 });

  try { 
    const age = String(userInfo.age);
    const query = `${question}.EDAD: ${age}`;
    const result = await graph.invoke({question: query});
    return NextResponse.json({answer: result.answer});
  } catch(error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

