/** MinerU 提取页 */
import { useState, useCallback, useEffect } from 'react';
import { getAllPapers, getPaperMarkdown, type PaperInfo } from '../api/papersManagement';
import { startExtraction, stopExtraction } from '../api/extraction';
import Loading from '../components/Loading';
import Error from '../components/Error';

const MinerUExtract = () => {
  const [papers, setPapers] = useState<PaperInfo[]>([]);
  const [total, setTotal] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(20); // 每页20条
  const [loading, setLoading] = useState(false);
  const [processingOssKeys, setProcessingOssKeys] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [selectedMarkdown, setSelectedMarkdown] = useState<string | null>(null);
  const [selectedPaperName, setSelectedPaperName] = useState<string | null>(null);

  // 加载论文列表（分页）
  const loadPapers = useCallback(async () => {
    setLoading(true);
    try {
      const offset = (currentPage - 1) * pageSize;
      const response = await getAllPapers({ offset, limit: pageSize });
      setPapers(response.items);
      setTotal(response.total);
    } catch (err) {
      console.error('加载论文列表失败:', err);
    } finally {
      setLoading(false);
    }
  }, [currentPage, pageSize]);

  useEffect(() => {
    loadPapers();
    // 定期刷新论文列表
    const interval = setInterval(loadPapers, 2000);
    return () => clearInterval(interval);
  }, [loadPapers]);

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
        // 后端会自动处理提取流程，前端只需要启动任务
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

    // 刷新列表（会定期刷新，这里只是立即刷新一次）
    loadPapers();
  }, [papers, loadPapers]);

  // 定期检查并清理已完成的处理任务
  useEffect(() => {
    const interval = setInterval(() => {
      setProcessingOssKeys(prev => {
        const newSet = new Set(prev);
        // 移除状态不是 parsing 或 downloading 的论文
        papers.forEach(paper => {
          if (newSet.has(paper.oss_key) && 
              paper.status !== 'parsing' && 
              paper.status !== 'downloading') {
            newSet.delete(paper.oss_key);
          }
        });
        return newSet;
      });
    }, 3000); // 每3秒清理一次
    
    return () => clearInterval(interval);
  }, [papers]);

  // 停止提取
  const handleStopParse = useCallback(async (ossKey: string) => {
    try {
      await stopExtraction(ossKey);
      setProcessingOssKeys(prev => {
        const newSet = new Set(prev);
        newSet.delete(ossKey);
        return newSet;
      });
      loadPapers();
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

  const uploadedPapers = papers.filter(p => p.status === 'uploaded');
  // 处理中的论文：状态为 parsing 或 downloading 的论文
  const processingPapers = papers.filter(p => 
    p.status === 'parsing' || p.status === 'downloading'
  );
  const extractedPapers = papers.filter(p => p.status === 'extracted');
  const errorPapers = papers.filter(p => p.status === 'error');

  return (
    <div className="p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            MinerU 提取
          </h1>
          {uploadedPapers.length > 0 && (
            <button
              onClick={handleStartParse}
              disabled={processingOssKeys.size > 0}
              className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              开始提取 ({uploadedPapers.length})
            </button>
          )}
        </div>

        {error && (
          <div className="mb-6">
            <Error message={error} />
          </div>
        )}

        {/* 待处理论文 */}
        {uploadedPapers.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
              待处理论文 ({uploadedPapers.length})
            </h2>
            <div className="space-y-2">
              {uploadedPapers.map((paper) => (
                <div
                  key={paper.oss_key}
                  className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg"
                >
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {paper.filename}
                    </h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      {paper.uploaded_at
                        ? new Date(paper.uploaded_at).toLocaleString('zh-CN')
                        : '未知时间'}
                    </p>
                  </div>
                  <span className="ml-4 px-2 py-1 bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200 rounded text-xs font-medium">
                    已上传
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 处理中的论文 */}
        {processingPapers.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
              处理中
            </h2>
            <div className="space-y-2">
              {processingPapers.map((paper) => (
                <div
                  key={paper.oss_key}
                  className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg"
                >
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {paper.filename}
                    </h3>
                    {paper.task_id && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 break-all">
                        Task ID: {paper.task_id}
                      </p>
                    )}
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      状态: {paper.status === 'parsing' ? '解析中' : paper.status === 'downloading' ? '下载中' : '处理中'}
                    </p>
                  </div>
                  <div className="ml-4 flex items-center space-x-2">
                    <Loading />
                    <button
                      onClick={() => handleStopParse(paper.oss_key)}
                      className="px-3 py-1 text-sm bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
                    >
                      停止
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 已提取的论文 */}
        {extractedPapers.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
              已提取 ({extractedPapers.length})
            </h2>
            <div className="space-y-2">
              {extractedPapers.map((paper) => (
                <div
                  key={paper.oss_key}
                  className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg"
                >
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {paper.filename}
                    </h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      {paper.extracted_at
                        ? new Date(paper.extracted_at).toLocaleString('zh-CN')
                        : '未知时间'}
                    </p>
                  </div>
                  <div className="ml-4 flex items-center space-x-2">
                    <span className="px-2 py-1 bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 rounded text-xs font-medium">
                      已提取
                    </span>
                    {paper.markdown_path && (
                      <button
                        onClick={() => handleViewMarkdown(paper)}
                        className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm"
                      >
                        查看内容
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 失败的论文 */}
        {errorPapers.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
              处理失败 ({errorPapers.length})
            </h2>
            <div className="space-y-2">
              {errorPapers.map((paper) => (
                <div
                  key={paper.oss_key}
                  className="flex items-center justify-between p-4 border border-red-200 dark:border-red-800 rounded-lg"
                >
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {paper.filename}
                    </h3>
                    {paper.error && (
                      <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                        {paper.error}
                      </p>
                    )}
                  </div>
                  <span className="ml-4 px-2 py-1 bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 rounded text-xs font-medium">
                    失败
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 空状态 */}
        {!loading && papers.length === 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-12 text-center">
            <p className="text-gray-500 dark:text-gray-400">
              还没有论文，请先前往"论文上传"页面上传论文
            </p>
          </div>
        )}

        {/* 分页控件 */}
        {totalPages > 1 && (
          <div className="mt-6 flex items-center justify-between bg-white dark:bg-gray-800 rounded-lg shadow-lg p-4">
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
              <span className="text-sm text-gray-700 dark:text-gray-300">
                第 {currentPage} / {totalPages} 页
              </span>
              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage >= totalPages}
                className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                下一页
              </button>
            </div>
          </div>
        )}

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
