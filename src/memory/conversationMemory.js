const conversations = new Map();

const MAX_MESSAGES = 12;

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
        content
    });

    // Keep only the most recent messages
    while (conversation.length > MAX_MESSAGES) {
        conversation.shift();
    }
}

function clearConversation(userId) {
    conversations.delete(userId);
}

module.exports = {
    getConversation,
    addMessage,
    clearConversation
};