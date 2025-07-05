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

- **Número de Sesión**: [extraer numero de sesion]
- **Número de Semana**: [extraer numero de semana]
- **Contenidos Para Trabajar**: [extraído literalmente]
- **Tiempo Total de la Sesión**: [Por defecto extrae los tiempos de la session de 2 horas, salvo que el usuario te pida una session con un tiempo total differente o la session solo tenga una opcion de 1 hora ]

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
proporciona todas las sesiones con esta estructura. Todas las sessiones estan 
estructuradas por numero de session y semana, como ejemplo las 4 primeras sesiones 
serian: 

1. Session: 1 - Semana: 1 
2. Session: 2: - Semana: 1 
3. Session: 1 - Semana 2
4. Session: 2 - Semana: 2

Si el usuario te pide las sessiones de una semana en concreta, como por ejemplo 
la semana 1. El resultado serian todas las sessiones de la Semana: 1.

Si el usuario te pide una o varias sessiones especificas, siempre devuelve las 
sessiones que te pida. 

Si el usuario solicita solo ejercicios, actividades o juegos, proporciona solo 
el ejercicio o los ejercicios mas apropiados en contexto. 

Siempre, devuelve el resultado con formato markdown, sin cambiar la letra y detecta
y añade los titulos, subtitulos, emphasis en negrita y puntos de enumeracion necessarios.

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
  ),
  dates: z.object({ 
    trimester: z.number(), 
    week: z.number(), 
    session: z.number() 
  }).describe("Detects the number of trimester, week and session the user is asking to get the sessions. The sessions can be numbers or days of the week Ex: 1,2,3 or day of the week kkl")
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
      // Order sessions and limits
      retrievedDocs = retrievedDocs
        .sort((a,b) => a.metadata.week - b.metadata.week);
    }

    // TODO: Consider limiting the results here.
    return { context: retrievedDocs };
  } catch(err: any) {
    throw new Error("Failed to filter results in database.");
  }
}

// Node3 - Prompt Generation
const generate = async (state: typeof StateAnnotation.State) => {
  /*
  const contextWithImages = state.context.map((doc, index) => {
    const imageMarkdown = doc.metadata?.imageRef
      ? `![Ficha](${doc.metadata.imageRef})\n`
      : "";
    const vectorMarkdown = doc.metadata?.imageRef
      ? `![Vector](${doc.metadata.vectorRef})\n`
      : "";
      return `${imageMarkdown}${vectorMarkdown}${doc.pageContent}`;
  }).join("\n\n");
  //const docsContent = state.context.map((doc) => doc.pageContent).join("\n");
  let response = await llm.invoke([
    { 
      role: "system", 
      content: `
        Format all the content to markdown
      ` 
    },
    { role: "user", content: contextWithImages }
  ]);
  const messages = await promptTemplate.invoke({
    question: state.question,
    context: response.content,
  });
  response = await llm.invoke(messages);

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
  }*/
  return {answer: /*response.content*/"lol" };
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

