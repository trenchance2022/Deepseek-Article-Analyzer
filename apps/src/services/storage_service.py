"""本地存储服务"""

import json
import os
import sys
import time
from pathlib import Path
from typing import List, Dict, Any, Optional

# 跨平台文件锁支持
if sys.platform == "win32":
    import msvcrt
else:
    import fcntl

# working_dir 路径（相对于项目根目录）
WORKING_DIR = (
    Path(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__)))))
    / "working_dir"
)
WORKING_DIR.mkdir(exist_ok=True, parents=True)

# 存储文件路径
STORAGE_FILE = WORKING_DIR / "papers.json"
# 锁文件路径
LOCK_FILE = WORKING_DIR / "papers.json.lock"


def _acquire_lock():
    """获取文件锁（跨平台）"""
    max_retries = 10
    retry_delay = 0.1

    for attempt in range(max_retries):
        try:
            lock_file = open(LOCK_FILE, "w")
            if sys.platform == "win32":
                # Windows 使用 msvcrt
                try:
                    msvcrt.locking(lock_file.fileno(), msvcrt.LK_NBLCK, 1)
                except IOError:
                    lock_file.close()
                    if attempt < max_retries - 1:
                        time.sleep(retry_delay)
                        continue
                    raise
            else:
                # Unix/Linux 使用 fcntl
                fcntl.flock(lock_file.fileno(), fcntl.LOCK_EX)
            return lock_file
        except Exception:
            if "lock_file" in locals():
                try:
                    lock_file.close()
                except:
                    pass
            if attempt < max_retries - 1:
                time.sleep(retry_delay)
                continue
            raise
    raise IOError("无法获取文件锁")


def _release_lock(lock_file):
    """释放文件锁（跨平台）"""
    try:
        if sys.platform == "win32":
            # Windows 使用 msvcrt
            try:
                msvcrt.locking(lock_file.fileno(), msvcrt.LK_UNLCK, 1)
            except IOError:
                pass  # 忽略释放锁时的错误
        else:
            # Unix/Linux 使用 fcntl
            fcntl.flock(lock_file.fileno(), fcntl.LOCK_UN)
    finally:
        try:
            lock_file.close()
        except:
            pass


def save_papers(papers: List[Dict[str, Any]]) -> None:
    """
    保存论文信息到本地 JSON 文件（线程安全）

    Args:
        papers: 论文信息列表，每个包含 oss_key, oss_url, filename
    """
    lock_file = _acquire_lock()
    try:
        # 读取现有数据
        existing_papers = load_papers()

        # 合并数据（以 oss_key 为唯一标识）
        papers_dict = {paper["oss_key"]: paper for paper in existing_papers}
        for paper in papers:
            papers_dict[paper["oss_key"]] = paper

        # 保存到文件
        with open(STORAGE_FILE, "w", encoding="utf-8") as f:
            json.dump(list(papers_dict.values()), f, ensure_ascii=False, indent=2)
    finally:
        _release_lock(lock_file)


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
    支持正斜杠和反斜杠的灵活匹配

    Args:
        oss_key: OSS 对象键（可能包含正斜杠或反斜杠）

    Returns:
        Optional[Dict]: 论文信息，如果不存在则返回 None
    """
    papers = load_papers()

    # 标准化输入的 oss_key（统一使用正斜杠）
    oss_key_normalized = oss_key.replace("\\", "/")

    for paper in papers:
        paper_oss_key = paper.get("oss_key", "")
        # 标准化存储的 oss_key（统一使用正斜杠）
        paper_oss_key_normalized = paper_oss_key.replace("\\", "/")

        # 同时尝试精确匹配和标准化匹配
        if paper_oss_key == oss_key or paper_oss_key_normalized == oss_key_normalized:
            return paper

    return None


def update_paper(oss_key: str, updates: Dict[str, Any]) -> bool:
    """
    更新论文信息（线程安全，支持路径标准化）

    Args:
        oss_key: OSS 对象键（可能包含正斜杠或反斜杠）
        updates: 要更新的字段

    Returns:
        bool: 是否更新成功
    """
    lock_file = _acquire_lock()
    try:
        papers = load_papers()
        updated = False

        # 标准化输入的 oss_key（统一使用正斜杠）
        oss_key_normalized = oss_key.replace("\\", "/")

        for paper in papers:
            paper_oss_key = paper.get("oss_key", "")
            # 标准化存储的 oss_key（统一使用正斜杠）
            paper_oss_key_normalized = paper_oss_key.replace("\\", "/")

            # 同时尝试精确匹配和标准化匹配
            if (
                paper_oss_key == oss_key
                or paper_oss_key_normalized == oss_key_normalized
            ):
                paper.update(updates)
                updated = True
                break

        if updated:
            with open(STORAGE_FILE, "w", encoding="utf-8") as f:
                json.dump(papers, f, ensure_ascii=False, indent=2)

        return updated
    finally:
        _release_lock(lock_file)


def delete_paper(oss_key: str) -> bool:
    """
    删除论文信息（线程安全，支持路径标准化）

    Args:
        oss_key: OSS 对象键（可能包含正斜杠或反斜杠）

    Returns:
        bool: 是否删除成功
    """
    lock_file = _acquire_lock()
    try:
        papers = load_papers()
        original_count = len(papers)

        # 标准化输入的 oss_key（统一使用正斜杠）
        oss_key_normalized = oss_key.replace("\\", "/")

        # 使用标准化匹配删除
        filtered_papers = []
        for paper in papers:
            paper_oss_key = paper.get("oss_key", "")
            paper_oss_key_normalized = paper_oss_key.replace("\\", "/")
            # 如果匹配，则跳过（不添加到 filtered_papers）
            if (
                paper_oss_key == oss_key
                or paper_oss_key_normalized == oss_key_normalized
            ):
                continue
            filtered_papers.append(paper)

        if len(filtered_papers) < original_count:
            with open(STORAGE_FILE, "w", encoding="utf-8") as f:
                json.dump(filtered_papers, f, ensure_ascii=False, indent=2)
            return True

        return False
    finally:
        _release_lock(lock_file)
