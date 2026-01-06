# 项目架构规范

## 目录结构

```
apps/src/
├── core/              # 核心模块
│   ├── config.py      # 配置管理
│   └── clients/       # 第三方 API 客户端（基础层）
│       ├── deepseek_client.py
│       ├── mineru_client.py
│       └── oss_client.py
│
├── services/          # 业务服务层
│   └── paper_service.py    # 论文处理业务服务
│
└── api/               # API 路由层
    └── v1/
        └── papers.py  # 论文相关接口
```

## 职责划分

### 1. `core/` - 核心模块
- **`config.py`**: 配置管理，从环境变量读取配置
- **`clients/`**: 第三方 API/SDK 客户端（基础层）
  - 只负责与外部服务通信（API、OSS等）
  - 封装 HTTP 请求或 SDK 调用
  - 返回原始数据
  - 不包含业务逻辑
  - 包括：`deepseek_client.py`, `mineru_client.py`, `oss_client.py`

### 2. `services/` - 业务服务层
- 组合多个客户端完成业务逻辑
- 例如：上传 OSS → 调用 MinerU → 调用 DeepSeek
- 提供高级业务方法

### 3. `api/` - API 路由层
- 接收 HTTP 请求
- 参数验证（使用 Pydantic）
- 调用 services 处理业务
- 返回 HTTP 响应

## 命名规范

- **客户端**: `*_client.py` (如 `deepseek_client.py`, `mineru_client.py`, `oss_client.py`)
- **服务**: `*_service.py` (如 `paper_service.py`)
- **API 路由**: 使用动词命名 (如 `papers.py`)

## 导入规范

```python
# API 层导入 services
from src.services.paper_service import get_paper_service

# Services 层导入 clients
from src.core.clients import get_mineru_client, get_deepseek_client, get_oss_client

# 不要跨层导入
# ❌ API 层不应该直接导入 clients
# ✅ API 层应该导入 services
```

## 单例模式

所有客户端和服务都使用单例模式，通过 `get_*()` 函数获取实例：

```python
# 客户端
from src.core.clients import get_mineru_client, get_oss_client
mineru = get_mineru_client()
oss = get_oss_client()

# 服务
from src.services.paper_service import get_paper_service
paper_service = get_paper_service()
```

