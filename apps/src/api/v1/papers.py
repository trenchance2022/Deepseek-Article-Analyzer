"""论文相关API接口"""

from fastapi import APIRouter, UploadFile, File, HTTPException, status
from typing import List
from src.core.clients import get_oss_client
from pydantic import BaseModel


router = APIRouter(prefix="/papers", tags=["papers"])


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


@router.delete("/{oss_key:path}", response_model=DeleteResponse)
async def delete_file(oss_key: str):
    """
    删除OSS中的文件

    Args:
        oss_key: OSS对象键（路径）

    Returns:
        DeleteResponse: 删除结果
    """
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
