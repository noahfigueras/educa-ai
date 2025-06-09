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
conceptuales usando exclusivamente la información textual exacta encontrada en 
los documentos proporcionados en el contexto proporcionado. 

No debes resumir, parafrasear, completar con conocimientos propios ni inventar 
ejercicios o contenido. Siempre responde utilizando literalmente los ejercicios, actividades, 
nombres, y descripciones tal como aparecen en el programa original.

Si el usuario, hace preguntas conceptuales, debes extraer el contenido directamente
del programa y responder al usuario con los contenidos proporcionados en contexto.

Si el usuario solicita una sesión, debes extraer el contenido directamente 
del programa y estructurarlo en el siguiente formato:

- **Número de Sesión**: [número]
- **Número de Semana**: [número]
- **Contenidos Para Trabajar**: [extraído literalmente]
- **Tiempo Total de la Sesión**: [Pueden haber diferentes tiempos, extrae todos]

## PARTE [Inicial, Principal, Final] 

- **Duración**: [duración la parte en minutos]

### Ejercicio [Número del ejercicio]
- **Etapa**: [TIPO DE EJERCICIO en mayúsculas al principio de la descripción]
- **Descripción**: [descripción]
  
[Grafico de explicacion de los ejercicios solo un grafico por entrenamiento]
## Graficos Explicativos
![Vector](/images/<url_vector>.png)

---

Si el usuario solicita múltiples sesiones (por ejemplo, una semana completa), 
proporciona todas las sesiones con esa estructura.

Si el usuario solicita solo ejercicios, actividades o juegos, proporciona solo 
el ejercicio o los ejercicios mas apropiados en contexto. 

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
  language: z.string().describe("Extrae lenguage del query 'LANGUAGE: <codigo_idioma>'"),
  questionType: z.enum(["session", "conceptual"])
  .describe(
    `Classify the query intent:
      - Use "session" if the user is asking for a specific training plan, exercises, session details, weekly programs, or any practice-oriented content (e.g. "Dame una sesión para mejorar mi saque", "Ejercicios para volea").
      - Use "conceptual" if the user is asking about tennis theory, technique explanations, training principles, or general advice (e.g. "¿Qué es la anticipación en tenis?", "¿Cómo mejorar la concentración?", "¿Cuántas sesiones debe entrenar un jugador profesional en una semana?").`
  )
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
  const group = state.search.ageGroup;
  const questionType = state.search.questionType;
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
      { "coach": coach },
      { "sectionType": questionType}
    ]
  };
  console.log(filter);
  try {
  const retrievedDocs = await vectorStore.similaritySearch(
    state.search.query,
    5,
    filter
  );
  //console.log(retrievedDocs);
  return { context: retrievedDocs };
  } catch(err: any) {
    console.log(err)
  }
}

// Node3 - Prompt Generation
const generate = async (state: typeof StateAnnotation.State) => {
  const contextWithImages = state.context.map((doc, index) => {
    const imageMarkdown = doc.metadata?.imageRef
      ? `![Ficha](${doc.metadata.imageRef})\n`
      : "";
    const vectorMarkdown = doc.metadata?.imageRef
      ? `![Vector](${doc.metadata.vectorRef})\n`
      : "";
      return `${imageMarkdown}${vectorMarkdown}${doc.pageContent}`;
  }).join("\n\n");
  const docsContent = state.context.map((doc) => doc.pageContent).join("\n");
  const messages = await promptTemplate.invoke({
    question: state.question,
    context: contextWithImages,
  });
  let response = await llm.invoke(messages);

  // Translate if needed
  if(state.search.language != "spa") {
    const messages = [
      { role: "system", content: `You are a translator. Translate the following Spanish text to "${state.search.language}" without changing the meaning.` },
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
  const { question, userInfo } = await req.json();
  if (!question) return NextResponse.json({ error: 'Missing question' }, { status: 400 });

  try { 
    const group = userInfo.ageGroup;
    const coach = userInfo.userType;
    const lang = franc(question, { only: ['spa', 'eng'] });
    const query = `${question}, GRUPO: ${group}, COACH: ${coach}, LANGUAGE: ${lang}`;
    const result = await graph.invoke({question: query});
    return NextResponse.json({answer: result.answer});
  } catch(error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

