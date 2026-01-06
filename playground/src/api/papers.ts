/** 论文相关API */
import apiClient from './client';
import type { AxiosProgressEvent } from 'axios';

export interface UploadResponse {
  oss_key: string;
  oss_url: string;
  filename: string;
  size: number;
}

export interface DeleteResponse {
  success: boolean;
  message: string;
}

/**
 * 上传单个PDF文件
 */
export const uploadFile = async (
  file: File,
  onProgress?: (progress: number) => void
): Promise<UploadResponse> => {
  const formData = new FormData();
  formData.append('file', file);

  const response = await apiClient.post<UploadResponse>(
    '/v1/papers/upload',
    formData,
    {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress: (progressEvent: AxiosProgressEvent) => {
        if (onProgress && progressEvent.total) {
          const progress = Math.round(
            (progressEvent.loaded * 100) / progressEvent.total
          );
          onProgress(progress);
        }
      },
    }
  );

  return response.data;
};

/**
 * 批量上传PDF文件
 */
export const uploadFiles = async (
  files: File[],
  onProgress?: (fileIndex: number, progress: number) => void
): Promise<UploadResponse[]> => {
  const formData = new FormData();
  files.forEach((file) => {
    formData.append('files', file);
  });

  const response = await apiClient.post<UploadResponse[]>(
    '/v1/papers/upload/batch',
    formData,
    {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress: (progressEvent: AxiosProgressEvent) => {
        if (onProgress && progressEvent.total) {
          const progress = Math.round(
            (progressEvent.loaded * 100) / progressEvent.total
          );
          // 简单处理：平均分配进度到各个文件
          const progressPerFile = Math.floor(progress / files.length);
          files.forEach((_, index) => {
            onProgress(index, progressPerFile);
          });
        }
      },
    }
  );

  return response.data;
};

/**
 * 删除OSS中的文件
 */
export const deleteFile = async (ossKey: string): Promise<DeleteResponse> => {
  const response = await apiClient.delete<DeleteResponse>(
    `/v1/papers/delete/${encodeURIComponent(ossKey)}`
  );
  return response.data;
};

