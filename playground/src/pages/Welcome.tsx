/** 欢迎页 */
import { useNavigate } from 'react-router-dom';
import { getStatusStats, type StatusStats } from '../api/papersManagement';
import { useEffect, useState } from 'react';

const Welcome = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState<StatusStats>({
    total: 0,
    uploading: 0,
    uploaded: 0,
    parsing: 0,
    downloading: 0,
    extracted: 0,
    analyzing: 0,
    done: 0,
    error: 0,
  });

  // 加载数据
  const loadData = async () => {
    try {
      const statsData = await getStatusStats();
      setStats(statsData);
    } catch (err) {
      console.error('加载数据失败:', err);
    }
  };

  useEffect(() => {
    loadData();
    // 定期刷新统计信息
    const interval = setInterval(loadData, 2000);
    return () => clearInterval(interval);
  }, []);

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
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4 mb-8">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="text-3xl font-bold text-blue-600 dark:text-blue-400 mb-2">
              {stats.total}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">总论文数</div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="text-3xl font-bold text-yellow-600 dark:text-yellow-400 mb-2">
              {stats.uploading}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">上传中</div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="text-3xl font-bold text-amber-600 dark:text-amber-400 mb-2">
              {stats.uploaded}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">已上传</div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="text-3xl font-bold text-purple-600 dark:text-purple-400 mb-2">
              {stats.parsing + stats.downloading}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">提取中</div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="text-3xl font-bold text-green-600 dark:text-green-400 mb-2">
              {stats.extracted}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">已提取</div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="text-3xl font-bold text-indigo-600 dark:text-indigo-400 mb-2">
              {stats.analyzing}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">分析中</div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="text-3xl font-bold text-emerald-600 dark:text-emerald-400 mb-2">
              {stats.done}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">已完成</div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="text-3xl font-bold text-red-600 dark:text-red-400 mb-2">
              {stats.error}
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

      </div>
    </div>
  );
};

export default Welcome;

