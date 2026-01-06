"""DeepSeek API 客户端"""

import os
from openai import OpenAI
from .config import settings


class DeepSeekClient:
    """DeepSeek API 客户端封装"""

    def __init__(self):
        self.client = OpenAI(
            api_key=settings.DEEPSEEK_API_KEY, base_url=settings.API_BASE_URL
        )

    def get_client(self) -> OpenAI:
        """获取 OpenAI 客户端实例"""
        return self.client


# 全局客户端实例
deepseek_client = DeepSeekClient()
