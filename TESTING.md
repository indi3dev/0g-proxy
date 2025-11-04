# Testing Guide for 0G Proxy

This guide provides examples and scripts for testing the 0G Proxy streaming functionality.

## Quick Tests

### 1. Health Check

```bash
curl http://localhost:3000/health
```

Expected response:
```json
{
  "status": "ok",
  "timestamp": "2025-01-04T...",
  "service": "0g-proxy"
}
```

### 2. List Available Models

```bash
curl -H "Authorization: Bearer YOUR_AUTH_TOKEN" \
  http://localhost:3000/v1/models
```

Expected response:
```json
{
  "object": "list",
  "data": [
    {
      "id": "gpt-oss-120b",
      "object": "model",
      "created": 1234567890,
      "owned_by": "0g-compute",
      "provider": "0x..."
    }
  ]
}
```

### 3. Non-Streaming Chat Completion

```bash
curl -X POST http://localhost:3000/v1/chat/completions \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-oss-120b",
    "messages": [
      {"role": "user", "content": "Hello! How are you?"}
    ],
    "stream": false
  }'
```

Expected response:
```json
{
  "id": "chatcmpl-...",
  "object": "chat.completion",
  "created": 1234567890,
  "model": "gpt-oss-120b",
  "choices": [{
    "index": 0,
    "message": {
      "role": "assistant",
      "content": "Hello! I'm doing well..."
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

### 4. Streaming Chat Completion

```bash
curl -X POST http://localhost:3000/v1/chat/completions \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -N \
  -d '{
    "model": "gpt-oss-120b",
    "messages": [
      {"role": "user", "content": "Tell me a short story"}
    ],
    "stream": true
  }'
```

Expected output (streaming):
```
data: {"id":"chatcmpl-...","object":"chat.completion.chunk","created":1234567890,"model":"gpt-oss-120b","choices":[{"index":0,"delta":{"role":"assistant"},"finish_reason":null}]}

data: {"id":"chatcmpl-...","object":"chat.completion.chunk","created":1234567890,"model":"gpt-oss-120b","choices":[{"index":0,"delta":{"content":"Once"},"finish_reason":null}]}

data: {"id":"chatcmpl-...","object":"chat.completion.chunk","created":1234567890,"model":"gpt-oss-120b","choices":[{"index":0,"delta":{"content":" upon"},"finish_reason":null}]}

...

data: [DONE]
```

## Testing with Python

### Install OpenAI SDK

```bash
pip install openai
```

### Non-Streaming Test

```python
from openai import OpenAI

client = OpenAI(
    api_key="YOUR_AUTH_TOKEN",
    base_url="http://localhost:3000/v1"
)

response = client.chat.completions.create(
    model="gpt-oss-120b",
    messages=[
        {"role": "user", "content": "Hello!"}
    ]
)

print(response.choices[0].message.content)
```

### Streaming Test

```python
from openai import OpenAI

client = OpenAI(
    api_key="YOUR_AUTH_TOKEN",
    base_url="http://localhost:3000/v1"
)

stream = client.chat.completions.create(
    model="gpt-oss-120b",
    messages=[
        {"role": "user", "content": "Tell me a story"}
    ],
    stream=True
)

for chunk in stream:
    if chunk.choices[0].delta.content:
        print(chunk.choices[0].delta.content, end="", flush=True)

print()  # New line at the end
```

## Testing with Node.js

### Install OpenAI SDK

```bash
npm install openai
```

### Streaming Test

```javascript
import OpenAI from 'openai';

const client = new OpenAI({
  apiKey: 'YOUR_AUTH_TOKEN',
  baseURL: 'http://localhost:3000/v1'
});

async function testStreaming() {
  const stream = await client.chat.completions.create({
    model: 'gpt-oss-120b',
    messages: [
      { role: 'user', content: 'Tell me a story' }
    ],
    stream: true
  });

  for await (const chunk of stream) {
    process.stdout.write(chunk.choices[0]?.delta?.content || '');
  }

  console.log('\n');
}

testStreaming();
```

## Testing with Open WebUI

1. **Start the proxy**:
   ```bash
   npm run dev
   ```

2. **Start Open WebUI** (if not running):
   ```bash
   docker run -d -p 3001:8080 --name open-webui \
     -v open-webui:/app/backend/data \
     ghcr.io/open-webui/open-webui:main
   ```

3. **Configure in Open WebUI**:
   - Open http://localhost:3001
   - Go to Settings → Connections → OpenAI
   - Set Base URL: `http://localhost:3000/v1`
   - Set API Key: Your `AUTH_TOKEN`
   - Save and verify connection

4. **Test streaming**:
   - Select a model from the dropdown
   - Start a conversation
   - You should see responses streaming in real-time

## Troubleshooting

### Issue: "Connection refused"
- Ensure the proxy is running (`npm run dev`)
- Check that port 3000 is not in use

### Issue: "401 Unauthorized"
- Verify your `AUTH_TOKEN` in `.env` matches what you're using in requests
- Check that the `Authorization: Bearer` header is included

### Issue: "No providers available"
- Ensure your 0G network connection is configured correctly
- Check `ZG_CHAIN_RPC` in `.env`
- Verify your account has sufficient balance

### Issue: "Streaming not working"
- The proxy has automatic fallback for non-streaming providers
- Check browser console for CORS errors
- Ensure `-N` flag is used with curl for streaming

### Issue: "Tool calling not supported"
- Open WebUI may not expose function calling UI
- You can still test function calling via API using curl or Python
- Tool calling is fully supported by the proxy

## Advanced Testing

### Testing Function Calling

```bash
curl -X POST http://localhost:3000/v1/chat/completions \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-oss-120b",
    "messages": [
      {"role": "user", "content": "What is the weather in Paris?"}
    ],
    "tools": [
      {
        "type": "function",
        "function": {
          "name": "get_weather",
          "description": "Get current weather in a location",
          "parameters": {
            "type": "object",
            "properties": {
              "location": {
                "type": "string",
                "description": "City and state, e.g. San Francisco, CA"
              }
            },
            "required": ["location"]
          }
        }
      }
    ],
    "tool_choice": "auto"
  }'
```

### Performance Testing

```bash
# Install Apache Bench
# macOS: brew install apache-bench
# Ubuntu: apt-get install apache2-utils

# Create test payload
cat > payload.json << 'EOF'
{
  "model": "gpt-oss-120b",
  "messages": [{"role": "user", "content": "Hi"}],
  "stream": false
}
EOF

# Run 100 requests with concurrency of 10
ab -n 100 -c 10 -p payload.json -T application/json \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN" \
  http://localhost:3000/v1/chat/completions
```

## Monitoring Logs

The proxy logs all requests and responses. Watch logs in real-time:

```bash
npm run dev | grep -E "(Streaming|Chat completion|provider)"
```

Common log messages:
- `Chat completion request for model: ...` - New request received
- `Using provider: 0x... at https://...` - Provider selected
- `Streaming chat completion request` - Streaming request detected
- `Provider returned non-streaming response, converting to stream` - Fallback activated
- `Chat completion successful` - Request completed

## Next Steps

After successful testing:
1. Build for production: `npm run build`
2. Start production server: `npm start`
3. Set up reverse proxy (nginx/caddy) with HTTPS
4. Configure firewall rules
5. Set up monitoring and logging
6. Configure rate limiting
