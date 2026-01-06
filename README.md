# DeepSeek API 客户端

使用 OpenAI SDK 调用 DeepSeek API 的 Python 项目。

## 配置

1. 从 [DeepSeek Platform](https://platform.deepseek.com/) 获取您的 API Key
2. 编辑 `.env` 文件，将 `xxx` 替换为您的实际 API Key：

```
DEEPSEEK_API_KEY=your_actual_api_key_here
```

## 运行

```bash
# 同步所有依赖
uv sync --all-packages

# 设置 PYTHONPATH（Windows PowerShell）
$env:PYTHONPATH = "."

# 运行程序
uv run main.py
```

## 项目结构

```
deepseek-api/
├── main.py           # 主程序文件
├── pyproject.toml    # 项目配置和依赖
├── README.md         # 项目说明
└── .gitignore        # Git 忽略文件
```

