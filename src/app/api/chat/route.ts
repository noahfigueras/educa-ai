import { NextResponse } from "next/server";
import { ChatOpenAI } from "@langchain/openai";
import { OpenAIEmbeddings } from "@langchain/openai";
import { Chroma } from "@langchain/community/vectorstores/chroma";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { StateGraph } from "@langchain/langgraph";
import { Document } from "@langchain/core/documents";
import { Annotation } from "@langchain/langgraph";
import { z } from "zod";
//import type { UserInfo } from "@/app/types";

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
Eres un asistente de entrenamiento profesional de tenis basado únicamente en los 
contenidos del programa EDUCA TENNIS desarrollado por Joel Figueras Torras. 

Tu función principal es generar sesiones de entrenamiento o responder preguntas 
usando exclusivamente la información textual exacta encontrada en los documentos 
proporcionados en el contexto proporcionado. 

No debes resumir, parafrasear, completar con conocimientos propios ni inventar 
ejercicios. Siempre responde utilizando literalmente los ejercicios, actividades, 
nombres, y descripciones tal como aparecen en el programa original.

Cuando un usuario solicita una sesión, debes extraer el contenido directamente 
del programa y estructurarlo en el siguiente formato:

- **Número de Sesión**: [número]
- **Número de Semana**: [número]
- **Contenidos Para Trabajar**: [extraído literalmente]
- **Tiempo Total de la Sesión**: [minutos]
- **Parte Inicial**: [nombre, descripcion y duración de cada ejercicio]
- **Parte Principal**: [nombre, descripcion y duración de cada ejercicio] (Esta Parte Principal incluyen todos los ejercicios entre PARTE PRINCIPAL y PARTE FINAL) 
- **Parte Final**: [nombre, descripcion y duración de cada ejercicio]

Si el usuario solicita múltiples sesiones (por ejemplo, una semana completa), 
proporciona todas las sesiones con esa estructura.

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
    "16 AÑOS",
    "ALTO RENDIMIENTO JUVENIL",
    "ADULTOS INICIACION",
    "ADULTOS PERFECCIONAMIENTO",
    "ADULTOS TECNIFICACIÓN",
    "ADULTOS COMPETICIÓN",
    "ATP_WTA_Tierra",
    "ATP_WTA_Rapida",
    "ATP_WTA_Indoor",
  ]).describe("Usa '16 AÑOS' para edades 14, 15 y 16; y 'ALTO RENDIMIENTO JUVENIL' para edades 17 y 18."),
  coach: z.enum([
    "coach", 
    "player",
    "parent",
  ]).describe("Use of coach type")
});

const structuredLlm = llm.withStructuredOutput(searchSchema);

// Node1 - Query Analysis
const analyzeQuery = async (state: typeof InputStateAnnotation.State) => {
  console.log(state.question);
  const result = await structuredLlm.invoke(state.question);
  console.log(result);
  return { search: result };
};

// Node2 - Retrieval of Embeddings
const retrieve = async (state: typeof StateAnnotation.State) => {
  const group = state.search.ageGroup;
  let coach = state.search.coach;
  const filterGroups: string[] = [state.search.ageGroup];
  if(group == "6 AÑOS" || group == "7 AÑOS") {
    filterGroups.push("6-7 AÑOS");
  } else if(group == "8 AÑOS" || group == "9 AÑOS") {
    filterGroups.push("8-9 AÑOS");
  } else if(group == "10 AÑOS" || group == "11 AÑOS") {
    filterGroups.push("10-11 AÑOS");
  } else if(group == "12 AÑOS" || group == "13 AÑOS") {
    filterGroups.push("12-13 AÑOS");
  } else if(group == "16 AÑOS" || group == "ALTO RENDIMIENTO JUVENIL") {
    coach = "coach"; 
  }
      
  const filter: any = {
    "$and": [
      { "ageGroup": { "$in": filterGroups } },
      { "coach": coach }
    ]
  };
  console.log(filter);
  console.log(filterGroups);
  try {
  const retrievedDocs = await vectorStore.similaritySearch(
    state.search.query,
    5,
    filter
  );
  console.log(retrievedDocs);
  return { context: retrievedDocs };
  } catch(err: any) {
    console.log(err)
  }
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
    const group = userInfo.ageGroup;
    const coach = userInfo.userType;
    const query = `${question}.GRUPO: ${group}, COACH: ${coach}`;
    const result = await graph.invoke({question: query});
    return NextResponse.json({answer: result.answer});
  } catch(error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

