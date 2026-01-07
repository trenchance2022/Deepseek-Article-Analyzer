"""MinerU API 客户端"""

import httpx
from typing import Optional, Dict, List, Any
from config import settings
from src.core.logger import logger


class MinerUClient:
    """MinerU API 客户端"""

    def __init__(self):
        """初始化 MinerU 客户端"""
        if not settings.MINERU_API_TOKEN:
            raise ValueError("MinerU API Token 未配置，请检查环境变量 MINERU_API_TOKEN")

        self.base_url = settings.MINERU_API_BASE_URL
        self.token = settings.MINERU_API_TOKEN
        self.headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.token}",
        }

    def create_task(
        self,
        url: str,
        model_version: str = "vlm",
        data_id: Optional[str] = None,
        enable_formula: bool = True,
        enable_table: bool = True,
        language: str = "ch",
        is_ocr: bool = False,
        page_ranges: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        创建单个文件解析任务

        Args:
            url: 文件URL（OSS URL）
            model_version: 模型版本，pipeline 或 vlm，默认 vlm
            data_id: 数据ID，可选
            enable_formula: 是否开启公式识别，默认 True
            enable_table: 是否开启表格识别，默认 True
            language: 文档语言，默认 ch
            is_ocr: 是否启动OCR，默认 False
            page_ranges: 页码范围，如 "1-600"

        Returns:
            dict: 包含 task_id 的响应数据
        """
        endpoint = f"{self.base_url}/extract/task"

        payload = {
            "url": url,
            "model_version": model_version,
            "enable_formula": enable_formula,
            "enable_table": enable_table,
            "language": language,
            "is_ocr": is_ocr,
        }

        if data_id:
            payload["data_id"] = data_id
        if page_ranges:
            payload["page_ranges"] = page_ranges

        try:
            logger.debug(f"创建 MinerU 任务: url={url}, model_version={model_version}")
            with httpx.Client(timeout=30.0) as client:
                response = client.post(endpoint, headers=self.headers, json=payload)
                response.raise_for_status()
                result = response.json()

                if result.get("code") != 0:
                    error_msg = result.get("msg", "未知错误")
                    logger.error(f"MinerU API 错误: {error_msg}")
                    raise Exception(f"MinerU API 错误: {error_msg}")

                task_data = result.get("data", {})
                task_id = task_data.get("task_id", "")
                logger.info(f"MinerU 任务创建成功: task_id={task_id}, url={url}")
                return task_data
        except httpx.HTTPError as e:
            logger.error(f"MinerU API 请求失败: {e}", exc_info=True)
            raise Exception(f"MinerU API 请求失败: {str(e)}")

    def get_task_status(self, task_id: str) -> Dict[str, Any]:
        """
        查询任务状态

        Args:
            task_id: 任务ID

        Returns:
            dict: 任务状态信息
        """
        endpoint = f"{self.base_url}/extract/task/{task_id}"

        try:
            with httpx.Client(timeout=30.0) as client:
                response = client.get(endpoint, headers=self.headers)
                response.raise_for_status()
                result = response.json()

                if result.get("code") != 0:
                    raise Exception(f"MinerU API 错误: {result.get('msg', '未知错误')}")

                return result.get("data", {})
        except httpx.HTTPError as e:
            raise Exception(f"MinerU API 请求失败: {str(e)}")

    def create_batch_tasks(
        self,
        files: List[Dict[str, str]],
        model_version: str = "vlm",
        enable_formula: bool = True,
        enable_table: bool = True,
        language: str = "ch",
    ) -> Dict[str, Any]:
        """
        批量创建解析任务（URL方式）

        Args:
            files: 文件列表，每个文件包含 url 和可选的 data_id
            model_version: 模型版本，默认 vlm
            enable_formula: 是否开启公式识别，默认 True
            enable_table: 是否开启表格识别，默认 True
            language: 文档语言，默认 ch

        Returns:
            dict: 包含 batch_id 的响应数据
        """
        endpoint = f"{self.base_url}/extract/task/batch"

        payload = {
            "files": files,
            "model_version": model_version,
            "enable_formula": enable_formula,
            "enable_table": enable_table,
            "language": language,
        }

        try:
            logger.debug(f"批量创建 MinerU 任务: 文件数={len(files)}")
            with httpx.Client(timeout=30.0) as client:
                response = client.post(endpoint, headers=self.headers, json=payload)
                response.raise_for_status()
                result = response.json()

                if result.get("code") != 0:
                    error_msg = result.get("msg", "未知错误")
                    logger.error(f"MinerU API 错误: {error_msg}")
                    raise Exception(f"MinerU API 错误: {error_msg}")

                batch_data = result.get("data", {})
                batch_id = batch_data.get("batch_id", "")
                logger.info(
                    f"MinerU 批量任务创建成功: batch_id={batch_id}, 文件数={len(files)}"
                )
                return batch_data
        except httpx.HTTPError as e:
            logger.error(f"MinerU API 请求失败: {e}", exc_info=True)
            raise Exception(f"MinerU API 请求失败: {str(e)}")

    def get_batch_results(self, batch_id: str) -> Dict[str, Any]:
        """
        批量查询任务结果

        Args:
            batch_id: 批量任务ID

        Returns:
            dict: 批量任务结果
        """
        endpoint = f"{self.base_url}/extract-results/batch/{batch_id}"

        try:
            logger.debug(f"查询 MinerU 批量任务结果: batch_id={batch_id}")
            with httpx.Client(timeout=30.0) as client:
                response = client.get(endpoint, headers=self.headers)
                response.raise_for_status()
                result = response.json()

                if result.get("code") != 0:
                    error_msg = result.get("msg", "未知错误")
                    logger.error(f"MinerU API 错误: batch_id={batch_id}, {error_msg}")
                    raise Exception(f"MinerU API 错误: {error_msg}")

                return result.get("data", {})
        except httpx.HTTPError as e:
            logger.error(
                f"MinerU API 请求失败: batch_id={batch_id}, {e}", exc_info=True
            )
            raise Exception(f"MinerU API 请求失败: {str(e)}")

    def wait_for_task_completion(
        self,
        task_id: str,
        max_wait_time: int = 300,
        poll_interval: int = 5,
    ) -> Dict[str, Any]:
        """
        等待任务完成（轮询）

        Args:
            task_id: 任务ID
            max_wait_time: 最大等待时间（秒），默认300秒
            poll_interval: 轮询间隔（秒），默认5秒

        Returns:
            dict: 任务完成后的结果
        """
        import time

        start_time = time.time()

        while True:
            status = self.get_task_status(task_id)
            state = status.get("state")

            if state == "done":
                return status
            elif state == "failed":
                err_msg = status.get("err_msg", "解析失败")
                raise Exception(f"MinerU 解析失败: {err_msg}")

            # 检查超时
            if time.time() - start_time > max_wait_time:
                raise Exception(f"任务等待超时（超过{max_wait_time}秒）")

            # 等待后继续轮询
            time.sleep(poll_interval)


# 全局客户端实例
_mineru_client: Optional[MinerUClient] = None


def get_mineru_client() -> MinerUClient:
    """获取 MinerU 客户端实例（单例模式）"""
    global _mineru_client
    if _mineru_client is None:
        _mineru_client = MinerUClient()
    return _mineru_client
