import axios from "axios";
import { env } from "@/lib/config/env";
import { normalizeApiError } from "./errors";
// No token persistence or guessed refresh interceptor. Stage 2 owns session orchestration.
export const api = axios.create({ baseURL: env.apiUrl, withCredentials: true, timeout: 15000 });
api.interceptors.response.use((response) => response, (error: unknown) => Promise.reject(normalizeApiError(error)));
