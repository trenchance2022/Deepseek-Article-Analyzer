"""API Schema 模型定义"""

from .papers import (
    PaperInfo,
    PaperCreate,
    PaperUpdate,
    StatusStats,
    PaperListResponse,
    PaperStatus,
)
from .extraction import (
    StartExtractionResponse,
    StopExtractionResponse,
)
from .analysis import (
    StartAnalysisResponse,
    AnalysisResultsResponse,
)

__all__ = [
    "PaperInfo",
    "PaperCreate",
    "PaperUpdate",
    "StatusStats",
    "PaperListResponse",
    "PaperStatus",
    "StartExtractionResponse",
    "StopExtractionResponse",
    "StartAnalysisResponse",
    "AnalysisResultsResponse",
]
