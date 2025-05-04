import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { Chroma } from "@langchain/community/vectorstores/chroma";
import { OpenAIEmbeddings } from "@langchain/openai";
import { Document } from "langchain/document";
//import { fromPath } from "pdf2pic";

const files = [ 
  "./content/Educa6.pdf",
  "./content/Educa7.pdf",
  "./content/Educa8.pdf",
  "./content/Educa9.pdf",
  "./content/Educa10.pdf",
  "./content/Educa11.pdf",
  "./content/Educa12.pdf",
  "./content/Educa13.pdf",
  "./content/Educa16.pdf",
  "./content/Under18.pdf"
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
  let sectionType = "introduccion";
  const matchAge = doc[0].pageContent.match(/(?:GRUPO:\s*|EDAD:\s*|ETAPA\s+)(.*?)(?:\s+TEMPORADA|$)/i);
  const ageGroup = matchAge ? matchAge[1].trim() : null;


  for(let i = 0; i < 5; i++) {
    const d = doc[i];
    let week, day, topic, imageRef;
    const isTrainingPlan = false;
    if (d.pageContent.includes("2- TEMPORIZACIÓN Y DESARROLLO CONCEPTUAL DE LOS CONTENIDOS")) {
      sectionType = "entrenamiento";
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
        ageGroup,
        sectionType,
        week,
        day,
        topic,
        isTrainingPlan,
        imageRef
      }
    }));
  }

  return vector;
}

/*
function convertPdf2Pic(fileName, page) {
  const options = { 
    density: 150,           // DPI (higher = better quality)
    saveFilename: fileName,   // Base filename
    savePath: "./images",   // Output directory
    format: "png",          // Output format
    width: 1240,            // A4 width at 150 DPI
    height: 1754            // A4 height at 150 DPI
  };

  const convert = fromPath(pdfFile, options);
  convert(page);
}*/

run();
