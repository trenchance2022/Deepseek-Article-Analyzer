"""FastAPI 主应用"""

# 首先导入 logger 以确保日志配置被初始化（包括拦截标准 logging）
from src.core.logger import logger

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from config import settings
from src.api.v1 import papers, mineru, files, extraction
from src.services.storage_service import load_papers
from src.services.mineru_extraction_service import process_extraction
import asyncio

# 记录应用启动
logger.info("论文批量读取系统 API 启动中...")

app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    debug=settings.DEBUG,
)


async def recover_incomplete_extractions():
    """
    启动时恢复未完成的提取任务
    """
    papers = load_papers()

    # 查找状态为 parsing 或 downloading 且有 task_id 的论文
    incomplete_papers = [
        p
        for p in papers
        if p.get("status") in ["parsing", "downloading"] and p.get("task_id")
    ]

    if incomplete_papers:
        logger.info(f"发现 {len(incomplete_papers)} 个未完成的提取任务，正在恢复...")
        for paper in incomplete_papers:
            oss_key = paper.get("oss_key")
            task_id = paper.get("task_id")
            if oss_key and task_id:
                # 使用 asyncio.create_task 启动后台任务
                asyncio.create_task(process_extraction(oss_key, task_id))
                logger.info(f"已恢复提取任务: {oss_key} (task_id: {task_id})")


@app.on_event("startup")
async def startup_event():
    """
    应用启动时执行
    """
    logger.info("应用启动完成，开始恢复未完成的提取任务...")
    await recover_incomplete_extractions()
    logger.info("应用启动流程完成")


# 配置 CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 注册路由
# 文件操作
app.include_router(files.router, prefix="/api/v1")
# 论文资源管理（包含提取操作作为子资源）
app.include_router(papers.router, prefix="/api/v1")
app.include_router(extraction.router, prefix="/api/v1/papers")
# MinerU 服务
app.include_router(mineru.router, prefix="/api/v1")


@app.get("/")
async def root():
    """根路径"""
    return {
        "message": "论文批量读取系统 API",
        "version": settings.APP_VERSION,
    }


@app.get("/health")
async def health():
    """健康检查"""
    return {"status": "ok"}
