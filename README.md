# 论文批量读取系统

## 后端

```bash
cd apps
uv sync --all-packages
$env:PYTHONPATH = "."
uv run app.py
```

服务地址: http://127.0.0.1:8000

## 前端

```bash
cd playground
pnpm install
pnpm dev
```

服务地址: http://localhost:10617
