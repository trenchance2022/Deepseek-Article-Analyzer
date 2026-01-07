"""论文资源管理API接口（RESTful）"""

from fastapi import APIRouter, HTTPException, status, Query
from typing import List, Optional
from datetime import datetime
from urllib.parse import unquote
from src.services.storage_service import (
    load_papers,
    save_papers,
    get_paper_by_oss_key,
    update_paper,
    delete_paper,
    WORKING_DIR,
)
from src.schema.papers import (
    PaperInfo,
    PaperCreate,
    PaperUpdate,
    StatusStats,
    PaperListResponse,
    PaperStatus,
)
from pathlib import Path

router = APIRouter(prefix="/papers", tags=["papers"])


@router.get("", response_model=PaperListResponse)
async def get_papers(
    status: Optional[str] = Query(
        None,
        description="按状态筛选，支持多个状态用逗号分隔，如：extracted,analyzing,done",
    ),
    offset: Optional[int] = Query(0, ge=0, description="偏移量，从0开始"),
    limit: Optional[int] = Query(10, ge=1, le=100, description="每页数量，最大100"),
):
    """
    获取论文列表（分页）

    GET /api/v1/papers
    GET /api/v1/papers?status=uploaded&offset=0&limit=10
    GET /api/v1/papers?status=extracted,analyzing,done&offset=0&limit=10

    Args:
        status: 可选的状态筛选，支持多个状态用逗号分隔
        offset: 偏移量，从0开始
        limit: 每页数量，默认10，最大100

    Returns:
        PaperListResponse: 分页响应，包含论文列表、总数、偏移量和每页数量
    """
    papers = load_papers()

    # 按状态筛选（支持多状态）
    if status:
        # 支持逗号分隔的多个状态
        status_list = [s.strip() for s in status.split(",")]
        papers = [p for p in papers if p.get("status") in status_list]

    # 按上传时间倒序排序
    papers.sort(
        key=lambda x: x.get("uploaded_at", ""),
        reverse=True,
    )

    total = len(papers)

    # 处理分页参数（确保有默认值）
    offset_val = offset if offset is not None else 0
    limit_val = limit if limit is not None else 10

    # 分页切片
    end = offset_val + limit_val
    paginated_papers = papers[offset_val:end]

    return PaperListResponse(
        items=[PaperInfo(**paper) for paper in paginated_papers],
        total=total,
        offset=offset_val,
        limit=limit_val,
    )


@router.get("/stats", response_model=StatusStats)
async def get_status_stats():
    """
    获取状态统计信息

    GET /api/v1/papers/stats

    Returns:
        StatusStats: 状态统计
    """
    papers = load_papers()

    stats = {
        "total": len(papers),
        "uploading": 0,
        "uploaded": 0,
        "parsing": 0,
        "downloading": 0,
        "extracted": 0,
        "analyzing": 0,
        "done": 0,
        "error": 0,
    }

    for paper in papers:
        paper_status = paper.get("status", "uploaded")
        if paper_status in stats:
            stats[paper_status] += 1

    return StatusStats(**stats)


@router.post("", response_model=PaperInfo)
async def create_paper(paper_create: PaperCreate):
    """
    创建论文记录

    POST /api/v1/papers

    Args:
        paper_create: 论文创建信息

    Returns:
        PaperInfo: 创建的论文信息
    """
    # 检查是否已存在
    existing = get_paper_by_oss_key(paper_create.oss_key)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="论文已存在"
        )

    # 创建新论文记录
    paper_data = {
        "oss_key": paper_create.oss_key,
        "oss_url": paper_create.oss_url,
        "filename": paper_create.filename,
        "size": paper_create.size,
        "status": "uploaded",
        "uploaded_at": datetime.now().isoformat(),
    }

    papers = load_papers()
    papers.append(paper_data)
    save_papers(papers)

    return PaperInfo(**paper_data)


@router.post("/batch", response_model=List[PaperInfo])
async def create_papers_batch(papers_create: List[PaperCreate]):
    """
    批量创建论文记录

    POST /api/v1/papers/batch

    Args:
        papers_create: 论文创建信息列表

    Returns:
        List[PaperInfo]: 创建的论文信息列表
    """
    papers = load_papers()
    papers_dict = {p.get("oss_key"): p for p in papers}
    created_papers = []

    for paper_create in papers_create:
        # 如果已存在，跳过
        if paper_create.oss_key in papers_dict:
            created_papers.append(PaperInfo(**papers_dict[paper_create.oss_key]))
            continue

        # 创建新论文记录
        paper_data = {
            "oss_key": paper_create.oss_key,
            "oss_url": paper_create.oss_url,
            "filename": paper_create.filename,
            "size": paper_create.size,
            "status": "uploaded",
            "uploaded_at": datetime.now().isoformat(),
        }
        papers.append(paper_data)
        created_papers.append(PaperInfo(**paper_data))

    save_papers(papers)
    return created_papers
