import { Router, Request, Response } from "express";
import crypto from "crypto";
import { getBrokerManager } from "../broker";
import { Translator, OpenAIChatRequest } from "../utils/translator";
import { Logger } from "../utils/logger";

const router = Router();

router.post(
  "/chat/completions",
  async (req: Request, res: Response): Promise<void> => {
    try {
      const openAIRequest: OpenAIChatRequest = req.body;

      // Validate request
      if (!openAIRequest.messages || !Array.isArray(openAIRequest.messages)) {
        res.status(400).json({
          error: {
            message: "Invalid request: messages array is required",
            type: "invalid_request_error",
            code: "invalid_messages",
          },
        });
        return;
      }

      if (!openAIRequest.model) {
        res.status(400).json({
          error: {
            message: "Invalid request: model is required",
            type: "invalid_request_error",
            code: "missing_model",
          },
        });
        return;
      }

      // Handle streaming vs non-streaming
      if (openAIRequest.stream) {
        await handleStreamingRequest(req, res, openAIRequest);
      } else {
        await handleNonStreamingRequest(req, res, openAIRequest);
      }
    } catch (error: any) {
      Logger.error("Error processing chat completion:", error);

      // Handle specific error types
      if (error.message?.includes("No provider")) {
        res.status(503).json({
          error: {
            message: error.message,
            type: "service_unavailable",
            code: "no_provider_available",
          },
        });
        return;
      }

      if (error.message?.includes("Broker not initialized")) {
        res.status(500).json({
          error: {
            message: "Service initialization error",
            type: "internal_error",
            code: "broker_not_initialized",
          },
        });
        return;
      }

      // Generic error response
      res.status(500).json({
        error: {
          message: error.message || "Internal server error",
          type: "internal_error",
          code: "internal_error",
        },
      });
    }
  }
);

async function handleNonStreamingRequest(
  req: Request,
  res: Response,
  openAIRequest: OpenAIChatRequest
): Promise<void> {
  Logger.info(`Chat completion request for model: ${openAIRequest.model}`);

  // Get broker manager
  const brokerManager = getBrokerManager();

  // Get provider from request model (can be provider address or model name)
  const provider = await brokerManager.getProvider(openAIRequest.model);

  Logger.info(
    `Using provider: ${provider.address} at ${provider.endpoint} model ${provider.model}`
  );

  // Update request model to the provider model
  openAIRequest.model = provider.model;

  // Translate request to 0G format
  const zgRequest = Translator.openAIToZG(openAIRequest);

  // Get request headers from broker
  const requestContent = JSON.stringify(zgRequest.messages);
  const headers = await brokerManager.getRequestHeaders(
    provider.address,
    requestContent
  );

  Logger.debug("Request headers obtained", headers);

  // Make request to 0G provider
  const zgEndpoint = `${provider.endpoint}/chat/completions`;
  Logger.info(`Sending request to: ${zgEndpoint}`);

  const response = await fetch(zgEndpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
    body: JSON.stringify(zgRequest),
  });

  if (!response.ok) {
    const errorText = await response.text();
    Logger.error(`0G provider error: ${response.status} - ${errorText}`);

    // Handle specific error codes
    if (response.status === 402) {
      res.status(402).json({
        error: {
          message: "Insufficient balance in 0G account",
          type: "insufficient_balance",
          code: "insufficient_balance",
        },
      });
      return;
    }

    res.status(response.status).json({
      error: {
        message: `Provider error: ${errorText}`,
        type: "provider_error",
        code: "provider_error",
      },
    });
    return;
  }

  const zgResponse = await response.json();
  Logger.debug("0G response received", zgResponse);

  // Translate response to OpenAI format
  const openAIResponse = Translator.zgToOpenAI(
    zgResponse,
    openAIRequest.model,
    openAIRequest.messages
  );

  Logger.info(`Chat completion successful`);
  res.json(openAIResponse);
}

