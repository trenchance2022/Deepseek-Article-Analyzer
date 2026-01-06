"""DeepSeek API 客户端"""

from openai import OpenAI
from config import settings
from typing import Optional


class DeepSeekClient:
    """DeepSeek API 客户端"""

    def __init__(self):
        """初始化 DeepSeek 客户端"""
        if not settings.DEEPSEEK_API_KEY:
            raise ValueError("DeepSeek API Key 未配置，请检查环境变量 DEEPSEEK_API_KEY")

        self.client = OpenAI(
            api_key=settings.DEEPSEEK_API_KEY, base_url=settings.API_BASE_URL
        )

    def get_client(self) -> OpenAI:
        """获取 OpenAI 客户端实例"""
        return self.client


# 全局客户端实例
_deepseek_client: Optional[DeepSeekClient] = None


def get_deepseek_client() -> DeepSeekClient:
    """获取 DeepSeek 客户端实例（单例模式）"""
    global _deepseek_client
    if _deepseek_client is None:
        _deepseek_client = DeepSeekClient()
    return _deepseek_client
