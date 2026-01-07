"""文件操作API接口（OSS文件上传、删除）"""

import os
import zipfile
import httpx
from fastapi import APIRouter, UploadFile, File, HTTPException, status
from pathlib import Path
from typing import List, Optional
from pydantic import BaseModel
from src.core.clients import get_oss_client
from src.services.storage_service import load_papers, save_papers
from datetime import datetime

router = APIRouter(prefix="/files", tags=["files"])

# working_dir 路径（相对于项目根目录）
WORKING_DIR = (
    Path(
        os.path.dirname(
            os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__))))
        )
    )
    / "working_dir"
)
WORKING_DIR.mkdir(exist_ok=True, parents=True)


class UploadResponse(BaseModel):
    """上传响应模型"""

    oss_key: str
    oss_url: str
    filename: str
    size: int


class DeleteResponse(BaseModel):
    """删除响应模型"""

    success: bool
    message: str


class DownloadAndExtractRequest(BaseModel):
    """下载和解压请求模型"""

    zip_url: str
    task_id: str


class DownloadAndExtractResponse(BaseModel):
    """下载和解压响应模型"""

    success: bool
    task_dir: str
    markdown_path: str
    message: str


@router.post("", response_model=UploadResponse)
async def upload_file(file: UploadFile = File(...)):
    """
    上传PDF文件到OSS

    Args:
        file: 上传的文件

    Returns:
        UploadResponse: 包含OSS key和URL等信息
    """
    # 验证文件类型
    if not file.filename.endswith(".pdf"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="只支持PDF文件"
        )

    try:
        # 读取文件内容
        file_content = await file.read()

        # 验证文件大小（例如：最大100MB）
        max_size = 100 * 1024 * 1024  # 100MB
        if len(file_content) > max_size:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"文件大小超过限制（最大{max_size / 1024 / 1024}MB）",
            )

        # 上传到OSS
        oss_client = get_oss_client()
        result = oss_client.upload_file(file_content, file.filename)

        # 自动创建论文记录
        papers = load_papers()
        papers_dict = {p.get("oss_key"): p for p in papers}

        if result["oss_key"] not in papers_dict:
            paper_data = {
                "oss_key": result["oss_key"],
                "oss_url": result["oss_url"],
                "filename": result["filename"],
                "size": result["size"],
                "status": "uploaded",
                "uploaded_at": datetime.now().isoformat(),
            }
            papers.append(paper_data)
            save_papers(papers)

        return UploadResponse(
            oss_key=result["oss_key"],
            oss_url=result["oss_url"],
            filename=result["filename"],
            size=result["size"],
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"OSS配置错误: {str(e)}",
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"上传失败: {str(e)}",
        )


@router.post("/batch", response_model=List[UploadResponse])
async def upload_files(files: List[UploadFile] = File(...)):
    """
    批量上传PDF文件到OSS

    Args:
        files: 上传的文件列表

    Returns:
        List[UploadResponse]: 上传结果列表
    """
    if not files:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="请至少上传一个文件"
        )

    results = []
    errors = []

    try:
        oss_client = get_oss_client()

        for file in files:
            try:
                # 验证文件类型
                if not file.filename.endswith(".pdf"):
                    errors.append(f"{file.filename}: 只支持PDF文件")
                    continue

                # 读取文件内容
                file_content = await file.read()

                # 验证文件大小
                max_size = 100 * 1024 * 1024  # 100MB
                if len(file_content) > max_size:
                    errors.append(f"{file.filename}: 文件大小超过限制")
                    continue

                # 上传到OSS
                result = oss_client.upload_file(file_content, file.filename)
                results.append(
                    UploadResponse(
                        oss_key=result["oss_key"],
                        oss_url=result["oss_url"],
                        filename=result["filename"],
                        size=result["size"],
                    )
                )
            except Exception as e:
                errors.append(f"{file.filename}: {str(e)}")

        # 批量创建论文记录
        if results:
            papers = load_papers()
            papers_dict = {p.get("oss_key"): p for p in papers}

            for result in results:
                if result.oss_key not in papers_dict:
                    paper_data = {
                        "oss_key": result.oss_key,
                        "oss_url": result.oss_url,
                        "filename": result.filename,
                        "size": result.size,
                        "status": "uploaded",
                        "uploaded_at": datetime.now().isoformat(),
                    }
                    papers.append(paper_data)

            if papers:
                save_papers(papers)

        if not results and errors:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"所有文件上传失败: {'; '.join(errors)}",
            )

        return results
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"OSS配置错误: {str(e)}",
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"批量上传失败: {str(e)}",
        )


# 注意：路由顺序很重要！固定路径必须放在通用路径参数路由之前
# 否则 FastAPI 可能会先匹配到通用路由，导致路径解析错误


@router.post("/download-extract", response_model=DownloadAndExtractResponse)
async def download_and_extract(request: DownloadAndExtractRequest):
    """
    下载 ZIP 文件并解压

    Args:
        request: 包含 zip_url 和 task_id 的请求

    Returns:
        DownloadAndExtractResponse: 解压结果，包含 markdown 文件路径
    """
    try:
        # 创建任务目录
        task_dir = WORKING_DIR / request.task_id
        task_dir.mkdir(exist_ok=True)

        zip_path = task_dir / f"{request.task_id}.zip"

        # 下载 ZIP 文件
        async with httpx.AsyncClient(timeout=300.0) as client:
            response = await client.get(request.zip_url)
            response.raise_for_status()

            with open(zip_path, "wb") as f:
                f.write(response.content)

        # 解压 ZIP 文件
        with zipfile.ZipFile(zip_path, "r") as zip_ref:
            zip_ref.extractall(task_dir)

        # 查找 full.md 文件
        markdown_path = None
        for root, dirs, files in os.walk(task_dir):
            if "full.md" in files:
                markdown_path = os.path.join(root, "full.md")
                break

        if not markdown_path:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="解压后未找到 full.md 文件",
            )

        return DownloadAndExtractResponse(
            success=True,
            task_dir=str(task_dir),
            markdown_path=markdown_path,
            message="下载和解压成功",
        )
    except httpx.HTTPError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"下载文件失败: {str(e)}",
        )
    except zipfile.BadZipFile:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="ZIP 文件格式错误",
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"处理失败: {str(e)}",
        )


# 通用路由放在最后（固定路径已经在上面定义）
@router.delete("/{oss_key:path}", response_model=DeleteResponse)
async def delete_file(oss_key: str):
    """
    删除OSS中的文件

    Args:
        oss_key: OSS对象键（路径）

    Returns:
        DeleteResponse: 删除结果
    """
    # URL 解码 oss_key（如果被编码了）
    from urllib.parse import unquote

    oss_key = unquote(oss_key)

    if not oss_key:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="oss_key不能为空"
        )

    try:
        oss_client = get_oss_client()

        # 检查文件是否存在
        if not oss_client.file_exists(oss_key):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="文件不存在"
            )

        # 删除文件
        success = oss_client.delete_file(oss_key)

        if success:
            return DeleteResponse(success=True, message="文件删除成功")
        else:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="文件删除失败"
            )
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"OSS配置错误: {str(e)}",
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"删除失败: {str(e)}",
        )


# 注意：已移除通过 task_id 获取 markdown 的接口
# 统一使用 /api/v1/papers/{oss_key}/markdown 接口
# 因为 oss_key 是唯一标识，一个 oss_key 对应一个论文，不会重复解析
