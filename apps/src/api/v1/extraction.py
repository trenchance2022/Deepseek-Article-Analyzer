"""论文提取操作API（作为论文资源的子资源）"""

from fastapi import APIRouter, HTTPException, status, BackgroundTasks
from urllib.parse import unquote
from pathlib import Path
from src.services.mineru_extraction_service import (
    start_extraction,
    stop_extraction,
    process_extraction,
)
from src.services.storage_service import (
    get_paper_by_oss_key,
    WORKING_DIR,
)
from src.schema.papers import PaperInfo, PaperUpdate
from src.schema.extraction import (
    StartExtractionResponse,
    StopExtractionResponse,
)
from src.core.logger import logger
from src.services.storage_service import update_paper, delete_paper

# 注意：这个 router 需要作为 papers 的子路由注册
# 在 main.py 中使用 include_router(papers_router, prefix="/papers")
# 这样路径是 /api/v1/papers/{oss_key}/... 而不是 /api/v1/papers/papers/{oss_key}/...
router = APIRouter(tags=["papers"])


# 注意：路由顺序很重要！更具体的路由必须放在更通用的路由之前
# 否则 FastAPI 会先匹配到通用路由，导致路径解析错误


@router.post("/{oss_key:path}/extraction", response_model=StartExtractionResponse)
async def start_paper_extraction(oss_key: str, background_tasks: BackgroundTasks):
    """
    开始论文提取

    POST /api/v1/papers/{oss_key}/extraction

    Args:
        oss_key: OSS 对象键（可能包含斜杠）
        background_tasks: FastAPI 后台任务

    Returns:
        StartExtractionResponse: 包含 task_id 的响应
    """
    # URL 解码 oss_key
    oss_key = unquote(oss_key)

    try:
        result = await start_extraction(oss_key)
        task_id = result["task_id"]

        # 使用 FastAPI 的 BackgroundTasks 来运行后台任务
        background_tasks.add_task(process_extraction, oss_key, task_id)

        return StartExtractionResponse(
            task_id=task_id,
            oss_key=oss_key,
            message="提取任务已启动",
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"启动提取失败: {str(e)}",
        )


@router.delete("/{oss_key:path}/extraction", response_model=StopExtractionResponse)
async def stop_paper_extraction(oss_key: str):
    """
    停止论文提取

    DELETE /api/v1/papers/{oss_key}/extraction

    Args:
        oss_key: OSS 对象键（可能包含斜杠）

    Returns:
        StopExtractionResponse: 操作结果
    """
    # URL 解码 oss_key
    oss_key = unquote(oss_key)

    try:
        result = await stop_extraction(oss_key)
        return StopExtractionResponse(
            success=result["success"], message=result["message"]
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"停止提取失败: {str(e)}",
        )


