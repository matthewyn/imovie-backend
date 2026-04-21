const { PineconeStore } = require("@langchain/pinecone");
const { Pinecone: PineconeClient } = require("@pinecone-database/pinecone");

let vectorStore;
let pinecone;
let pineconeIndex;

async function initializeVectorStore(embeddings) {
  pinecone = new PineconeClient();
  pineconeIndex = pinecone.Index(process.env.PINECONE_INDEX);

  vectorStore = await PineconeStore.fromExistingIndex(embeddings, {
    pineconeIndex,
    maxConcurrency: 4,
  });

  return vectorStore;
}

function getVectorStore() {
  return vectorStore;
}

function getRetriever() {
  return vectorStore.asRetriever();
}

module.exports = {
  initializeVectorStore,
  getVectorStore,
  getRetriever,
};
