import { useState } from 'react';

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE' | 'PUT';
  headers?: Record<string, string>;
  body?: string;
}

interface ApiResponse<T = any> {
  success: boolean;
  data: T;
  error?: string;
}

interface UseApiReturn {
  request: <T = any>(url: string, options?: RequestOptions) => Promise<ApiResponse<T>>;
  loading: boolean;
  error: string | null;
}

export function useApi(): UseApiReturn {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const request = async <T = any>(
    url: string,
    options: RequestOptions = {}
  ): Promise<ApiResponse<T>> => {
    try {
      setLoading(true);
      setError(null);

      const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3333';
      const token = import.meta.env.VITE_API_TOKEN || '';

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'x-api-key': token,
        ...options.headers,
      };

      const config: RequestInit = {
        method: options.method || 'GET',
        headers,
      };

      if (options.body) {
        config.body = options.body;
      }

      const response = await fetch(`${baseUrl}${url}`, config);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage =
          errorData.message || errorData.error || `HTTP ${response.status}`;
        throw new Error(errorMessage);
      }

      const data = await response.json();

      return {
        success: true,
        data: data.data || data,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return {
    request,
    loading,
    error,
  };
}
