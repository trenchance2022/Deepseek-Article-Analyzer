/** 分析结果可视化页面 */
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getAnalysisResults } from '../api/extraction';
import Error from '../components/Error';
import Loading from '../components/Loading';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';

interface AnalysisResults {
  [key: string]: any;
}

const AnalysisResultsPage = () => {
  const { ossKey } = useParams<{ ossKey: string }>();
  const navigate = useNavigate();
  const [results, setResults] = useState<AnalysisResults | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  useEffect(() => {
    if (!ossKey) {
      setError('缺少论文标识');
      setLoading(false);
      return;
    }

    const loadResults = async () => {
      try {
        // URL 解码 ossKey
        const decodedOssKey = decodeURIComponent(ossKey);
        const response = await getAnalysisResults(decodedOssKey);
        setResults(response.results);
      } catch (err) {
        const errorMessage = err instanceof globalThis.Error ? err.message : String(err ?? '加载分析结果失败');
        setError(errorMessage);
      } finally {
        setLoading(false);
      }
    };

    loadResults();
  }, [ossKey]);

  const copyToClipboard = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2000);
    } catch (err) {
      console.error('复制失败:', err);
    }
  };

  const renderValue = (value: any, depth: number = 0, key: string = ''): React.ReactNode => {
    if (depth > 4) {
      return <span className="text-gray-500 dark:text-gray-400">（嵌套过深，已省略）</span>;
    }

    if (value === null || value === undefined) {
      return <span className="text-gray-400 dark:text-gray-500">null</span>;
    }

    if (typeof value === 'string') {
      // 判断是否是 markdown 内容（简单判断：包含 markdown 常见标记或数学公式）
      const isMarkdown = /^[\s\S]*(#{1,6}\s|[\*\-\+]\s|```|\[.*\]\(.*\)|!\[.*\]\(.*\)|\$[^$]+\$|\$\$[\s\S]+\$\$)/.test(value);
      
      if (isMarkdown) {
        return (
          <div className="mt-2">
            <div className="prose prose-sm dark:prose-invert max-w-none bg-gray-50 dark:bg-gray-900 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
              <ReactMarkdown
                remarkPlugins={[remarkMath]}
                rehypePlugins={[rehypeKatex]}
              >
                {value}
              </ReactMarkdown>
            </div>
          </div>
        );
      } else {
        return (
          <div className="mt-2">
            <pre className="whitespace-pre-wrap text-sm text-gray-800 dark:text-gray-200 font-mono bg-gray-50 dark:bg-gray-900 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
              {value}
            </pre>
          </div>
        );
      }
    }

    if (typeof value === 'number' || typeof value === 'boolean') {
      return <span className="text-blue-600 dark:text-blue-400 font-mono">{String(value)}</span>;
    }

    if (Array.isArray(value)) {
      return (
        <div className="mt-2 ml-4 border-l-2 border-gray-300 dark:border-gray-600 pl-4">
          {value.map((item, index) => (
            <div key={index} className="mb-2">
              <span className="text-gray-500 dark:text-gray-400 font-mono text-sm">[{index}]</span>
              <div className="mt-1">{renderValue(item, depth + 1, `${key}[${index}]`)}</div>
            </div>
          ))}
        </div>
      );
    }

    if (typeof value === 'object') {
      return (
        <div className="mt-2 ml-4 border-l-2 border-gray-300 dark:border-gray-600 pl-4">
          {Object.entries(value).map(([k, v]) => (
            <div key={k} className="mb-3">
              <div className="font-semibold text-gray-700 dark:text-gray-300 mb-1">
                {k}:
              </div>
              <div className="mt-1">{renderValue(v, depth + 1, key ? `${key}.${k}` : k)}</div>
            </div>
          ))}
        </div>
      );
    }

    return <span className="text-gray-500 dark:text-gray-400">{String(value)}</span>;
  };

  if (loading) {
    return (
      <div className="p-8">
        <div className="max-w-6xl mx-auto">
          <Loading />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8">
        <div className="max-w-6xl mx-auto">
          <Error message={error} />
          <button
            onClick={() => navigate(-1)}
            className="mt-4 px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors"
          >
            返回
          </button>
        </div>
      </div>
    );
  }

  if (!results) {
    return (
      <div className="p-8">
        <div className="max-w-6xl mx-auto">
          <div className="text-center text-gray-500 dark:text-gray-400">
            暂无分析结果
          </div>
          <button
            onClick={() => navigate(-1)}
            className="mt-4 px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors"
          >
            返回
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
              分析结果
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              论文标识: {ossKey ? decodeURIComponent(ossKey) : '未知'}
            </p>
          </div>
          <button
            onClick={() => navigate(-1)}
            className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors"
          >
            返回
          </button>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
          {Object.entries(results).map(([key, value]) => (
            <div key={key} className="mb-6 pb-6 border-b border-gray-200 dark:border-gray-700 last:border-b-0">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                  {key === 'abstract' ? '摘要' :
                   key === 'introduction' ? '引言' :
                   key === 'conclusion' ? '结论' :
                   key === 'problem_modeling' ? '问题建模' :
                   key === 'algorithm' ? '算法思路' :
                   key === 'summary' ? '论文总结' : key}
                </h2>
                <button
                  onClick={() => copyToClipboard(typeof value === 'string' ? value : JSON.stringify(value, null, 2), key)}
                  className="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors flex items-center gap-1"
                >
                  {copiedKey === key ? (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      已复制
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                      复制
                    </>
                  )}
                </button>
              </div>
              <div className="text-gray-800 dark:text-gray-200">
                {renderValue(value, 0, key)}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AnalysisResultsPage;

