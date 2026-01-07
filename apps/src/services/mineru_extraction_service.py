"""MinerU 提取业务逻辑服务"""

import asyncio
import os
import zipfile
import httpx
from pathlib import Path
from typing import Optional
from src.core.clients import get_mineru_client, get_oss_client
from src.services.storage_service import get_paper_by_oss_key, update_paper
from src.core.logger import logger

# working_dir 路径
WORKING_DIR = (
    Path(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__)))))
    / "working_dir"
)
WORKING_DIR.mkdir(exist_ok=True, parents=True)


async def start_extraction(oss_key: str) -> dict:
    """
    开始提取流程（异步）

    Args:
        oss_key: OSS 对象键

    Returns:
        dict: 包含 task_id 等信息
    """
    logger.info(f"开始提取论文: {oss_key}")
    paper = get_paper_by_oss_key(oss_key)
    if not paper:
        logger.error(f"论文不存在: {oss_key}")
        raise ValueError(f"论文不存在: {oss_key}")

    if paper.get("status") != "uploaded":
        logger.warning(
            f"论文状态不正确，无法开始提取: {oss_key}, 状态: {paper.get('status')}"
        )
        raise ValueError(f"论文状态不正确，无法开始提取: {paper.get('status')}")

    # 更新状态为解析中
    update_paper(oss_key, {"status": "parsing"})
    logger.debug(f"论文状态已更新为 parsing: {oss_key}")

    # 创建 MinerU 任务
    mineru_client = get_mineru_client()
    logger.debug(f"创建 MinerU 任务: {oss_key}")
    task_data = mineru_client.create_task(
        url=paper["oss_url"],
        model_version="vlm",
    )

    task_id = task_data.get("task_id", "")
    update_paper(oss_key, {"task_id": task_id})
    logger.info(f"MinerU 任务已创建: {oss_key}, task_id: {task_id}")

    # 注意：后台任务由 FastAPI 的 BackgroundTasks 处理，不在这里启动
    return {"task_id": task_id, "oss_key": oss_key}


