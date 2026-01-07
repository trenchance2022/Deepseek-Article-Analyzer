/** 论文提取和分析操作 API */

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

export interface StartAnalysisResponse {
  oss_key: string;
  message: string;
}

export interface AnalysisResultsResponse {
  oss_key: string;
  results: { [key: string]: string };
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

/**
 * 开始论文分析
 * POST /api/v1/papers/{oss_key}/analysis
 */
export const startAnalysis = async (ossKey: string): Promise<StartAnalysisResponse> => {
  const response = await apiClient.post<StartAnalysisResponse>(
    `/v1/papers/${encodeURIComponent(ossKey)}/analysis`
  );
  return response.data;
};

/**
 * 获取论文分析结果
 * GET /api/v1/papers/{oss_key}/analysis
 */
export const getAnalysisResults = async (ossKey: string): Promise<AnalysisResultsResponse> => {
  const response = await apiClient.get<AnalysisResultsResponse>(
    `/v1/papers/${encodeURIComponent(ossKey)}/analysis`
  );
  return response.data;
};
