"""DeepSeek 分析业务逻辑服务"""

import asyncio
import re
from pathlib import Path
from typing import Dict, Any, Optional, List, Tuple
from src.core.clients import get_deepseek_client
from src.services.storage_service import get_paper_by_oss_key, update_paper, WORKING_DIR
from src.core.logger import logger
import os

# 预定义的问题列表
ANALYSIS_QUESTIONS = {
    # "abstract": "请提取abstract部分并翻译为中文",
    # "introduction": "请提取introduction部分并翻译为中文",
    # "conclusion": "请提取conclusion部分并翻译成中文",
    # "problem_modeling": "这篇论文的问题建模是什么，主要解决了什么问题",
    # "algorithm": "这篇论文的算法思路是什么样的，请你帮我解释一下",
    # "summary": "讲讲这篇论文说了什么",
}


def parse_markdown_sections(markdown_content: str) -> Dict[str, str]:
    """
    解析 markdown，按 # 标题分割成 {标题: 内容} 字典

    Args:
        markdown_content: 完整的 markdown 内容

    Returns:
        Dict[str, str]: {标题: 内容} 字典，标题包含 # 符号
    """
    sections = {}
    lines = markdown_content.split("\n")

    current_title = None
    current_content = []

    for line in lines:
        # 检查是否是标题行（以 # 开头）
        stripped = line.strip()
        if stripped.startswith("#"):
            # 保存上一章节
            if current_title is not None:
                sections[current_title] = "\n".join(current_content).strip()

            # 开始新章节
            current_title = stripped  # 保留原始格式，包括 # 和空格
            current_content = []
        else:
            # 添加到当前章节内容
            if current_title is not None:
                current_content.append(line)
            else:
                # 如果还没有遇到第一个标题，可能是文档开头的元信息，忽略或作为第一个章节
                if not stripped:  # 空行
                    continue
                # 将第一个非标题内容作为第一个章节（标题为空或使用文档标题）
                if current_title is None:
                    current_title = "# Document"
                    current_content = [line]

    # 保存最后一章节
    if current_title is not None:
        sections[current_title] = "\n".join(current_content).strip()

    return sections


def identify_formula_blocks(content: str) -> List[str]:
    """
    识别内容中的所有公式块（$$...$$）

    Args:
        content: 文本内容

    Returns:
        List[str]: 公式块列表（包含 $$）
    """
    # 匹配块级公式 $$...$$（可能跨多行）
    pattern = r"\$\$[\s\S]*?\$\$"
    formulas = re.findall(pattern, content)
    return formulas


async def translate_section(title: str, content: str, client: Any) -> str:
    """
    翻译单个章节内容

    Args:
        title: 章节标题（包含 #）
        content: 章节内容
        client: DeepSeek 客户端

    Returns:
        str: 翻译后的内容（包含公式和解释）
    """
    if not content.strip():
        # 如果内容为空，只返回标题
        return ""

    # 识别公式块（用于验证）
    formulas = identify_formula_blocks(content)

    # 构建翻译 prompt
    translation_prompt = f"""你是一个专业的学术论文翻译助手。请将以下英文学术论文内容翻译成中文。

**翻译要求**：
1. 将英文内容翻译成中文，保持学术论文的严谨性和专业性
2. 专业术语保留英文并用括号标注，例如：机器学习（Machine Learning）
3. 人名、地名、机构名等专有名词保留英文
4. **重要**：对于数学公式块（以 $$ 开头和结尾的块），请原样保留，不要翻译，不要修改，不要移动位置
5. 保持原文的段落结构和格式（包括换行）
6. 翻译要准确、流畅、符合中文表达习惯

**原文内容**：
{content}

**特别要求**：
- 如果内容中包含 $$...$$ 公式块，请原样保留在翻译结果中的原位置
- 在翻译内容的最后，添加一个"**公式解释**"部分，对内容中出现的每个公式进行解释
- 公式解释格式：
  - 先列出完整的公式（$$...$$）
  - 然后解释公式中每个符号的含义
  - 说明公式的物理意义或数学意义
  - 用中文解释，语言要清晰易懂
- 如果内容中没有公式，则不需要添加公式解释部分
- 公式解释部分与翻译内容之间用空行分隔

请开始翻译："""

    try:
        # 调用 DeepSeek API
        def _call_deepseek_api():
            """同步调用 DeepSeek API（在线程池中执行）"""
            return client.chat.completions.create(
                model="deepseek-reasoner",
                messages=[
                    {
                        "role": "system",
                        "content": "你是一个专业的学术论文翻译助手，擅长将英文学术论文翻译成中文，并解释数学公式。",
                    },
                    {"role": "user", "content": translation_prompt},
                ],
                stream=False,
                extra_body={"thinking": {"type": "enabled"}},
                max_tokens=65536,  # 64K tokens
            )

        # 在线程池中执行同步调用
        response = await asyncio.to_thread(_call_deepseek_api)
        translated_content = response.choices[0].message.content

        # 验证公式是否被保留
        translated_formulas = identify_formula_blocks(translated_content)
        if len(translated_formulas) < len(formulas):
            # 如果公式没有被完全保留，尝试手动插入
            logger.warning(
                f"章节 {title} 的公式可能未被完全保留，原始公式数: {len(formulas)}, 翻译后公式数: {len(translated_formulas)}"
            )
            # 这里可以添加手动插入公式的逻辑，但为了简单起见，先记录警告

        return translated_content

    except Exception as e:
        logger.error(f"翻译章节 {title} 失败: {e}", exc_info=True)
        # 翻译失败时返回错误标记
        return f"[翻译失败: {str(e)}]\n\n原文：\n{content}"


