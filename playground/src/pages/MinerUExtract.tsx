/** MinerU 提取页 */
import { useState, useCallback, useEffect } from 'react';
import { deleteFile } from '../api/papers';
import { parsePaper, getTaskStatus, type MinerUParseResponse, type MinerUTaskStatusResponse } from '../api/mineru';
import { downloadAndExtract, getMarkdown } from '../api/files';
import { getAllPapers, getPapersByStatus, updatePaper, deletePaper as deletePaperStorage, type PaperInfo } from '../utils/storage';
import Loading from '../components/Loading';
import Error from '../components/Error';

const MinerUExtract = () => {
  const [papers, setPapers] = useState<PaperInfo[]>([]);
  const [processingPapers, setProcessingPapers] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [selectedMarkdown, setSelectedMarkdown] = useState<string | null>(null);
  const [selectedPaperName, setSelectedPaperName] = useState<string | null>(null);

  // 加载论文列表
  const loadPapers = useCallback(() => {
    const allPapers = getAllPapers();
    setPapers(allPapers);
  }, []);

  useEffect(() => {
    loadPapers();
  }, [loadPapers]);

  // 恢复处理中的论文（只在组件挂载时执行一次）
  useEffect(() => {
    const uploadedPapers = getPapersByStatus('uploaded');
    const parsingPapers = papers.filter(
      p => p.status === 'parsing' || p.status === 'downloading'
    );

    // 如果有上传但未处理的论文，或者有处理中断的论文，自动恢复处理
    if (uploadedPapers.length > 0 || parsingPapers.length > 0) {
      const papersToProcess = [...uploadedPapers, ...parsingPapers];
      // 延迟执行，避免在 useEffect 中直接调用异步函数
      const timer = setTimeout(() => {
        handleStartParse(papersToProcess);
      }, 100);
      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // 只在组件挂载时执行一次

  // 开始解析
  const handleStartParse = useCallback(async (papersToProcess?: PaperInfo[]) => {
    const targetPapers = papersToProcess || getPapersByStatus('uploaded');
    
    if (targetPapers.length === 0) {
      setError('没有待处理的论文');
      return;
    }

    setError(null);

    // 标记为处理中
    targetPapers.forEach(paper => {
      setProcessingPapers(prev => new Set(prev).add(paper.oss_key));
      updatePaper(paper.oss_key, { status: 'parsing' });
    });

    // 逐个处理论文
    for (const paper of targetPapers) {
      try {
        // 1. 创建 MinerU 解析任务
        const parseResult: MinerUParseResponse = await parsePaper({
          url: paper.oss_url,
          model_version: 'vlm',
        });

        const taskId = parseResult.task_id;
        updatePaper(paper.oss_key, { 
          task_id: taskId, 
          status: 'parsing' 
        });

        // 2. 轮询任务状态
        let taskStatus: MinerUTaskStatusResponse;
        let attempts = 0;
        const maxAttempts = 300; // 最多轮询 50 分钟

        do {
          await new Promise(resolve => setTimeout(resolve, 10000)); // 等待 10 秒
          taskStatus = await getTaskStatus(taskId);
          attempts++;

          updatePaper(paper.oss_key, { 
            task_id: taskId, 
            status: taskStatus.state === 'done' ? 'extracted' : 'parsing'
          });

          if (attempts >= maxAttempts) {
            throw new globalThis.Error('任务超时');
          }
        } while (taskStatus.state !== 'done' && taskStatus.state !== 'error');

        if (taskStatus.state === 'error') {
          throw new globalThis.Error(taskStatus.err_msg || '解析失败');
        }

        if (!taskStatus.full_zip_url) {
          throw new globalThis.Error('未获取到 ZIP 文件 URL');
        }

        // 3. 更新状态为下载中
        updatePaper(paper.oss_key, { status: 'downloading' });

        // 4. 下载并解压
        await downloadAndExtract({
          zip_url: taskStatus.full_zip_url,
          task_id: taskId,
        });

        // 5. 获取 Markdown 内容
        const markdownResult = await getMarkdown(taskId);
        
        // 6. 更新本地存储
        updatePaper(paper.oss_key, {
          task_id: taskId,
          status: 'extracted',
          markdown_content: markdownResult.content,
          extracted_at: new Date().toISOString(),
        });

        // 7. 删除 OSS 文件
        try {
          await deleteFile(paper.oss_key);
          deletePaperStorage(paper.oss_key);
        } catch (err) {
          console.error('删除 OSS 文件失败:', err);
        }

        // 8. 更新状态
        setProcessingPapers(prev => {
          const newSet = new Set(prev);
          newSet.delete(paper.oss_key);
          return newSet;
        });

        // 刷新列表
        loadPapers();

      } catch (err) {
        const errorMessage = err instanceof globalThis.Error ? err.message : String(err ?? '处理失败');
        updatePaper(paper.oss_key, { 
          status: 'error',
          error: errorMessage
        });
        setProcessingPapers(prev => {
          const newSet = new Set(prev);
          newSet.delete(paper.oss_key);
          return newSet;
        });
        loadPapers();
      }
    }
  }, [loadPapers]);

  // 查看 Markdown
  const handleViewMarkdown = useCallback((paper: PaperInfo) => {
    if (paper.markdown_content) {
      setSelectedMarkdown(paper.markdown_content);
      setSelectedPaperName(paper.filename);
    }
  }, []);

  // 关闭 Markdown 查看
  const handleCloseMarkdown = useCallback(() => {
    setSelectedMarkdown(null);
    setSelectedPaperName(null);
  }, []);

  const uploadedPapers = getPapersByStatus('uploaded');
  const extractedPapers = getPapersByStatus('extracted');
  const errorPapers = getPapersByStatus('error');

  return (
    <div className="p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            MinerU 提取
          </h1>
          {uploadedPapers.length > 0 && (
            <button
              onClick={() => handleStartParse()}
              disabled={processingPapers.size > 0}
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
        {papers.filter(p => processingPapers.has(p.oss_key) || p.status === 'parsing' || p.status === 'downloading').length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
              处理中
            </h2>
            <div className="space-y-2">
              {papers
                .filter(p => processingPapers.has(p.oss_key) || p.status === 'parsing' || p.status === 'downloading')
                .map((paper) => (
                  <div
                    key={paper.oss_key}
                    className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg"
                  >
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-medium text-gray-900 dark:text-white truncate">
                        {paper.filename}
                      </h3>
                      {paper.task_id && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          Task: {paper.task_id.slice(0, 8)}...
                        </p>
                      )}
                    </div>
                    <div className="ml-4">
                      <Loading />
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
                    {paper.markdown_content && (
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
        {papers.length === 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-12 text-center">
            <p className="text-gray-500 dark:text-gray-400">
              还没有论文，请先前往"论文上传"页面上传论文
            </p>
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

