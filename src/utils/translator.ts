import crypto from "crypto";

// OpenAI Tool Definition
export interface OpenAITool {
  type: "function";
  function: {
    name: string;
    description?: string;
    parameters?: {
      type: string;
      properties?: Record<string, any>;
      required?: string[];
    };
  };
}

// OpenAI Tool Call
export interface OpenAIToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
}

// OpenAI Chat Completion Request
export interface OpenAIChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: OpenAIToolCall[];
  tool_call_id?: string;
  name?: string;
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
  tools?: OpenAITool[];
  tool_choice?: "none" | "auto" | { type: "function"; function: { name: string } };
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
      content: string | null;
      tool_calls?: OpenAIToolCall[];
    };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

// OpenAI Streaming Chunk
export interface OpenAIStreamChunk {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    delta: {
      role?: string;
      content?: string;
      tool_calls?: Array<{
        index: number;
        id?: string;
        type?: "function";
        function?: {
          name?: string;
          arguments?: string;
        };
      }>;
    };
    finish_reason: string | null;
  }>;
}

// 0G Request Format
export interface ZGChatRequest {
  messages: Array<{
    role: string;
    content: string | null;
    tool_calls?: OpenAIToolCall[];
    tool_call_id?: string;
    name?: string;
  }>;
  model: string;
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
  tools?: OpenAITool[];
  tool_choice?: "none" | "auto" | { type: "function"; function: { name: string } };
}

// 0G Response Format (assuming similar to OpenAI)
export interface ZGChatResponse {
  id?: string;
  choices?: Array<{
    message?: {
      role: string;
      content: string | null;
      tool_calls?: OpenAIToolCall[];
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
        ...(msg.tool_calls && { tool_calls: msg.tool_calls }),
        ...(msg.tool_call_id && { tool_call_id: msg.tool_call_id }),
        ...(msg.name && { name: msg.name }),
      })),
      model: openAIRequest.model,
    };

    if (openAIRequest.temperature !== undefined) {
      zgRequest.temperature = openAIRequest.temperature;
    }

    if (openAIRequest.max_tokens !== undefined) {
      zgRequest.max_tokens = openAIRequest.max_tokens;
    }

    if (openAIRequest.stream !== undefined) {
      zgRequest.stream = openAIRequest.stream;
    }

    if (openAIRequest.tools !== undefined) {
      zgRequest.tools = openAIRequest.tools;
    }

    if (openAIRequest.tool_choice !== undefined) {
      zgRequest.tool_choice = openAIRequest.tool_choice;
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
    let content: string | null = "";
    let finishReason = "stop";
    let toolCalls: OpenAIToolCall[] | undefined = undefined;

    if (zgResponse.choices && zgResponse.choices.length > 0) {
      // Standard OpenAI-like format
      const choice = zgResponse.choices[0];
      content = choice.message?.content || choice.text || "";
      finishReason = choice.finish_reason || "stop";

      // Handle tool calls if present
      if (choice.message?.tool_calls) {
        toolCalls = choice.message.tool_calls;
        // When tool_calls are present, content may be null
        if (!content) {
          content = null;
        }
      }
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
      requestMessages.map((m) => m.content || "").join(" ")
    );
    const completionTokens = this.estimateTokens(content || "") +
      (toolCalls ? this.estimateTokens(JSON.stringify(toolCalls)) : 0);

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
            ...(toolCalls && { tool_calls: toolCalls }),
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

  /**
   * Convert streaming chunk from 0G to OpenAI format
   */
  static zgStreamChunkToOpenAI(
    zgChunk: any,
    model: string,
    id: string,
    created: number
  ): OpenAIStreamChunk {
    // Handle different possible chunk formats
    let delta: any = {};
    let finishReason: string | null = null;

    if (zgChunk.choices && zgChunk.choices.length > 0) {
      const choice = zgChunk.choices[0];
      delta = choice.delta || {};
      finishReason = choice.finish_reason || null;
    } else if (zgChunk.delta) {
      delta = zgChunk.delta;
      finishReason = zgChunk.finish_reason || null;
    } else if (zgChunk.content !== undefined) {
      delta = { content: zgChunk.content };
    } else if (typeof zgChunk === 'string') {
      delta = { content: zgChunk };
    }

    return {
      id: zgChunk.id || id,
      object: "chat.completion.chunk",
      created: zgChunk.created || created,
      model: model,
      choices: [
        {
          index: 0,
          delta: delta,
          finish_reason: finishReason,
        },
      ],
    };
  }

  /**
   * Parse SSE data line and extract JSON
   */
  static parseSSELine(line: string): any | null {
    // SSE format: "data: {json}"
    if (line.startsWith('data: ')) {
      const data = line.substring(6).trim();

      // Check for [DONE] marker
      if (data === '[DONE]') {
        return { done: true };
      }

      try {
        return JSON.parse(data);
      } catch (e) {
        return null;
      }
    }
    return null;
  }

  /**
   * Format chunk as SSE string
   */
  static formatSSE(chunk: OpenAIStreamChunk): string {
    return `data: ${JSON.stringify(chunk)}\n\n`;
  }

  /**
   * Format done message as SSE string
   */
  static formatSSEDone(): string {
    return `data: [DONE]\n\n`;
  }
}