async function handleStreamingRequest(
  req: Request,
  res: Response,
  openAIRequest: OpenAIChatRequest
): Promise<void> {
  Logger.info(`Streaming chat completion request for model: ${openAIRequest.model}`);

  // Get broker manager
  const brokerManager = getBrokerManager();

  // Get provider from request model (can be provider address or model name)
  const provider = await brokerManager.getProvider(openAIRequest.model);

  Logger.info(
    `Using provider: ${provider.address} at ${provider.endpoint} model ${provider.model}`
  );

  // Update request model to the provider model
  const model = provider.model;
  openAIRequest.model = model;

  // Translate request to 0G format
  const zgRequest = Translator.openAIToZG(openAIRequest);

  // Get request headers from broker
  const requestContent = JSON.stringify(zgRequest.messages);
  const headers = await brokerManager.getRequestHeaders(
    provider.address,
    requestContent
  );

  Logger.debug("Request headers obtained for streaming", headers);

  // Make streaming request to 0G provider
  const zgEndpoint = `${provider.endpoint}/chat/completions`;
  Logger.info(`Sending streaming request to: ${zgEndpoint}`);

  const response = await fetch(zgEndpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
    body: JSON.stringify(zgRequest),
  });

  if (!response.ok) {
    const errorText = await response.text();
    Logger.error(`0G provider error: ${response.status} - ${errorText}`);

    // Handle specific error codes
    if (response.status === 402) {
      res.status(402).json({
        error: {
          message: "Insufficient balance in 0G account",
          type: "insufficient_balance",
          code: "insufficient_balance",
        },
      });
      return;
    }

    res.status(response.status).json({
      error: {
        message: `Provider error: ${errorText}`,
        type: "provider_error",
        code: "provider_error",
      },
    });
    return;
  }

  // Set SSE headers
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no"); // Disable nginx buffering

  // Generate unique ID and timestamp for this completion
  const completionId = `chatcmpl-${crypto.randomBytes(16).toString("hex")}`;
  const created = Math.floor(Date.now() / 1000);

  // Check if provider returned streaming response or JSON
  const contentType = response.headers.get("content-type") || "";
  const isStreamingResponse = contentType.includes("text/event-stream") ||
                              contentType.includes("stream");

  // If provider doesn't support streaming, convert JSON response to stream
  if (!isStreamingResponse) {
    Logger.info("Provider returned non-streaming response, converting to stream");

    try {
      const zgResponse: any = await response.json();

      // Send initial chunk with role
      res.write(Translator.formatSSE({
        id: completionId,
        object: "chat.completion.chunk",
        created: created,
        model: model,
        choices: [{
          index: 0,
          delta: { role: "assistant" },
          finish_reason: null,
        }],
      }));

      // Extract content from response
      let content = "";
      let toolCalls: any[] | undefined = undefined;
      let finishReason = "stop";

      if (zgResponse.choices && zgResponse.choices.length > 0) {
        const choice = zgResponse.choices[0];
        content = choice.message?.content || "";
        toolCalls = choice.message?.tool_calls;
        finishReason = choice.finish_reason || "stop";
      }

      // Stream content word by word for better UX
      if (content) {
        const words = content.split(/(\s+)/);
        for (const word of words) {
          if (word) {
            res.write(Translator.formatSSE({
              id: completionId,
              object: "chat.completion.chunk",
              created: created,
              model: model,
              choices: [{
                index: 0,
                delta: { content: word },
                finish_reason: null,
              }],
            }));
          }
        }
      }

      // Stream tool calls if present
      if (toolCalls && toolCalls.length > 0) {
        for (let i = 0; i < toolCalls.length; i++) {
          const toolCall = toolCalls[i];

          // Send tool call initialization
          res.write(Translator.formatSSE({
            id: completionId,
            object: "chat.completion.chunk",
            created: created,
            model: model,
            choices: [{
              index: 0,
              delta: {
                tool_calls: [{
                  index: i,
                  id: toolCall.id,
                  type: toolCall.type,
                  function: {
                    name: toolCall.function.name,
                    arguments: "",
                  },
                }],
              },
              finish_reason: null,
            }],
          }));

          // Stream arguments
          const args = toolCall.function.arguments;
          if (args) {
            res.write(Translator.formatSSE({
              id: completionId,
              object: "chat.completion.chunk",
              created: created,
              model: model,
              choices: [{
                index: 0,
                delta: {
                  tool_calls: [{
                    index: i,
                    function: {
                      arguments: args,
                    },
                  }],
                },
                finish_reason: null,
              }],
            }));
          }
        }

        finishReason = "tool_calls";
      }

      // Send final chunk with finish_reason
      res.write(Translator.formatSSE({
        id: completionId,
        object: "chat.completion.chunk",
        created: created,
        model: model,
        choices: [{
          index: 0,
          delta: {},
          finish_reason: finishReason,
        }],
      }));

      res.write(Translator.formatSSEDone());
      res.end();

      Logger.info("Converted non-streaming response to stream successfully");
      return;
    } catch (error: any) {
      Logger.error("Error converting non-streaming response:", error);
      res.write(Translator.formatSSE({
        id: completionId,
        object: "chat.completion.chunk",
        created: created,
        model: model,
        choices: [{
          index: 0,
          delta: {},
          finish_reason: "error",
        }],
      }));
      res.write(Translator.formatSSEDone());
      res.end();
      return;
    }
  }

  // Process the streaming response from provider
  const reader = response.body;
  if (!reader) {
    Logger.error("Response body is null");
    res.write(Translator.formatSSE({
      id: completionId,
      object: "chat.completion.chunk",
      created: created,
      model: model,
      choices: [{
        index: 0,
        delta: {},
        finish_reason: "error",
      }],
    }));
    res.write(Translator.formatSSEDone());
    res.end();
    return;
  }

  try {
    let buffer = "";
    const decoder = new TextDecoder();

    // Read the stream
    for await (const chunk of reader as any) {
      const text = decoder.decode(chunk, { stream: true });
      buffer += text;

      // Process complete lines
      const lines = buffer.split("\n");
      buffer = lines.pop() || ""; // Keep the last incomplete line in the buffer

      for (const line of lines) {
        const trimmedLine = line.trim();
        if (!trimmedLine || trimmedLine.startsWith(":")) {
          continue; // Skip empty lines and comments
        }

        // Parse SSE line
        const data = Translator.parseSSELine(trimmedLine);
        if (!data) {
          continue;
        }

        // Check for done marker
        if (data.done) {
          res.write(Translator.formatSSEDone());
          break;
        }

        // Convert 0G chunk to OpenAI format
        const openAIChunk = Translator.zgStreamChunkToOpenAI(
          data,
          model,
          completionId,
          created
        );

        // Send chunk to client
        res.write(Translator.formatSSE(openAIChunk));
      }
    }

    // Send final [DONE] message if not already sent
    res.write(Translator.formatSSEDone());
    res.end();

    Logger.info("Streaming chat completion successful");
  } catch (error: any) {
    Logger.error("Error processing streaming response:", error);

    // Try to send error to client if headers not sent
    if (!res.headersSent) {
      res.status(500).json({
        error: {
          message: error.message || "Error processing stream",
          type: "internal_error",
          code: "streaming_error",
        },
      });
    } else {
      // If already streaming, just end the response
      res.end();
    }
  }
}

export default router;
