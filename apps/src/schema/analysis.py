"""分析相关 Schema 模型"""

from pydantic import BaseModel
from typing import Dict


class StartAnalysisResponse(BaseModel):
    """开始分析响应"""

    oss_key: str
    message: str


class AnalysisResultsResponse(BaseModel):
    """分析结果响应"""

    oss_key: str
    results: Dict[str, str]  # 键为问题标识，值为回答内容
