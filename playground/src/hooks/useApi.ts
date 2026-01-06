/** API 请求 Hook */
import { useState, useEffect } from 'react';
import apiClient from '../api/client';
import type { AxiosRequestConfig } from 'axios';

interface UseApiOptions {
  url: string;
  config?: AxiosRequestConfig;
  immediate?: boolean;
}

interface UseApiResult<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
  execute: () => Promise<void>;
  reset: () => void;
}

function useApi<T = unknown>({
  url,
  config,
  immediate = false,
}: UseApiOptions<T>): UseApiResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);

  const execute = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiClient.get<T>(url, config);
      setData(response.data);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown error');
      setError(error);
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setData(null);
    setError(null);
    setLoading(false);
  };

  useEffect(() => {
    if (immediate) {
      execute();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);

  return { data, loading, error, execute, reset };
}

export default useApi;

