/** 论文资源管理 API */

import apiClient from './client';

export type PaperStatus = 'uploading' | 'uploaded' | 'parsing' | 'downloading' | 'extracted' | 'analyzing' | 'done' | 'error';

export interface PaperInfo {
  oss_key: string;
  oss_url: string;
  filename: string;
  size?: number;
  task_id?: string;
  status: PaperStatus;
  markdown_path?: string;  // markdown 文件路径（相对于 working_dir）
  error?: string;
  uploaded_at?: string;
  extracted_at?: string;
  analyzed_at?: string;
  analysis_results_path?: string;  // 分析结果文件路径
}

export interface MarkdownContent {
  oss_key: string;
  content: string;
}

export interface StatusStats {
  total: number;
  uploading: number;
  uploaded: number;
  parsing: number;
  downloading: number;
  extracted: number;
  analyzing: number;
  done: number;
  error: number;
}

export interface PaperListResponse {
  items: PaperInfo[];
  total: number;
  offset: number;
  limit: number;
}

export interface GetAllPapersOptions {
  status?: PaperStatus | string;  // 支持单个状态或多个状态（逗号分隔）
  offset?: number;
  limit?: number;
}

/**
 * 获取论文列表（分页）
 * GET /api/v1/papers
 * GET /api/v1/papers?status=uploaded&offset=0&limit=10
 */
export const getAllPapers = async (options?: GetAllPapersOptions): Promise<PaperListResponse> => {
  const params: Record<string, string | number> = {};
  if (options?.status) {
    params.status = options.status;
  }
  if (options?.offset !== undefined) {
    params.offset = options.offset;
  }
  if (options?.limit !== undefined) {
    params.limit = options.limit;
  }
  const response = await apiClient.get<PaperListResponse>('/v1/papers', { params });
  return response.data;
};

/**
 * 获取状态统计
 * GET /api/v1/papers/stats
 */
export const getStatusStats = async (): Promise<StatusStats> => {
  const response = await apiClient.get<StatusStats>('/v1/papers/stats');
  return response.data;
};

/**
 * 根据 oss_key 获取论文信息
 * GET /api/v1/papers/{oss_key}
 */
export const getPaperByOssKey = async (ossKey: string): Promise<PaperInfo> => {
  const response = await apiClient.get<PaperInfo>(`/v1/papers/${encodeURIComponent(ossKey)}`);
  return response.data;
};

/**
 * 更新论文信息
 * PUT /api/v1/papers/{oss_key}
 */
export const updatePaper = async (ossKey: string, updates: Partial<PaperInfo>): Promise<PaperInfo> => {
  const response = await apiClient.put<PaperInfo>(`/v1/papers/${encodeURIComponent(ossKey)}`, updates);
  return response.data;
};

/**
 * 获取论文的 Markdown 内容
 * GET /api/v1/papers/{oss_key}/markdown
 */
export const getPaperMarkdown = async (ossKey: string): Promise<MarkdownContent> => {
  const response = await apiClient.get<MarkdownContent>(`/v1/papers/${encodeURIComponent(ossKey)}/markdown`);
  return response.data;
};

/**
 * 删除论文记录
 * DELETE /api/v1/papers/{oss_key}
 */
export const deletePaper = async (ossKey: string): Promise<void> => {
  await apiClient.delete(`/v1/papers/${encodeURIComponent(ossKey)}`);
};
