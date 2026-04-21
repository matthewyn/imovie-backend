function generateSystemMessage(docs) {
  return `You are a knowledgeable, friendly assistant representing the company iMovie. You are chatting with a user about iMovie. If relevant, use the given context to answer any question. If you don't know the answer, say so. Context::\n\n${docs.map((doc) => doc.pageContent).join("\n\n")}`;
}

function generateRephraseMessage(history, question) {
  return `
    Given the following conversation and a follow up question, rephrase the follow up question to be a standalone question.
    Chat History:
    ${history}
    Follow Up Input: ${question}
    Standalone Question:
  `;
}

module.exports = { generateSystemMessage, generateRephraseMessage };