async def translate_full_paper(markdown_content: str, client: Any) -> str:
    """
    翻译整篇论文（并行翻译，每批次最多5个章节）

    Args:
        markdown_content: 完整的 markdown 内容
        client: DeepSeek 客户端

    Returns:
        str: 翻译后的完整 markdown 内容
    """
    logger.info("开始解析 markdown 结构...")
    sections = parse_markdown_sections(markdown_content)
    logger.info(f"解析完成，共 {len(sections)} 个章节")

    # 将字典转换为列表，保持顺序
    sections_list = list(sections.items())

    # 使用 Semaphore 控制并发数（最多5个）
    semaphore = asyncio.Semaphore(5)

    async def translate_with_semaphore(
        index: int, title: str, content: str
    ) -> Tuple[int, str]:
        """
        带信号量控制的翻译函数，返回 (索引, 翻译结果)
        这样可以保持原始顺序
        """
        async with semaphore:
            logger.info(f"开始翻译章节 {index + 1}/{len(sections_list)}: {title}")
            try:
                # 翻译章节内容
                translated_content = await translate_section(title, content, client)

                # 组合标题和翻译内容
                if translated_content.strip():
                    translated_section = f"{title}\n\n{translated_content}"
                else:
                    # 如果内容为空，只保留标题
                    translated_section = title

                logger.info(f"完成翻译章节 {index + 1}/{len(sections_list)}: {title}")
                return (index, translated_section)
            except Exception as e:
                logger.error(f"翻译章节 {index + 1} ({title}) 失败: {e}", exc_info=True)
                # 翻译失败时返回错误标记
                error_section = f"{title}\n\n[翻译失败: {str(e)}]"
                return (index, error_section)

    # 创建所有翻译任务
    tasks = [
        translate_with_semaphore(i, title, content)
        for i, (title, content) in enumerate(sections_list)
    ]

    # 并行执行所有任务
    logger.info(f"开始并行翻译，最多同时翻译 5 个章节...")
    results = await asyncio.gather(*tasks)

    # 按原始索引排序，确保顺序一致
    results.sort(key=lambda x: x[0])

    # 提取翻译结果（已按顺序）
    translated_sections = [result[1] for result in results]

    # 组合所有章节
    full_translation = "\n\n".join(translated_sections)
    logger.info(f"全文翻译完成，总长度: {len(full_translation)} 字符")

    return full_translation


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

    # 首先进行全文翻译
    logger.info(f"开始全文翻译: {oss_key}")
    try:
        full_translation = await translate_full_paper(markdown_content, client)
        analysis_results["full_translation"] = full_translation
        logger.info(f"全文翻译完成: {oss_key}, 长度: {len(full_translation)} 字符")
    except Exception as e:
        logger.error(f"全文翻译失败: {oss_key}, 错误: {e}", exc_info=True)
        # 翻译失败不影响其他分析，记录错误但继续
        analysis_results["full_translation"] = f"全文翻译失败: {str(e)}"

    # 短暂延迟，避免 API 限流
    await asyncio.sleep(1)

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
