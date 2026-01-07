"""日志配置模块"""

from loguru import logger
import sys
import logging
from pathlib import Path
import os
from logging import Handler


class InterceptHandler(Handler):
    """
    拦截标准 logging 的输出，转发到 loguru
    """

    def emit(self, record: logging.LogRecord) -> None:
        # 获取对应的 loguru 级别
        try:
            level = logger.level(record.levelname).name
        except ValueError:
            level = str(record.levelno)

        # 查找调用者
        try:
            frame = sys._getframe(6)
        except ValueError:
            frame = None

        depth = 0
        if frame:
            while frame and frame.f_code.co_filename == logging.__file__:
                frame = frame.f_back
                depth += 1

        logger.opt(depth=depth, exception=record.exc_info).log(
            level, record.getMessage()
        )


def setup_logging():
    """
    配置日志系统，拦截标准 logging 并转发到 loguru
    """
    # 移除默认的 handler
    logger.remove()

    # 添加控制台输出（带颜色）
    logger.add(
        sys.stderr,
        format="<green>{time:YYYY-MM-DD HH:mm:ss}</green> | <level>{level: <8}</level> | <cyan>{name}</cyan>:<cyan>{function}</cyan>:<cyan>{line}</cyan> - <level>{message}</level>",
        level="INFO",
        colorize=True,
    )

    # 添加文件输出（保存到 working_dir/logs）
    # 使用与 storage_service 相同的路径计算方式
    WORKING_DIR = (
        Path(
            os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__))))
        )
        / "working_dir"
    )
    LOGS_DIR = WORKING_DIR / "logs"
    LOGS_DIR.mkdir(exist_ok=True, parents=True)

    logger.add(
        LOGS_DIR / "app_{time:YYYY-MM-DD}.log",
        rotation="00:00",  # 每天午夜轮转
        retention="30 days",  # 保留30天
        compression="zip",  # 压缩旧日志
        format="{time:YYYY-MM-DD HH:mm:ss} | {level: <8} | {name}:{function}:{line} - {message}",
        level="DEBUG",
        encoding="utf-8",
    )

    # 拦截标准 logging
    logging.basicConfig(handlers=[InterceptHandler()], level=0, force=True)

    # 配置 Uvicorn 相关的 logger
    for logger_name in ["uvicorn", "uvicorn.error", "uvicorn.access", "fastapi"]:
        uvicorn_logger = logging.getLogger(logger_name)
        uvicorn_logger.handlers = [InterceptHandler()]
        uvicorn_logger.propagate = False

    # 配置其他常用库的 logger
    for logger_name in ["httpx", "httpcore"]:
        lib_logger = logging.getLogger(logger_name)
        lib_logger.handlers = [InterceptHandler()]
        lib_logger.propagate = False


# 初始化日志配置
setup_logging()

# 导出 logger
__all__ = ["logger", "setup_logging"]