async def process_extraction(oss_key: str, task_id: str):
    """
    处理提取流程（后台任务）

    Args:
        oss_key: OSS 对象键
        task_id: MinerU 任务ID
    """
    try:
        mineru_client = get_mineru_client()

        # 轮询任务状态
        max_attempts = 300  # 最多轮询 50 分钟
        attempts = 0
        task_status = None

        while attempts < max_attempts:
            await asyncio.sleep(10)  # 等待 10 秒
            attempts += 1

            try:
                task_data = mineru_client.get_task_status(task_id)
                task_status = task_data

                state = task_data.get("state", "")
                logger.debug(
                    f"轮询任务状态: {oss_key}, task_id: {task_id}, state: {state}, attempts: {attempts}"
                )

                # 如果状态是 done，退出循环
                if state == "done":
                    logger.info(f"MinerU 任务完成: {oss_key}, task_id: {task_id}")
                    break

                # 如果状态是 error，抛出异常
                if state == "error":
                    err_msg = task_data.get("err_msg", "解析失败")
                    logger.error(
                        f"MinerU 解析失败: {oss_key}, task_id: {task_id}, 错误: {err_msg}"
                    )
                    raise Exception(f"MinerU 解析失败: {err_msg}")

            except Exception as e:
                # 继续轮询，除非是致命错误
                if attempts >= max_attempts:
                    logger.error(
                        f"轮询任务状态超时: {oss_key}, task_id: {task_id}, 错误: {e}"
                    )
                    raise e
                logger.warning(
                    f"轮询任务状态失败，继续重试: {oss_key}, task_id: {task_id}, 错误: {e}"
                )
                continue

        if not task_status:
            logger.error(f"无法获取任务状态: {oss_key}, task_id: {task_id}")
            raise Exception("无法获取任务状态")

        if task_status.get("state") != "done":
            logger.error(
                f"任务状态异常: {oss_key}, task_id: {task_id}, state: {task_status.get('state')}"
            )
            raise Exception(f"任务状态异常: {task_status.get('state')}")

        full_zip_url = task_status.get("full_zip_url")
        if not full_zip_url:
            logger.error(f"未获取到 ZIP 文件 URL: {oss_key}, task_id: {task_id}")
            raise Exception("未获取到 ZIP 文件 URL")

        # 更新状态为下载中
        update_paper(oss_key, {"status": "downloading"})
        logger.info(f"开始下载 ZIP 文件: {oss_key}, task_id: {task_id}")

        # 下载并解压
        task_dir = WORKING_DIR / task_id
        task_dir.mkdir(exist_ok=True)
        zip_path = task_dir / f"{task_id}.zip"

        logger.debug(f"下载 ZIP 文件: {oss_key}, url: {full_zip_url}")
        async with httpx.AsyncClient(timeout=300.0) as client:
            response = await client.get(full_zip_url)
            response.raise_for_status()
            with open(zip_path, "wb") as f:
                f.write(response.content)
        logger.debug(
            f"ZIP 文件下载完成: {oss_key}, 大小: {zip_path.stat().st_size} bytes"
        )

        logger.debug(f"解压 ZIP 文件: {oss_key}, task_id: {task_id}")
        with zipfile.ZipFile(zip_path, "r") as zip_ref:
            zip_ref.extractall(task_dir)
        logger.debug(f"ZIP 文件解压完成: {oss_key}, task_id: {task_id}")

        # 查找 full.md 文件路径
        markdown_path = None
        for root, dirs, files in os.walk(task_dir):
            if "full.md" in files:
                markdown_path = os.path.join(root, "full.md")
                break

        if not markdown_path:
            logger.error(f"解压后未找到 full.md 文件: {oss_key}, task_id: {task_id}")
            raise Exception("解压后未找到 full.md 文件")

        # 将路径转换为相对于 working_dir 的相对路径
        markdown_relative_path = os.path.relpath(markdown_path, WORKING_DIR)
        # 统一使用正斜杠作为路径分隔符（跨平台兼容）
        markdown_relative_path = markdown_relative_path.replace("\\", "/")
        logger.debug(f"找到 Markdown 文件: {oss_key}, 路径: {markdown_relative_path}")

        # 更新论文状态（只保存路径，不保存内容）
        from datetime import datetime

        update_paper(
            oss_key,
            {
                "status": "extracted",
                "markdown_path": markdown_relative_path,  # 保存相对路径
                "extracted_at": datetime.now().isoformat(),
            },
        )
        logger.info(f"论文提取完成: {oss_key}, task_id: {task_id}")

        # 删除 OSS 文件（但保留论文记录）
        try:
            oss_client = get_oss_client()
            if oss_client.file_exists(oss_key):
                oss_client.delete_file(oss_key)
                logger.info(f"已删除 OSS 文件: {oss_key}")
        except Exception as e:
            logger.error(f"删除 OSS 文件失败: {oss_key}, 错误: {e}")

    except Exception as e:
        # 更新为错误状态
        logger.error(
            f"论文提取失败: {oss_key}, task_id: {task_id}, 错误: {e}", exc_info=True
        )
        update_paper(oss_key, {"status": "error", "error": str(e)})


async def stop_extraction(oss_key: str) -> dict:
    """
    停止提取（将状态改回已上传）

    Args:
        oss_key: OSS 对象键

    Returns:
        dict: 操作结果
    """
    logger.info(f"停止提取: {oss_key}")
    paper = get_paper_by_oss_key(oss_key)
    if not paper:
        logger.error(f"论文不存在: {oss_key}")
        raise ValueError(f"论文不存在: {oss_key}")

    # 如果状态是 parsing 或 downloading，改回 uploaded
    if paper.get("status") in ["parsing", "downloading"]:
        update_paper(oss_key, {"status": "uploaded"})
        logger.info(f"已停止提取，状态已改回 uploaded: {oss_key}")
        return {"success": True, "message": "已停止提取"}

    logger.warning(
        f"论文不在提取状态，无法停止: {oss_key}, 状态: {paper.get('status')}"
    )
    return {"success": False, "message": "论文不在提取状态"}
