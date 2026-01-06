"""文件下载和解压相关API接口"""

import os
import zipfile
import httpx
from fastapi import APIRouter, HTTPException, status
from pathlib import Path
from typing import Optional
from pydantic import BaseModel

router = APIRouter(prefix="/files", tags=["files"])

# working_dir 路径（相对于项目根目录）
import os

WORKING_DIR = (
    Path(
        os.path.dirname(
            os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__))))
        )
    )
    / "working_dir"
)
WORKING_DIR.mkdir(exist_ok=True, parents=True)


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


@router.get("/markdown/{task_id}")
async def get_markdown(task_id: str):
    """
    获取指定任务的 Markdown 内容

    Args:
        task_id: 任务ID

    Returns:
        dict: 包含 markdown 内容
    """
    try:
        task_dir = WORKING_DIR / task_id

        # 查找 full.md 文件
        markdown_path = None
        for root, dirs, files in os.walk(task_dir):
            if "full.md" in files:
                markdown_path = os.path.join(root, "full.md")
                break

        if not markdown_path or not os.path.exists(markdown_path):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Markdown 文件不存在",
            )

        with open(markdown_path, "r", encoding="utf-8") as f:
            content = f.read()

        return {"task_id": task_id, "content": content}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"读取文件失败: {str(e)}",
        )
