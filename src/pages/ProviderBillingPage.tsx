import { useState } from "react";
import {
  Alert,
  App,
  Button,
  Checkbox,
  DatePicker,
  Descriptions,
  Drawer,
  Form,
  Input,
  Modal,
  Select,
  Space,
  Table,
  Tag,
  Typography,
} from "antd";
import type { TableColumnsType } from "antd";
import dayjs from "dayjs";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Can } from "@/components/Can";
import { usePermission } from "@/hooks/usePermission";
import { Permission } from "@/types/admin";
import {
  listProviderBills,
  listBillingConfigs,
  saveBillingConfig,
  syncProviderBill,
  rawBillUrl,
} from "@/api/providerBilling";
import type {
  BillingConfigInput,
  BillSource,
  ProviderBill,
} from "@/api/providerBilling";
import { fmtTime } from "@/utils/format";

const labels = { volcengine: "火山引擎", aliyun: "阿里云" };
const providers = {
  volcengine: [
    "volcengine",
    "volcengine-jimeng",
    "volcengine-speech",
    "volcengine-mediakit",
  ],
  aliyun: ["bailian", "facebody"],
};
const statusLabels: Record<string, string> = {
  not_synced: "未同步",
  scope_changed: "需重新同步模型账单",
  interrupted: "同步中断",
  syncing: "同步中",
  synced: "同步成功",
  failed: "同步失败",
};
const money = (v?: string) =>
  v == null
    ? "—"
    : Number(v).toLocaleString("zh-CN", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 6,
      });
interface ConfigForm extends BillingConfigInput {
  clear_credentials?: boolean;
}

function VendorSyncButton({
  source,
  month,
}: {
  source: BillSource;
  month: string;
}) {
  const { message } = App.useApp();
  const qc = useQueryClient();
  const sync = useMutation({
    mutationFn: ({ source, period }: { source: BillSource; period: string }) =>
      syncProviderBill(source, period),
    onSuccess: () => {
      void message.success("账单已同步，请核对范围及差额");
    },
    onError: (e: Error) => {
      void message.error(e.message);
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: ["provider-bills"] });
    },
  });
  return (
    <Button
      size="small"
      loading={sync.isPending}
      disabled={sync.isPending}
      onClick={() => sync.mutate({ source, period: month })}
    >
      同步
    </Button>
  );
}

