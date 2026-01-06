"""本地存储服务"""

import json
from pathlib import Path
from typing import List, Dict, Any, Optional

# working_dir 路径（相对于项目根目录）
import os

WORKING_DIR = (
    Path(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__)))))
    / "working_dir"
)
WORKING_DIR.mkdir(exist_ok=True, parents=True)

# 存储文件路径
STORAGE_FILE = WORKING_DIR / "papers.json"


def save_papers(papers: List[Dict[str, Any]]) -> None:
    """
    保存论文信息到本地 JSON 文件

    Args:
        papers: 论文信息列表，每个包含 oss_key, oss_url, filename
    """
    # 读取现有数据
    existing_papers = load_papers()

    # 合并数据（以 oss_key 为唯一标识）
    papers_dict = {paper["oss_key"]: paper for paper in existing_papers}
    for paper in papers:
        papers_dict[paper["oss_key"]] = paper

    # 保存到文件
    with open(STORAGE_FILE, "w", encoding="utf-8") as f:
        json.dump(list(papers_dict.values()), f, ensure_ascii=False, indent=2)


def load_papers() -> List[Dict[str, Any]]:
    """
    从本地 JSON 文件加载论文信息

    Returns:
        List[Dict]: 论文信息列表
    """
    if not STORAGE_FILE.exists():
        return []

    try:
        with open(STORAGE_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except (json.JSONDecodeError, IOError):
        return []


def get_paper_by_oss_key(oss_key: str) -> Optional[Dict[str, Any]]:
    """
    根据 oss_key 获取论文信息

    Args:
        oss_key: OSS 对象键

    Returns:
        Optional[Dict]: 论文信息，如果不存在则返回 None
    """
    papers = load_papers()
    for paper in papers:
        if paper.get("oss_key") == oss_key:
            return paper
    return None


def update_paper(oss_key: str, updates: Dict[str, Any]) -> bool:
    """
    更新论文信息

    Args:
        oss_key: OSS 对象键
        updates: 要更新的字段

    Returns:
        bool: 是否更新成功
    """
    papers = load_papers()
    updated = False

    for paper in papers:
        if paper.get("oss_key") == oss_key:
            paper.update(updates)
            updated = True
            break

    if updated:
        with open(STORAGE_FILE, "w", encoding="utf-8") as f:
            json.dump(papers, f, ensure_ascii=False, indent=2)

    return updated


def delete_paper(oss_key: str) -> bool:
    """
    删除论文信息

    Args:
        oss_key: OSS 对象键

    Returns:
        bool: 是否删除成功
    """
    papers = load_papers()
    original_count = len(papers)

    papers = [p for p in papers if p.get("oss_key") != oss_key]

    if len(papers) < original_count:
        with open(STORAGE_FILE, "w", encoding="utf-8") as f:
            json.dump(papers, f, ensure_ascii=False, indent=2)
        return True

    return False
