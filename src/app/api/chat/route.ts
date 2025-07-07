import { NextResponse } from "next/server";
import { ChatOpenAI } from "@langchain/openai";
import { OpenAIEmbeddings } from "@langchain/openai";
import { Chroma } from "@langchain/community/vectorstores/chroma";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { StateGraph } from "@langchain/langgraph";
import { Document } from "@langchain/core/documents";
import { Annotation } from "@langchain/langgraph";
import { z } from "zod";
import { franc } from 'franc';
//import type { UserInfo } from "@/app/types";

const llm = new ChatOpenAI({
  temperature: 0,
  modelName: "gpt-4o", // or "gpt-3.5-turbo"
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
contenidos del programa Educa Tennis. 

Tu función principal es generar sesiones de entrenamiento o responder preguntas 
conceptuales usando exclusivamente la información textual exacta encontrada en 
los documentos proporcionados en el contexto proporcionado. 

No debes resumir, parafrasear, completar con conocimientos propios ni inventar 
ejercicios o contenido. Siempre responde utilizando literalmente los ejercicios, actividades, 
nombres, y descripciones tal como aparecen en el programa original.

Si el usuario, hace preguntas conceptuales, debes extraer el contenido directamente
del programa y responder al usuario con los contenidos proporcionados en contexto.

Si el usuario solicita una sesión, debes extraer el contenido directamente 
del programa y estructurarlo en el siguiente formato:

---

Si el usuario solicita múltiples sesiones (por ejemplo, una semana completa), 
proporciona todas las sesiones que detectes en la semana especificada. Todas las sessiones estan estructuradas por trimestre, semana y session.

Si el usuario te pide las sessiones de una semana en concreta, como por ejemplo 
la semana 1. El resultado serian todas las sessiones de la Semana: 1.

Si el usuario te pide una o varias sessiones especificas, siempre devuelve las 
sessiones que te pida. 

Si el usuario solicita solo ejercicios, actividades o juegos, proporciona solo 
el ejercicio o los ejercicios mas apropiados en contexto. 

Siempre, devuelve el resultado con formato markdown limipo, sin cambiar la letra.

---

Despues de la respuesta, siempre ayudas al usuario como guia para las siguientes 
preguntas utilizando la pregunta en cuestion y el contexto utilizado. El objetivo 
es mantener al usuario preguntando y tu tienes que guiarlo siempre sugeriendo nuevas
sesiones, ejercicios o explicacion de conceptos dependiendo de lo que el usuario
vaya preguntando.

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
  query: z.string().describe("Search query to run. Translate always to spanish."),
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
  ]).describe("Use of coach type"),
  language: z.enum(["spa","en"]).describe('Detects language if spanish returns "spa" otherwise returns "en"'),
  questionType: z.enum(["session", "conceptual"])
  .describe(
    `Classify the query intent:
      - Use "session" if the user is asking for a specific training plan, exercises, session details, weekly programs, or any practice-oriented content (e.g. "Dame una sesión para mejorar mi saque", "Ejercicios para volea").
      - Use "conceptual" if the user is asking about tennis theory, technique explanations, training principles, objectives, or general advice (e.g. "¿Qué es la anticipación en tenis?", "¿Cómo mejorar la concentración?", "¿Cuántas sesiones debe entrenar un jugador profesional en una semana?", "¿Cuales son los objetivos tecnicos a trabajar en la primera semana?").`
  ),
  dates: z.object({ 
    trimester: z.number().describe("Trimester number requested by the user, defaults to 1 if not provided"), 
    week: z.number().describe("Week number of the session requested by the user, defaults to 0 if not mentioned"), 
    session: z.number().describe("Specific session number if mentioned, defaults to 0 if not mentioned"), 
    limit: z.number().describe("Maximum number of sessions requested, e.g., 'first 5 sessions', 'first 5 weeks' would set limit to 5, defaults to 0 if not mentioned")
  }).describe("Detects the number of trimester, week and session the user is asking to get the sessions.")
});

const structuredLlm = llm.withStructuredOutput(searchSchema);

