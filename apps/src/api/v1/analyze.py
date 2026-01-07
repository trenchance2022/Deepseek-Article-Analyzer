"""论文分析操作API（作为论文资源的子资源）"""

from fastapi import APIRouter, HTTPException, status, BackgroundTasks
from urllib.parse import unquote
from src.services.deepseek_analysis_service import process_analysis
from src.services.storage_service import get_paper_by_oss_key
from src.schema.analysis import (
    StartAnalysisResponse,
    AnalysisResultsResponse,
)
from src.core.logger import logger

# 注意：这个 router 需要作为 papers 的子路由注册
# 在 main.py 中使用 include_router(analyze_router, prefix="/api/v1/papers")
# 这样路径是 /api/v1/papers/{oss_key}/analysis 而不是 /api/v1/papers/papers/{oss_key}/analysis
router = APIRouter(tags=["papers"])


@router.post("/{oss_key:path}/analysis", response_model=StartAnalysisResponse)
async def start_paper_analysis(oss_key: str, background_tasks: BackgroundTasks):
    """
    开始论文分析

    POST /api/v1/papers/{oss_key}/analysis

    Args:
        oss_key: OSS 对象键（可能包含斜杠）
        background_tasks: FastAPI 后台任务

    Returns:
        StartAnalysisResponse: 操作结果
    """
    # URL 解码 oss_key
    oss_key = unquote(oss_key)

    try:
        # 检查论文是否存在且状态正确
        paper = get_paper_by_oss_key(oss_key)
        if not paper:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="论文不存在"
            )

        if paper.get("status") != "extracted":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"论文状态不正确，无法开始分析: {paper.get('status')}",
            )

        # 使用 FastAPI 的 BackgroundTasks 来运行后台任务
        background_tasks.add_task(process_analysis, oss_key)

        logger.info(f"分析任务已启动: {oss_key}")
        return StartAnalysisResponse(
            oss_key=oss_key,
            message="分析任务已启动",
        )
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(f"启动分析失败: {oss_key}, 错误: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"启动分析失败: {str(e)}",
        )


@router.get("/{oss_key:path}/analysis", response_model=AnalysisResultsResponse)
async def get_paper_analysis(oss_key: str):
    """
    获取论文分析结果

    GET /api/v1/papers/{oss_key}/analysis

    Args:
        oss_key: OSS 对象键（可能包含斜杠）

    Returns:
        AnalysisResultsResponse: 分析结果
    """
    # URL 解码 oss_key
    oss_key = unquote(oss_key)

    paper = get_paper_by_oss_key(oss_key)
    if not paper:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="论文不存在")

    analysis_results_path = paper.get("analysis_results_path")
    if not analysis_results_path:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="分析结果不存在"
        )

    # 读取分析结果文件
    from pathlib import Path
    import json
    from src.services.storage_service import WORKING_DIR

    # 构建完整路径
    analysis_results_path_normalized = analysis_results_path.replace("\\", "/")
    if Path(analysis_results_path_normalized).is_absolute():
        full_path = Path(analysis_results_path_normalized)
    else:
        full_path = WORKING_DIR / analysis_results_path_normalized

    if not full_path.exists():
        logger.error(f"分析结果文件不存在: {full_path}")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="分析结果文件不存在"
        )

    try:
        with open(full_path, "r", encoding="utf-8") as f:
            analysis_results = json.load(f)
        logger.debug(f"获取分析结果: {oss_key}, 问题数量: {len(analysis_results)}")
        return AnalysisResultsResponse(oss_key=oss_key, results=analysis_results)
    except json.JSONDecodeError as e:
        logger.error(f"解析分析结果文件失败: {full_path}, 错误: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="解析分析结果文件失败"
        )
    except Exception as e:
        logger.error(f"读取分析结果文件失败: {full_path}, 错误: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"读取分析结果文件失败: {str(e)}"
        )
