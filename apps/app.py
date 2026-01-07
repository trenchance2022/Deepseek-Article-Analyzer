"""应用入口文件"""

import uvicorn
from config import settings

if __name__ == "__main__":
    uvicorn.run(
        "src.api.main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=True,  # 启用自动重载（代码修改后自动重启）
        reload_dirs=["src"],  # 只监听 src 目录的变化
        reload_includes=["*.py"],  # 只监听 .py 文件
    )
