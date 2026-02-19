/** DeepSeek 分析页 */
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAllPapers, type PaperInfo, type PaperStatus } from '../api/papersManagement';
import { startAnalysis } from '../api/extraction';
import Error from '../components/Error';
import Loading from '../components/Loading';

const DeepSeekAnalysis = () => {
  const navigate = useNavigate();
  const [papers, setPapers] = useState<PaperInfo[]>([]);
  const [total, setTotal] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(10);
  const [initialLoading, setInitialLoading] = useState(true); // 初始加载状态
  const [error, setError] = useState<string | null>(null);
  const [processingOssKeys, setProcessingOssKeys] = useState<Set<string>>(new Set());
  const [hasExtractedPapers, setHasExtractedPapers] = useState(false); // 是否有待分析的论文

  // 加载论文列表（只加载已提取、分析中、已完成的论文）
  // silent: 是否静默加载（不显示加载状态，用于后台轮询）
  const loadPapers = useCallback(async (silent: boolean = false) => {
    if (!silent) {
      setInitialLoading(true);
    }
    setError(null);
    try {
      const offset = (currentPage - 1) * pageSize;
      
      // 使用多状态筛选，后端会处理分页
      const response = await getAllPapers({
        status: 'extracted,analyzing,done' as any, // 多状态筛选
        offset,
        limit: pageSize,
      });
      
      setPapers(response.items);
      setTotal(response.total);
      
      // 检查当前页是否有 extracted 状态的论文
      const hasExtracted = response.items.some(p => p.status === 'extracted');
      setHasExtractedPapers(hasExtracted);
      
      // 如果当前页没有，检查所有页（通过 API 查询 extracted 状态）
      if (!hasExtracted && !silent) {
        try {
          const extractedResponse = await getAllPapers({
            status: 'extracted',
            offset: 0,
            limit: 1,
          });
          setHasExtractedPapers(extractedResponse.total > 0);
        } catch (err) {
          // 如果查询失败，使用当前页的结果
          setHasExtractedPapers(false);
        }
      }
    } catch (err) {
      const errorMessage = err instanceof globalThis.Error ? err.message : String(err ?? '加载论文列表失败');
      setError(errorMessage);
    } finally {
      if (!silent) {
        setInitialLoading(false);
      }
    }
  }, [currentPage, pageSize]);

  // 初始加载
  useEffect(() => {
    loadPapers(false);
  }, [currentPage, pageSize]); // 只在分页变化时重新加载

  // 后台轮询（静默刷新，不显示加载状态）
  useEffect(() => {
    // 等待初始加载完成后再开始轮询
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

  // 开始分析（单个）
  const handleStartAnalysis = useCallback(async (ossKey: string) => {
    try {
      setProcessingOssKeys(prev => new Set(prev).add(ossKey));
      await startAnalysis(ossKey);
      await loadPapers(); // 刷新列表
    } catch (err) {
      const errorMessage = err instanceof globalThis.Error ? err.message : String(err ?? '启动分析失败');
      setError(errorMessage);
      setProcessingOssKeys(prev => {
        const newSet = new Set(prev);
        newSet.delete(ossKey);
        return newSet;
      });
    }
  }, [loadPapers]);

  // 获取所有状态为 extracted 的论文（分页获取）
  const getAllExtractedPapers = useCallback(async (): Promise<PaperInfo[]> => {
    const allPapers: PaperInfo[] = [];
    let offset = 0;
    const limit = 100; // 每次获取100条

    while (true) {
      try {
        const response = await getAllPapers({
          status: 'extracted',
          offset,
          limit,
        });

        allPapers.push(...response.items);

        // 如果返回的数量小于 limit，说明已经获取完所有数据
        if (response.items.length < limit) {
          break;
        }

        offset += limit;
      } catch (err) {
        const errorMessage = err instanceof globalThis.Error ? err.message : String(err ?? '获取论文列表失败');
        setError(`获取论文列表失败: ${errorMessage}`);
        break;
      }
    }

    return allPapers;
  }, []);

  // 一键开始分析（批量）
  const handleStartAllAnalysis = useCallback(async () => {
    setError(null);

    // 获取所有状态为 extracted 的论文
    const extractedPapers = await getAllExtractedPapers();
    
    if (extractedPapers.length === 0) {
      setError('没有待分析的论文');
      return;
    }

    // 逐个启动分析任务（串行执行，避免 API 限流）
    for (const paper of extractedPapers) {
      try {
        setProcessingOssKeys(prev => new Set(prev).add(paper.oss_key));
        await startAnalysis(paper.oss_key);
        // 短暂延迟，避免 API 限流
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (err) {
        const errorMessage = err instanceof globalThis.Error ? err.message : String(err ?? '启动分析失败');
        setError(`论文 ${paper.filename} 分析启动失败: ${errorMessage}`);
        setProcessingOssKeys(prev => {
          const newSet = new Set(prev);
          newSet.delete(paper.oss_key);
          return newSet;
        });
        // 继续处理下一个，不中断
      }
    }

    // 刷新列表
    await loadPapers();
  }, [getAllExtractedPapers, loadPapers]);

  // 查看分析结果
  const handleViewAnalysis = useCallback((ossKey: string) => {
    navigate(`/analysis/${encodeURIComponent(ossKey)}`);
  }, [navigate]);

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

  // 判断按钮是否可用
  const canAnalyze = (status: PaperStatus) => status === 'extracted';
  const canViewAnalysis = (status: PaperStatus, hasResults?: boolean) => 
    status === 'done' && hasResults;

  // 计算总页数
  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
              DeepSeek 分析
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              管理论文的 DeepSeek 分析任务，包括已提取、分析中和已完成的论文
            </p>
          </div>
          <button
            onClick={handleStartAllAnalysis}
            disabled={!hasExtractedPapers || processingOssKeys.size > 0}
            className="px-6 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            开始分析
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
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider w-16">
                    ID
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider min-w-[280px]">
                    名称
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider w-24">
                    状态
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    操作
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
                  papers.map((paper, index) => {
                    const isProcessing = processingOssKeys.has(paper.oss_key);
                    const canAnalyzeNow = canAnalyze(paper.status) && !isProcessing;
                    const isAnalyzing = paper.status === 'analyzing';
                    const canViewNow = canViewAnalysis(paper.status, !!(paper.analysis_results_path || (paper as any).analysis_results));

                    return (
                      <tr key={paper.oss_key} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                          {(currentPage - 1) * pageSize + index + 1}
                        </td>
                        <td className="px-6 py-4 min-w-[280px] align-top">
                          <div className="text-sm font-medium text-gray-900 dark:text-white break-words">
                            {paper.filename}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusStyle(paper.status)}`}>
                            {getStatusText(paper.status)}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <div className="flex items-center justify-end space-x-2">
                            {canAnalyzeNow && (
                              <button
                                onClick={() => handleStartAnalysis(paper.oss_key)}
                                className="px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600 transition-colors text-xs"
                                disabled={isAnalyzing}
                              >
                                {isAnalyzing ? '分析中...' : '分析'}
                              </button>
                            )}
                            {isAnalyzing && (
                              <span className="px-3 py-1 bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200 rounded text-xs">
                                分析中...
                              </span>
                            )}
                            {canViewNow && (
                              <button
                                onClick={() => handleViewAnalysis(paper.oss_key)}
                                className="px-3 py-1 bg-teal-500 text-white rounded hover:bg-teal-600 transition-colors text-xs"
                              >
                                查看分析结果
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
      </div>
    </div>
  );
};

export default DeepSeekAnalysis;
