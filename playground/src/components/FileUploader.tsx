/** 文件上传组件 */
import { useState, useCallback } from 'react';
import { uploadFiles, type UploadResponse } from '../api/papers';
import Loading from './Loading';
import Error from './Error';

interface FileUploaderProps {
  onUploadSuccess?: (results: UploadResponse[]) => void;
  onUploadError?: (error: Error) => void;
  multiple?: boolean;
  accept?: string;
}

const FileUploader = ({
  onUploadSuccess,
  onUploadError,
  multiple = true,
  accept = '.pdf',
}: FileUploaderProps) => {
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<Record<number, number>>({});
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<UploadResponse[]>([]);

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const selectedFiles = Array.from(e.target.files || []);
      
      // 验证文件类型
      const validFiles = selectedFiles.filter((file) => {
        if (!file.name.toLowerCase().endsWith('.pdf')) {
          setError(`${file.name} 不是PDF文件`);
          return false;
        }
        return true;
      });

      if (validFiles.length > 0) {
        setFiles((prev) => (multiple ? [...prev, ...validFiles] : validFiles));
        setError(null);
      }
    },
    [multiple]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const droppedFiles = Array.from(e.dataTransfer.files);
      const validFiles = droppedFiles.filter((file) =>
        file.name.toLowerCase().endsWith('.pdf')
      );

      if (validFiles.length > 0) {
        setFiles((prev) => (multiple ? [...prev, ...validFiles] : validFiles));
        setError(null);
      } else {
        setError('请拖放PDF文件');
      }
    },
    [multiple]
  );

  const handleUpload = useCallback(async () => {
    if (files.length === 0) {
      setError('请先选择文件');
      return;
    }

    setUploading(true);
    setError(null);
    setProgress({});

    try {
      const uploadResults = await uploadFiles(files, (fileIndex, progress) => {
        setProgress((prev) => ({
          ...prev,
          [fileIndex]: progress,
        }));
      });

      setResults(uploadResults);
      onUploadSuccess?.(uploadResults);
      
      // 上传成功后，清除已上传的文件列表
      setFiles([]);
      setProgress({});
    } catch (err) {
      const error = err instanceof globalThis.Error ? err : new globalThis.Error(String(err ?? '上传失败'));
      setError(error.message);
      onUploadError?.(error);
    } finally {
      setUploading(false);
    }
  }, [files, onUploadSuccess, onUploadError]);

  const handleRemove = useCallback((index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
    setProgress((prev) => {
      const newProgress = { ...prev };
      delete newProgress[index];
      return newProgress;
    });
  }, []);

  const handleClear = useCallback(() => {
    setFiles([]);
    setProgress({});
    setError(null);
    setResults([]);
  }, []);

  return (
    <div className="w-full max-w-4xl mx-auto p-6">
      {/* 上传区域 */}
      <div
        className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-8 text-center hover:border-blue-500 transition-colors"
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        <input
          type="file"
          id="file-upload"
          className="hidden"
          multiple={multiple}
          accept={accept}
          onChange={handleFileSelect}
        />
        <label
          htmlFor="file-upload"
          className="cursor-pointer flex flex-col items-center"
        >
          <svg
            className="w-12 h-12 text-gray-400 mb-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
            />
          </svg>
          <span className="text-lg font-medium text-gray-700 dark:text-gray-300 mb-2">
            点击选择文件或拖放文件到此处
          </span>
          <span className="text-sm text-gray-500 dark:text-gray-400">
            支持PDF文件，{multiple ? '可多选' : '单选'}
          </span>
        </label>
      </div>

      {/* 错误提示 */}
      {error && (
        <div className="mt-4">
          <Error message={error} />
        </div>
      )}

      {/* 文件列表 */}
      {files.length > 0 && (
        <div className="mt-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              已选择文件 ({files.length})
            </h3>
            <div className="space-x-2">
              <button
                onClick={handleClear}
                className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
                disabled={uploading}
              >
                清空
              </button>
              <button
                onClick={handleUpload}
                disabled={uploading}
                className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {uploading ? '上传中...' : '开始上传'}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            {files.map((file, index) => (
              <div
                key={`${file.name}-${index}`}
                className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                    {file.name}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {(file.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                  {uploading && progress[index] !== undefined && (
                    <div className="mt-2">
                      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                        <div
                          className="bg-blue-500 h-2 rounded-full transition-all"
                          style={{ width: `${progress[index]}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>
                {!uploading && (
                  <button
                    onClick={() => handleRemove(index)}
                    className="ml-4 text-red-500 hover:text-red-700"
                  >
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 上传结果 */}
      {results.length > 0 && (
        <div className="mt-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            上传成功 ({results.length})
          </h3>
          <div className="space-y-2">
            {results.map((result, index) => (
              <div
                key={index}
                className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg"
              >
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  {result.filename}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 break-all">
                  OSS Key: {result.oss_key}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 break-all">
                  OSS URL: {result.oss_url}
                </p>
                <a
                  href={result.oss_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-500 hover:text-blue-700 mt-1 inline-block"
                >
                  查看文件 →
                </a>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 加载状态 */}
      {uploading && (
        <div className="mt-4">
          <Loading />
        </div>
      )}
    </div>
  );
};

export default FileUploader;

