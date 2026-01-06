"""论文处理业务服务"""

from typing import Dict, List, Any, Optional
from src.core.clients import get_mineru_client, get_deepseek_client, get_oss_client


class PaperService:
    """论文处理业务服务类"""

    def __init__(self):
        """初始化服务"""
        self.oss_client = get_oss_client()
        self.mineru_client = get_mineru_client()
        self.deepseek_client = get_deepseek_client()

    def upload_and_parse(
        self,
        file_content: bytes,
        filename: str,
        model_version: str = "vlm",
    ) -> Dict[str, Any]:
        """
        上传文件到OSS并创建MinerU解析任务

        Args:
            file_content: 文件内容
            filename: 文件名
            model_version: MinerU模型版本

        Returns:
            dict: 包含 oss_url 和 task_id
        """
        # 1. 上传到OSS
        oss_result = self.oss_client.upload_file(file_content, filename)
        oss_url = oss_result["oss_url"]

        # 2. 创建MinerU解析任务
        mineru_result = self.mineru_client.create_task(
            url=oss_url,
            model_version=model_version,
        )

        return {
            "oss_key": oss_result["oss_key"],
            "oss_url": oss_url,
            "task_id": mineru_result.get("task_id"),
            "filename": filename,
        }

    def get_parse_result(self, task_id: str) -> Dict[str, Any]:
        """
        获取MinerU解析结果

        Args:
            task_id: MinerU任务ID

        Returns:
            dict: 解析结果，包含 state 和 full_zip_url
        """
        return self.mineru_client.get_task_status(task_id)

    def wait_for_parse_completion(
        self,
        task_id: str,
        max_wait_time: int = 300,
        poll_interval: int = 5,
    ) -> Dict[str, Any]:
        """
        等待解析完成

        Args:
            task_id: MinerU任务ID
            max_wait_time: 最大等待时间（秒）
            poll_interval: 轮询间隔（秒）

        Returns:
            dict: 完成后的结果
        """
        return self.mineru_client.wait_for_task_completion(
            task_id=task_id,
            max_wait_time=max_wait_time,
            poll_interval=poll_interval,
        )


# 全局服务实例
_paper_service: Optional[PaperService] = None


def get_paper_service() -> PaperService:
    """获取论文处理服务实例（单例模式）"""
    global _paper_service
    if _paper_service is None:
        _paper_service = PaperService()
    return _paper_service
