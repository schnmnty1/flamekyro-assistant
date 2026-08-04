const conversations = new Map();

function getConversation(userId) {
  if (!conversations.has(userId)) {
    conversations.set(userId, []);
  }

  return conversations.get(userId);
}

function addMessage(userId, role, content) {
  const conversation = getConversation(userId);

  conversation.push({
    role,
    content,
  });

  // केवल आखिरी 20 messages रखो
  if (conversation.length > 20) {
    conversation.shift();
  }
}

module.exports = {
  getConversation,
  addMessage,
};