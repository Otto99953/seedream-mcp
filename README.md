# Seedream 5.0 Lite MCP Server

火山引擎豆包 **Seedream 5.0 Lite** 高清生图模型 MCP 服务，支持单张/组图生成、批量并发生成、参考图自动转码、推荐分辨率自适应与本地图片落盘。

---

## ✨ 特性

- 🚀 **高清分辨率智能映射**：支持 `1:1`, `16:9`, `9:16`, `3:2`, `4:3`, `21:9` 等常用比例，自动匹配官方推荐最佳分辨率（如 `4992x3328`, `5504x3040` 等）。
- ⚡ **批量并发支持**：内置 `seedream_batch_generate`，支持设置并发数（默认 3~5 并发），大幅缩短 PPT 配图、批量分镜生图耗时。
- 🖼️ **图生图 / 参考图**：支持本地路径或网络 URL，自动转码为 Base64 Data URI。
- 🛡️ **长连接防超时**：支持 180s 完整渲染等待与单次落盘，避免盲目重试导致重复扣费。
- 💾 **自动保存到本地**：自动下载图片至指定或当前工作区的 `generated_images/` 目录。

---

## 🛠️ 工具列表

### 1. `seedream_generate_image`
用于生成单张图片或连续组图。

### 2. `seedream_batch_generate`
用于批量并发生成多张不同提示词的图片。
```json
{
  "tasks": [
    { "filename_prefix": "slide_1", "prompt": "...", "aspect_ratio": "16:9" },
    { "filename_prefix": "slide_2", "prompt": "...", "aspect_ratio": "16:9" }
  ],
  "concurrency": 3
}
```

---

## 📦 跨设备 / 跨 Agent 快速接入

### 环境变量准备
在系统环境变量中设置 `ARK_API_KEY`：
```cmd
setx ARK_API_KEY "your_api_key_here"
```

### 1. ZCode (`~/.zcode/cli/config.json`)
```json
{
  "mcp": {
    "servers": {
      "seedream": {
        "type": "stdio",
        "command": "node",
        "args": ["C:/path/to/seedream-mcp/index.js"],
        "timeoutMs": 180000
      }
    }
  }
}
```

### 2. Claude Desktop (`%APPDATA%\Claude\claude_desktop_config.json`)
```json
{
  "mcpServers": {
    "seedream": {
      "command": "node",
      "args": ["C:/path/to/seedream-mcp/index.js"],
      "env": {
        "ARK_API_KEY": "your_api_key_here"
      }
    }
  }
}
```

### 3. Cursor / Windsurf / VSCode (Cline)
在 MCP 设置中添加：
- **Command**: `node`
- **Args**: `["C:/path/to/seedream-mcp/index.js"]`
- **Env**: `ARK_API_KEY=your_key`
