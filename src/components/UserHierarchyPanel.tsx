import { useState } from "react";
import { Alert, App, Button, Form, Select, Space, Spin, Typography } from "antd";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Can } from "@/components/Can";
import { http } from "@/api/client";
import { listUsers } from "@/api/queries";
import type { User } from "@/types/domain";
import { Permission } from "@/types/admin";
import { ApiError } from "@/types/api";

const label = (user: User) => `${user.nickname || "未命名用户"} · ${user.mobile || user.email || `#${user.id}`} (#${user.id})`;

export function UserHierarchyPanel({ userId }: { userId: number }) {
  const { message } = App.useApp();
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [keyword, setKeyword] = useState("");
  const [form] = Form.useForm<{ superior: number | null }>();
  const chain = useQuery({
    queryKey: ["admin", "user-hierarchy", userId],
    queryFn: () => http.get<User[]>(`/admin/users/${userId}/hierarchy`),
  });
  const candidates = useQuery({
    queryKey: ["admin", "hierarchy-candidates", keyword],
    queryFn: () => listUsers({ keyword, limit: 30 }),
    enabled: editing,
  });
  const save = useMutation({
    mutationFn: (superior: number | null) => http.put(`/admin/users/${userId}/superior`, { superior_user_id: superior }),
    onSuccess: () => {
      setEditing(false);
      void qc.invalidateQueries({ queryKey: ["admin", "user-hierarchy"] });
      message.success("上下级关系已保存");
    },
    onError: (error: unknown) => message.error(error instanceof ApiError ? error.message : "保存失败，请重试"),
  });
  const current = chain.data?.[1];
  const options = new Map((candidates.data?.items ?? []).filter(u => u.id !== userId).map(u => [u.id, u]));
  if (current) options.set(current.id, current);

  return <section aria-label="上下级关系">
    <Space orientation="vertical" style={{ width: "100%" }}>
      <Typography.Text strong>上下级关系</Typography.Text>
      {chain.isPending ? <Spin /> : chain.isError ? <Alert type="error" title="上下级关系加载失败" action={<Button onClick={() => void chain.refetch()}>重试</Button>} /> : <>
        <Typography.Text>直属上级：{current ? label(current) : "未绑定"}</Typography.Text>
        {(chain.data?.length ?? 0) > 1 && <ol aria-label="上级链，从本人逐级向上">
          {chain.data?.map((user, index) => <li key={user.id}>{index === 0 ? "本人" : `第 ${index} 级上级`}：{label(user)}</li>)}
        </ol>}
        <Can permission={Permission.USERS_WRITE}>
          {!editing ? <Button onClick={() => { form.setFieldsValue({ superior: current?.id ?? null }); setEditing(true); }}>设置直属上级</Button> :
            <Form form={form} layout="vertical" disabled={save.isPending} onFinish={values => save.mutate(values.superior ?? null)}>
              <Form.Item name="superior" label="直属上级" extra="按昵称、手机号或邮箱搜索；清空后保存可解除绑定。">
                <Select showSearch allowClear filterOption={false} onSearch={setKeyword} loading={candidates.isFetching} placeholder="搜索并选择用户" options={[...options.values()].map(user => ({ value: user.id, label: label(user) }))} />
              </Form.Item>
              {candidates.isError && <Alert type="error" title="用户搜索失败，请重新搜索" />}
              <Space wrap>
                <Button type="primary" htmlType="submit" loading={save.isPending}>保存关系</Button>
                <Button disabled={save.isPending} onClick={() => setEditing(false)}>取消</Button>
              </Space>
            </Form>}
        </Can>
      </>}
    </Space>
  </section>;
}
