import { Router, Request, Response } from "express";
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

export default router;
