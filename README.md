# Seedream 5.0 Lite MCP Server

火山引擎豆包 **Seedream 5.0 Lite** 高清生图模型 MCP 服务，支持单张/组图生成、批量并发生成、参考图自动转码、推荐分辨率自适应与本地图片落盘。

---

## 📋 新设备 / 新 Agent 一键配置指令（直接复制给 Agent）

> 在任何新设备上打开任意 AI Agent（如 Claude Code / Cursor / Windsurf / Cline / Roo Code / ZCode 等），**直接复制并发送以下通用提示词**，Agent 即可全自动完成拉取、安装与配置：

```text
请帮我一键配置并接入当前设备的 Seedream 生图 MCP 服务：
1. 请参考本项目 README.md 中的“各主流 Agent 配置清单”，将本仓库克隆到本地用户工具目录（如 ~/.tools/seedream-mcp）并执行 npm install 安装依赖。
2. 识别你当前所处的 Agent/客户端环境，按照 README 对应章节将 seedream MCP 服务注册到相应的配置文件中（建议配置超时时间为 180 秒/180000ms）。
3. 如果当前环境支持 Skill/规则扩展（如 ~/.agents/skills/ 或对应指令规则），请根据 README 中的规范配置 image-generation 生图指导技能。
4. 检查系统环境变量 ARK_API_KEY 是否已配置，若未配置请根据当前操作系统给出设置指令。
```

---

## ⚙️ 各主流 Agent 详细配置清单

为避免不同 Agent 重复猜测或配置出错，以下整理了已验证的配置方式：

### 1. 通用环境变量
无论使用何种 Agent，生图服务均优先读取系统环境变量 `ARK_API_KEY`：
- **Windows (CMD / PowerShell)**：
  ```cmd
  setx ARK_API_KEY "your_api_key_here"
  ```
- **macOS / Linux (`~/.bashrc` 或 `~/.zshrc`)**：
  ```bash
  export ARK_API_KEY="your_api_key_here"
  ```

---

### 2. ZCode
- **配置文件路径**：`~/.zcode/cli/config.json`
- **配置内容**：
  ```json
  {
    "mcp": {
      "servers": {
        "seedream": {
          "type": "stdio",
          "command": "node",
          "args": ["<本地路径>/seedream-mcp/index.js"],
          "timeoutMs": 180000
        }
      }
    }
  }
  ```
- **Skill 路径**：`~/.zcode/skills/image-generation/SKILL.md` 或 `~/.agents/skills/image-generation/SKILL.md`

---

### 3. Claude Desktop / Claude Code
- **配置文件路径**：
  - Windows: `%APPDATA%\Claude\claude_desktop_config.json`
  - macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **配置内容**：
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
- **Skill / 规则路径**：`~/.claude/commands/` 或项目根目录 `CLAUDE.md`

---

### 4. Cursor
- **配置入口**：Settings → Features → MCP → **+ Add New MCP Server**
- **配置项**：
  - **Name**: `seedream`
  - **Type**: `command`
  - **Command**: `node <本地绝对路径>/seedream-mcp/index.js`
- **Rules 路径**：`.cursorrules` 或 `.cursor/rules/`

---

### 5. Windsurf (Cascade)
- **配置文件路径**：`~/.codeium/windsurf/mcp_config.json`
- **配置内容**：
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
- **Rules 路径**：`.windsurfrules`

---

### 6. VSCode 插件 (Cline / Roo Code)
- **配置文件路径**：`cline_mcp_settings.json` 或在扩展界面的 MCP Servers 面板中添加：
  ```json
  {
    "mcpServers": {
      "seedream": {
        "command": "node",
        "args": ["<本地绝对路径>/seedream-mcp/index.js"],
        "disabled": false,
        "autoApprove": []
      }
    }
  }
  ```

---

## 🛠️ 工具列表与能力

### 1. `seedream_generate_image`
用于生成单张图片或连续组图。

### 2. `seedream_batch_generate`
用于批量并发生成多张不同提示词的图片（如 PPT 各页、分镜批量生成）。
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

## 🎨 生图指导 Skill / Prompt 规范 (通用)

在支持技能体系的 Agent 中，可将以下内容写入 `SKILL.md` 或系统提示中：

```markdown
---
name: image-generation
description: 当需要单张或批量生成图片、插图、PPT 配图或分镜时调用 seedream MCP 服务。
---

# 图片生成指引
1. 单张/同主题连贯分镜：调用 `seedream_generate_image`。
2. 多场景/PPT 各页/批量出图：优先调用 `seedream_batch_generate`（并发数推荐 3~5）。
3. 比例推荐：PPT/横屏壁纸 `16:9`；手机/海报 `9:16`；摄影 `3:2`；方形 `1:1`。
4. 提示词自动扩写：包含主体细节、光影质感、构图氛围与风格关键词。
```
