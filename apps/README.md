# 论文批量读取系统 - 后端

## 安装

```bash
cd apps
uv sync --all-packages
```

## 配置

编辑 `.env` 文件：

```
DEEPSEEK_API_KEY=your_api_key_here
OSS_ACCESS_KEY_ID=your_access_key_id
OSS_ACCESS_KEY_SECRET=your_access_key_secret
OSS_BUCKET_NAME=your_bucket_name
OSS_ENDPOINT=oss-cn-hangzhou.aliyuncs.com
MINERU_API_TOKEN=your_mineru_api_token
```

## 运行

```bash
$env:PYTHONPATH = "."
uv run app.py
```

服务地址: http://127.0.0.1:8000
