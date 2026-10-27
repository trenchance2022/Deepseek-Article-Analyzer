"""论文批量导出服务"""

import io
import json
import zipfile
from datetime import datetime
from pathlib import Path
from typing import List, Tuple

from src.core.logger import logger
from src.services.storage_service import WORKING_DIR, get_paper_by_oss_key


def _strip_pdf_extension(filename: str) -> str:
    """去掉文件名末尾的 .pdf（不区分大小写）"""
    if filename.lower().endswith(".pdf"):
        return filename[:-4]
    return filename


def _resolve_paper_dir(paper: dict) -> Path | None:
    """根据论文记录定位本地任务目录"""
    markdown_path = paper.get("markdown_path")
    if markdown_path:
        md_path = Path(str(markdown_path).replace("\\", "/"))
        if md_path.is_absolute():
            paper_dir = md_path.parent
        else:
            paper_dir = WORKING_DIR / md_path.parent
        if paper_dir.exists():
            return paper_dir

    task_id = paper.get("task_id")
    if task_id:
        paper_dir = WORKING_DIR / task_id
        if paper_dir.exists():
            return paper_dir

    return None


def _unique_folder_name(base_name: str, used_names: set) -> str:
    """生成不重复的文件夹名"""
    if base_name not in used_names:
        return base_name
    index = 2
    while f"{base_name}_{index}" in used_names:
        index += 1
    return f"{base_name}_{index}"


def _add_directory_to_zip(zf: zipfile.ZipFile, source_dir: Path, arc_prefix: str) -> int:
    """将目录递归写入 zip，返回写入的文件数量"""
    added = 0
    for path in source_dir.rglob("*"):
        if path.is_file():
            relative = path.relative_to(source_dir).as_posix()
            zf.write(path, f"{arc_prefix}/{relative}")
            added += 1
    return added


def build_papers_export_zip(oss_keys: List[str]) -> Tuple[bytes, str]:
    """
    将选中论文打包为一个总 zip。

    总包内为多个文件夹，文件夹名为 filename（去掉 .pdf）。
    每个文件夹尽量包含：images/、full.md、ch-{name}.md（来自 analysis_results.json 的 full_translation）。
    缺失的内容跳过并写日志，不导致整体失败。

    Returns:
        Tuple[bytes, str]: (zip 内容, 总包文件名)
    """
    buffer = io.BytesIO()
    used_folder_names: set = set()
    packed_count = 0

    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as zf:
        for oss_key in oss_keys:
            paper = get_paper_by_oss_key(oss_key)
            if not paper:
                logger.warning(f"[批量导出] 找不到论文记录，已跳过: {oss_key}")
                continue

            filename = paper.get("filename") or "unnamed"
            folder_name = _unique_folder_name(
                _strip_pdf_extension(filename), used_folder_names
            )
            used_folder_names.add(folder_name)

            paper_dir = _resolve_paper_dir(paper)
            if paper_dir is None:
                logger.warning(
                    f"[批量导出] 论文本地目录不存在，已跳过: filename={filename}, oss_key={oss_key}"
                )
                continue

            added_any = False

            images_dir = paper_dir / "images"
            if images_dir.is_dir():
                file_count = _add_directory_to_zip(
                    zf, images_dir, f"{folder_name}/images"
                )
                if file_count > 0:
                    added_any = True
                    logger.info(
                        f"[批量导出] 已打包 images: {folder_name}, 文件数={file_count}"
                    )
                else:
                    logger.warning(
                        f"[批量导出] images 目录为空，已跳过: {folder_name}"
                    )
            else:
                logger.warning(
                    f"[批量导出] 找不到 images 目录，已跳过: {folder_name}, 路径={images_dir}"
                )

            full_md = paper_dir / "full.md"
            if full_md.is_file():
                zf.write(full_md, f"{folder_name}/full.md")
                added_any = True
                logger.info(f"[批量导出] 已打包 full.md: {folder_name}")
            else:
                logger.warning(
                    f"[批量导出] 找不到 full.md，已跳过: {folder_name}, 路径={full_md}"
                )

            analysis_path = paper_dir / "analysis_results.json"
            if not analysis_path.is_file():
                analysis_rel = paper.get("analysis_results_path")
                if analysis_rel:
                    candidate = Path(str(analysis_rel).replace("\\", "/"))
                    if not candidate.is_absolute():
                        candidate = WORKING_DIR / candidate
                    if candidate.is_file():
                        analysis_path = candidate

            if analysis_path.is_file():
                with open(analysis_path, "r", encoding="utf-8") as f:
                    analysis_data = json.load(f)
                full_translation = analysis_data.get("full_translation")
                if isinstance(full_translation, str) and full_translation.strip():
                    ch_name = f"ch-{folder_name}.md"
                    zf.writestr(f"{folder_name}/{ch_name}", full_translation)
                    added_any = True
                    logger.info(
                        f"[批量导出] 已打包翻译 markdown: {folder_name}/{ch_name}"
                    )
                else:
                    logger.warning(
                        f"[批量导出] analysis_results.json 中无有效 full_translation，已跳过: {folder_name}"
                    )
            else:
                logger.warning(
                    f"[批量导出] 找不到 analysis_results.json，已跳过翻译文件: {folder_name}"
                )

            if added_any:
                packed_count += 1
            else:
                logger.warning(
                    f"[批量导出] 该论文没有任何可打包内容: {folder_name}, oss_key={oss_key}"
                )

    zip_filename = datetime.now().strftime("%Y%m%d_%H%M%S") + ".zip"
    logger.info(
        f"[批量导出] 打包完成: 请求 {len(oss_keys)} 篇, 实际打包 {packed_count} 篇, 文件名={zip_filename}"
    )
    return buffer.getvalue(), zip_filename
