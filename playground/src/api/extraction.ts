/** 论文提取操作 API */

import apiClient from './client';

export interface StartExtractionResponse {
  task_id: string;
  oss_key: string;
  message: string;
}

export interface StopExtractionResponse {
  success: boolean;
  message: string;
}

/**
 * 开始论文提取
 * POST /api/v1/papers/{oss_key}/extraction
 */
export const startExtraction = async (ossKey: string): Promise<StartExtractionResponse> => {
  const response = await apiClient.post<StartExtractionResponse>(
    `/v1/papers/${encodeURIComponent(ossKey)}/extraction`
  );
  return response.data;
};

/**
 * 停止论文提取
 * DELETE /api/v1/papers/{oss_key}/extraction
 */
export const stopExtraction = async (ossKey: string): Promise<StopExtractionResponse> => {
  const response = await apiClient.delete<StopExtractionResponse>(
    `/v1/papers/${encodeURIComponent(ossKey)}/extraction`
  );
  return response.data;
};