export function ProviderBillingPage() {
  const [month, setMonth] = useState(
    dayjs().subtract(1, "month").format("YYYY-MM"),
  );
  const [detailSource, setDetailSource] = useState<BillSource | null>(null);
  const [editing, setEditing] = useState<BillSource | null>(null);
  const [form] = Form.useForm<ConfigForm>();
  const { has } = usePermission();
  const { message } = App.useApp();
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ["provider-bills", month],
    queryFn: () => listProviderBills(month),
    refetchInterval: (q) =>
      q.state.data?.some((r) => r.status === "syncing") ? 5000 : false,
  });
  const configs = useQuery({
    queryKey: ["billing-configs"],
    queryFn: listBillingConfigs,
    enabled: has(Permission.SETTINGS_READ),
  });
  const save = useMutation({
    mutationFn: ({
      source,
      body,
    }: {
      source: BillSource;
      body: BillingConfigInput;
    }) => saveBillingConfig(source, body),
    onSuccess: () => {
      setEditing(null);
      form.resetFields();
      void qc.invalidateQueries({ queryKey: ["billing-configs"] });
      void qc.invalidateQueries({ queryKey: ["provider-bills"] });
      void message.success("配置已保存，请重新同步账单");
    },
    onError: (e: Error) => {
      void message.error(e.message);
    },
  });
  const edit = (source: BillSource) => {
    const config = configs.data?.find((c) => c.source === source);
    form.resetFields();
    form.setFieldsValue(
      config
        ? { ...config, access_key: "", secret_key: "" }
        : {
            account_label: "",
            products: [],
            local_providers: providers[source],
            exclusive: false,
          },
    );
    setEditing(source);
  };
  const columns: TableColumnsType<ProviderBill> = [
    {
      title: "厂商 / 账号",
      key: "source",
      width: 180,
      render: (_, r) => (
        <>
          <Typography.Text strong>{labels[r.source]}</Typography.Text>
          <div>
            {r.snapshot?.config.account_label ||
              configs.data?.find((c) => c.source === r.source)?.account_label ||
              "尚未配置账号"}
          </div>
        </>
      ),
    },
    {
      title: "同步状态",
      key: "status",
      width: 160,
      render: (_, r) => (
        <Space orientation="vertical" size="small">
          <Tag color={r.status === "failed" ? "error" : undefined}>
            {statusLabels[r.status] || r.status}
          </Tag>
          {r.provisional && <Tag>暂估账期</Tag>}
          {r.config_changed && <Tag color="warning">配置已变更</Tag>}
        </Space>
      ),
    },
    {
      title: "本站估算（元）",
      key: "local",
      align: "right",
      render: (_, r) => money(r.snapshot?.local_estimate),
    },
    {
      title: "厂商模型原价（元）",
      key: "gross",
      align: "right",
      render: (_, r) => money(r.snapshot?.gross),
    },
    {
      title: "厂商模型应付（元）",
      key: "payable",
      align: "right",
      render: (_, r) => money(r.snapshot?.payable),
    },
    {
      title: "应付减估算（元）",
      key: "diff",
      align: "right",
      render: (_, r) => money(r.snapshot?.difference),
    },
    {
      title: "核对提示",
      key: "check",
      width: 160,
      render: (_, r) =>
        !r.snapshot
          ? "等待同步"
          : r.config_changed
            ? "请按新配置重新同步"
            : r.snapshot.comparable
              ? "范围已确认，待人工核对"
              : "范围或成本待补全",
    },
    {
      title: "操作",
      key: "actions",
      width: 160,
      fixed: "right",
      render: (_, r) => (
        <Space wrap>
          <Button
            size="small"
            disabled={!r.snapshot}
            onClick={() => setDetailSource(r.source)}
          >
            明细
          </Button>
          <Can
            permission={[Permission.BILLING_READ, Permission.SETTINGS_WRITE]}
            mode="all"
          >
            <VendorSyncButton source={r.source} month={month} />
          </Can>
        </Space>
      ),
    },
  ];
  const detail = query.data?.find((r) => r.source === detailSource);
  const snap = detail?.snapshot;
  return (
    <Space
      orientation="vertical"
      size="large"
      style={{ width: "100%", fontVariantNumeric: "tabular-nums" }}
    >
      <Typography.Title level={1} style={{ margin: 0, fontSize: 24 }}>
        AI 厂商月度对账
      </Typography.Title>
      <Typography.Paragraph type="secondary" style={{ margin: 0 }}>
        仅核对模型调用费用，排除服务器、数据库、带宽、存储和软件席位订阅。本站成本为估算，不自动调整用户积分。
      </Typography.Paragraph>
      <Space wrap>
        <DatePicker
          picker="month"
          allowClear={false}
          value={dayjs(`${month}-01`)}
          disabledDate={(d) =>
            d.isAfter(dayjs(), "month") ||
            d.isBefore(dayjs().subtract(17, "month"), "month")
          }
          onChange={(d) => {
            if (d) {
              setMonth(d.format("YYYY-MM"));
              setDetailSource(null);
            }
          }}
          aria-label="账单月份"
        />
        <Button
          onClick={() => {
            void query.refetch();
          }}
        >
          刷新
        </Button>
        <Can
          permission={[Permission.SETTINGS_READ, Permission.SETTINGS_WRITE]}
          mode="all"
        >
          <Button
            disabled={configs.isPending || !!configs.error}
            onClick={() => edit("volcengine")}
          >
            火山账单配置
          </Button>
          <Button
            disabled={configs.isPending || !!configs.error}
            onClick={() => edit("aliyun")}
          >
            阿里云账单配置
          </Button>
        </Can>
      </Space>
      <Alert
        type="info"
        showIcon
        title="核对口径"
        description="本地按北京时间的任务提交月份统计，厂商按账单账期统计；跨月任务可能不同。历史本站估算沿用后台现有计算方式，部分价格会随当前配置变化。最终账单建议次月4日12点后同步；未确认专用账号和产品范围时，不视为对平。"
      />
      {query.error && (
        <Alert
          type="error"
          title={query.error.message}
          action={
            <Button
              onClick={() => {
                void query.refetch();
              }}
            >
              重试
            </Button>
          }
        />
      )}
      {configs.error && (
        <Alert
          type="error"
          title={`账单配置读取失败：${configs.error.message}`}
          action={
            <Button
              onClick={() => {
                void configs.refetch();
              }}
            >
              重试
            </Button>
          }
        />
      )}
      {query.data
        ?.filter((r) => r.error)
        .map((r) => (
          <Alert
            key={r.source}
            type="error"
            title={`${labels[r.source]}：${r.error}`}
          />
        ))}
      <Table
        rowKey="source"
        columns={columns}
        dataSource={query.data || []}
        loading={query.isFetching}
        pagination={false}
        scroll={{ x: 1200 }}
      />
      <Drawer
        title={`${detailSource ? labels[detailSource] : ""} · ${month} 账单明细`}
        open={detailSource !== null}
        onClose={() => setDetailSource(null)}
        size="large"
        destroyOnHidden
      >
        {snap && detail && (
          <Space orientation="vertical" size="large" style={{ width: "100%" }}>
            <Alert
              type="warning"
              title="这是一份同步时的快照"
              description="下方保留账单产品分组以便核查，非模型或尚未确认的计费项明确排除，不计入上方金额。产品选择留空也仅纳入已核验的模型调用费用。失败及取消任务仍可能产生厂商费用。"
            />
            <Descriptions
              column={1}
              items={[
                {
                  key: "time",
                  label: "上次成功同步",
                  children: fmtTime(detail.synced_at || undefined),
                },
                {
                  key: "account",
                  label: "账号标识",
                  children: snap.config.account_label,
                },
                {
                  key: "products",
                  label: "纳入产品",
                  children:
                    snap.config.products.join("、") ||
                    "自动识别已核验的模型产品",
                },
                {
                  key: "providers",
                  label: "本地厂商范围",
                  children: snap.config.local_providers.join("、"),
                },
                {
                  key: "count",
                  label: "任务统计",
                  children: `总计 ${snap.task_count}；成本缺失 ${snap.unknown_cost_count}；未结束 ${snap.pending_count}；失败或取消 ${snap.failed_count}`,
                },
              ]}
            />
            <Table
              rowKey={(r) => `${r.code}:${r.currency}:${r.model_cost}`}
              size="small"
              dataSource={snap.products}
              pagination={{ pageSize: 10 }}
              scroll={{ x: 600 }}
              columns={[
                { title: "产品代码", dataIndex: "code" },
                { title: "名称", dataIndex: "name" },
                { title: "币种", dataIndex: "currency" },
                {
                  title: "原价",
                  dataIndex: "gross",
                  align: "right",
                  render: money,
                },
                {
                  title: "应付",
                  dataIndex: "payable",
                  align: "right",
                  render: money,
                },
                {
                  title: "纳入核对",
                  render: (_, r) =>
                    !r.model_cost
                      ? "排除：非模型或未确认"
                      : snap.config.products.length === 0 ||
                          snap.config.products.includes(r.code)
                        ? "纳入模型费用"
                        : "排除：未选中",
                },
              ]}
            />
            <Button
              href={rawBillUrl(detail.source, month)}
              target="_blank"
              rel="noopener noreferrer"
            >
              下载厂商原始账单 JSON
            </Button>
          </Space>
        )}
      </Drawer>
      <Modal
        title={`${editing ? labels[editing] : ""}账单查询配置`}
        open={editing !== null}
        onCancel={() => {
          if (!save.isPending) {
            setEditing(null);
            form.resetFields();
          }
        }}
        confirmLoading={save.isPending}
        forceRender
        onOk={() => {
          void form
            .validateFields()
            .then((values) => {
              if (!editing) return;
              const { clear_credentials, access_key, secret_key, ...rest } =
                values;
              const body = {
                ...rest,
                ...(clear_credentials
                  ? { access_key: "", secret_key: "" }
                  : {
                      ...(access_key?.trim()
                        ? { access_key: access_key.trim() }
                        : {}),
                      ...(secret_key?.trim()
                        ? { secret_key: secret_key.trim() }
                        : {}),
                    }),
              };
              save.mutate({ source: editing, body });
            })
            .catch(() => {});
        }}
      >
        <Form
          form={form}
          layout="vertical"
          preserve={false}
          disabled={save.isPending}
        >
          <Alert
            type="info"
            showIcon
            title={
              editing &&
              configs.data?.find((c) => c.source === editing)?.configured
                ? "已保存凭证；留空保留，输入新值覆盖"
                : "请配置厂商费用中心只读 AccessKey，模型调用 Key 不适用"
            }
          />
          <Form.Item
            name="account_label"
            label="账号标识"
            rules={[
              { required: true, whitespace: true, message: "请填写账号标识" },
              { max: 100 },
            ]}
          >
            <Input placeholder="例如：公司火山生产账号" />
          </Form.Item>
          <Form.Item name="access_key" label="AccessKey ID">
            <Input.Password autoComplete="new-password" maxLength={4096} />
          </Form.Item>
          <Form.Item name="secret_key" label="AccessKey Secret">
            <Input.Password autoComplete="new-password" maxLength={4096} />
          </Form.Item>
          <Form.Item name="clear_credentials" valuePropName="checked">
            <Checkbox>清空账单查询凭证</Checkbox>
          </Form.Item>
          <Form.Item
            name="local_providers"
            label="纳入本站估算的厂商"
            rules={[{ required: true, message: "至少选择一个厂商" }]}
          >
            <Select
              mode="multiple"
              options={
                editing
                  ? providers[editing].map((value) => ({ value, label: value }))
                  : []
              }
            />
          </Form.Item>
          <Form.Item
            name="products"
            label="模型产品范围"
            extra="留空时自动纳入已核验的模型调用费用；服务器、数据库、带宽、存储等不能选入。未知模型或计费项需核验后才能纳入。"
          >
            <Select
              mode="multiple"
              placeholder="自动识别模型费用"
              options={(
                configs.data?.find((c) => c.source === editing)
                  ?.model_products || []
              ).map((value) => ({ value, label: value }))}
            />
          </Form.Item>
          <Form.Item name="exclusive" valuePropName="checked">
            <Checkbox>
              已确认所选产品的此账号消耗全部来自上述本站厂商，包含测试和生产范围核对
            </Checkbox>
          </Form.Item>
        </Form>
      </Modal>
    </Space>
  );
}
