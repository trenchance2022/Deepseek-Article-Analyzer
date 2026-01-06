/** 论文上传页 */
import { useState, useCallback } from 'react';
import { type UploadResponse } from '../api/papers';
import { addPapers } from '../utils/storage';
import FileUploader from '../components/FileUploader';
import Error from '../components/Error';

const PaperUpload = () => {
  const [error, setError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [uploadedCount, setUploadedCount] = useState(0);

  const handleUploadSuccess = useCallback((results: UploadResponse[]) => {
    setError(null);
    setUploadSuccess(true);
    setUploadedCount(results.length);
    
    // 保存到本地存储，状态为 uploaded
    addPapers(
      results.map((r) => ({
        oss_key: r.oss_key,
        oss_url: r.oss_url,
        filename: r.filename,
        size: r.size,
        status: 'uploaded' as const,
        uploaded_at: new Date().toISOString(),
      }))
    );
  }, []);

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
      </div>
    </div>
  );
};

export default PaperUpload;

