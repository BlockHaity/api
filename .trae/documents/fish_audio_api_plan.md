# Fish Audio API 代理端点实现计划

## 背景研究总结

### Fish Audio API

* **基础 URL**: `https://api.fish.audio`

* **认证**: `Authorization: Bearer <token>`

* **主要端点**:

  * `POST /v1/tts` — 文本转语音

  * `POST /v1/stt` — 语音转文本

  * `POST /v1/voice-design` — 声音设计

  * `GET /v1/models` — 列出模型

  * `POST /v1/model` — 创建模型（声音克隆）

  * `GET /v1/model/:id` — 获取模型详情

  * `PUT /v1/model/:id` — 更新模型

  * `DELETE /v1/model/:id` — 删除模型

* **WebSocket TTS**: `WSS /v1/tts/live`（暂不支持）

### 项目三平台架构

| 平台                     | 目录                        | 入口模式                                            | 配置              |
| ---------------------- | ------------------------- | ----------------------------------------------- | --------------- |
| **Cloudflare Workers** | `workers/`                | `workers/index.js` 路由 + `workers/handlers/` 处理器 | `wrangler.toml` |
| **Vercel Edge**        | `api/`                    | `api/*.js` 边缘函数 + `vercel.json` rewrites        | `vercel.json`   |
| **Netlify Edge**       | `netlify/edge-functions/` | `netlify/edge-functions/*.js` + `config.path`   | `netlify.toml`  |

### 现有代理模式参考

* `agnes-api.js` / `agnes-media.js` — Vercel/Netlify 完整反向代理实现

  * Hop-by-Hop 头部过滤

  * CORS 头部设置

  * 请求体转发（GET 除外）

  * SSE 流式处理

  * 响应头部选择性转发

***

## 修改文件列表

### 1. Cloudflare Workers（3 个文件）

* **`workers/config.js`** — 添加 `FISH_AUDIO_BASE_URL` 常量

* **`workers/handlers/fish-audio.js`**（新建）— Fish Audio 反向代理处理器

* **`workers/index.js`** — 修改路由 + 放开 POST/PUT/DELETE 方法限制

### 2. Vercel Edge Functions（2 个文件）

* **`api/fish-audio.js`**（新建）— Fish Audio 边缘函数

* **`vercel.json`** — 添加 rewrite 规则

### 3. Netlify Edge Functions（1 个文件）

* **`netlify/edge-functions/fish-audio.js`**（新建）— Fish Audio 边缘函数

### 4. 文档（2 个文件）

* **`docs/api-doc/fish-audio-api.md`**（新建）— API 文档

* **`docs/_sidebar.md`** — 添加 fish-audio-api 导航链接

***

## 详细步骤

### 步骤 1: Cloudflare Worker 实现

#### 1.1 修改 `workers/config.js`

添加:

```js
export const FISH_AUDIO_BASE_URL = 'https://api.fish.audio';
```

#### 1.2 创建 `workers/handlers/fish-audio.js`

参照 `github-download.js` 和 `agnes-api.js` 的代理模式：

* 接收 `/fish-audio-api/*` 路径请求

* 剥离前缀后转发到 `https://api.fish.audio/*`

* 过滤 Hop-by-Hop 头部

* 转发 `Authorization` 等请求头

* 支持 GET/POST/PUT/DELETE 方法

* 转发请求体（非 GET/HEAD）

* 设置 CORS 头

* 选择性转发响应头（content-type, content-length 等）

#### 1.3 修改 `workers/index.js`

* 导入 `handleFishAudio`

* 对 `/fish-audio-api` 路径放开所有 HTTP 方法（移除第26-28行的 GET 限制对该路径的影响）

* 添加路由：`pathname.startsWith('/fish-audio-api')` → `handleFishAudio(request)`

* 保留 OPTIONS 预检处理在路由之前

### 步骤 2: Vercel Edge Function 实现

#### 2.1 创建 `api/fish-audio.js`

参照 `api/agnes-api.js` 模式：

* 使用 `runtime: 'edge'`

* 路径解析：支持 `/fish-audio-api` 和 `/fish-audio-api/*`（参照 `agnes-api.js` 的 `resolvePath` 模式）

* Hop-by-Hop 头部过滤

* 请求体读取（`arrayBuffer()`）

* 响应头部选择性转发

* CORS 头设置

* SSE 流式处理

* 通过 `vercel.json` rewrite 将路径映射到此函数

#### 2.2 修改 `vercel.json`

添加 rewrite 规则：

```json
{ "source": "/fish-audio-api", "destination": "/api/fish-audio" },
{ "source": "/fish-audio-api/:path*", "destination": "/api/fish-audio?__path=:path*" }
```

### 步骤 3: Netlify Edge Function 实现

#### 3.1 创建 `netlify/edge-functions/fish-audio.js`

参照 `netlify/edge-functions/agnes-api.js` 模式：

* `config.path: ['/fish-audio-api', '/fish-audio-api/*']`

* 相同的代理逻辑

* Hop-by-Hop 头部过滤

* CORS 支持

* 与 Vercel 版本保持一致的实现

### 步骤 4: 文档

#### 4.1 创建 `docs/api-doc/fish-audio-api.md`

参照 `docs/api-doc/agnes-api.md` 格式：

* 节点地址（Vercel / Netlify / Cloudflare）

* 基础路径映射表

* 认证说明

* 各端点说明（TTS、STT、Voice Design、Models CRUD）

* cURL 示例

* 错误码说明

#### 4.2 修改 `docs/_sidebar.md`

在 API文档 分组下添加：

```md
- [fish-audio-api](/api-doc/fish-audio-api)
```

***

## 风险与注意事项

1. **请求体大小**：Fish Audio 的 STT 端点接收音频文件，Cloudflare Worker 免费版限制 128MB，付费版 500MB
2. **WebSocket**：`/v1/tts/live` WebSocket 流式端点不在本次实现范围内
3. **流式响应**：TTS 返回音频流，需确保流式转发正常（不缓冲整个响应体）
4. **安全性**：此代理为免认证转发端点，需考虑是否限制访问来源
5. **路径映射**：`/fish-audio-api` 根路径需特殊处理，确保 `/fish-audio-api` → `/` 和 `/fish-audio-api/` → `/` 正确映射
6. **Vercel body 读取**：Vercel Edge Functions 使用 `await req.arrayBuffer()` 读取请求体，而 Cloudflare Workers 直接使用 `request.body`（ReadableStream）

