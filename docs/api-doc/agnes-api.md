# Agnes API

[Agnes AI](https://agnes-ai.com) API 中转站，提供兼容 OpenAI 规范的接口访问，支持边缘节点加速转发和流式响应。

## 节点地址

<!-- tabs:start -->
#### **Cloudflare-Vercel 节点**

```
https://api.blockhaity.dpdns.org/agnes-api
```

#### **Cloudflare 节点**

```
https://api-cloudflare.blockhaity.dpdns.org/agnes-api
```

#### **Vercel 节点**

```
https://api-vercel.blockhaity.dpdns.org/agnes-api
```

#### **Netlify 节点**

```
https://blockhaity-api.netlify.app/agnes-api
```

<!-- tabs:end -->

## 基础路径

所有请求通过 `/agnes-api` 路径转发到 Agnes AI API（`https://apihub.agnes-ai.com/v1`）。

| 边缘节点路径 | → Agnes AI API |
|---|---|
| `/agnes-api/chat/completions` | `/v1/chat/completions` |
| `/agnes-api/v1/chat/completions` | `/v1/chat/completions` |
| `/agnes-api/models` | `/v1/models` |
| `/agnes-api/images/generations` | `/v1/images/generations` |
| `/agnes-api/embeddings` | `/v1/embeddings` |
| `/agnes-api/audio/speech` | `/v1/audio/speech` |

## 认证

请求头需携带 Agnes AI API Key：

```
Authorization: Bearer YOUR_API_KEY
Content-Type: application/json
```

## API 接口

### 聊天补全 (Chat Completions)

`POST /agnes-api/chat/completions`

请求体与 [Agnes 2.5 Flash](https://agnes-ai.com/zh-Hans/docs/agnes-25-flash) 模型规范一致。

**请求参数**

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `model` | string | 是 | 模型名称，如 `agnes-2.5-flash` |
| `messages` | array | 是 | 对话消息数组 |
| `stream` | boolean | 否 | 是否启用流式输出 |
| `temperature` | number | 否 | 控制输出随机性 |
| `max_tokens` | number | 否 | 最大生成 token 数 |
| `tools` | array | 否 | 工具调用定义 |
| `tool_choice` | string / object | 否 | 工具调用控制 |
| `chat_template_kwargs` | object | 否 | 启用 Thinking 等扩展能力 |
| `thinking` | object | 否 | Anthropic 兼容 Thinking 模式 |

**请求示例**

```bash
curl POST https://your-domain/agnes-api/chat/completions \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "agnes-2.5-flash",
    "messages": [
      { "role": "system", "content": "你是一个乐于助人的 AI 助手。" },
      { "role": "user", "content": "用三句话解释什么是量子计算。" }
    ],
    "temperature": 0.7,
    "max_tokens": 1024
  }'
```

### 流式输出 (Stream)

在请求体中设置 `"stream": true`，响应将以 SSE（Server-Sent Events）格式返回。

```bash
curl -N POST https://your-domain/agnes-api/chat/completions \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "agnes-2.5-flash",
    "messages": [
      { "role": "user", "content": "写一首关于春天的短诗。" }
    ],
    "stream": true
  }'
```

响应格式：

```
data: {"id":"...","choices":[{"delta":{"content":"你"},"index":0}],"model":"agnes-2.5-flash"}

data: {"id":"...","choices":[{"delta":{"content":"好"},"index":0}],"model":"agnes-2.5-flash"}

...

data: [DONE]
```

### 图像理解 (Vision)

`messages[].content` 支持文本和图像 URL 的混合数组。

```bash
curl POST https://your-domain/agnes-api/chat/completions \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "agnes-2.5-flash",
    "messages": [
      {
        "role": "user",
        "content": [
          { "type": "text", "text": "描述这张图片的内容。" },
          { "type": "image_url", "image_url": { "url": "https://example.com/image.jpg" } }
        ]
      }
    ]
  }'
```

### 工具调用 (Tool Calling)

```bash
curl POST https://your-domain/agnes-api/chat/completions \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "agnes-2.5-flash",
    "messages": [
      { "role": "user", "content": "北京今天的天气怎么样？" }
    ],
    "tools": [
      {
        "type": "function",
        "function": {
          "name": "get_weather",
          "description": "获取指定城市的天气信息",
          "parameters": {
            "type": "object",
            "properties": {
              "city": { "type": "string", "description": "城市名称" }
            },
            "required": ["city"]
          }
        }
      }
    ],
    "tool_choice": "auto"
  }'
```

### 列出模型

`GET /agnes-api/models`

```bash
curl https://your-domain/agnes-api/models \
  -H "Authorization: Bearer YOUR_API_KEY"
```

### 嵌入 (Embeddings)

`POST /agnes-api/embeddings`

```bash
curl POST https://your-domain/agnes-api/embeddings \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "agnes-2.5-flash",
    "input": "你好，世界"
  }'
```

## 多模态支持

Agnes 2.5 Flash 支持以下输入类型：

| 输入类型 | 格式 | 说明 |
|---|---|---|
| 文本 | `text` | 纯文本指令或问题 |
| 图像 URL | `image_url` | 通过公开可访问的 URL 传递图像 |

## 客户端集成

### Python (OpenAI SDK)

```python
from openai import OpenAI

client = OpenAI(
    api_key="YOUR_API_KEY",
    base_url="https://your-domain/agnes-api/v1"
)

response = client.chat.completions.create(
    model="agnes-2.5-flash",
    messages=[
        {"role": "user", "content": "你好"}
    ],
    stream=True
)

for chunk in response:
    if chunk.choices[0].delta.content:
        print(chunk.choices[0].delta.content, end="")
```

### Node.js

```javascript
const response = await fetch("https://your-domain/agnes-api/chat/completions", {
  method: "POST",
  headers: {
    "Authorization": "Bearer YOUR_API_KEY",
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    model: "agnes-2.5-flash",
    messages: [{ role: "user", content: "你好" }],
    stream: true
  })
});

const reader = response.body.getReader();
const decoder = new TextDecoder();

while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  console.log(decoder.decode(value));
}
```

## 技术特性

- **边缘加速** — 请求经 Cloudflare / Netlify / Vercel 边缘节点转发，降低延迟
- **流式零缓冲** — SSE 流式响应逐块透传，无中间缓冲
- **CORS 支持** — 自动处理跨域预检请求
- **Hop-by-Hop 过滤** — 正确处理 HTTP 代理头部
- **请求体缓冲** — 自动处理重定向兼容性

## 错误码

| HTTP 状态码 | 说明 |
|---|---|
| 401 | API Key 无效或缺失 |
| 400 | 请求参数错误 |
| 429 | 请求频率超限 |
| 500 | 上游服务异常 |

更多模型详细说明请参考 [Agnes AI 官方文档](https://agnes-ai.com/zh-Hans/docs/agnes-25-flash)。