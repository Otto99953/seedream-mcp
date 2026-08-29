#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const ENDPOINT = "https://ark.cn-beijing.volces.com/api/plan/v3/images/generations";
const MODEL = "doubao-seedream-5.0-lite";

// 比例与官方推荐尺寸映射
const RATIO_SIZE_MAP = {
  "1:1": "4096x4096",
  "4:3": "4704x3520",
  "3:4": "3520x4704",
  "16:9": "5504x3040",
  "9:16": "3040x5504",
  "3:2": "4992x3328",
  "2:3": "3328x4992",
  "21:9": "6240x2656",
};

const MIME_MAP = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".bmp": "image/bmp",
  ".tif": "image/tiff",
  ".tiff": "image/tiff",
  ".gif": "image/gif",
  ".heic": "image/heic",
  ".heif": "image/heif",
};

async function fileToDataUri(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const mime = MIME_MAP[ext];
  if (!mime) throw new Error(`不支持的参考图扩展名: ${ext}`);

  const bytes = await readFile(filePath);
  if (bytes.length > 30 * 1024 * 1024) {
    throw new Error(`参考图大小超过 30MB: ${filePath}`);
  }
  return `data:${mime};base64,${bytes.toString("base64")}`;
}

// 单次请求生图 API（180秒超时）
async function requestGeneration(apiKey, payload) {
  const response = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(180_000),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`HTTP ${response.status}: ${text.slice(0, 500)}`);
  }

  const result = await response.json();
  if (result.error) {
    throw new Error(`${result.error.code || "API_ERROR"}: ${result.error.message || "Unknown error"}`);
  }
  return result;
}

// 核心单任务处理逻辑
async function executeSingleTask(apiKey, taskConfig, globalOutputDir) {
  const {
    prompt,
    aspect_ratio = "1:1",
    count = 1,
    reference_images = [],
    filename_prefix = "seedream",
    output_dir = globalOutputDir,
  } = taskConfig;

  // 1. 处理参考图
  let formattedImages = [];
  if (reference_images && reference_images.length > 0) {
    if (reference_images.length > 14) {
      throw new Error("参考图最多不能超过 14 张");
    }
    for (const img of reference_images) {
      if (img.startsWith("http://") || img.startsWith("https://") || img.startsWith("data:image/")) {
        formattedImages.push(img);
      } else {
        const resolvedPath = path.isAbsolute(img) ? img : path.resolve(process.cwd(), img);
        formattedImages.push(await fileToDataUri(resolvedPath));
      }
    }
  }

  if (formattedImages.length + count > 15) {
    throw new Error(`组图容量超限: 参考图(${formattedImages.length}) + 生成张数(${count}) 不能大于 15`);
  }

  const size = RATIO_SIZE_MAP[aspect_ratio] || "4096x4096";
  const payload = {
    model: MODEL,
    prompt: prompt,
    sequential_image_generation: count > 1 ? "auto" : "disabled",
    response_format: "url",
    size: size,
    stream: false,
    output_format: "png",
    watermark: false,
  };

  if (count > 1) {
    payload.sequential_image_generation_options = { max_images: count };
  }
  if (formattedImages.length > 0) {
    payload.image = formattedImages;
  }

  const result = await requestGeneration(apiKey, payload);
  const dataList = result.data || [];
  if (dataList.length === 0) {
    throw new Error("API 返回的数据为空，未获取到图片 URL");
  }

  await mkdir(output_dir, { recursive: true });

  const savedFiles = [];
  const timestamp = Date.now();

  for (let i = 0; i < dataList.length; i++) {
    const item = dataList[i];
    const imgUrl = item.url;
    if (!imgUrl) continue;

    const imgRes = await fetch(imgUrl, { signal: AbortSignal.timeout(180_000) });
    if (!imgRes.ok) {
      throw new Error(`图片下载失败: HTTP ${imgRes.status}`);
    }

    const buffer = Buffer.from(await imgRes.arrayBuffer());
    const fileName = count === 1 
      ? `${filename_prefix}_${timestamp}.png` 
      : `${filename_prefix}_${timestamp}_${i + 1}.png`;
    const filePath = path.join(output_dir, fileName);

    await writeFile(filePath, buffer);
    savedFiles.push({ path: filePath, size: item.size || size });
  }

  return savedFiles;
}

// 轻量并发池实现（控制同时发起的请求数）
async function asyncPool(limit, tasks, taskRunner) {
  const results = [];
  const executing = new Set();

  for (let i = 0; i < tasks.length; i++) {
    const task = tasks[i];
    const p = Promise.resolve().then(() => taskRunner(task, i));
    results.push(p);
    executing.add(p);

    const clean = () => executing.delete(p);
    p.then(clean).catch(clean);

    if (executing.size >= limit) {
      await Promise.race(executing);
    }
  }
  return Promise.allSettled(results);
}

// 创建 MCP Server
const server = new Server(
  { name: "seedream-image-generator", version: "1.1.0" },
  { capabilities: { tools: {} } }
);

