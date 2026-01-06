"""阿里云OSS服务"""

import os
import uuid
from datetime import datetime
from typing import Optional
import oss2
from src.core.config import settings


class OSSService:
    """阿里云OSS服务类"""

    def __init__(self):
        """初始化OSS客户端"""
        if not all(
            [
                settings.OSS_ACCESS_KEY_ID,
                settings.OSS_ACCESS_KEY_SECRET,
                settings.OSS_BUCKET_NAME,
                settings.OSS_ENDPOINT,
            ]
        ):
            raise ValueError("OSS配置不完整，请检查环境变量")

        # 创建认证对象
        auth = oss2.Auth(settings.OSS_ACCESS_KEY_ID, settings.OSS_ACCESS_KEY_SECRET)

        # 创建Bucket对象
        self.bucket = oss2.Bucket(auth, settings.OSS_ENDPOINT, settings.OSS_BUCKET_NAME)

        self.bucket_name = settings.OSS_BUCKET_NAME

    def upload_file(
        self, file_content: bytes, filename: str, folder: str = "papers"
    ) -> dict:
        """
        上传文件到OSS

        Args:
            file_content: 文件内容（字节）
            filename: 原始文件名
            folder: OSS中的文件夹路径，默认为 "papers"

        Returns:
            dict: 包含 oss_key, oss_url 等信息
        """
        # 生成唯一的文件key
        file_ext = os.path.splitext(filename)[1]  # 获取文件扩展名
        unique_filename = f"{uuid.uuid4()}{file_ext}"
        oss_key = f"{folder}/{datetime.now().strftime('%Y%m%d')}/{unique_filename}"

        try:
            # 上传文件
            result = self.bucket.put_object(oss_key, file_content)

            # 构建文件URL
            if settings.OSS_ENDPOINT.startswith("http"):
                # 如果endpoint包含协议，直接使用
                base_url = settings.OSS_ENDPOINT.replace("http://", "https://")
            else:
                # 否则构建标准URL
                base_url = f"https://{self.bucket_name}.{settings.OSS_ENDPOINT}"

            oss_url = f"{base_url}/{oss_key}"

            return {
                "oss_key": oss_key,
                "oss_url": oss_url,
                "filename": filename,
                "size": len(file_content),
                "etag": result.etag,
            }
        except Exception as e:
            raise Exception(f"OSS上传失败: {str(e)}")

    def delete_file(self, oss_key: str) -> bool:
        """
        删除OSS中的文件

        Args:
            oss_key: OSS对象键

        Returns:
            bool: 删除是否成功
        """
        try:
            self.bucket.delete_object(oss_key)
            return True
        except Exception as e:
            raise Exception(f"OSS删除失败: {str(e)}")

    def file_exists(self, oss_key: str) -> bool:
        """
        检查文件是否存在

        Args:
            oss_key: OSS对象键

        Returns:
            bool: 文件是否存在
        """
        try:
            return self.bucket.object_exists(oss_key)
        except Exception:
            return False

    def get_file_url(self, oss_key: str, expires: int = 3600) -> str:
        """
        生成文件的临时访问URL（带签名）

        Args:
            oss_key: OSS对象键
            expires: URL有效期（秒），默认1小时

        Returns:
            str: 临时访问URL
        """
        try:
            url = self.bucket.sign_url("GET", oss_key, expires)
            return url
        except Exception as e:
            raise Exception(f"生成临时URL失败: {str(e)}")


# 全局OSS服务实例
_oss_service: Optional[OSSService] = None


def get_oss_service() -> OSSService:
    """获取OSS服务实例（单例模式）"""
    global _oss_service
    if _oss_service is None:
        _oss_service = OSSService()
    return _oss_service