// Node1 - Query Analysis
const analyzeQuery = async (state: typeof InputStateAnnotation.State) => {
  const result = await structuredLlm.invoke(state.question);
  console.log(result);
  return { search: result };
};

// Node2 - Retrieval of Embeddings
const retrieve = async (state: typeof StateAnnotation.State) => {
  const {
    ageGroup,
    questionType,
    dates,
  } = state.search
  let coach = state.search.coach;
  const filterGroups: string[] = [ageGroup];

  // Include mixed group programs
  if(ageGroup == "6 AÑOS" || ageGroup == "7 AÑOS") {
    filterGroups.push("6-7 AÑOS");
  } else if(ageGroup == "8 AÑOS" || ageGroup == "9 AÑOS") {
    filterGroups.push("8-9 AÑOS");
  } else if(ageGroup == "10 AÑOS" || ageGroup == "11 AÑOS") {
    filterGroups.push("10-11 AÑOS");
  } else if(ageGroup == "12 AÑOS" || ageGroup == "13 AÑOS") {
    filterGroups.push("12-13 AÑOS");
  } else if(ageGroup == "16 AÑOS" || ageGroup == "ALTO RENDIMIENTO JUVENIL") {
    coach = "coach"; 
  }
      
  dates.trimester = questionType == "session" ? dates.trimester : 0;
  const filter: any = {
    "$and": [
      { "ageGroup": { "$in": filterGroups } },
      { "coach": coach },
      { "sectionType": questionType},
      ...(dates.trimester > 0 ? [{"trimester": dates.trimester}] : []),
      ...(dates.week > 0 ? [{"week": dates.week}] : []),
    ]
  };

  try {
     let retrievedDocs = await vectorStore.similaritySearch(
      state.search.query,
      16,
      filter
    );

    if(dates.trimester || dates.week) {
      // Order sessions
      const sorted = retrievedDocs
        .sort((a,b) => a.metadata.week - b.metadata.week)

      // Add limits
      retrievedDocs = dates.limit as number > 0 
        ? sorted.slice(0, dates.limit) 
        : sorted;

    }

    return { context: retrievedDocs };
  } catch(err: any) {
    throw new Error("Failed to filter results in database.");
  }
}

// Node3 - Prompt Generation
const generate = async (state: typeof StateAnnotation.State) => {
  const docsContent = state.context
    .map((doc) => {
      if(doc.metadata.sectionType == "session") {
        const header = `## Trimestre: ${doc.metadata.trimester} | Semana: ${doc.metadata.week} | Session: ${doc.metadata.session}\n\n`;
        return header.concat(doc.pageContent);
      }
      return doc.pageContent;
    }).join("\n\n---\n\n");

  const messages = await promptTemplate.invoke({
    question: state.question,
    context: docsContent,
  });
  let response = await llm.invoke(messages);

  // Translate if needed
  if(state.search.language != "spa") {
    const messages = [
      { 
        role: "system", 
        content: `You are a translator. Translate the following Spanish text to "${state.search.language}" 
          without changing the meaning. This text is part of a tennis training program, so always use correct tennis-specific terminology used by coaches and players. 
          Do not translate word-for-word if it results in incorrect tennis terms.
            
          Examples:
          - "paralelo" → "down the line"
          - "cruzado" → "cross-court"
          - "dejada" → "drop shot"
          - "resto" → "return"
          - "peloteo" → "rally"

          It's very important that you keep the same structure of the content, do not
          modify, delete or altere images.
        ` 
      },
      { role: "user", content: response.content }
    ];
    response = await llm.invoke(messages);
  }
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
  const { question, userInfo, language } = await req.json();
  if (!question) return NextResponse.json({ error: 'Missing question' }, { status: 400 });

  try { 
    const group = userInfo.ageGroup;
    const coach = userInfo.userType;
    const query = `${question}, GRUPO: ${group}, COACH: ${coach}, language: ${language}`;
    const result = await graph.invoke({question: query});
    return NextResponse.json({answer: result.answer});
  } catch(error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

