import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { Chroma } from "@langchain/community/vectorstores/chroma";
import { OpenAIEmbeddings } from "@langchain/openai";
import { Document } from "langchain/document";
import { fromPath } from "pdf2pic";

const files = [ 
  "./content/educaU18/Educa6.pdf",
  "./content/educaU18/Educa7.pdf",
  "./content/educaU18/Educa8.pdf",
  "./content/educaU18/Educa9.pdf",
  "./content/educaU18/Educa10.pdf",
  "./content/educaU18/Educa11.pdf",
  "./content/educaU18/Educa12.pdf",
  "./content/educaU18/Educa13.pdf",
  "./content/educaU18/Educa16.pdf",
  "./content/educaU18/Under18.pdf",
  "./content/padreEntrenador/padreEntrenador_6-7.pdf",
  "./content/padreEntrenador/padreEntrenador_8-9.pdf",
  "./content/padreEntrenador/padreEntrenador_10-11.pdf",
  "./content/padreEntrenador/padreEntrenador_12-13.pdf",
  "./content/Verano/Verano6-7.pdf",
  "./content/Verano/Verano8-9.pdf",
  "./content/Verano/Verano10-11.pdf",
  "./content/Verano/Verano12-13.pdf",
  //"./content/Verano/VeranoCompeticion12-13.pdf",  hex values heree!!
  "./content/AdultosAutodidacta/AdultosIniciacion.pdf",
  "./content/AdultosAutodidacta/AdultosPerfeccionamiento.pdf",
  "./content/AdultosAutodidacta/AdultosTecnificacion.pdf",
  "./content/AdultosAutodidacta/AdultosCompeticion.pdf",
  "./content/AdultosCoach/AdultosIniciacion.pdf",
  "./content/AdultosCoach/AdultosPerfeccionamiento.pdf",
  "./content/AdultosCoach/AdultosTecnificacion.pdf",
  "./content/AdultosCoach/AdultosCompeticion.pdf",
  "./content/ATP/ATP_WTA_Indoor.pdf",
  "./content/ATP/ATP_WTA_Rapida.pdf",
  "./content/ATP/ATP_WTA_Tierra.pdf",
];

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

async function run() {
  // Parse all programs
  for(const file of files) {
    const loader = new PDFLoader(file);
    const pdf = await loader.load();
    const vector = parseDocument(pdf);
    await vectorStore.addDocuments(vector);
  }
}

function parseDocument(doc: Document[]) {
  const vector = [];
  let ageGroup;
  let coach;
  let sectionType 

  // Match Group
  let matchAge = doc[0].pageContent.match(/(?:GRUPO:\s*|EDAD:\s*|ETAPA\s+)(.*?)(?:\s+TEMPORADA|$)/i);
  if(matchAge) {
    ageGroup = matchAge[1].trim();
  } else if(matchAge = doc[0].pageContent.match(/(\d+)-(\d+)\s*AÑOS/))  {
    ageGroup = matchAge[0].trim();
  } else {
    const autodidactaMatch = doc[0].pageContent
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .match(
        /ADULTOS(?:\s+AUTODIDACTA)?\s+(?:(["“«<]{1,2})([A-ZÑ\s]+)(?:["”»>]{1,2})|([A-ZÑ\s]+))/
    );
    if (autodidactaMatch) {
      const extracted = autodidactaMatch[2] || autodidactaMatch[3];
      ageGroup = `ADULTOS ${extracted.trim()}`;
    }
  }

  // Match court type for ATP
  if(doc[0].metadata.source.includes("ATP")) {
    const match = doc[0].metadata.source.match(/([^/]+)\.pdf$/);
    ageGroup = match ? match[1] : null;
  }

  // Match Coach Type Based on source
  if(doc[0].metadata.source.includes("padreEntrenador")) {
    coach = "parent";
  } else if(doc[0].metadata.source.includes("Autodidacta")) {
    coach = "player";
  } else {
    coach = "coach";
  }

  // Filter training sessions and conceptual concepts
  for(let i = 0; i < doc.length; i++) {
    const d = doc[i];
    let week, day, topic, imageRef;
    if (d.pageContent.includes("ENTRENADOR:") && d.pageContent.includes("FECHA:")) {
      sectionType = "session";
      const fileName = `ficha-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
      convertPdf2Pic(fileName, d.metadata.loc.pageNumber, doc[0].metadata.source);
      imageRef = `${fileName}.${d.metadata.loc.pageNumber}.png`;
    } else {
      sectionType = "conceptual";
    }     

    /*
    if(sectionType != "introduccion") {
      const days = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];
      day = days.find((x) => d.pageContent.toLowerCase().includes(x)) || null;

      isTrainingPlan = d.pageContent.includes("ENTRENADOR:");
      console.log(d.pageContent);
      const topicMatch = d.pageContent.replace(/\n/g, " ").match(/(?:\b(?:lunes|martes|miércoles|jueves|viernes|sábado|domingo)\b(?:.*?))((T[ÉÉ]CNICAS\s+Y\s+T[ÁA]CTICAS.*?))(?=\s+Concepto:|\s+TIEMPO\s+SESI[ÓO]N)/i);
      topic = topicMatch?.[1]?.trim() || null;

      if(isTrainingPlan) {
        const weekMatch = d.pageContent.match(/semana[:\s]*([0-9]+)/i);
        week = weekMatch ? parseInt(weekMatch[1]) : null;
        // Generate fileName here to avoid waiting for pdf2pic.
        const fileName = `ficha-${Date.now()}-${Math.floor(Math.random() * 10000)}.png`;
        //convertPdf2Pic(fileName, d.metadata.loc.pageNumber);
        imageRef = fileName;
      } else {
        const weekMatch = d.pageContent.match(/(\d+)[ªaº]?\s*semana/i);
        week = weekMatch ? parseInt(weekMatch[1]) : null;
      }
    }*/

    vector.push(new Document({
      pageContent: d.pageContent.split('\n').filter(line => line.length > 0).join('/n'),
      metadata: {
        coach,
        ageGroup,
        sectionType,
        week,
        day,
        topic,
        imageRef
      }
    }));
  }

  return vector;
}

function convertPdf2Pic(fileName: string, page: number, source: string) {
  const options = { 
    density: 150,           // DPI (higher = better quality)
    saveFilename: fileName,   // Base filename
    savePath: "./images",   // Output directory
    format: "png",          // Output format
    width: 1240,            // A4 width at 150 DPI
    height: 1754            // A4 height at 150 DPI
  };

  const convert = fromPath(source, options);
  convert(page);
}

run();
