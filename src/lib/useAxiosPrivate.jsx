import { useEffect } from 'react';
import { supabase } from './supabaseClient.ts';
import { axiosPrivate } from '../api/axiosPrivate.ts';

const absentTokenError = 'No access token present. Please try again.';

export const useAxiosPrivate = () => {
  useEffect(() => {
    const requestIntercept = axiosPrivate.interceptors.request.use(
      (config) => {
        const session = supabase.auth.session();

        if ((session?.access_token ?? '').length === 0) {
          return Promise.reject(absentTokenError);
        }

        if (!config.headers['Authorization']) {
          config.headers['Authorization'] = `Bearer ${session.access_token}`;
        }

        return config;
      },
      (error) => Promise.reject(error),
    );

    const responseIntercept = axiosPrivate.interceptors.response.use(
      (response) => response,
      async (error) => {
        const prevRequest = error?.config;
        if (error?.response?.status === 403 && !prevRequest?.sent) {
          prevRequest.sent = true;
          const { session, error: err } = await supabase.auth.signIn({
            refreshToken: session.refresh_token,
          });

          if (err) {
            return Promise.reject(err);
          }

          if ((session?.access_token ?? '').length === 0) {
            return Promise.reject(absentTokenError);
          }

          prevRequest.headers[
            'Authorization'
          ] = `Bearer ${session.access_token}`;
          return axiosPrivate(prevRequest);
        }
        return Promise.reject(error);
      },
    );

    return () => {
      axiosPrivate.interceptors.request.eject(requestIntercept);
      axiosPrivate.interceptors.response.eject(responseIntercept);
    };
  }, []);

  return axiosPrivate;
};
