/** MinerU 提取页 */
import { useState, useCallback, useEffect } from 'react';
import { getAllPapers, getPaperMarkdown, type PaperInfo, type PaperStatus } from '../api/papersManagement';
import { startExtraction, stopExtraction } from '../api/extraction';
import Loading from '../components/Loading';
import Error from '../components/Error';

const MinerUExtract = () => {
  const [papers, setPapers] = useState<PaperInfo[]>([]);
  const [total, setTotal] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(10);
  const [initialLoading, setInitialLoading] = useState(true);
  const [processingOssKeys, setProcessingOssKeys] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [selectedMarkdown, setSelectedMarkdown] = useState<string | null>(null);
  const [selectedPaperName, setSelectedPaperName] = useState<string | null>(null);

  // 加载论文列表（分页）
  // silent: 是否静默加载（不显示加载状态，用于后台轮询）
  const loadPapers = useCallback(async (silent: boolean = false) => {
    if (!silent) {
      setInitialLoading(true);
    }
    try {
      const offset = (currentPage - 1) * pageSize;
      const response = await getAllPapers({ offset, limit: pageSize });
      setPapers(response.items);
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

  // 处理分页
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  // 计算总页数
  const totalPages = Math.ceil(total / pageSize);

  // 开始提取
  const handleStartParse = useCallback(async () => {
    const uploadedPapers = papers.filter(p => p.status === 'uploaded');
    
    if (uploadedPapers.length === 0) {
      setError('没有待处理的论文');
      return;
    }

    setError(null);

    // 逐个启动提取任务
    for (const paper of uploadedPapers) {
      try {
        setProcessingOssKeys(prev => new Set(prev).add(paper.oss_key));
        await startExtraction(paper.oss_key);
      } catch (err) {
        const errorMessage = err instanceof globalThis.Error ? err.message : String(err ?? '启动提取失败');
        setError(errorMessage);
        setProcessingOssKeys(prev => {
          const newSet = new Set(prev);
          newSet.delete(paper.oss_key);
          return newSet;
        });
      }
    }

    // 刷新列表
    loadPapers(false);
  }, [papers, loadPapers]);

  // 停止提取
  const handleStopParse = useCallback(async (ossKey: string) => {
    try {
      await stopExtraction(ossKey);
      setProcessingOssKeys(prev => {
        const newSet = new Set(prev);
        newSet.delete(ossKey);
        return newSet;
      });
      loadPapers(false);
    } catch (err) {
      const errorMessage = err instanceof globalThis.Error ? err.message : String(err ?? '停止提取失败');
      setError(errorMessage);
    }
  }, [loadPapers]);

  // 查看 Markdown
  const handleViewMarkdown = useCallback(async (paper: PaperInfo) => {
    if (paper.markdown_path) {
      try {
        const result = await getPaperMarkdown(paper.oss_key);
        setSelectedMarkdown(result.content);
        setSelectedPaperName(paper.filename);
      } catch (err) {
        const errorMessage = err instanceof globalThis.Error ? err.message : String(err ?? '读取 Markdown 失败');
        setError(errorMessage);
      }
    }
  }, []);

  // 关闭 Markdown 查看
  const handleCloseMarkdown = useCallback(() => {
    setSelectedMarkdown(null);
    setSelectedPaperName(null);
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

  // 统计各状态的论文数量
  const uploadedPapers = papers.filter(p => p.status === 'uploaded');

  return (
    <div className="p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
              MinerU 提取
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              使用 MinerU 提取论文 PDF 内容为 Markdown 格式
            </p>
          </div>
          <button
            onClick={handleStartParse}
            disabled={uploadedPapers.length === 0 || processingOssKeys.size > 0}
            className="px-6 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            开始提取
          </button>
        </div>

        {error && (
          <div className="mb-6">
            <Error message={error} />
          </div>
        )}

        {/* 表格 */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden">
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
                    Task ID
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    上传时间
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    操作
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {initialLoading ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center">
                      <Loading />
                    </td>
                  </tr>
                ) : papers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                      暂无数据
                    </td>
                  </tr>
                ) : (
                  papers.map((paper, index) => {
                    const isExtracting = paper.status === 'parsing' || paper.status === 'downloading';

                    return (
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
                        <td className="px-6 py-4 whitespace-nowrap">
                          {paper.task_id ? (
                            <div className="text-xs text-gray-500 dark:text-gray-400 font-mono break-all max-w-xs">
                              {paper.task_id}
                            </div>
                          ) : (
                            <span className="text-xs text-gray-400 dark:text-gray-500">-</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                          {paper.uploaded_at
                            ? new Date(paper.uploaded_at).toLocaleString('zh-CN')
                            : '未知时间'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <div className="flex items-center justify-end space-x-2">
                            {isExtracting && (
                              <button
                                onClick={() => handleStopParse(paper.oss_key)}
                                className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600 transition-colors text-xs"
                              >
                                停止
                              </button>
                            )}
                            {(paper.status === 'extracted' || paper.status === 'analyzing' || paper.status === 'done') && paper.markdown_path && (
                              <button
                                onClick={() => handleViewMarkdown(paper)}
                                className="px-3 py-1 bg-purple-500 text-white rounded hover:bg-purple-600 transition-colors text-xs"
                              >
                                查看提取结果
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
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

        {/* Markdown 查看模态框 */}
        {selectedMarkdown && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col">
              <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white truncate">
                  {selectedPaperName}
                </h3>
                <button
                  onClick={handleCloseMarkdown}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="flex-1 overflow-auto p-6">
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  <pre className="whitespace-pre-wrap text-sm text-gray-800 dark:text-gray-200 font-mono">
                    {selectedMarkdown}
                  </pre>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MinerUExtract;
