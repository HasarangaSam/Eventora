import { useCallback } from 'react'
import { useAuth } from '@clerk/react'
import type { AxiosRequestConfig, AxiosResponse } from 'axios'
import { api } from '../../lib/api'

export function useAuthenticatedApi() {
  const { getToken } = useAuth()

  return useCallback(async <T,>(config: AxiosRequestConfig): Promise<AxiosResponse<T>> => {
    const token = await getToken()
    if (!token) throw new Error('Your session has expired. Please sign in again.')

    return api.request<T>({
      ...config,
      headers: { ...config.headers, Authorization: `Bearer ${token}` },
    })
  }, [getToken])
}
