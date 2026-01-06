/** 文件上传页面 */
import FileUploader from '../components/FileUploader';
import type { UploadResponse } from '../api/papers';

const Upload = () => {
  const handleUploadSuccess = (results: UploadResponse[]) => {
    console.log('上传成功:', results);
    // 可以在这里处理上传成功后的逻辑
  };

  const handleUploadError = (error: Error) => {
    console.error('上传失败:', error);
    // 可以在这里处理上传失败后的逻辑
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
      <div className="container mx-auto px-4">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            论文PDF上传
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            上传PDF文件到阿里云OSS，支持批量上传
          </p>
        </div>

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

export default Upload;

