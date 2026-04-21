const { OpenAI } = require("openai");
const { OpenAIEmbeddings } = require("@langchain/openai");

let openai;
let embeddings;

async function initializeAI() {
  openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });
  embeddings = new OpenAIEmbeddings({
    model: "text-embedding-3-large",
  });
  return { openai, embeddings };
}

function getOpenAI() {
  return openai;
}

function getEmbeddings() {
  return embeddings;
}

module.exports = {
  initializeAI,
  getOpenAI,
  getEmbeddings,
};
