import { useState } from "react";
import { createRoot } from "react-dom/client";
import { Form, Button } from "antd";
import { PricingField } from "../../src/components/PricingField";

export function Fixture() {
  const [saved, setSaved] = useState<unknown>(null);
  const query = new URLSearchParams(location.search);
  return (
    <main style={{ maxWidth: 720, padding: 16, margin: "auto" }}>
      <h1 style={{ fontSize: 20 }}>Pricing regression fixture</h1>
      <Form
        layout="vertical"
        initialValues={{ pricing: {
          unit: "generation", input_credit_rate: 0, output_credit_rate: 200,
          provider_concurrency_limit: 8,
        } }}
        onFinish={setSaved}
      >
        <Form.Item name="pricing" label="计价">
          <PricingField
            provider={query.get("provider") ?? "google"}
            version={query.get("version") ?? "gemini-2.5-flash-image"}
            capability={query.get("capability") ?? "image"}
          />
        </Form.Item>
        <Button htmlType="submit">保存测试配置</Button>
      </Form>
      <pre data-testid="saved" style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
        {JSON.stringify(saved)}
      </pre>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(<Fixture />);
