# Seedream 5.0 Lite MCP Server

火山引擎豆包 **Seedream 5.0 Lite** 高清生图模型 MCP 服务，支持单张/组图生成、批量并发生成、参考图自动转码、推荐分辨率自适应与本地图片落盘。

---

## 📋 新设备 / 新 Agent 一键配置指令（直接复制给 Agent）

> 在任何新电脑上打开你的 AI 编程助手（ZCode / Claude Code / Cursor / Windsurf / Cline 等），**直接复制并发送以下这段提示词**，Agent 即可全自动为你克隆、安装依赖并配置好 MCP 与 Skill：

```text
请帮我一键接入 Seedream 生图 MCP 服务：
1. 在本地合适的工具目录（例如 ~/.zcode/tools/ 或 ~/.tools/）执行 git clone https://github.com/Otto99953/seedream-mcp.git 并运行 npm install 安装依赖。
2. 将该 MCP 服务注册到当前客户端的 MCP 配置中（若为 ZCode 则写入 ~/.zcode/cli/config.json，添加 timeoutMs: 180000；若为 Claude/Cursor 则写入对应 MCP 配置文件）。
3. 在 ~/.agents/skills/image-generation/SKILL.md 下创建生图指导 Skill，指导调用 seedream_generate_image 与 seedream_batch_generate 工具。
4. 检查系统环境变量 ARK_API_KEY 是否已就绪，若未配置请给出对应系统的设置命令。
```

---

## ✨ 核心特性

- 🚀 **高清分辨率自适应**：支持 `1:1`, `16:9`, `9:16`, `3:2`, `4:3`, `21:9` 等常用比例，自动匹配官方推荐最佳分辨率（如 `4992x3328`, `5504x3040` 等）。
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

## ⚙️ 手动配置参考

### 环境变量准备
```cmd
setx ARK_API_KEY "your_api_key_here"
```

### 各客户端配置文件位置与格式

#### 1. ZCode (`~/.zcode/cli/config.json`)
```json
{
  "mcp": {
    "servers": {
      "seedream": {
        "type": "stdio",
        "command": "node",
        "args": ["<本地绝对路径>/seedream-mcp/index.js"],
        "timeoutMs": 180000
      }
    }
  }
}
```

#### 2. Claude Desktop (`%APPDATA%\Claude\claude_desktop_config.json`)
```json
{
  "mcpServers": {
    "seedream": {
      "command": "node",
      "args": ["<本地绝对路径>/seedream-mcp/index.js"],
      "env": {
        "ARK_API_KEY": "your_api_key_here"
      }
    }
  }
}
```

#### 3. Cursor / Windsurf / VSCode (Cline)
在 MCP 设置中添加：
- **Command**: `node`
- **Args**: `["<本地绝对路径>/seedream-mcp/index.js"]`
- **Env**: `ARK_API_KEY=your_key`
