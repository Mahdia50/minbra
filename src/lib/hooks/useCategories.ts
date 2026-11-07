"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "@/components/providers/SessionProvider";
import { humanError } from "@/lib/constants";
import type { Category } from "@/lib/types";

/** Word-bank categories with live word counts (the bank itself is never exposed). */
export function useCategories() {
  const { client, status } = useSession();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!client) return;
    // State updates live inside promise callbacks so React can tell they are
    // asynchronous (a synchronous setState in an effect body would cascade).
    return Promise.resolve(client.rpc("api_list_categories"))
      .then(({ data, error: rpcError }) => {
        if (rpcError) throw rpcError;
        setCategories(
          ((data ?? []) as Category[]).map((row) => ({
            ...row,
            word_count: Number(row.word_count),
          })),
        );
        setError(null);
      })
      .catch((err) => setError(humanError(err)))
      .finally(() => setLoading(false));
  }, [client]);

  useEffect(() => {
    if (status !== "ready") return;
    void load();
  }, [status, load]);

  const totalWords = categories.reduce((sum, c) => sum + c.word_count, 0);

  return { categories, loading, error, reload: load, totalWords };
}
