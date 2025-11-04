import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import { initializeBrokerManager, getBrokerManager } from './broker';
import { createAuthMiddleware } from './middleware/auth';
import chatRouter from './routes/chat';
import { Logger } from './utils/logger';

// Load environment variables
dotenv.config();

// Validate required environment variables
const requiredEnvVars = [
  'AUTH_TOKEN',
  'PRIVATE_KEY',
  'ZG_CHAIN_RPC',
];

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    Logger.error(`Missing required environment variable: ${envVar}`);
    process.exit(1);
  }
}

const PORT = process.env.PORT || 3000;
const AUTH_TOKEN = process.env.AUTH_TOKEN!;
const PRIVATE_KEY = process.env.PRIVATE_KEY!;
const ZG_CHAIN_RPC = process.env.ZG_CHAIN_RPC!;

async function startServer() {
  try {
    Logger.info('Starting 0G Proxy Server...');

    // Initialize broker manager
    const brokerManager = initializeBrokerManager({
      privateKey: PRIVATE_KEY,
      zgChainRpc: ZG_CHAIN_RPC,
    });

    // Initialize the broker (connect to 0G network)
    await brokerManager.initialize();

    // Create Express app
    const app = express();

    // CORS middleware for web clients
    app.use((req, res, next) => {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      res.setHeader('Access-Control-Max-Age', '86400');

      // Handle preflight requests
      if (req.method === 'OPTIONS') {
        res.status(204).end();
        return;
      }

      next();
    });

    // Middleware
    app.use(express.json());

    // Health check endpoint (no auth required)
    app.get('/health', (req: Request, res: Response) => {
      res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        service: '0g-proxy',
      });
    });

    // Root endpoint
    app.get('/', (req: Request, res: Response) => {
      res.json({
        service: '0g-proxy',
        version: '1.0.0',
        description: 'OpenAI-compatible proxy for 0G Compute Network',
        endpoints: {
          health: 'GET /health',
          models: 'GET /v1/models',
          chat: 'POST /v1/chat/completions',
        },
      });
    });

    // Models endpoint (OpenAI-compatible, with auth)
    app.get('/v1/models', createAuthMiddleware(AUTH_TOKEN), async (req: Request, res: Response) => {
      try {
        const brokerManager = getBrokerManager();
        const services = await brokerManager.getBroker().inference.listService();

        const models = services.map((service: any, index: number) => ({
          id: service.model || `model-${index}`,
          object: 'model',
          created: Math.floor(Date.now() / 1000),
          owned_by: '0g-compute',
          permission: [],
          root: service.model || `model-${index}`,
          parent: null,
          // Additional 0G-specific metadata
          provider: service.provider,
        }));

        res.json({
          object: 'list',
          data: models,
        });
      } catch (error: any) {
        Logger.error('Error listing models:', error);
        res.status(500).json({
          error: {
            message: error.message || 'Failed to list models',
            type: 'internal_error',
            code: 'model_list_error',
          },
        });
      }
    });

    // API routes (with auth)
    app.use('/v1', createAuthMiddleware(AUTH_TOKEN), chatRouter);

    // 404 handler
    app.use((req: Request, res: Response) => {
      res.status(404).json({
        error: {
          message: `Route ${req.method} ${req.path} not found`,
          type: 'invalid_request_error',
          code: 'route_not_found',
        },
      });
    });

    // Start server
    app.listen(PORT, () => {
      Logger.info(`🚀 Server started on port ${PORT}`);
      Logger.info(`📡 Health check: http://localhost:${PORT}/health`);
      Logger.info(`🤖 Chat completions: http://localhost:${PORT}/v1/chat/completions`);
    });

  } catch (error: any) {
    Logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  Logger.info('Received SIGINT, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  Logger.info('Received SIGTERM, shutting down gracefully...');
  process.exit(0);
});

// Start the server
startServer();
