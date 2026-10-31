"use client";
import { useQuery } from "@tanstack/react-query";
import { exchangesApi } from "../api";
export function useOpenIssues(id: string, enabled = true) {
  return useQuery({
    queryKey: ["exchanges", "open-issues", id],
    queryFn: async () => {
      for (let offset = 0; ; offset += 20) {
        const page = await exchangesApi.issues(id, offset);
        if (page.some((issue) => issue.status === "OPEN")) return true;
        if (page.length < 20) return false;
      }
    },
    enabled,
    refetchInterval: 30000,
  });
}
