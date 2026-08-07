# Fish Audio API

[Fish Audio](https://fish.audio) 语音 AI 平台 API 中转站，提供文本转语音（TTS）、语音转文本（STT）、声音设计与声音模型管理接口，通过边缘节点加速转发。

## 节点地址

<!-- tabs:start -->
#### **Vercel 节点**

```
https://api-vercel.blockhaity.dpdns.org/fish-audio-api
```

#### **Netlify 节点**

```
https://blockhaity-api.netlify.app/fish-audio-api
```

#### **Cloudflare 节点**

```
https://api-cloudflare.blockhaity.qzz.io/fish-audio-api
```

<!-- tabs:end -->

## 基础路径

所有请求通过 `/fish-audio-api` 路径转发到 Fish Audio API（`https://api.fish.audio`）。

| 边缘节点路径 | → Fish Audio API | 用途 |
|---|---|---|
| `POST /fish-audio-api/v1/tts` | `/v1/tts` | 文本转语音 |
| `POST /fish-audio-api/v1/stt` | `/v1/stt` | 语音转文本 |
| `POST /fish-audio-api/v1/voice-design` | `/v1/voice-design` | 声音设计 |
| `GET /fish-audio-api/v1/models` | `/v1/models` | 列出模型 |
| `POST /fish-audio-api/v1/model` | `/v1/model` | 创建模型（声音克隆） |
| `GET /fish-audio-api/v1/model/:id` | `/v1/model/:id` | 获取模型详情 |
| `PUT /fish-audio-api/v1/model/:id` | `/v1/model/:id` | 更新模型 |
| `DELETE /fish-audio-api/v1/model/:id` | `/v1/model/:id` | 删除模型 |

## 认证

请求头需携带 Fish Audio API Key（可在 [API Keys](https://fish.audio/app/api-keys/) 获取）：

```
Authorization: Bearer YOUR_API_KEY
Content-Type: application/json
```

## 文本转语音 (TTS)

`POST /fish-audio-api/v1/tts`

将文本转换为自然语音，支持单说话人与多说话人对话（多说话人仅 S2 系列模型支持）。

**请求参数**

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `text` | string | 是 | 要合成的文本 |
| `reference_id` | string / array | 否 | 声音模型 ID；多说话人时传 ID 数组 |
| `references` | array | 否 | 零样本克隆的参考音频数组 |
| `model` | string | 否 | 模型名称，如 `s2.1-pro`、`s2.1-pro-free`、`s2-pro`、`s1` |
| `latency` | string | 否 | 延迟优化等级，如 `normal` |
| `format` | string | 否 | 输出格式，如 `mp3`、`wav` |
| `mp3_bitrate` | integer | 否 | MP3 比特率 |
| `prosody_speed` | number | 否 | 语速倍率 |
| `prosody_volume` | number | 否 | 音量倍率 |
| `normalize` | boolean | 否 | 是否对文本进行标准化 |
| `trim` | boolean | 否 | 是否裁剪首尾静音 |

**单说话人示例**

```bash
curl -X POST https://your-domain/fish-audio-api/v1/tts \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "text": "你好，世界！",
    "reference_id": "YOUR_MODEL_ID",
    "format": "mp3"
  }' --output speech.mp3
```

**多说话人对话示例（S2 系列）**

```bash
curl -X POST https://your-domain/fish-audio-api/v1/tts \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "text": "<|speaker:0|>早上好！<|speaker:1|>早上好！你今天怎么样？<|speaker:0|>我很好，谢谢！",
    "reference_id": ["MODEL_ID_ALICE", "MODEL_ID_BOB"],
    "format": "mp3"
  }' --output dialogue.mp3
```

响应为音频流的二进制数据，`Content-Type` 与请求的 `format` 对应。

## 语音转文本 (STT)

`POST /fish-audio-api/v1/stt`

将音频文件转录为文本，支持自动语言检测。

**请求参数（multipart/form-data）**

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `audio` | file | 是 | 要转录的音频文件 |
| `language` | string | 否 | 语言提示（ISO 639-1），不传则自动检测 |
| `ignore_timestamps` | boolean | 否 | 是否跳过精确时间戳，默认 `true` |

**请求示例**

```bash
curl -X POST https://your-domain/fish-audio-api/v1/stt \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -F "audio=@speech.mp3" \
  -F "language=zh"
```

**响应示例**

```json
{
  "text": "你好，世界！",
  "duration": 2.5,
  "segments": [
    {
      "text": "你好，世界！",
      "start": 0.0,
      "end": 2.5,
      "language_code": "zh",
      "language": "Chinese"
    }
  ],
  "language_code": "zh"
}
```

## 声音设计 (Voice Design)

`POST /fish-audio-api/v1/voice-design`

根据自然语言描述生成候选声音，端点为无状态，不创建模型或预签名 URL。

**请求参数**

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `instruction` | string | 是 | 声音设计提示词，1-2000 字符 |
| `reference_text` | string | 否 | 预览文本，最多 150 字符 |
| `language` | string | 否 | BCP-47 语言提示，如 `en`、`zh`、`ja` |
| `n` | integer | 否 | 候选数量，1-4，默认 `2` |
| `speed` | number | 否 | 语速倍率，最大 `3` |
| `num_step` | integer | 否 | 扩散步数，1-128，默认 `32` |
| `guidance_scale` | number | 否 | CFG 引导强度，默认 `2` |
| `instruct_guidance_scale` | number | 否 | 指令引导强度，默认 `0` |
| `seed` | integer | 否 | 随机种子，用于复现 |

**请求示例**

```bash
curl -X POST https://your-domain/fish-audio-api/v1/voice-design \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "instruction": "A warm and gentle female voice with a slight British accent, suitable for audiobook narration",
    "reference_text": "Hello, welcome to our channel.",
    "n": 2,
    "language": "en"
  }'
```

## 模型管理

### 列出模型

`GET /fish-audio-api/v1/models`

```bash
curl https://your-domain/fish-audio-api/v1/models \
  -H "Authorization: Bearer YOUR_API_KEY"
```

### 创建模型（声音克隆）

`POST /fish-audio-api/v1/model`

通过上传参考音频创建自定义声音模型，请求体为 `multipart/form-data`。

```bash
curl -X POST https://your-domain/fish-audio-api/v1/model \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -F "title=My Voice Clone" \
  -F "description=Custom cloned voice" \
  -F "visibility=public" \
  -F "type=personal" \
  -F "audios=@reference1.wav" \
  -F "audios=@reference2.wav"
```

### 获取模型详情

`GET /fish-audio-api/v1/model/:id`

```bash
curl https://your-domain/fish-audio-api/v1/model/MODEL_ID \
  -H "Authorization: Bearer YOUR_API_KEY"
```

### 更新模型

`PUT /fish-audio-api/v1/model/:id`

```bash
curl -X PUT https://your-domain/fish-audio-api/v1/model/MODEL_ID \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Updated Title",
    "description": "Updated description",
    "visibility": "private"
  }'
```

### 删除模型

`DELETE /fish-audio-api/v1/model/:id`

```bash
curl -X DELETE https://your-domain/fish-audio-api/v1/model/MODEL_ID \
  -H "Authorization: Bearer YOUR_API_KEY"
```

## 模型说明

| 模型 | 说明 |
|---|---|
| `s2.1-pro` | 推荐生产模型，质量、延迟、吞吐均优于 S2-Pro |
| `s2.1-pro-free` | 免费版同款模型，适合测试与小型业务，无 TTFA/DPA 保证 |
| `s2-pro` | 上一代 S2 模型，支持多说话人与自然语言表达控制 |
| `s1` | 上一代模型，支持括号情感标签 |

## 客户端集成

### Python (fish-audio-sdk)

```python
from fish_audio_sdk import Session, TTSRequest, ReferenceAudio

session = Session("YOUR_API_KEY")

with open("output.mp3", "wb") as f:
    request = TTSRequest(
        text="你好，世界！",
        reference_id="YOUR_MODEL_ID",
    )
    for chunk in session.tts(request):
        f.write(chunk)
```

将 SDK 的 `base_url` 指向边缘节点即可使用代理：

```python
session = Session("YOUR_API_KEY", base_url="https://your-domain/fish-audio-api")
```

### Node.js

```javascript
const response = await fetch("https://your-domain/fish-audio-api/v1/tts", {
  method: "POST",
  headers: {
    "Authorization": "Bearer YOUR_API_KEY",
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    text: "你好，世界！",
    reference_id: "YOUR_MODEL_ID",
    format: "mp3"
  })
});

const audioBuffer = await response.arrayBuffer();
```

## 技术特性

- **边缘加速** — 请求经 Cloudflare / Vercel / Netlify 边缘节点转发，降低延迟
- **流式透传** — TTS 音频流与 SSE 流式响应逐块透传，无中间缓冲
- **CORS 支持** — 自动处理跨域预检请求
- **Hop-by-Hop 过滤** — 正确处理 HTTP 代理头部
- **多方法支持** — 支持 GET / POST / PUT / DELETE / PATCH / OPTIONS

## 错误码

| HTTP 状态码 | 说明 |
|---|---|
| 400 | 请求参数错误 |
| 401 | API Key 无效或缺失 |
| 402 | 余额不足 |
| 404 | 模型或资源未找到 |
| 429 | 请求频率超限 |
| 500 | 服务器错误 |
| 503 | 服务繁忙，请稍后重试 |

## 注意事项

- WebSocket 实时流式端点 `/v1/tts/live` 暂不在代理支持范围内，请使用官方 SDK 或直连 `wss://api.fish.audio`。
- STT 端点上传音频时，请求体大小受各边缘平台限制（Cloudflare 免费版 128MB）。
- TTS 返回的音频为流式二进制数据，请使用 `--output` 或 `arrayBuffer()` 接收。
- 此代理为免认证转发端点，API Key 由客户端在请求头中携带。

更多详细说明请参考 [Fish Audio 官方文档](https://docs.fish.audio)。
