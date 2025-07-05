import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { ChatOpenAI } from "@langchain/openai";
import { fromPath } from "pdf2pic";
import { Document } from "langchain/document";
import fs from "fs";
import path from "path";
import { z } from "zod";

const files = [ 
  "./content/es/educaU18/Educa6.pdf",
  "./content/es/educaU18/Educa7.pdf",
  "./content/es/educaU18/Educa8.pdf",
  "./content/es/educaU18/Educa9.pdf",
  "./content/es/educaU18/Educa10.pdf",
  "./content/es/educaU18/Educa11.pdf",
  "./content/es/educaU18/Educa12.pdf",
  "./content/es/educaU18/Educa13.pdf",
  "./content/es/educaU18/Educa16.pdf",
  "./content/es/educaU18/Under18.pdf",
  "./content/es/padreEntrenador/padreEntrenador_6-7.pdf",
  "./content/es/padreEntrenador/padreEntrenador_8-9.pdf",
  "./content/es/padreEntrenador/padreEntrenador_10-11.pdf",
  "./content/es/padreEntrenador/padreEntrenador_12-13.pdf",
  "./content/es/Verano/Verano6-7.pdf",
  "./content/es/Verano/Verano8-9.pdf",
  "./content/es/Verano/Verano10-11.pdf",
  "./content/es/Verano/Verano12-13.pdf",
  //"./content/es/Verano/VeranoCompeticion12-13.pdf",  hex values heree!!
  "./content/es/AdultosAutodidacta/AdultosAutodidactaIniciacion.pdf",
  "./content/es/AdultosAutodidacta/AdultosAutodidactaPerfeccionamiento.pdf",
  "./content/es/AdultosAutodidacta/AdultosAutodidactaTecnificacion.pdf",
  "./content/es/AdultosAutodidacta/AdultosAutodidactaCompeticion.pdf",
  "./content/es/AdultosCoach/AdultosIniciacion.pdf",
  "./content/es/AdultosCoach/AdultosPerfeccionamiento.pdf",
  "./content/es/AdultosCoach/AdultosTecnificacion.pdf",
  "./content/es/AdultosCoach/AdultosCompeticion.pdf",
  "./content/es/ATP/ATP_WTA_Indoor.pdf",
  "./content/es/ATP/ATP_WTA_Rapida.pdf",
  "./content/es/ATP/ATP_WTA_Tierra.pdf",
];

const llm = new ChatOpenAI({
  temperature: 0,
  modelName: "gpt-4o", // or "gpt-3.5-turbo"
  streaming: true,
});

async function main() {
  for(const file of files) {
    const loader = new PDFLoader(file);
    const pdf = await loader.load();
    await parseDocument(pdf);
    break;
  }
}
main();

const searchSchema = z.object({
  page: z.number().describe("number of the page"),
  pageContent: z.string().describe(`Extract all the content and format it in a clean and easy to read markdown format style. If the page is a session which you can identify only if you find the following keywords: "ENTRENADOR:", "FECHA:", it is very important that you include all the different times for the session and exercises found.`), ageGroup: z.enum([
    "6 AÑOS", 
    "7 AÑOS", 
    "6-7 AÑOS", 
    "8 AÑOS",
    "9 AÑOS",
    "8-9 AÑOS",
    "10 AÑOS",
    "11 AÑOS",
    "10-11 AÑOS",
    "12 AÑOS",
    "13 AÑOS",
    "12-13 AÑOS",
    "16 AÑOS",
    "ALTO RENDIMIENTO JUVENIL",
    "ADULTOS INICIACION",
    "ADULTOS PERFECCIONAMIENTO",
    "ADULTOS TECNIFICACIÓN",
    "ADULTOS COMPETICIÓN",
    "ATP_WTA_Tierra",
    "ATP_WTA_Rapida",
    "ATP_WTA_Indoor",
  ]).describe("Extract the age or group of the program. For ATP/WTA use the filename to classify them by court type"),
  sectionType: z.enum(["session", "conceptual"]).describe(`Detects if the image is a session or a conceptual page. It is a session only if you find the keywords "ENTRENADOR:" and "FECHA:" in the page, otherwise return conceptual by default.`),
  coach: z.enum(["coach", "player", "parent"]).describe('Detect if the program is designed for a coach, parent or a player. By default this will be a coach. If you find in the fileName of the pdf image which I will provide, "padreEntrenador" this is for a parent. If you find in the title of the pdf "AdultosAutodidacta" then it is for a player.'),
  trimester: z.number().describe("Detects session trimester number if the page is a session, otherwise returns null"),
  week: z.number().describe("Detects session week number if the page is a session, otherwise returns null"),
  session: z.number().describe("Detects session number if the page is a session, otherwise returns null"),
});
const structuredLlm = llm.withStructuredOutput(searchSchema);

async function parseDocument(doc: Document[]) {
  const filePath = doc[0].metadata.source;
  const fileName = path.basename(filePath);
  const pages = [];

  for(const page of doc) {
    const number = page.metadata.loc.pageNumber; 
    pages.push(ParserAgent(filePath, fileName, number));
  }

  const result = await Promise.all(pages);
  write2JSON(fileName, result);
  return result
}

async function ParserAgent(filePath: string, fileName: string, number: number) {
    const base64 = await convertPdfPage2base64(filePath, number);
    const message = [
      {
        role: "system",
        content: `You are an expert AI agent that helps me parse pdf images to    
        extract the content of the pdf as well as some metadata related to it with 
        the defined structured output provided. Do not include any links 
        or references to images. When extracting the text content of the image 
        make sure to extract all the helpful information you can find and don't 
        forget to include the times of the sessions.`
      }, 
      {
        role: "user",
        content: [
          {type: "text", text: `This is the fileName: ${fileName}`},
          {
          type: "image_url",
          image_url: {
            url: `data:image/png;base64,${base64}`
          }
        }]
      }
    ];

    const maxRetries = 5;
    let attempt = 0;
    let result;

    while (attempt < maxRetries) {
        try {
            result = await structuredLlm.invoke(message);
            if (result.page != number) result.page = number;
            return result;
        } catch (error) {
            if (isRateLimitError(error)) {
                attempt++;
                const backoffTime = calculateExponentialBackoff(attempt);
                console.log(`Rate limit exceeded. Retrying in ${backoffTime}ms...`);
                await sleep(backoffTime);
            } else {
                throw error; // Re-throw non-rate limit errors
            }
        }
    }
    
    throw new Error('Max retry attempts reached');
}

function isRateLimitError(error: any): boolean {
    // Implement logic to determine if the error is due to rate limiting.
    // This might be checking the error code or message content.
    return error.code === 'rate_limit_exceeded';
}

function calculateExponentialBackoff(attempt: number): number {
    // Calculate exponential backoff time with some jitter.
    const baseTime = 200; // Base delay time in milliseconds
    const jitter = Math.random() * 100; // Random jitter up to 100ms
    return Math.min(1600, baseTime * Math.pow(2, attempt)) + jitter;
}

function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function convertPdfPage2base64(source: string, page: number): Promise<string> {
  const options = { 
    density: 150,           // DPI (higher = better quality)
    width: 1240,            // A4 width at 150 DPI
    height: 1754            // A4 height at 150 DPI
  };

  const convert = fromPath(source, options);
  const resolve = await convert(page, { responseType: "base64" });
  return resolve.base64 as string;
}

function write2JSON(fileName: string, data: any[]) {
  fs.writeFileSync(
    `content-md/${fileName.replace(".pdf", ".json")}`, 
    JSON.stringify(data, null, 2), 
    'utf-8'
  );
}

