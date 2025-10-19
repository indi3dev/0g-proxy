import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import { initializeBrokerManager } from './broker';
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
          chat: 'POST /v1/chat/completions',
        },
      });
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
