"""FastAPI 主应用"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from config import settings
from src.api.v1 import papers

app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    debug=settings.DEBUG,
)

# 配置 CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 注册路由
app.include_router(papers.router, prefix="/api/v1")


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
