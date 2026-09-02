import { groq } from "@ai-sdk/groq";
import { convertToModelMessages, streamText, type UIMessage } from "ai";
import {
  buildChatSystemPrompt,
  sanitizeChatStockContext,
  type ChatStockContext,
} from "@/lib/chat-context";
import {
  checkChatRateLimit,
  clientIdentifierFromRequest,
} from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// Llama 3.3 70B was retired from Groq; gpt-oss-120b is the current closest
// free-tier equivalent. Verify at console.groq.com/docs/models if retired.
const GROQ_MODEL = "openai/gpt-oss-120b";

// Bounds on client-supplied input — this endpoint is open to guests, so a
// single request must not be able to blow up token cost or hold the
// connection with an unbounded payload.
const MAX_MESSAGES = 40;
const MAX_MESSAGE_TEXT_LENGTH = 2000;
const MAX_OUTPUT_TOKENS = 800;

type ChatRequestBody = {
  messages: UIMessage[];
  stockContext: ChatStockContext;
};

function isChatRequestBody(json: unknown): json is ChatRequestBody {
  if (!json || typeof json !== "object") return false;
  const o = json as Record<string, unknown>;
  return Array.isArray(o.messages) && typeof o.stockContext === "object" && o.stockContext !== null;
}

function messagesWithinLimits(messages: UIMessage[]): boolean {
  if (messages.length > MAX_MESSAGES) return false;
  for (const message of messages) {
    if (!Array.isArray(message.parts)) return false;
    for (const part of message.parts) {
      if (part.type === "text" && part.text.length > MAX_MESSAGE_TEXT_LENGTH) {
        return false;
      }
    }
  }
  return true;
}

export async function POST(request: Request) {
  const identifier = clientIdentifierFromRequest(request);
  const rateLimit = await checkChatRateLimit(identifier);
  if (!rateLimit.success) {
    return new Response(
      JSON.stringify({
        error: true,
        message: "You've hit the chat message limit for now. Try again in a bit.",
      }),
      { status: 429, headers: { "Content-Type": "application/json" } },
    );
  }

  const json: unknown = await request.json().catch(() => null);
  if (!isChatRequestBody(json) || !messagesWithinLimits(json.messages)) {
    return new Response(
      JSON.stringify({ error: true, message: "Invalid request" }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  const { messages, stockContext } = json;

  const result = streamText({
    model: groq(GROQ_MODEL),
    system: buildChatSystemPrompt(sanitizeChatStockContext(stockContext)),
    messages: await convertToModelMessages(messages),
    maxOutputTokens: MAX_OUTPUT_TOKENS,
  });

  return result.toUIMessageStreamResponse();
}
