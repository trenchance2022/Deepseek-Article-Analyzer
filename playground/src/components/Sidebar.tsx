/** 侧边栏组件 */
import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';

interface SidebarProps {
  className?: string;
}

const Sidebar = ({ className = '' }: SidebarProps) => {
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);

  const menuItems = [
    { path: '/', label: '欢迎页', icon: '🏠' },
    { path: '/papers', label: '论文管理', icon: '📚' },
    { path: '/upload', label: '论文上传', icon: '📤' },
    { path: '/mineru', label: 'MinerU提取', icon: '📄' },
    { path: '/deepseek', label: 'DeepSeek分析', icon: '🤖' },
  ];

  return (
    <div
      className={`flex flex-col bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 transition-all duration-300 ${
        collapsed ? 'w-16' : 'w-64'
      } ${className}`}
    >
      <div className={`p-4 flex items-center ${collapsed ? 'justify-center' : 'justify-between'}`}>
        {!collapsed && (
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            论文批量读取系统
          </h2>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          title={collapsed ? '展开侧边栏' : '收起侧边栏'}
        >
          <span className="text-lg">
            {collapsed ? '→' : '←'}
          </span>
        </button>
      </div>
      <nav className="space-y-2 px-2 pb-4">
        {menuItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center rounded-lg transition-colors ${
                collapsed ? 'justify-center px-2 py-3' : 'space-x-3 px-4 py-3'
              } ${
                isActive
                  ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 font-medium'
                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
              title={collapsed ? item.label : undefined}
            >
              <span className="text-xl shrink-0">{item.icon}</span>
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>
    </div>
  );
};

export default Sidebar;

