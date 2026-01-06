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

/**
 * 获取 Markdown 内容
 */
export const getMarkdown = async (
  taskId: string
): Promise<MarkdownResponse> => {
  const response = await apiClient.get<MarkdownResponse>(
    `/v1/files/markdown/${taskId}`
  );
  return response.data;
};

