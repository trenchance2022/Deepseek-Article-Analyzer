"""提取相关 Schema 模型"""

from pydantic import BaseModel


class StartExtractionResponse(BaseModel):
    """开始提取响应"""

    task_id: str
    oss_key: str
    message: str


class StopExtractionResponse(BaseModel):
    """停止提取响应"""

    success: bool
    message: str
