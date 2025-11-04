# 0G Proxy Development Plan

## Overview
Develop a proxy service that translates OpenAI API requests to 0G Compute Network inference requests, providing OpenAI-compatible endpoints while leveraging 0G's decentralized AI infrastructure.

## Architecture

### Components
1. **Express Server** - HTTP server handling OpenAI-compatible endpoints
2. **0G Broker Integration** - Connection to 0G Compute Network
3. **Request Translator** - Convert OpenAI format to 0G format
4. **Response Translator** - Convert 0G responses to OpenAI format
5. **Authentication Middleware** - Simple token-based auth using Bearer tokens

### OpenAI API Compatibility
- **Primary Endpoint**: `POST /v1/chat/completions`
- **Request Format**: OpenAI chat completions format
- **Response Format**: OpenAI chat completions response
- **Auth**: Bearer token in Authorization header
- **Function Calling**: Full support for OpenAI tools/function calling API

## Technical Stack
- **Runtime**: Node.js with TypeScript
- **Framework**: Express.js
- **0G SDK**: `@0glabs/0g-serving-broker`
- **Dependencies**:
  - `crypto-js` (required by 0G SDK)
  - `dotenv` (environment configuration)
  - `express`

## Environment Configuration (.env)

```env
# Server Configuration
PORT=3000
AUTH_TOKEN=your-secret-token-here

# 0G Network Configuration
PRIVATE_KEY=your-ethereum-private-key
BROKER_ADDRESS=0x... # 0G Broker contract address
ZG_CHAIN_RPC=https://evmrpc-testnet.0g.ai # 0G blockchain RPC endpoint

# Provider Configuration
# Providers are automatically selected based on the model specified in the request
# The model field can be either a model name (for auto-discovery) or a provider address (0x...)

# Funding Configuration
INITIAL_FUND_AMOUNT=0.01 # Amount to fund account (in native tokens)
```

## API Flow

### 1. Client Request
```
POST /v1/chat/completions
Authorization: Bearer <AUTH_TOKEN>
Content-Type: application/json

{
  "model": "gpt-oss-120b",
  "messages": [
    {"role": "user", "content": "Hello"}
  ],
  "temperature": 0.7,
  "max_tokens": 150,
  "stream": false
}
```

For streaming responses, set `stream: true`.

### 2. Proxy Processing
1. Validate auth token
2. Initialize 0G broker (if not already initialized)
3. Check/fund account balance
4. Discover provider based on model from request (supports both model names and provider addresses)
5. Acknowledge provider
6. Generate 0G request headers
7. Forward request to 0G provider endpoint
8. Translate 0G response to OpenAI format
9. Return to client

### 3. Response Format
```json
{
  "id": "chatcmpl-<unique-id>",
  "object": "chat.completion",
  "created": 1234567890,
  "model": "gpt-oss-120b",
  "choices": [{
    "index": 0,
    "message": {
      "role": "assistant",
      "content": "Response from 0G"
    },
    "finish_reason": "stop"
  }],
  "usage": {
    "prompt_tokens": 10,
    "completion_tokens": 20,
    "total_tokens": 30
  }
}
```

## Function Calling / Tools Support

The proxy fully supports OpenAI's function calling API (tools). You can define functions that the model can call during the conversation.

### Request with Tools
```json
{
  "model": "gpt-oss-120b",
  "messages": [
    {"role": "user", "content": "What's the weather in San Francisco?"}
  ],
  "tools": [
    {
      "type": "function",
      "function": {
        "name": "get_weather",
        "description": "Get the current weather in a given location",
        "parameters": {
          "type": "object",
          "properties": {
            "location": {
              "type": "string",
              "description": "The city and state, e.g. San Francisco, CA"
            },
            "unit": {
              "type": "string",
              "enum": ["celsius", "fahrenheit"]
            }
          },
          "required": ["location"]
        }
      }
    }
  ],
  "tool_choice": "auto"
}
```

### Response with Tool Call
```json
{
  "id": "chatcmpl-abc123",
  "object": "chat.completion",
  "created": 1234567890,
  "model": "gpt-oss-120b",
  "choices": [{
    "index": 0,
    "message": {
      "role": "assistant",
      "content": null,
      "tool_calls": [{
        "id": "call_abc123",
        "type": "function",
        "function": {
          "name": "get_weather",
          "arguments": "{\"location\":\"San Francisco, CA\",\"unit\":\"fahrenheit\"}"
        }
      }]
    },
    "finish_reason": "tool_calls"
  }],
  "usage": {
    "prompt_tokens": 82,
    "completion_tokens": 18,
    "total_tokens": 100
  }
}
```

### Completing the Function Call
After receiving a tool call, provide the result back to continue the conversation:

```json
{
  "model": "gpt-oss-120b",
  "messages": [
    {"role": "user", "content": "What's the weather in San Francisco?"},
    {
      "role": "assistant",
      "content": null,
      "tool_calls": [{
        "id": "call_abc123",
        "type": "function",
        "function": {
          "name": "get_weather",
          "arguments": "{\"location\":\"San Francisco, CA\",\"unit\":\"fahrenheit\"}"
        }
      }]
    },
    {
      "role": "tool",
      "tool_call_id": "call_abc123",
      "name": "get_weather",
      "content": "{\"temperature\": 72, \"unit\": \"fahrenheit\", \"description\": \"Sunny\"}"
    }
  ]
}
```

### Supported Tool Features
- ✅ Multiple tool definitions
- ✅ Tool choice: `"auto"`, `"none"`, or specific function
- ✅ Tool call responses in messages
- ✅ Multiple tool calls in a single response
- ✅ Full OpenAI tools API compatibility

