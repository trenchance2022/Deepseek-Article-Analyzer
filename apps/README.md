# DeepSeek API 后端服务

FastAPI 后端服务，提供 DeepSeek API 接口。

## 安装

```bash
cd apps
uv sync --all-packages
```

## 配置

编辑 `.env` 文件，设置相关配置：

```
# DeepSeek API
DEEPSEEK_API_KEY=your_api_key_here

# 阿里云OSS配置
OSS_ACCESS_KEY_ID=your_access_key_id
OSS_ACCESS_KEY_SECRET=your_access_key_secret
OSS_BUCKET_NAME=your_bucket_name
OSS_ENDPOINT=oss-cn-hangzhou.aliyuncs.com
```

## 运行

```bash
# 方式 1: 使用 uv run
uv run main.py

# 方式 2: 使用 uvicorn 直接运行
uvicorn src.api.main:app --reload --host 0.0.0.0 --port 8000
```

## API 文档

启动服务后，访问：
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

