/** 论文上传页 */
import { useState, useCallback, useEffect } from 'react';
import { type UploadResponse } from '../api/papers';
import { getAllPapers, type PaperInfo } from '../api/papersManagement';
import FileUploader from '../components/FileUploader';
import Error from '../components/Error';

const PaperUpload = () => {
  const [error, setError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [uploadedCount, setUploadedCount] = useState(0);
  const [existingPapers, setExistingPapers] = useState<PaperInfo[]>([]);
  const [total, setTotal] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(10);
  const [loading, setLoading] = useState(false);

  // 加载已上传及之后状态的论文（分页）
  const loadExistingPapers = useCallback(async () => {
    setLoading(true);
    try {
      const offset = (currentPage - 1) * pageSize;
      const response = await getAllPapers({ offset, limit: pageSize });
      // 查询所有状态为 uploaded 及之后状态的论文（排除 uploading）
      const filtered = response.items.filter(
        p => p.status !== 'uploading' && 
        (p.status === 'uploaded' || p.status === 'parsing' || p.status === 'downloading' || 
         p.status === 'extracted' || p.status === 'analyzing' || p.status === 'done' || p.status === 'error')
      );
      setExistingPapers(filtered);
      setTotal(response.total);
    } catch (err) {
      console.error('加载论文列表失败:', err);
    } finally {
      setLoading(false);
    }
  }, [currentPage, pageSize]);

  useEffect(() => {
    loadExistingPapers();
    // 定期刷新
    const interval = setInterval(loadExistingPapers, 3000);
    return () => clearInterval(interval);
  }, [loadExistingPapers]);

  const handleUploadSuccess = useCallback((results: UploadResponse[]) => {
    setError(null);
    setUploadSuccess(true);
    setUploadedCount(results.length);
    // 后端会自动创建论文记录，刷新列表
    setTimeout(() => {
      loadExistingPapers();
    }, 500);
  }, [loadExistingPapers]);

  const handleUploadError = useCallback((err: Error) => {
    setError(err.message);
    setUploadSuccess(false);
  }, []);

  return (
    <div className="p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-6">
          论文上传
        </h1>

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

        <FileUploader
          onUploadSuccess={handleUploadSuccess}
          onUploadError={handleUploadError}
          multiple={true}
          accept=".pdf"
        />

        {/* 已上传的论文列表 */}
        {existingPapers.length > 0 && (
          <div className="mt-8 bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
              已上传的论文 (共 {total} 条)
            </h2>
            {loading ? (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">加载中...</div>
            ) : (
              <>
                <div className="space-y-2">
                  {existingPapers.map((paper) => (
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
                      <span
                        className={`ml-4 px-2 py-1 rounded text-xs font-medium ${
                          paper.status === 'extracted'
                            ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                            : paper.status === 'error'
                            ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                            : paper.status === 'parsing' || paper.status === 'downloading'
                            ? 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200'
                            : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                        }`}
                      >
                        {paper.status === 'extracted'
                          ? '已提取'
                          : paper.status === 'error'
                          ? '失败'
                          : paper.status === 'parsing'
                          ? '解析中'
                          : paper.status === 'downloading'
                          ? '下载中'
                          : paper.status === 'uploaded'
                          ? '已上传'
                          : '处理中'}
                      </span>
                    </div>
                  ))}
                </div>
                {/* 分页 */}
                {Math.ceil(total / pageSize) > 1 && (
                  <div className="mt-4 flex items-center justify-between">
                    <div className="text-sm text-gray-700 dark:text-gray-300">
                      共 {total} 条
                    </div>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                        disabled={currentPage === 1}
                        className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        上一页
                      </button>
                      <span className="text-sm text-gray-700 dark:text-gray-300">
                        第 {currentPage} / {Math.ceil(total / pageSize)} 页
                      </span>
                      <button
                        onClick={() => setCurrentPage(prev => Math.min(Math.ceil(total / pageSize), prev + 1))}
                        disabled={currentPage >= Math.ceil(total / pageSize)}
                        className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        下一页
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default PaperUpload;

