const Groq = require("groq-sdk");
const systemPrompt = require("../prompts/systemPrompt");
const { getConversation, addMessage } = require("../memory/conversationMemory");

const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY,
});

// Fast model for normal everyday Discord chat
const FAST_MODEL = "llama-3.1-8b-instant";

// Stronger model for complex questions
const SMART_MODEL = "openai/gpt-oss-20b";

const MAX_OUTPUT_TOKENS = 700;

function isComplexRequest(message) {
    const text = message.toLowerCase();

    const complexKeywords = [
        "explain in detail",
        "step by step",
        "analyze",
        "analysis",
        "compare",
        "difference between",
        "debug",
        "debugging",
        "code",
        "programming",
        "javascript",
        "python",
        "discord bot",
        "railway",
        "github",
        "api",
        "architecture",
        "strategy",
        "why does",
        "how does",
        "calculate",
        "solve"
    ];

    return (
        text.length > 500 ||
        complexKeywords.some(keyword => text.includes(keyword))
    );
}

function getFriendlyRateLimitMessage() {
    return "⚠️ Bro, AI की usage limit अभी hit हो गई है. थोड़ी देर बाद फिर try करना — मैं यहीं हूँ. 🔥";
}

async function askAI(userId, message) {
    // Save user message
    addMessage(userId, "user", message);

    // Get recent conversation
    const history = getConversation(userId);

    const messages = [
        {
            role: "system",
            content: systemPrompt
        },
        ...history
    ];

    const model = isComplexRequest(message)
        ? SMART_MODEL
        : FAST_MODEL;

    try {
        const response = await groq.chat.completions.create({
            model,
            messages,
            temperature: 0.7,
            max_completion_tokens: MAX_OUTPUT_TOKENS
        });

        const aiReply = response.choices?.[0]?.message?.content;

        if (!aiReply) {
            throw new Error("AI returned an empty response.");
        }

        // Save AI response to memory
        addMessage(userId, "assistant", aiReply);

        return aiReply;

    } catch (error) {

        console.error("Groq Error:", error);

        // Rate limit / quota
        if (
            error?.status === 429 ||
            error?.code === "rate_limit_exceeded" ||
            error?.error?.code === "rate_limit_exceeded"
        ) {
            return getFriendlyRateLimitMessage();
        }

        return "❌ Bro, AI को अभी response generate करने में problem आ रही है. थोड़ी देर बाद फिर try कर.";
    }
}

module.exports = {
    askAI
};