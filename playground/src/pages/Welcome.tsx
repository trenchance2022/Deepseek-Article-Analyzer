/** 欢迎页 */
import { useNavigate } from 'react-router-dom';
import { getAllPapers } from '../utils/storage';

const Welcome = () => {
  const navigate = useNavigate();
  const papers = getAllPapers();

  const statusCounts = {
    uploaded: papers.filter(p => p.status === 'uploaded').length,
    parsing: papers.filter(p => p.status === 'parsing' || p.status === 'downloading').length,
    extracted: papers.filter(p => p.status === 'extracted').length,
    done: papers.filter(p => p.status === 'done').length,
    error: papers.filter(p => p.status === 'error').length,
  };

  return (
    <div className="p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
          欢迎使用论文批量读取系统
        </h1>
        <p className="text-lg text-gray-600 dark:text-gray-400 mb-8">
          基于MinerU和DeepSeek的PDF论文批量处理系统
        </p>

        {/* 统计信息 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="text-3xl font-bold text-blue-600 dark:text-blue-400 mb-2">
              {papers.length}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">总论文数</div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="text-3xl font-bold text-yellow-600 dark:text-yellow-400 mb-2">
              {statusCounts.uploaded + statusCounts.parsing}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">处理中</div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="text-3xl font-bold text-green-600 dark:text-green-400 mb-2">
              {statusCounts.extracted + statusCounts.done}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">已提取</div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="text-3xl font-bold text-red-600 dark:text-red-400 mb-2">
              {statusCounts.error}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">失败</div>
          </div>
        </div>

        {/* 快速操作 */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-8">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            快速操作
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <button
              onClick={() => navigate('/upload')}
              className="p-4 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg hover:border-blue-500 transition-colors text-left"
            >
              <div className="text-2xl mb-2">📤</div>
              <div className="font-medium text-gray-900 dark:text-white">上传论文</div>
              <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                批量上传PDF文件
              </div>
            </button>
            <button
              onClick={() => navigate('/mineru')}
              className="p-4 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg hover:border-blue-500 transition-colors text-left"
            >
              <div className="text-2xl mb-2">📄</div>
              <div className="font-medium text-gray-900 dark:text-white">MinerU提取</div>
              <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                查看提取进度
              </div>
            </button>
            <button
              onClick={() => navigate('/deepseek')}
              className="p-4 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg hover:border-blue-500 transition-colors text-left"
            >
              <div className="text-2xl mb-2">🤖</div>
              <div className="font-medium text-gray-900 dark:text-white">DeepSeek分析</div>
              <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                分析论文内容
              </div>
            </button>
          </div>
        </div>

        {/* 最近论文 */}
        {papers.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
              最近论文
            </h2>
            <div className="space-y-2">
              {papers.slice(0, 5).map((paper) => (
                <div
                  key={paper.oss_key}
                  className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {paper.filename}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      {paper.uploaded_at
                        ? new Date(paper.uploaded_at).toLocaleString('zh-CN')
                        : '未知时间'}
                    </div>
                  </div>
                  <span
                    className={`ml-4 px-2 py-1 rounded text-xs font-medium ${
                      paper.status === 'done'
                        ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                        : paper.status === 'error'
                        ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                        : paper.status === 'extracted'
                        ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                        : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                    }`}
                  >
                    {paper.status === 'done'
                      ? '完成'
                      : paper.status === 'error'
                      ? '失败'
                      : paper.status === 'extracted'
                      ? '已提取'
                      : paper.status === 'uploaded'
                      ? '已上传'
                      : '处理中'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Welcome;

