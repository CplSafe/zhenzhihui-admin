import { useState } from "react";
import { App } from "antd";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ApiError } from "@/types/api";

// editId 约定:null=关闭弹窗, 0=新增, >0=编辑该 ID。供模态表单 CRUD 页复用。
type ToggleMut = ReturnType<typeof useMutation<unknown, ApiError, number>>;

interface UseResourceCrud {
  editId: number | null;
  isOpen: boolean;
  isEdit: boolean;
  openCreate: () => void;
  openEdit: (id: number) => void;
  close: () => void;
  onError: (e: unknown) => void;
  invalidate: () => void;
  enableMut: ToggleMut;
  disableMut: ToggleMut;
}

interface UseResourceCrudArgs {
  // react-query 缓存键,如 ['admin', 'plans']。
  queryKey: readonly unknown[];
  enableFn: (id: number) => Promise<unknown>;
  disableFn: (id: number) => Promise<unknown>;
}

// useResourceCrud 收敛「模态表单 + 启停」类管理页的公共样板:editId 状态机、
// 缓存失效、统一错误提示,以及结构完全一致的启用/停用 mutation。
// save mutation 因各资源请求体不同,仍由各页面自行编写。
export function useResourceCrud({
  queryKey,
  enableFn,
  disableFn,
}: UseResourceCrudArgs): UseResourceCrud {
  const { message } = App.useApp();
  const qc = useQueryClient();
  const [editId, setEditId] = useState<number | null>(null);

  const invalidate = () => qc.invalidateQueries({ queryKey });
  const onError = (e: unknown) =>
    message.error(e instanceof ApiError ? e.message : "操作失败");

  const toggleMutOptions = (
    mutationFn: (id: number) => Promise<unknown>,
    successMsg: string,
  ) => ({
    mutationFn,
    onSuccess: () => {
      message.success(successMsg);
      invalidate();
    },
    onError,
  });

  const enableMut = useMutation<unknown, ApiError, number>(
    toggleMutOptions(enableFn, "已启用"),
  );
  const disableMut = useMutation<unknown, ApiError, number>(
    toggleMutOptions(disableFn, "已停用"),
  );

  return {
    editId,
    isOpen: editId !== null,
    isEdit: editId !== null && editId > 0,
    openCreate: () => setEditId(0),
    openEdit: (id) => setEditId(id),
    close: () => setEditId(null),
    onError,
    invalidate,
    enableMut,
    disableMut,
  };
}
