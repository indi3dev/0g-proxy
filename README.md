# 0G Proxy

OpenAI-compatible proxy server for [0G Compute Network](https://0g.ai), enabling seamless integration of decentralized AI inference into existing OpenAI-based applications.

## Background

I wanted to use the 0G Compute model in Cursor for vibe coding and within my n8n workflow, but ran into a limitation — 0G requires dynamic custom headers, while these third-party tools only support a fixed `Authorization` header.

To solve this, I built an OpenAI-compatible proxy server for the 0G Compute Network that adheres to the standard OpenAI API specifications, enabling seamless integration of decentralized AI inference into any OpenAI-based application.

## Overview

0G Proxy translates OpenAI API requests to 0G Compute Network format, allowing you to use 0G's decentralized AI infrastructure with minimal code changes. The proxy handles authentication, provider discovery, request translation, and fee settlement automatically.

## Features

- ✅ **OpenAI API Compatible** - Drop-in replacement for OpenAI chat completions endpoint
- ✅ **Simple Authentication** - Bearer token authentication
- ✅ **Automatic Provider Discovery** - Finds best available 0G providers
- ✅ **Request Translation** - Seamlessly converts between OpenAI and 0G formats
- ✅ **Automatic Fee Settlement** - Handles micropayments to providers
- ✅ **TypeScript** - Fully typed for better developer experience
- ✅ **Error Handling** - Comprehensive error handling and logging

## Prerequisites

- Node.js 18+
- An Ethereum wallet with private key
- 0G testnet/mainnet tokens for funding inference requests

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd 0g-proxy
```

2. Install dependencies:
```bash
npm install
```

3. Copy `.env.example` to `.env` and configure:
```bash
cp .env.example .env
```

4. Edit `.env` with your configuration:
```env
PORT=3000
AUTH_TOKEN=your-secret-token-here
PRIVATE_KEY=0xYourPrivateKeyHere
ZG_CHAIN_RPC=https://evmrpc-testnet.0g.ai
```

## Configuration

### Environment Variables

| Variable | Required | Description | Default |
|----------|----------|-------------|---------|
| `PORT` | No | Server port | `3000` |
| `AUTH_TOKEN` | Yes | Bearer token for authentication | - |
| `PRIVATE_KEY` | Yes | Ethereum private key (with 0x prefix) | - |
| `ZG_CHAIN_RPC` | Yes | 0G blockchain RPC endpoint | - |
| `DEBUG` | No | Enable debug logging | `false` |

### Model Selection

The `model` field in requests accepts two types of values:

**1. Model Names** (auto-discovery):
- `gpt-oss-120b` - 70B parameter model (TEE verified)
- `deepseek-r1-70b` - Complex reasoning model (TEE verified)

**2. Provider Addresses** (direct selection):
- `0x...` - Specific provider address for manual selection

When using a model name, the proxy automatically discovers and selects an available provider for that model. When using a provider address, the proxy connects directly to that specific provider.

## Usage

### Development Mode

```bash
npm run dev
```

### Production Mode

1. Build the project:
```bash
npm run build
```

2. Start the server:
```bash
npm start
```

## API Endpoints

### Health Check

```bash
GET /health
```

Returns server status. No authentication required.

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2025-10-06T00:00:00.000Z",
  "service": "0g-proxy"
}
```

### Chat Completions

```bash
POST /v1/chat/completions
Authorization: Bearer YOUR_AUTH_TOKEN
Content-Type: application/json
```

OpenAI-compatible chat completions endpoint.

**Request:**
```json
{
  "model": "gpt-oss-120b",
  "messages": [
    {
      "role": "user",
      "content": "What is 0G?"
    }
  ],
  "temperature": 0.7,
  "max_tokens": 150
}
```

**Response:**
```json
{
  "id": "chatcmpl-abc123",
  "object": "chat.completion",
  "created": 1234567890,
  "model": "gpt-oss-120b",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "0G is a decentralized AI compute network..."
      },
      "finish_reason": "stop"
    }
  ],
  "usage": {
    "prompt_tokens": 10,
    "completion_tokens": 25,
    "total_tokens": 35
  }
}
```

## Using with OpenAI SDKs

### Python (OpenAI SDK)

```python
from openai import OpenAI

client = OpenAI(
    base_url="http://localhost:3000/v1",
    api_key="your-auth-token-here"
)

response = client.chat.completions.create(
    model="gpt-oss-120b",
    messages=[
        {"role": "user", "content": "Hello, how are you?"}
    ]
)

print(response.choices[0].message.content)
```

### Node.js (OpenAI SDK)

```javascript
import OpenAI from 'openai';

const openai = new OpenAI({
  baseURL: 'http://localhost:3000/v1',
  apiKey: 'your-auth-token-here',
});

const response = await openai.chat.completions.create({
  model: 'gpt-oss-120b',
  messages: [
    { role: 'user', content: 'Hello, how are you?' }
  ],
});

console.log(response.choices[0].message.content);
```

### Using a Specific Provider Address

You can also specify a provider address directly in the `model` field:

```javascript
const response = await openai.chat.completions.create({
  model: '0x1234567890abcdef1234567890abcdef12345678', // Provider address
  messages: [
    { role: 'user', content: 'Hello!' }
  ],
});
```

### cURL

```bash
curl http://localhost:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-auth-token-here" \
  -d '{
    "model": "gpt-oss-120b",
    "messages": [
      {
        "role": "user",
        "content": "What is 0G?"
      }
    ]
  }'
```

## Error Handling

The proxy returns standard HTTP status codes and OpenAI-compatible error responses:

| Status Code | Description |
|-------------|-------------|
| `200` | Success |
| `400` | Bad request (invalid parameters) |
| `401` | Unauthorized (invalid auth token) |
| `402` | Payment required (insufficient balance) |
| `404` | Not found (invalid endpoint) |
| `500` | Internal server error |
| `503` | Service unavailable (no providers available) |

**Error Response Format:**
```json
{
  "error": {
    "message": "Error description",
    "type": "error_type",
    "code": "error_code"
  }
}
```

## Architecture

```
┌─────────────┐
│   Client    │
│ (OpenAI SDK)│
└──────┬──────┘
       │ OpenAI API format
       ▼
┌─────────────────┐
│   0G Proxy      │
│  - Auth Check   │
│  - Translation  │
│  - Fee Handling │
└──────┬──────────┘
       │ 0G format
       ▼
┌─────────────────┐
│  0G Provider    │
│  (Decentralized)│
└─────────────────┘
```

## Project Structure

```
0g-proxy/
├── src/
│   ├── index.ts              # Main server entry point
│   ├── broker.ts             # 0G broker management
│   ├── middleware/
│   │   └── auth.ts           # Authentication middleware
│   ├── routes/
│   │   └── chat.ts           # Chat completions endpoint
│   └── utils/
│       ├── translator.ts     # Request/response translation
│       └── logger.ts         # Logging utilities
├── .env.example              # Example environment variables
├── .gitignore
├── package.json
├── tsconfig.json
├── README.md
└── CLAUDE.md                 # Development plan
```

## Troubleshooting

### "Broker not initialized" error

Make sure all required environment variables are set correctly in `.env`, especially `PRIVATE_KEY` and `ZG_CHAIN_RPC`.

### "Insufficient balance" error

Your 0G ledger needs to be funded with tokens. Make sure your wallet has sufficient balance in the 0G network and that you have created a ledger with funds.

### "No provider found for model" error

The requested model may not be available on the 0G network, or there may be no providers online. Try:
- Using a different model (e.g., `gpt-oss-120b` or `deepseek-r1-70b`)
- Checking 0G network status
- Using a specific provider address directly in the `model` field (e.g., `"model": "0x..."`)

### Rate limiting or performance issues

Consider implementing caching or rate limiting in production deployments. The current implementation makes a new request to 0G for each API call.

## Security Considerations

- ⚠️ **Never commit `.env` file** - It contains sensitive credentials
- ⚠️ **Use strong AUTH_TOKEN** - Generate cryptographically secure tokens for production
- ⚠️ **Protect PRIVATE_KEY** - Store securely and never expose publicly
- ⚠️ **Use HTTPS in production** - Deploy behind a reverse proxy with SSL/TLS
- ⚠️ **Implement rate limiting** - Add rate limiting for production use
- ⚠️ **Monitor spending** - Track 0G token usage and set up alerts

## Development

### Building

```bash
npm run build
```

### Running Tests

```bash
npm test
```

### Linting

```bash
npm run lint
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

ISC

## Resources

- [0G Documentation](https://docs.0g.ai)
- [0G Compute Network SDK](https://docs.0g.ai/developer-hub/building-on-0g/compute-network/sdk)
- [OpenAI API Reference](https://platform.openai.com/docs/api-reference)

## Support

For issues and questions:
- 0G Network: [0G Discord](https://discord.gg/0glabs)
- This Proxy: Open an issue on GitHub

---

Built with ❤️ for the 0G ecosystem
