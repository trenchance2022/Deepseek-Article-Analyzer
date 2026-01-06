"""配置管理模块"""

import os
from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    """应用配置"""

    # API 配置
    DEEPSEEK_API_KEY: str
    API_BASE_URL: str = "https://api.deepseek.com"

    # OSS 配置
    OSS_ACCESS_KEY_ID: str = ""
    OSS_ACCESS_KEY_SECRET: str = ""
    OSS_BUCKET_NAME: str = ""
    OSS_ENDPOINT: str = ""
    OSS_REGION: str = ""  # 可选，如 oss-cn-hangzhou

    # 应用配置
    APP_NAME: str = "论文批量读取系统"
    APP_VERSION: str = "0.1.0"
    DEBUG: bool = False

    # 服务器配置
    HOST: str = "127.0.0.1"
    PORT: int = 8000

    # CORS 配置
    CORS_ORIGINS: list[str] = ["http://localhost:10617", "http://127.0.0.1:10617"]

    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()
