/** 侧边栏组件 */
import { Link, useLocation } from 'react-router-dom';

interface SidebarProps {
  className?: string;
}

const Sidebar = ({ className = '' }: SidebarProps) => {
  const location = useLocation();

  const menuItems = [
    { path: '/', label: '欢迎页', icon: '🏠' },
    { path: '/papers', label: '论文管理', icon: '📚' },
    { path: '/upload', label: '论文上传', icon: '📤' },
    { path: '/mineru', label: 'MinerU提取', icon: '📄' },
    { path: '/deepseek', label: 'DeepSeek分析', icon: '🤖' },
  ];

  return (
    <div className={`w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 ${className}`}>
      <div className="p-4">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6">
          论文批量读取系统
        </h2>
        <nav className="space-y-2">
          {menuItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
                  isActive
                    ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 font-medium'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
              >
                <span className="text-xl">{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
};

export default Sidebar;

