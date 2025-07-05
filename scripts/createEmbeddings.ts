import * as fs from 'fs/promises';
import * as path from 'path';
import { Chroma } from "@langchain/community/vectorstores/chroma";
import { OpenAIEmbeddings } from "@langchain/openai";
import { Document } from "langchain/document";

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

async function main() {
  const folderPath = "./content-md";
  const files = await getFilesInDir(folderPath);

  for(const file of files) {
    const path = `${folderPath}/${file}`;
    const vector = await getVectorEmbedding(path); 
    await vectorStore.addDocuments(vector);
  }
}
main();

async function getVectorEmbedding(file: string) {
  const data = JSON.parse(await fs.readFile(file, 'utf8'));
  const vector: Document [] = [];
  data.forEach((obj: any) => {
    vector.push(new Document({
      pageContent: obj.pageContent,
      metadata: {
        page: obj.page, 
        ageGroup: obj.ageGroup,
        sectionType: obj.sectionType,
        coach: obj.coach,
        trimester: obj.trimester,
        week: obj.week,
        session: obj.session,
      }
    }));
  });
  return vector;
}

async function getFilesInDir(dir: string): Promise<string[]> {
  try {
    const files = await fs.readdir(dir);
    return files;
  } catch (err) {
    console.error('Error reading folder:', err);
    throw err; // or return an appropriate value, e.g., an empty array
  }
}