## File Structure

```
0g-proxy/
├── src/
│   ├── index.ts              # Main server entry point
│   ├── broker.ts             # 0G broker initialization & management
│   ├── middleware/
│   │   └── auth.ts           # Authentication middleware
│   ├── routes/
│   │   └── chat.ts           # Chat completions endpoint
│   └── utils/
│       ├── translator.ts     # Request/response translation
│       └── logger.ts         # Logging utilities
├── .env.example              # Example environment variables
├── .env                      # Actual environment (gitignored)
├── .gitignore
├── package.json
├── tsconfig.json
├── README.md
└── CLAUDE.md                 # This file
```

## Implementation Steps

### Phase 1: Project Setup
- [x] Research 0G SDK documentation
- [x] Create planning document
- [ ] Initialize Node.js/TypeScript project
- [ ] Install dependencies
- [ ] Configure TypeScript
- [ ] Create .env.example

### Phase 2: Core Infrastructure
- [ ] Implement 0G broker initialization
- [ ] Create broker singleton/manager
- [ ] Implement account funding logic
- [ ] Add provider discovery/selection

### Phase 3: API Implementation
- [ ] Create Express server
- [ ] Implement auth middleware
- [ ] Create /v1/chat/completions endpoint
- [ ] Implement request translation (OpenAI → 0G)
- [ ] Implement response translation (0G → OpenAI)

### Phase 4: Error Handling & Features
- [x] Add comprehensive error handling
- [x] Implement balance checking
- [x] Add health check endpoint
- [x] Implement logging
- [x] Handle streaming responses (SSE)

### Phase 5: Documentation
- [ ] Create comprehensive README.md
- [ ] Document API endpoints
- [ ] Add usage examples
- [ ] Document configuration options

## Model Mapping
0G models → OpenAI compatible names:
- `gpt-oss-120b` → exposed as `gpt-oss-120b` or `gpt-4` (alias)
- `deepseek-r1-70b` → exposed as `deepseek-r1-70b`

## Considerations

### Security
- Auth token should be strong and kept secret
- Private key must be secured (never commit to git)
- Consider rate limiting for production use

### Balance Management
- Auto-check balance before requests
- Auto-fund if balance below threshold
- Log funding transactions

### Provider Selection
- Provider selection is determined by the `model` field in the request body
- Supports both model names (e.g., "gpt-oss-120b") for auto-discovery
- Supports direct provider addresses (e.g., "0x...") for manual selection
- Providers are cached for performance after first discovery/acknowledgment

### Error Scenarios
- Insufficient balance → Return 402 Payment Required
- Invalid auth → Return 401 Unauthorized
- Provider unavailable → Return 503 Service Unavailable
- 0G API errors → Map to appropriate HTTP status codes

## Testing Strategy
1. Test auth middleware
2. Test broker initialization
3. Test simple chat completion
4. Test error scenarios
5. Test with different models
6. Test function calling / tools
7. Test multi-turn conversations with tool calls
8. Integration test with real 0G network

## Streaming Support

The proxy fully supports Server-Sent Events (SSE) streaming for real-time response generation.

### Enabling Streaming

To enable streaming, set `stream: true` in your request:

```json
{
  "model": "gpt-oss-120b",
  "messages": [
    {"role": "user", "content": "Write a story about a robot"}
  ],
  "stream": true
}
```

### Streaming Response Format

The response will be sent as Server-Sent Events (SSE) with the following format:

```
data: {"id":"chatcmpl-abc123","object":"chat.completion.chunk","created":1234567890,"model":"gpt-oss-120b","choices":[{"index":0,"delta":{"role":"assistant"},"finish_reason":null}]}

data: {"id":"chatcmpl-abc123","object":"chat.completion.chunk","created":1234567890,"model":"gpt-oss-120b","choices":[{"index":0,"delta":{"content":"Once"},"finish_reason":null}]}

data: {"id":"chatcmpl-abc123","object":"chat.completion.chunk","created":1234567890,"model":"gpt-oss-120b","choices":[{"index":0,"delta":{"content":" upon"},"finish_reason":null}]}

...

data: {"id":"chatcmpl-abc123","object":"chat.completion.chunk","created":1234567890,"model":"gpt-oss-120b","choices":[{"index":0,"delta":{},"finish_reason":"stop"}]}

data: [DONE]
```

### Streaming with Tools

Streaming also works with function calling. Tool calls will be streamed incrementally:

```json
{
  "model": "gpt-oss-120b",
  "messages": [
    {"role": "user", "content": "What's the weather in Paris?"}
  ],
  "tools": [...],
  "stream": true
}
```

Response chunks will include `delta.tool_calls` when the model is making function calls:

```
data: {"id":"chatcmpl-xyz","object":"chat.completion.chunk","created":1234567890,"model":"gpt-oss-120b","choices":[{"index":0,"delta":{"tool_calls":[{"index":0,"id":"call_abc","type":"function","function":{"name":"get_weather","arguments":""}}]},"finish_reason":null}]}

data: {"id":"chatcmpl-xyz","object":"chat.completion.chunk","created":1234567890,"model":"gpt-oss-120b","choices":[{"index":0,"delta":{"tool_calls":[{"index":0,"function":{"arguments":"{\\"location"}}]},"finish_reason":null}]}
```

## Future Enhancements
- Multiple auth tokens (multi-tenant)
- Usage tracking and analytics
- Rate limiting per token
- Support for embeddings endpoint
- Caching layer for repeated queries
- Load balancing across providers
- WebSocket support
