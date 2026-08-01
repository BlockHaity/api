# Agnes Media

[Agnes AI](https://agnes-ai.com) 视频与图像生成 API 中转站，支持文生视频、图生视频、关键帧动画以及文生图、图生图，通过边缘节点加速转发。

## 节点地址

<!-- tabs:start -->
#### **Vercel 节点**

```
https://api-vercel.blockhaity.dpdns.org/agnes-media
```

#### **Netlify 节点**

```
https://blockhaity-api.netlify.app/agnes-media
```

<!-- tabs:end -->

## 基础路径

所有请求通过 `/agnes-media` 路径转发到 Agnes AI API（`https://apihub.agnes-ai.com`）。

| 边缘节点路径 | → Agnes AI API | 用途 |
|---|---|---|
| `POST /agnes-media/v1/videos` | `/v1/videos` | 创建视频生成任务 |
| `GET /agnes-media/agnesapi?video_id=X` | `/agnesapi?video_id=X` | 查询视频结果（推荐） |
| `GET /agnes-media/v1/videos/:task_id` | `/v1/videos/:task_id` | 查询视频结果（兼容旧版） |
| `POST /agnes-media/v1/images/generations` | `/v1/images/generations` | 图像生成 |

## 认证

请求头需携带 Agnes AI API Key：

```
Authorization: Bearer YOUR_API_KEY
Content-Type: application/json
```

## 视频生成

### 创建视频任务

`POST /agnes-media/v1/videos`

视频生成采用异步任务 API：先创建任务，再通过 `video_id` 或 `task_id` 获取结果。模型名称使用 `agnes-video-v2.0`。

**请求参数**

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `model` | string | 是 | 模型名称，使用 `agnes-video-v2.0` |
| `prompt` | string | 是 | 视频内容的文本描述 |
| `image` | string | 否 | 图生视频使用的图片 URL |
| `mode` | string | 否 | 生成模式，例如 `ti2vid` 或 `keyframes` |
| `height` | integer | 否 | 视频高度，默认 `768` |
| `width` | integer | 否 | 视频宽度，默认 `1152` |
| `num_frames` | integer | 否 | 视频帧数，必须 `≤ 441` 且遵循 `8n + 1` 规则 |
| `frame_rate` | number | 否 | 视频帧率，支持范围 `1–60` |
| `num_inference_steps` | integer | 否 | 推理步数 |
| `seed` | integer | 否 | 随机种子，用于可复现结果 |
| `negative_prompt` | string | 否 | 反向提示词 |
| `extra_body.image` | array | 否 | 关键帧模式下输入图片 URL 数组 |
| `extra_body.mode` | string | 否 | 附加模式设置，例如 `keyframes` |

**文生视频示例**

```bash
curl -X POST https://your-domain/agnes-media/v1/videos \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "agnes-video-v2.0",
    "prompt": "A cinematic shot of a cat walking on the beach at sunset, soft ocean waves, warm golden lighting, realistic motion",
    "height": 768,
    "width": 1152,
    "num_frames": 121,
    "frame_rate": 24
  }'
```

**图生视频示例**

```bash
curl -X POST https://your-domain/agnes-media/v1/videos \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "agnes-video-v2.0",
    "prompt": "The woman slowly turns around and looks back at the camera, natural facial expression, cinematic camera movement",
    "image": "https://example.com/image.png",
    "num_frames": 121,
    "frame_rate": 24
  }'
```

**关键帧动画示例**

```bash
curl -X POST https://your-domain/agnes-media/v1/videos \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "agnes-video-v2.0",
    "prompt": "Generate a smooth cinematic transition between the keyframes, maintaining visual consistency and natural camera movement",
    "extra_body": {
      "image": [
        "https://example.com/keyframe1.png",
        "https://example.com/keyframe2.png"
      ],
      "mode": "keyframes"
    },
    "num_frames": 121,
    "frame_rate": 24
  }'
```

**响应示例**

```json
{
  "id": "task_YOUR_TASK_ID",
  "task_id": "task_YOUR_TASK_ID",
  "video_id": "video_YOUR_VIDEO_ID",
  "object": "video",
  "model": "agnes-video-v2.0",
  "status": "queued",
  "progress": 0,
  "created_at": 1780457477,
  "seconds": "10.0",
  "size": "1280x768"
}
```

### 查询视频结果（推荐方式）

`GET /agnes-media/agnesapi?video_id=<VIDEO_ID>`

```bash
curl --location --request GET 'https://your-domain/agnes-media/agnesapi?video_id=<VIDEO_ID>' \
  --header 'Authorization: Bearer YOUR_API_KEY'
```

也可显式指定模型名称：

```bash
curl --location --request GET 'https://your-domain/agnes-media/agnesapi?video_id=<VIDEO_ID>&model_name=agnes-video-v2.0' \
  --header 'Authorization: Bearer YOUR_API_KEY'
```

**响应示例**（任务完成后，视频直链位于 `metadata.url`，已自动改写为经代理加速的下载链接）

```json
{
  "id": "task_YOUR_TASK_ID",
  "video_id": "task_YOUR_TASK_ID",
  "task_id": "task_YOUR_TASK_ID",
  "object": "video",
  "model": "agnes-video-v2.0",
  "status": "completed",
  "progress": 100,
  "created_at": 1784530473,
  "completed_at": 1784530510,
  "seconds": "1.0",
  "size": "832x448",
  "metadata": {
    "url": "https://your-domain/agnes-media/download?url=https%3A%2F%2Fplatform-outputs.agnes-ai.space%2Fvideos%2Fagnes-video-v2.0%2Ftask_YOUR_TASK_ID.mp4"
  }
}
```

### 查询视频结果（兼容旧版）

`GET /agnes-media/v1/videos/<TASK_ID>`

```bash
curl --location --request GET 'https://your-domain/agnes-media/v1/videos/<TASK_ID>' \
  --header 'Authorization: Bearer YOUR_API_KEY'
```

### 视频任务状态

| 状态 | 说明 |
|---|---|
| `queued` | 任务正在队列中等待 |
| `in_progress` | 视频正在生成 |
| `completed` | 视频生成成功 |
| `failed` | 视频生成失败 |

### 视频时长控制

`seconds = num_frames / frame_rate`

`num_frames` 必须 `≤ 441` 且遵循 `8n + 1` 规则。

| 目标时长 | 推荐参数 |
|---|---|
| 约 3 秒 | `num_frames: 81`, `frame_rate: 24` |
| 约 5 秒 | `num_frames: 121`, `frame_rate: 24` |
| 约 10 秒 | `num_frames: 241`, `frame_rate: 24` |
| 约 18 秒 | `num_frames: 441`, `frame_rate: 24` |

## 图像生成

### 文生图

`POST /agnes-media/v1/images/generations`

模型名称使用 `agnes-image-2.1-flash`。文生图必填参数为 `model`、`prompt` 和 `size`。

**请求参数**

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `model` | string | 是 | 模型名称，使用 `agnes-image-2.1-flash` |
| `prompt` | string | 是 | 图像生成或编辑的文本指令 |
| `size` | string | 是 | 输出尺寸档位，推荐 `1K`、`2K`、`3K`、`4K`；也兼容 `1024x768` 等精确写法 |
| `ratio` | string | 否 | 宽高比，支持 `1:1`、`3:4`、`4:3`、`16:9`、`9:16`、`2:3`、`3:2`、`21:9`，默认 `1:1` |
| `image` | string[] | 图生图必填 | 输入图像数组，支持公共 URL 或 Data URI Base64 |
| `return_base64` | boolean | 否 | 文生图以 Base64 返回时使用 |
| `extra_body.response_format` | string | 否 | 输出格式，`url` 或 `b64_json` |

**URL 输出示例**

```bash
curl -X POST https://your-domain/agnes-media/v1/images/generations \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "agnes-image-2.1-flash",
    "prompt": "A luminous floating city above a misty canyon at sunrise, cinematic realism",
    "size": "2K",
    "ratio": "16:9",
    "extra_body": {
      "response_format": "url"
    }
  }'
```

**Base64 输出示例**

```bash
curl -X POST https://your-domain/agnes-media/v1/images/generations \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "agnes-image-2.1-flash",
    "prompt": "A clean product photo of a glass cube on a white studio background, soft shadows, high detail",
    "size": "1024x768",
    "return_base64": true
  }'
```

### 图生图

图生图需要在 `extra_body.image` 中提供输入图像，无需传递 `tags: ["img2img"]`。

```bash
curl -X POST https://your-domain/agnes-media/v1/images/generations \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "agnes-image-2.1-flash",
    "prompt": "Transform the scene into a rain-soaked cyberpunk night with neon reflections while preserving the original composition",
    "size": "1024x768",
    "extra_body": {
      "image": [
        "https://example.com/input-image.png"
      ],
      "response_format": "url"
    }
  }'
```

支持以 Data URI Base64 传入输入图像：

```
data:image/png;base64,BASE64_HERE
```

### 尺寸与宽高比参考

| Ratio | 1K | 2K | 3K | 4K |
|---|---|---|---|---|
| `1:1` | `1024x1024` | `2048x2048` | `3072x3072` | `4096x4096` |
| `16:9` | `1312x736` | `2624x1472` | `3936x2208` | `5248x2944` |
| `9:16` | `736x1312` | `1472x2624` | `2208x3936` | `2944x5248` |
| `4:3` | `1152x864` | `2304x1728` | `3456x2592` | `4608x3456` |
| `3:4` | `864x1152` | `1728x2304` | `2592x3456` | `3456x4608` |
| `3:2` | `1248x832` | `2496x1664` | `3744x2496` | `4992x3328` |
| `2:3` | `832x1248` | `1664x2496` | `2496x3744` | `3328x4992` |
| `21:9` | `1568x672` | `3136x1344` | `4704x2016` | `6272x2688` |

### 响应格式

**URL 输出**（`data[0].url` 已自动改写为经代理加速的下载链接）

```json
{
  "created": 1780000000,
  "data": [
    {
      "url": "https://your-domain/agnes-media/download?url=https%3A%2F%2Fstorage.googleapis.com%2Fagnes-aigc%2Fxxx.png",
      "b64_json": null,
      "revised_prompt": null
    }
  ]
}
```

**Base64 输出**

```json
{
  "created": 1780000000,
  "data": [
    {
      "url": null,
      "b64_json": "iVBORw0KGgoAAAANSUhEUgAA...",
      "revised_prompt": null
    }
  ]
}
```

## 加速下载

生成的视频与图片文件由 Agnes 的存储域名（如 `platform-outputs.agnes-ai.space`、`storage.googleapis.com`）提供直链。`/agnes-media` 代理会将 API 响应中的直链（视频 `metadata.url`、图片 `data[0].url`）**自动改写**为经边缘节点加速的下载链接，无需手动拼接。

改写后的链接格式：

```
GET /agnes-media/download?url=<原直链URL编码>
```

例如：

```
https://your-domain/agnes-media/download?url=https%3A%2F%2Fplatform-outputs.agnes-ai.space%2Fvideos%2Fagnes-video-v2.0%2Ftask_xxx.mp4
```

**特性**

- **自动改写** — 无需额外参数，API 响应中的直链字段已替换为代理下载链接，端点保持不变
- **流式转发** — 文件经边缘节点流式透传，支持断点续传（`Range`）与长视频/大图下载
- **CORS 支持** — 可直接用于浏览器 `<video>` / `<img>` 标签或 `fetch` 请求
- **无需鉴权** — 下载链接由代理生成，访问时无需携带 API Key

**使用示例**

```bash
# 直接使用响应中的 metadata.url 或 data[0].url 即可
curl -O 'https://your-domain/agnes-media/download?url=<编码后的直链>'

# 浏览器直接播放
# <video src="https://your-domain/agnes-media/download?url=..."></video>
```

> 注意：直链由上游生成，可能有时效。若下载返回 404，请重新创建生成任务并获取新的链接。

## 注意事项

- 请勿将 `response_format` 放在请求体顶层，需放入 `extra_body.response_format`。
- 图生图不需要传递 `tags: ["img2img"]`，只需在 `extra_body.image` 中提供输入图像。
- 输入图像 URL 需为可公开访问的 HTTPS 地址；无法公开访问时请使用 Data URI Base64。
- `1920x1080`、`2560x1440` 并非该图像模型的原生输出尺寸，建议请求 `size: "2K"` 搭配 `ratio: "16:9"` 后再裁剪。
- 图像生成可能耗时数秒到数十秒，客户端超时建议设置为 `60s - 360s`。

## 错误码

| HTTP 状态码 | 说明 |
|---|---|
| 400 | 请求无效，请检查请求参数 |
| 401 | 未授权，请检查 API Key |
| 404 | 任务或视频未找到 |
| 500 | 服务器错误 |
| 503 | 服务繁忙，请稍后重试 |

更多详细说明请参考 Agnes AI 官方文档：[Agnes Video V2.0](https://agnes-ai.com/zh-Hans/docs/agnes-video-v20) 与 [Agnes Image 2.1 Flash](https://agnes-ai.com/zh-Hans/docs/agnes-image-21-flash)。
