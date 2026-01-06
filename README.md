# DeepSeek API 项目

包含后端 API 服务和前端 Playground 的完整项目。

## 项目结构

```
deepseek-api/
├── apps/          # 后端 FastAPI 服务
│   ├── src/      # 源代码
│   ├── main.py   # 入口文件
│   └── .env      # 环境变量配置
│
└── playground/   # 前端 React 应用
    ├── src/      # 源代码
    └── package.json
```

## 快速开始

### 后端服务

```bash
# 进入后端目录
cd apps

# 安装依赖
uv sync --all-packages

# 配置环境变量（编辑 .env 文件）
# DEEPSEEK_API_KEY=your_api_key_here

# 运行服务
uv run main.py
```

后端服务将在 http://localhost:8000 启动

### 前端应用

```bash
# 进入前端目录
cd playground

# 安装依赖
pnpm install

# 启动开发服务器
pnpm dev
```

前端应用将在 http://localhost:5173 启动

## 技术栈

### 后端
- FastAPI
- Python 3.10+
- uv (包管理)
- DeepSeek API

### 前端
- React 19
- TypeScript
- Vite
- Tailwind CSS 4.x
- React Router DOM
- Axios
- pnpm

## 开发

### 后端 API 文档
启动后端服务后，访问：
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

### 前端代理配置
前端已配置代理，`/api/*` 请求会自动转发到后端 `http://localhost:8000`
