# 论文批量读取系统

## 后端

```bash
powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 | iex"
cd apps
uv sync --all-packages
$env:PYTHONPATH = "."
uv run app.py
```

服务地址: http://127.0.0.1:8000

## 前端

```bash
winget install OpenJS.NodeJS
npm install -g pnpm
cd playground
pnpm install
pnpm dev
```

服务地址: http://localhost:10617
