/** 论文上传页 */
import { useState, useCallback, useEffect } from 'react';
import { type UploadResponse } from '../api/papers';
import { getAllPapers, type PaperInfo, type PaperStatus } from '../api/papersManagement';
import FileUploader from '../components/FileUploader';
import Error from '../components/Error';
import Loading from '../components/Loading';

const PaperUpload = () => {
  const [error, setError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [uploadedCount, setUploadedCount] = useState(0);
  const [papers, setPapers] = useState<PaperInfo[]>([]);
  const [total, setTotal] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(10);
  const [initialLoading, setInitialLoading] = useState(true);

  // 加载已上传及之后状态的论文（分页）
  // silent: 是否静默加载（不显示加载状态，用于后台轮询）
  const loadPapers = useCallback(async (silent: boolean = false) => {
    if (!silent) {
      setInitialLoading(true);
    }
    try {
      const offset = (currentPage - 1) * pageSize;
      const response = await getAllPapers({ offset, limit: pageSize });
      // 查询所有状态为 uploaded 及之后状态的论文（排除 uploading）
      const filtered = response.items.filter(
        p => p.status !== 'uploading' && 
        (p.status === 'uploaded' || p.status === 'parsing' || p.status === 'downloading' || 
         p.status === 'extracted' || p.status === 'analyzing' || p.status === 'done' || p.status === 'error')
      );
      setPapers(filtered);
      setTotal(response.total);
    } catch (err) {
      console.error('加载论文列表失败:', err);
    } finally {
      if (!silent) {
        setInitialLoading(false);
      }
    }
  }, [currentPage, pageSize]);

  // 初始加载
  useEffect(() => {
    loadPapers(false);
  }, [currentPage, pageSize]);

  // 后台轮询（静默刷新，不显示加载状态）
  useEffect(() => {
    if (!initialLoading) {
      const interval = setInterval(() => {
        loadPapers(true); // 静默刷新
      }, 2000);
      return () => clearInterval(interval);
    }
  }, [initialLoading, loadPapers]);

  const handleUploadSuccess = useCallback((results: UploadResponse[]) => {
    setError(null);
    setUploadSuccess(true);
    setUploadedCount(results.length);
    // 后端会自动创建论文记录，刷新列表
    setTimeout(() => {
      loadPapers(false);
    }, 500);
  }, [loadPapers]);

  const handleUploadError = useCallback((err: Error) => {
    setError(err.message);
    setUploadSuccess(false);
  }, []);

  // 获取状态显示文本
  const getStatusText = (status: PaperStatus) => {
    const statusMap: Record<PaperStatus, string> = {
      uploading: '上传中',
      uploaded: '已上传',
      parsing: '解析中',
      downloading: '下载中',
      extracted: '已提取',
      analyzing: '分析中',
      done: '已完成',
      error: '失败',
    };
    return statusMap[status] || status;
  };

  // 获取状态样式
  const getStatusStyle = (status: PaperStatus) => {
    const styleMap: Record<PaperStatus, string> = {
      uploading: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
      uploaded: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
      parsing: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
      downloading: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
      extracted: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      analyzing: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200',
      done: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200',
      error: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
    };
    return styleMap[status] || 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
  };

  // 计算总页数
  const totalPages = Math.ceil(total / pageSize);

  // 处理分页
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  return (
    <div className="p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            论文上传
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            上传 PDF 论文文件到阿里云 OSS，支持批量上传
          </p>
        </div>

        {error && (
          <div className="mb-6">
            <Error message={error} />
          </div>
        )}

        {uploadSuccess && (
          <div className="mb-6 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
            <p className="text-green-800 dark:text-green-200">
              成功上传 {uploadedCount} 个文件！文件已保存，您可以继续上传或前往 MinerU 提取页面开始处理。
            </p>
          </div>
        )}

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-6">
          <FileUploader
            onUploadSuccess={handleUploadSuccess}
            onUploadError={handleUploadError}
            multiple={true}
            accept=".pdf"
          />
        </div>

        {/* 已上传的论文列表 - 使用表格布局 */}
        {papers.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                已上传的论文
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      ID
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      名称
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      状态
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      上传时间
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {initialLoading ? (
                    <tr>
                      <td colSpan={4} className="px-6 py-12 text-center">
                        <Loading />
                      </td>
                    </tr>
                  ) : papers.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                        暂无数据
                      </td>
                    </tr>
                  ) : (
                    papers.map((paper, index) => (
                      <tr key={paper.oss_key} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                          {(currentPage - 1) * pageSize + index + 1}
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm font-medium text-gray-900 dark:text-white truncate max-w-xs">
                            {paper.filename}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusStyle(paper.status)}`}>
                            {getStatusText(paper.status)}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                          {paper.uploaded_at
                            ? new Date(paper.uploaded_at).toLocaleString('zh-CN')
                            : '未知时间'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* 分页 */}
            {totalPages > 1 && (
              <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
                <div className="text-sm text-gray-700 dark:text-gray-300">
                  共 {total} 条
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                    className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    上一页
                  </button>
                  {Array.from({ length: Math.min(7, totalPages) }, (_, i) => {
                    let pageNum: number;
                    if (totalPages <= 7) {
                      pageNum = i + 1;
                    } else if (currentPage <= 4) {
                      pageNum = i + 1;
                    } else if (currentPage >= totalPages - 3) {
                      pageNum = totalPages - 6 + i;
                    } else {
                      pageNum = currentPage - 3 + i;
                    }
                    return (
                      <button
                        key={pageNum}
                        onClick={() => handlePageChange(pageNum)}
                        className={`px-3 py-1 border rounded transition-colors ${
                          currentPage === pageNum
                            ? 'bg-blue-500 text-white border-blue-500'
                            : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                  <button
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    下一页
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default PaperUpload;
