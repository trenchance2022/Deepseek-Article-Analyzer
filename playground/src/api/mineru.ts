/** MinerU 相关API */
import apiClient from './client';

export interface MinerUParseRequest {
  url: string;
  model_version?: string;
  data_id?: string;
  enable_formula?: boolean;
  enable_table?: boolean;
  language?: string;
  is_ocr?: boolean;
  page_ranges?: string;
}

export interface MinerUParseResponse {
  task_id: string;
  trace_id: string | null;
}

export interface MinerUTaskStatusResponse {
  task_id: string;
  state: string;
  data_id: string | null;
  full_zip_url: string | null;
  err_msg: string | null;
  extract_progress: Record<string, any> | null;
}

/**
 * 创建 MinerU 解析任务
 */
export const parsePaper = async (
  request: MinerUParseRequest
): Promise<MinerUParseResponse> => {
  const response = await apiClient.post<MinerUParseResponse>(
    '/v1/mineru/parse',
    request
  );
  return response.data;
};

/**
 * 查询 MinerU 任务状态
 */
export const getTaskStatus = async (
  taskId: string
): Promise<MinerUTaskStatusResponse> => {
  const response = await apiClient.get<MinerUTaskStatusResponse>(
    `/v1/mineru/task/${taskId}`
  );
  return response.data;
};

