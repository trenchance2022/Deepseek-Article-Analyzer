"""DeepSeek 分析业务逻辑服务"""

import asyncio
from pathlib import Path
from typing import Dict, Any, Optional
from src.core.clients import get_deepseek_client
from src.services.storage_service import get_paper_by_oss_key, update_paper, WORKING_DIR
from src.core.logger import logger
import os

# 预定义的问题列表
ANALYSIS_QUESTIONS = {
    "abstract": "请提取abstract部分并翻译为中文",
    "introduction": "请提取introduction部分并翻译为中文",
    # "conclusion": "请提取conclusion部分并翻译成中文",
    # "problem_modeling": "这篇论文的问题建模是什么，主要解决了什么问题",
    # "algorithm": "这篇论文的算法思路是什么样的，请你帮我解释一下",
    # "summary": "讲讲这篇论文说了什么",
}


async def analyze_paper(oss_key: str) -> Dict[str, str]:
    """
    分析论文（异步）

    Args:
        oss_key: OSS 对象键

    Returns:
        dict: 包含所有问题答案的字典，键为问题标识，值为回答内容
    """
    logger.info(f"开始分析论文: {oss_key}")

    # 获取论文信息
    paper = get_paper_by_oss_key(oss_key)
    if not paper:
        logger.error(f"论文不存在: {oss_key}")
        raise ValueError(f"论文不存在: {oss_key}")

    # 检查论文状态
    if paper.get("status") != "extracted":
        logger.warning(
            f"论文状态不正确，无法开始分析: {oss_key}, 状态: {paper.get('status')}"
        )
        raise ValueError(f"论文状态不正确，无法开始分析: {paper.get('status')}")

    # 检查是否有 markdown 文件
    markdown_path = paper.get("markdown_path")
    if not markdown_path:
        logger.error(f"论文没有 markdown 文件: {oss_key}")
        raise ValueError("论文没有 markdown 文件")

    # 构建完整路径
    markdown_path_normalized = markdown_path.replace("\\", "/")
    if Path(markdown_path_normalized).is_absolute():
        full_path = Path(markdown_path_normalized)
    else:
        full_path = WORKING_DIR / markdown_path_normalized

    if not full_path.exists():
        logger.error(f"Markdown 文件不存在: {full_path}")
        raise ValueError("Markdown 文件不存在")

    # 读取 markdown 内容
    logger.debug(f"读取 Markdown 文件: {full_path}")
    try:
        with open(full_path, "r", encoding="utf-8") as f:
            markdown_content = f.read()
    except Exception as e:
        logger.error(f"读取 Markdown 文件失败: {full_path}, 错误: {e}")
        raise ValueError(f"读取 Markdown 文件失败: {str(e)}")

    logger.info(f"Markdown 文件读取成功，内容长度: {len(markdown_content)} 字符")

    # 更新状态为分析中
    update_paper(oss_key, {"status": "analyzing"})
    logger.debug(f"论文状态已更新为 analyzing: {oss_key}")

    # 获取 DeepSeek 客户端
    deepseek_client = get_deepseek_client()
    client = deepseek_client.get_client()

    # 分析结果字典
    analysis_results: Dict[str, str] = {}

    # 逐个问题进行分析（每个问题都是独立的对话）
    for question_key, question_text in ANALYSIS_QUESTIONS.items():
        logger.info(f"分析问题 [{question_key}]: {oss_key}")

        try:
            # 构建完整的用户消息（包含论文内容和问题）
            user_message = f"""以下是一篇学术论文的 Markdown 内容：

{markdown_content}

问题：{question_text}"""

            # 调用 DeepSeek API（每次都是独立的对话，不保留历史）
            # 使用 asyncio.to_thread 将同步调用放到线程池，避免阻塞事件循环
            def _call_deepseek_api():
                """同步调用 DeepSeek API（在线程池中执行）"""
                return client.chat.completions.create(
                    model="deepseek-reasoner",
                    messages=[
                        {
                            "role": "system",
                            "content": "你是一个专业的学术论文分析助手，擅长理解和分析学术论文内容。",
                        },
                        {"role": "user", "content": user_message},
                    ],
                    stream=False,
                    extra_body={"thinking": {"type": "enabled"}},
                    max_tokens=65536,  # 64K tokens
                )

            # 在线程池中执行同步调用，不阻塞事件循环
            response = await asyncio.to_thread(_call_deepseek_api)

            # 提取回答内容
            answer = response.choices[0].message.content
            analysis_results[question_key] = answer

            logger.info(
                f"问题 [{question_key}] 分析完成: {oss_key}, 回答长度: {len(answer)} 字符"
            )

            # 短暂延迟，避免 API 限流
            await asyncio.sleep(1)

        except Exception as e:
            logger.error(
                f"分析问题 [{question_key}] 失败: {oss_key}, 错误: {e}", exc_info=True
            )
            # 如果某个问题失败，记录错误但继续处理其他问题
            analysis_results[question_key] = f"分析失败: {str(e)}"

    # 保存分析结果到 JSON 文件
    from datetime import datetime
    import json

    # 获取 markdown 文件的目录
    markdown_dir = full_path.parent

    # 分析结果文件路径（相对于 working_dir）
    analysis_results_file = markdown_dir / "analysis_results.json"

    # 保存分析结果到文件
    try:
        with open(analysis_results_file, "w", encoding="utf-8") as f:
            json.dump(analysis_results, f, ensure_ascii=False, indent=2)
        logger.info(f"分析结果已保存到文件: {analysis_results_file}")
    except Exception as e:
        logger.error(f"保存分析结果文件失败: {analysis_results_file}, 错误: {e}")
        raise ValueError(f"保存分析结果文件失败: {str(e)}")

    # 计算相对于 working_dir 的路径
    try:
        analysis_results_path = analysis_results_file.relative_to(WORKING_DIR)
        # 转换为使用正斜杠的字符串路径（跨平台兼容）
        analysis_results_path_str = str(analysis_results_path).replace("\\", "/")
    except ValueError:
        # 如果不在 working_dir 下，使用绝对路径（不应该发生，但为了安全）
        analysis_results_path_str = str(analysis_results_file)
        logger.warning(
            f"分析结果文件不在 working_dir 下，使用绝对路径: {analysis_results_path_str}"
        )

    # 更新论文状态为已完成，保存分析结果文件路径
    update_paper(
        oss_key,
        {
            "status": "done",
            "analysis_results_path": analysis_results_path_str,  # 保存分析结果文件路径
            "analyzed_at": datetime.now().isoformat(),
        },
    )

    logger.info(
        f"论文分析完成: {oss_key}, 共分析 {len(analysis_results)} 个问题，结果保存在: {analysis_results_path_str}"
    )

    return analysis_results


async def process_analysis(oss_key: str):
    """
    处理分析流程（后台任务）

    Args:
        oss_key: OSS 对象键
    """
    try:
        await analyze_paper(oss_key)
    except Exception as e:
        # 更新为错误状态
        logger.error(f"论文分析失败: {oss_key}, 错误: {e}", exc_info=True)
        update_paper(oss_key, {"status": "error", "error": str(e)})
