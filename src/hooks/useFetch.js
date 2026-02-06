import { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';

const useFetch = (url, options = {}) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const abortControllerRef = useRef(null);
  const { immediate = true, ...axiosOptions } = options;

  const execute = useCallback(async (overrideUrl) => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    abortControllerRef.current = new AbortController();

    setLoading(true);
    setError(null);

    try {
      const response = await axios({
        url: overrideUrl || url,
        signal: abortControllerRef.current.signal,
        ...axiosOptions,
      });
      setData(response.data);
      return response.data;
    } catch (err) {
      if (err.name !== 'CanceledError') {
        setError(err.message || 'An error occurred');
      }
      throw err;
    } finally {
      setLoading(false);
    }
  }, [url, axiosOptions]);

  useEffect(() => {
    if (immediate && url) {
      execute();
    }

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [immediate, url, execute]);

  const refetch = useCallback(() => execute(url), [execute, url]);

  return { data, loading, error, refetch, execute };
};

export default useFetch;
