"""MinerU 相关API接口"""

from fastapi import APIRouter, HTTPException, status
from typing import List, Optional
from src.core.clients import get_mineru_client
from pydantic import BaseModel


router = APIRouter(prefix="/mineru", tags=["mineru"])


class MinerUParseRequest(BaseModel):
    """MinerU 解析请求模型"""

    url: str
    model_version: str = "vlm"
    data_id: Optional[str] = None
    enable_formula: bool = True
    enable_table: bool = True
    language: str = "ch"
    is_ocr: bool = False
    page_ranges: Optional[str] = None


class MinerUParseResponse(BaseModel):
    """MinerU 解析响应模型"""

    task_id: str
    trace_id: Optional[str] = None


class MinerUTaskStatusResponse(BaseModel):
    """MinerU 任务状态响应模型"""

    task_id: str
    state: str
    data_id: Optional[str] = None
    full_zip_url: Optional[str] = None
    err_msg: Optional[str] = None
    extract_progress: Optional[dict] = None


class MinerUBatchParseRequest(BaseModel):
    """MinerU 批量解析请求模型"""

    files: List[dict]  # [{"url": "...", "data_id": "..."}]
    model_version: str = "vlm"
    enable_formula: bool = True
    enable_table: bool = True
    language: str = "ch"


class MinerUBatchParseResponse(BaseModel):
    """MinerU 批量解析响应模型"""

    batch_id: str
    trace_id: Optional[str] = None


@router.post("/parse", response_model=MinerUParseResponse)
async def parse_paper_with_mineru(request: MinerUParseRequest):
    """
    使用 MinerU 解析论文（单个文件）

    Args:
        request: 解析请求，包含 OSS URL 等参数

    Returns:
        MinerUParseResponse: 包含 task_id 的响应
    """
    try:
        mineru_client = get_mineru_client()

        task_data = mineru_client.create_task(
            url=request.url,
            model_version=request.model_version,
            data_id=request.data_id,
            enable_formula=request.enable_formula,
            enable_table=request.enable_table,
            language=request.language,
            is_ocr=request.is_ocr,
            page_ranges=request.page_ranges,
        )

        return MinerUParseResponse(
            task_id=task_data.get("task_id", ""),
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"MinerU配置错误: {str(e)}",
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"创建解析任务失败: {str(e)}",
        )


@router.get("/task/{task_id}", response_model=MinerUTaskStatusResponse)
async def get_mineru_task_status(task_id: str):
    """
    查询 MinerU 任务状态

    Args:
        task_id: 任务ID

    Returns:
        MinerUTaskStatusResponse: 任务状态信息
    """
    try:
        mineru_client = get_mineru_client()
        task_data = mineru_client.get_task_status(task_id)

        return MinerUTaskStatusResponse(
            task_id=task_data.get("task_id", task_id),
            state=task_data.get("state", "unknown"),
            data_id=task_data.get("data_id"),
            full_zip_url=task_data.get("full_zip_url"),
            err_msg=task_data.get("err_msg"),
            extract_progress=task_data.get("extract_progress"),
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"MinerU配置错误: {str(e)}",
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"查询任务状态失败: {str(e)}",
        )


@router.post("/parse/batch", response_model=MinerUBatchParseResponse)
async def parse_papers_batch_with_mineru(request: MinerUBatchParseRequest):
    """
    使用 MinerU 批量解析论文（URL方式）

    Args:
        request: 批量解析请求，包含文件URL列表

    Returns:
        MinerUBatchParseResponse: 包含 batch_id 的响应
    """
    if not request.files:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="文件列表不能为空",
        )

    try:
        mineru_client = get_mineru_client()

        batch_data = mineru_client.create_batch_tasks(
            files=request.files,
            model_version=request.model_version,
            enable_formula=request.enable_formula,
            enable_table=request.enable_table,
            language=request.language,
        )

        return MinerUBatchParseResponse(
            batch_id=batch_data.get("batch_id", ""),
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"MinerU配置错误: {str(e)}",
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"批量创建解析任务失败: {str(e)}",
        )


@router.get("/batch/{batch_id}")
async def get_mineru_batch_results(batch_id: str):
    """
    查询 MinerU 批量任务结果

    Args:
        batch_id: 批量任务ID

    Returns:
        dict: 批量任务结果
    """
    try:
        mineru_client = get_mineru_client()
        batch_data = mineru_client.get_batch_results(batch_id)

        return batch_data
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"MinerU配置错误: {str(e)}",
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"查询批量任务结果失败: {str(e)}",
        )
