const Groq = require("groq-sdk");
const systemPrompt = require("../prompts/systemPrompt");
const { getConversation, addMessage } = require("../memory/conversationMemory");

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

async function askAI(userId, message) {
  // User का नया message memory में add करो
  addMessage(userId, "user", message);

  // Conversation history लाओ
  const history = getConversation(userId);

  // System prompt + history भेजो
  const messages = [
    {
      role: "system",
      content: systemPrompt,
    },
    ...history,
  ];

  const response = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    messages,
    temperature: 0.7,
    max_completion_tokens: 1024,
  });

  const aiReply = response.choices[0].message.content;

  // AI का reply भी memory में save करो
  addMessage(userId, "assistant", aiReply);

  return aiReply;
}

module.exports = { askAI };