@router.get("/{oss_key:path}/markdown")
async def get_paper_markdown(oss_key: str):
    """
    获取论文的 Markdown 内容

    GET /api/v1/papers/{oss_key}/markdown

    Args:
        oss_key: OSS 对象键（可能包含斜杠）

    Returns:
        dict: 包含 markdown 内容
    """
    # 记录原始接收到的 oss_key
    logger.debug(f"[Markdown] 原始接收到的 oss_key (未解码): {repr(oss_key)}")
    logger.debug(f"[Markdown] 原始接收到的 oss_key (字符串): {oss_key}")

    # URL 解码 oss_key
    oss_key_decoded = unquote(oss_key)
    logger.debug(f"[Markdown] URL 解码后的 oss_key: {repr(oss_key_decoded)}")
    logger.debug(f"[Markdown] URL 解码后的 oss_key (字符串): {oss_key_decoded}")

    # 统一使用正斜杠（处理可能的反斜杠问题）
    oss_key_normalized = oss_key_decoded.replace("\\", "/")
    logger.debug(f"[Markdown] 标准化后的 oss_key: {repr(oss_key_normalized)}")

    # get_paper_by_oss_key 现在支持正斜杠和反斜杠的灵活匹配
    paper = get_paper_by_oss_key(oss_key_normalized)
    if not paper:
        # 如果标准化后找不到，尝试用原始解码值
        paper = get_paper_by_oss_key(oss_key_decoded)
        if not paper:
            # 最后尝试用未解码的值
            paper = get_paper_by_oss_key(oss_key)

    if not paper:
        logger.error(
            f"[Markdown] 所有尝试都失败，论文不存在。"
            f"尝试的值: 标准化={repr(oss_key_normalized)}, "
            f"解码={repr(oss_key_decoded)}, 原始={repr(oss_key)}"
        )
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="论文不存在")

    # 使用找到的论文的原始 oss_key（保持数据库中的格式）
    final_oss_key = paper.get("oss_key", oss_key_normalized)
    logger.debug(f"[Markdown] 找到论文，使用的 oss_key: {repr(final_oss_key)}")

    markdown_path = paper.get("markdown_path")
    logger.debug(f"[Markdown] 论文的 markdown_path: {repr(markdown_path)}")
    if not markdown_path:
        logger.error(f"[Markdown] 论文没有 markdown_path: {repr(final_oss_key)}")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Markdown 文件不存在"
        )

    # 构建完整路径（使用 storage_service 中的 WORKING_DIR）
    markdown_path_normalized = markdown_path.replace("\\", "/")
    logger.debug(
        f"[Markdown] 标准化后的 markdown_path: {repr(markdown_path_normalized)}"
    )
    logger.debug(f"[Markdown] WORKING_DIR: {WORKING_DIR}")

    if Path(markdown_path_normalized).is_absolute():
        full_path = Path(markdown_path_normalized)
        logger.debug(f"[Markdown] 使用绝对路径: {full_path}")
    else:
        full_path = WORKING_DIR / markdown_path_normalized
        logger.debug(f"[Markdown] 使用相对路径，完整路径: {full_path}")

    logger.debug(f"[Markdown] 最终文件路径是否存在: {full_path.exists()}")
    if not full_path.exists():
        logger.error(f"[Markdown] 文件不存在: {full_path}")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Markdown 文件不存在"
        )

    try:
        logger.info(f"[Markdown] 成功读取文件: {full_path}")
        with open(full_path, "r", encoding="utf-8") as f:
            content = f.read()
        logger.debug(f"[Markdown] 文件内容长度: {len(content)} 字符")
        return {"oss_key": final_oss_key, "content": content}
    except Exception as e:
        logger.error(f"[Markdown] 读取文件失败: {full_path}, 错误: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"读取文件失败: {str(e)}",
        )


# 通用路由放在最后（更具体的路由已经在上面定义）
@router.get("/{oss_key:path}", response_model=PaperInfo)
async def get_paper(oss_key: str):
    """
    获取单个论文信息

    GET /api/v1/papers/{oss_key}

    Args:
        oss_key: OSS 对象键（可能包含斜杠，如 papers/20260107/xxx.pdf）

    Returns:
        PaperInfo: 论文信息
    """
    # URL 解码 oss_key
    oss_key = unquote(oss_key)

    paper = get_paper_by_oss_key(oss_key)
    if not paper:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="论文不存在")
    return PaperInfo(**paper)


@router.put("/{oss_key:path}", response_model=PaperInfo)
async def update_paper_info(oss_key: str, paper_update: PaperUpdate):
    """
    更新论文信息

    PUT /api/v1/papers/{oss_key}

    Args:
        oss_key: OSS 对象键（可能包含斜杠）
        paper_update: 更新信息

    Returns:
        PaperInfo: 更新后的论文信息
    """
    # URL 解码 oss_key
    oss_key = unquote(oss_key)

    paper = get_paper_by_oss_key(oss_key)
    if not paper:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="论文不存在")

    # 构建更新数据
    updates = {}
    if paper_update.status is not None:
        updates["status"] = paper_update.status
    if paper_update.task_id is not None:
        updates["task_id"] = paper_update.task_id
    if paper_update.markdown_path is not None:
        updates["markdown_path"] = paper_update.markdown_path
    if paper_update.error is not None:
        updates["error"] = paper_update.error
    if paper_update.extracted_at is not None:
        updates["extracted_at"] = paper_update.extracted_at

    # 更新论文
    update_paper(oss_key, updates)

    # 返回更新后的论文
    updated_paper = get_paper_by_oss_key(oss_key)
    return PaperInfo(**updated_paper)


@router.delete("/{oss_key:path}")
async def delete_paper_info(oss_key: str):
    """
    删除论文记录

    DELETE /api/v1/papers/{oss_key}

    Args:
        oss_key: OSS 对象键（可能包含斜杠）

    Returns:
        dict: 删除结果
    """
    # URL 解码 oss_key
    oss_key = unquote(oss_key)

    success = delete_paper(oss_key)
    if not success:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="论文不存在")
    return {"success": True, "message": "论文记录已删除"}