// 注册工具定义
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "seedream_generate_image",
        description:
          "使用火山引擎豆包 Seedream 5.0 Lite 模型生成单张或一组连续图片。自动下载并保存在本地。",
        inputSchema: {
          type: "object",
          properties: {
            prompt: {
              type: "string",
              description: "详细的图片生成提示词。如有参考图，提示词中需使用 Image 1, Image 2 等对应指代。",
            },
            aspect_ratio: {
              type: "string",
              enum: ["1:1", "4:3", "3:4", "16:9", "9:16", "3:2", "2:3", "21:9"],
              default: "1:1",
              description: "图片宽高比，默认 1:1",
            },
            count: {
              type: "integer",
              minimum: 1,
              maximum: 14,
              default: 1,
              description: "生成图片数量。大于 1 时启用组图连续模式。",
            },
            reference_images: {
              type: "array",
              items: { type: "string" },
              description: "参考图列表（最多14张），支持本地绝对/相对路径或 URL",
            },
            output_dir: {
              type: "string",
              description: "保存目录绝对路径，默认保存在当前工作区的 generated_images 文件夹",
            },
            filename_prefix: {
              type: "string",
              default: "seedream",
              description: "文件名前缀",
            },
          },
          required: ["prompt"],
        },
      },
      {
        name: "seedream_batch_generate",
        description:
          "批量并发生图工具。当需要为 PPT 各页、短视频分镜、小说多章节或批量素材同时生成多张不同提示词的图片时使用。支持并发池并发控制，极大缩短耗时。",
        inputSchema: {
          type: "object",
          properties: {
            tasks: {
              type: "array",
              description: "批量生图任务列表，每个元素为一个生图配置对象",
              items: {
                type: "object",
                properties: {
                  prompt: { type: "string", description: "该任务的详细提示词" },
                  aspect_ratio: {
                    type: "string",
                    enum: ["1:1", "4:3", "3:4", "16:9", "9:16", "3:2", "2:3", "21:9"],
                    default: "16:9",
                    description: "图片宽高比",
                  },
                  filename_prefix: {
                    type: "string",
                    description: "该图片的文件名前缀（如 slide_1, scene_01 等）",
                  },
                  count: { type: "integer", default: 1, description: "该任务生成张数" },
                  reference_images: {
                    type: "array",
                    items: { type: "string" },
                    description: "参考图路径列表",
                  },
                },
                required: ["prompt", "filename_prefix"],
              },
            },
            concurrency: {
              type: "integer",
              minimum: 1,
              maximum: 8,
              default: 3,
              description: "最大并行并发数，建议 3~5（默认 3）",
            },
            output_dir: {
              type: "string",
              description: "批量图片保存的统一目录路径，默认当前工作区的 generated_images 文件夹",
            },
          },
          required: ["tasks"],
        },
      },
    ],
  };
});

// 处理工具调用
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const apiKey = process.env.ARK_API_KEY;
  if (!apiKey) {
    return {
      content: [{ type: "text", text: "错误: 未配置环境变量 ARK_API_KEY，请确保已设置系统环境变量并重启客户端。" }],
      isError: true,
    };
  }

  // 1. 单张/组图工具
  if (request.params.name === "seedream_generate_image") {
    try {
      const savedFiles = await executeSingleTask(
        apiKey,
        request.params.arguments || {},
        path.join(process.cwd(), "generated_images")
      );
      const summary = savedFiles
        .map((f, idx) => `- 图片 ${idx + 1}: ${f.path} (分辨率: ${f.size})`)
        .join("\n");
      return {
        content: [{ type: "text", text: `生图成功！已保存到本地：\n${summary}` }],
      };
    } catch (error) {
      return {
        content: [{ type: "text", text: `生图失败: ${error.message}` }],
        isError: true,
      };
    }
  }

  // 2. 批量并发工具
  if (request.params.name === "seedream_batch_generate") {
    const {
      tasks = [],
      concurrency = 3,
      output_dir = path.join(process.cwd(), "generated_images"),
    } = request.params.arguments || {};

    if (!Array.isArray(tasks) || tasks.length === 0) {
      return {
        content: [{ type: "text", text: "错误: tasks 列表不能为空" }],
        isError: true,
      };
    }

    try {
      await mkdir(output_dir, { recursive: true });

      const taskRunner = async (task, index) => {
        const prefix = task.filename_prefix || `batch_${index + 1}`;
        const files = await executeSingleTask(
          apiKey,
          { ...task, filename_prefix: prefix, output_dir },
          output_dir
        );
        return { index: index + 1, prefix, files };
      };

      const settled = await asyncPool(concurrency, tasks, taskRunner);

      const successList = [];
      const failedList = [];

      settled.forEach((res, idx) => {
        if (res.status === "fulfilled") {
          successList.push(res.value);
        } else {
          failedList.push({
            index: idx + 1,
            prefix: tasks[idx].filename_prefix || `batch_${idx + 1}`,
            error: res.reason?.message || "未知错误",
          });
        }
      });

      let outputText = `### 批量并发生图完成（共 ${tasks.length} 项，并发数: ${concurrency}）\n\n`;
      outputText += `✅ **成功**: ${successList.length} 项\n`;
      if (failedList.length > 0) {
        outputText += `❌ **失败**: ${failedList.length} 项\n\n`;
      }

      if (successList.length > 0) {
        outputText += `\n**生成成功的图片列表**：\n`;
        successList.forEach((item) => {
          item.files.forEach((f) => {
            outputText += `- [任务 ${item.index} - ${item.prefix}]: \`${f.path}\` (${f.size})\n`;
          });
        });
      }

      if (failedList.length > 0) {
        outputText += `\n**失败项详情**：\n`;
        failedList.forEach((item) => {
          outputText += `- 任务 ${item.index} (${item.prefix}): ${item.error}\n`;
        });
      }

      return {
        content: [{ type: "text", text: outputText }],
      };
    } catch (error) {
      return {
        content: [{ type: "text", text: `批量生图出现严重异常: ${error.message}` }],
        isError: true,
      };
    }
  }

  throw new Error(`Unknown tool: ${request.params.name}`);
});

// 启动服务
const transport = new StdioServerTransport();
await server.connect(transport);
