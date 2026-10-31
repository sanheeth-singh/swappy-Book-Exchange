import axios from "axios";
export class ApiError extends Error { constructor(message: string, public status?: number, public code?: string, public fields: Record<string, string> = {}) { super(message); this.name = "ApiError"; } }
export function normalizeApiError(error: unknown): ApiError {
 if (error instanceof ApiError) return error;
 if (!axios.isAxiosError(error)) return new ApiError("Something went wrong. Please try again.");
 const status = error.response?.status; const data = error.response?.data;
 if (!error.response) return new ApiError("Cannot reach Swappy. Check your connection and try again.", undefined, "network_error");
 if (data?.error?.message) return new ApiError(data.error.message, status, data.error.code);
 if (Array.isArray(data?.detail)) { const fields: Record<string, string> = {}; for (const item of data.detail) { if (Array.isArray(item.loc) && typeof item.msg === "string") fields[item.loc.filter((part: unknown) => part !== "body").join(".")] = item.msg; } return new ApiError("Please check the highlighted information.", status, "validation_error", fields); }
 if (typeof data?.detail === "string") return new ApiError(data.detail, status);
 return new ApiError(status === 403 ? "You do not have permission for this action." : "The request could not be completed.", status);
}
