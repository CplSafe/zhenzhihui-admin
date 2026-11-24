import { useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { Alert, Button, QRCode, Space, Typography } from "antd";
import { http } from "@/api/client";
import { ApiError } from "@/types/api";

export function UserHierarchyInvite({ userId }: { userId: number }) {
  const qr = useRef<HTMLDivElement>(null);
  function downloadQRCode() {
    const canvas = qr.current?.querySelector("canvas");
    if (!canvas) return;
    const anchor = document.createElement("a");
    anchor.href = canvas.toDataURL("image/png");
    anchor.download = `下级注册链接-${userId}.png`;
    anchor.click();
  }
  const link = useMutation({
    mutationFn: () => http.post<{ url: string }>(`/admin/users/${userId}/hierarchy-invite`, {}),
  });
  return <Space orientation="vertical" style={{ width: "100%" }}>
    <Typography.Text strong>下级注册链接</Typography.Text>
    <Typography.Text type="secondary">
      新用户通过此链接或二维码注册后，自动绑定为该用户的直属下级。仅记录上下级关系，不涉及邀请返利；已有账号保持原关系。
    </Typography.Text>
    {!link.data && <Button loading={link.isPending} onClick={() => { if (!link.isPending) link.mutate(); }}>生成注册链接和二维码</Button>}
    {link.isError && <Alert type="error" showIcon title={link.error instanceof ApiError ? link.error.message : "注册链接生成失败，请重试"} />}
    {link.data && <>
      <Typography.Paragraph copyable={{ text: link.data.url }} style={{ overflowWrap: "anywhere", marginBottom: 0 }}>
        {link.data.url}
      </Typography.Paragraph>
      <div ref={qr} aria-label="下级注册二维码"><QRCode value={link.data.url} size={180} /></div>
      <Button onClick={downloadQRCode}>下载二维码</Button>
    </>}
  </Space>;
}
