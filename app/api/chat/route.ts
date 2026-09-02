import { groq } from "@ai-sdk/groq";
import { convertToModelMessages, streamText, type UIMessage } from "ai";
import { buildChatSystemPrompt, type ChatStockContext } from "@/lib/chat-context";
import {
  checkChatRateLimit,
  clientIdentifierFromRequest,
} from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// Llama 3.3 70B was retired from Groq; gpt-oss-120b is the current closest
// free-tier equivalent. Verify at console.groq.com/docs/models if retired.
const GROQ_MODEL = "openai/gpt-oss-120b";

type ChatRequestBody = {
  messages: UIMessage[];
  stockContext: ChatStockContext;
};

function isChatRequestBody(json: unknown): json is ChatRequestBody {
  if (!json || typeof json !== "object") return false;
  const o = json as Record<string, unknown>;
  return Array.isArray(o.messages) && typeof o.stockContext === "object" && o.stockContext !== null;
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
  if (!isChatRequestBody(json)) {
    return new Response(
      JSON.stringify({ error: true, message: "Invalid request" }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  const { messages, stockContext } = json;

  const result = streamText({
    model: groq(GROQ_MODEL),
    system: buildChatSystemPrompt(stockContext),
    messages: await convertToModelMessages(messages),
  });

  return result.toUIMessageStreamResponse();
}
