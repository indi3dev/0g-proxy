import crypto from "crypto";

// OpenAI Chat Completion Request
export interface OpenAIChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface OpenAIChatRequest {
  model: string;
  messages: OpenAIChatMessage[];
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
  stop?: string | string[];
  stream?: boolean;
}

// OpenAI Chat Completion Response
export interface OpenAIChatResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

// 0G Request Format
export interface ZGChatRequest {
  messages: Array<{
    role: string;
    content: string;
  }>;
  model: string;
  temperature?: number;
  max_tokens?: number;
}

// 0G Response Format (assuming similar to OpenAI)
export interface ZGChatResponse {
  id?: string;
  choices?: Array<{
    message?: {
      role: string;
      content: string;
    };
    finish_reason?: string;
  }>;
  // 0G might return response differently
  response?: string;
  content?: string;
}

export class Translator {
  /**
   * Translate OpenAI chat request to 0G format
   */
  static openAIToZG(openAIRequest: OpenAIChatRequest): ZGChatRequest {
    const zgRequest: ZGChatRequest = {
      messages: openAIRequest.messages.map((msg) => ({
        role: msg.role,
        content: msg.content,
      })),
      model: openAIRequest.model,
    };

    if (openAIRequest.temperature !== undefined) {
      zgRequest.temperature = openAIRequest.temperature;
    }

    if (openAIRequest.max_tokens !== undefined) {
      zgRequest.max_tokens = openAIRequest.max_tokens;
    }

    return zgRequest;
  }

  /**
   * Translate 0G response to OpenAI format
   */
  static zgToOpenAI(
    zgResponse: any,
    model: string,
    requestMessages: OpenAIChatMessage[]
  ): OpenAIChatResponse {
    // Handle different possible 0G response formats
    let content = "";
    let finishReason = "stop";

    if (zgResponse.choices && zgResponse.choices.length > 0) {
      // Standard OpenAI-like format
      const choice = zgResponse.choices[0];
      content = choice.message?.content || choice.text || "";
      finishReason = choice.finish_reason || "stop";
    } else if (zgResponse.response) {
      // Simple response format
      content = zgResponse.response;
    } else if (zgResponse.content) {
      // Alternative content format
      content = zgResponse.content;
    } else if (typeof zgResponse === "string") {
      // Raw string response
      content = zgResponse;
    }

    // Estimate token usage (rough approximation)
    const promptTokens = this.estimateTokens(
      requestMessages.map((m) => m.content).join(" ")
    );
    const completionTokens = this.estimateTokens(content);

    return {
      id: zgResponse.id || `chatcmpl-${this.generateId()}`,
      object: "chat.completion",
      created: Math.floor(Date.now() / 1000),
      model: model,
      choices: [
        {
          index: 0,
          message: {
            role: "assistant",
            content: content,
          },
          finish_reason: finishReason,
        },
      ],
      usage: {
        prompt_tokens: promptTokens,
        completion_tokens: completionTokens,
        total_tokens: promptTokens + completionTokens,
      },
    };
  }

  /**
   * Estimate token count (rough approximation: 1 token ≈ 4 characters)
   */
  private static estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }

  /**
   * Generate unique ID for chat completion
   */
  private static generateId(): string {
    return crypto.randomBytes(16).toString("hex");
  }
}
