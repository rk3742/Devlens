import { useState } from 'react';

/**
 * Generic async-operation hook.
 * Returns { data, loading, error, execute } where execute triggers the async fn.
 *
 * @param {Function} asyncFn  - async function to wrap
 */
export function useAsync(asyncFn) {
  const [state, setState] = useState({ data: null, loading: false, error: null });

  const execute = async (...args) => {
    setState({ data: null, loading: true, error: null });
    try {
      const data = await asyncFn(...args);
      setState({ data, loading: false, error: null });
      return data;
    } catch (err) {
      setState({ data: null, loading: false, error: err.message });
      throw err;
    }
  };

  return { ...state, execute };
}
