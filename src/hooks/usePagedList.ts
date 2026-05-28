import { useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import type { TablePaginationConfig } from "antd";
import { ApiError } from "@/types/api";
import type { ListPage } from "@/types/domain";

const DEFAULT_PAGE_SIZE = 20;

interface UsePagedListArgs<T, F extends object> {
  queryKey: string;
  filters: F;
  fetcher: (
    params: F & { limit: number; offset: number },
  ) => Promise<ListPage<T>>;
}

export function usePagedList<T, F extends object>({
  queryKey,
  filters,
  fetcher,
}: UsePagedListArgs<T, F>) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  // Reset page on filter change in render phase to avoid a wasted render with stale page.
  const filtersKey = JSON.stringify(filters);
  const [prevFiltersKey, setPrevFiltersKey] = useState(filtersKey);
  if (prevFiltersKey !== filtersKey) {
    setPrevFiltersKey(filtersKey);
    setPage(1);
  }

  const { data, isFetching, error, refetch } = useQuery<ListPage<T>, ApiError>({
    queryKey: [queryKey, filters, page, pageSize],
    queryFn: () =>
      fetcher({ ...filters, limit: pageSize, offset: (page - 1) * pageSize }),
    placeholderData: keepPreviousData,
  });

  const total = data?.total ?? 0;

  const pagination: TablePaginationConfig = {
    current: page,
    pageSize,
    total,
    showSizeChanger: true,
    showTotal: (t) => `共 ${t} 条`,
    onChange: (p, ps) => {
      // 改变每页条数时回到第 1 页,避免在高页码下切大页导致 offset 超出 total → 空表。
      if (ps !== pageSize) {
        setPageSize(ps);
        setPage(1);
      } else {
        setPage(p);
      }
    },
  };

  return {
    items: data?.items ?? [],
    total,
    loading: isFetching,
    error,
    pagination,
    refetch,
  };
}
