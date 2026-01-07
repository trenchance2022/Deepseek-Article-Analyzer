"""论文相关 Schema 模型"""

from pydantic import BaseModel
from typing import List, Optional, Dict

# 论文状态类型
PaperStatus = str  # 'uploading' | 'uploaded' | 'parsing' | 'downloading' | 'extracted' | 'analyzing' | 'done' | 'error'


class PaperInfo(BaseModel):
    """论文信息模型"""

    oss_key: str
    oss_url: str
    filename: str
    size: Optional[int] = None
    task_id: Optional[str] = None
    status: PaperStatus
    markdown_path: Optional[str] = None  # markdown 文件路径（相对于 working_dir）
    error: Optional[str] = None
    uploaded_at: Optional[str] = None
    extracted_at: Optional[str] = None
    analyzed_at: Optional[str] = None
    analysis_results_path: Optional[str] = (
        None  # 分析结果文件路径（相对于 working_dir）
    )


class PaperCreate(BaseModel):
    """创建论文请求模型"""

    oss_key: str
    oss_url: str
    filename: str
    size: Optional[int] = None


class PaperUpdate(BaseModel):
    """更新论文请求模型"""

    status: Optional[PaperStatus] = None
    task_id: Optional[str] = None
    markdown_path: Optional[str] = None
    error: Optional[str] = None
    extracted_at: Optional[str] = None
    analyzed_at: Optional[str] = None
    analysis_results_path: Optional[str] = None  # 分析结果文件路径（相对于 working_dir）


class StatusStats(BaseModel):
    """状态统计模型"""

    total: int
    uploading: int
    uploaded: int
    parsing: int
    downloading: int
    extracted: int
    analyzing: int
    done: int
    error: int


class PaperListResponse(BaseModel):
    """论文列表分页响应模型"""

    items: List[PaperInfo]
    total: int
    offset: int
    limit: int
