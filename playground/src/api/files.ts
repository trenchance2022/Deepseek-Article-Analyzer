/** 文件相关API */
import apiClient from './client';

export interface DownloadAndExtractRequest {
  zip_url: string;
  task_id: string;
}

export interface DownloadAndExtractResponse {
  success: boolean;
  task_dir: string;
  markdown_path: string;
  message: string;
}

export interface MarkdownResponse {
  task_id: string;
  content: string;
}

/**
 * 下载并解压 ZIP 文件
 */
export const downloadAndExtract = async (
  request: DownloadAndExtractRequest
): Promise<DownloadAndExtractResponse> => {
  const response = await apiClient.post<DownloadAndExtractResponse>(
    '/v1/files/download-extract',
    request
  );
  return response.data;
};

// 注意：已移除通过 task_id 获取 markdown 的接口
// 统一使用 papersManagement.getPaperMarkdown(ossKey) 接口
// 因为 oss_key 是唯一标识，一个 oss_key 对应一个论文

