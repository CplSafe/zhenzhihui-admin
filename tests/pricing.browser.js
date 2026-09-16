async (page) => {
  const origin = await page.evaluate(() => location.origin);
  if (!/^http:\/\/(localhost|127\.0\.0\.1):/.test(origin)) throw new Error("Run only against a local dev server");
  const check = (condition, message) => { if (!condition) throw new Error(message); };
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  const fixture = "/tests/fixtures/pricing.html";
  const save = async () => {
    await page.getByRole("button", { name: "保存测试配置" }).click();
    await page.waitForFunction(() => document.querySelector('[data-testid="saved"]').textContent.trim() !== "null");
    return JSON.parse(await page.getByTestId("saved").innerText()).pricing;
  };

  await page.goto(origin + fixture);
  await page.getByText("200 积分 / 张 = ¥4.00 / 张").waitFor();
  check(await page.getByText("实际按上游返回的真实 token 结算", { exact: false }).count() === 0, "Legacy Google misleading token settlement");
  check((await save()).output_credit_rate === 200, "Opening legacy editor changed price");

  for (const version of ["gemini-3.1-flash-image", "gemini-3-pro-image"]) {
    await page.goto(origin + fixture + "?version=" + version);
    await page.getByText("当前计价配置与此模型不匹配").waitFor();
    check((await save()).output_credit_rate === 200, "Opening cost editor silently changed price");
    await page.getByRole("button", { name: "应用官方成本配置" }).click();
    await page.getByText("图片输出成本（不含输入及思考）").waitFor();
    const saved = await save();
    check(saved.unit === "provider_cost" && saved.output_credit_rate === 0 && saved.input_credit_rate === 0, "Saved old fixed rates");
    check(saved.provider_concurrency_limit === 8 && saved.provider_cost_to_cny_ppm === 7300000, "Lost concurrency or FX");
    check(saved.provider_cost_cents_per_million_tokens_by_usage.image_output === (version.includes("3.1") ? 6000 : 12000), "Wrong image output rate");
    await page.getByRole("spinbutton", { name: "结算汇率", exact: true }).fill("7.2");
    await page.getByRole("spinbutton", { name: "结算汇率", exact: true }).blur();
    check((await save()).provider_cost_to_cny_ppm === 7200000, "FX lost on save");
    await page.getByRole("button", { name: /高级计价/ }).click();
    await page.getByRole("textbox").fill('{"provider_concurrency_limit":9}');
    const advanced = await save();
    check(advanced.provider_concurrency_limit === 9 && advanced.provider_cost_currency === "USD" && advanced.provider_cost_cents_per_million_tokens_by_usage.image_output === saved.provider_cost_cents_per_million_tokens_by_usage.image_output, "Advanced editor lost cost config");
    await page.getByRole("button", { name: /高级计价/ }).click();
    await page.setViewportSize({ width: 390, height: 844 });
    check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "Pricing overflows mobile width");
    await page.screenshot({ path: "output/playwright/" + version + "-mobile.png", fullPage: true });
    await page.setViewportSize({ width: 1280, height: 960 });
    await page.screenshot({ path: "output/playwright/" + version + "-desktop.png", fullPage: true });
  }

  for (const [provider, version] of [["openai", "gpt-image-2"], ["volcengine", "doubao-seedream-5-0-260128"]]) {
    await page.goto(origin + fixture + "?provider=" + provider + "&version=" + version);
    await page.getByText("输出单价(积分 / 千 token)").waitFor();
    check(await page.getByRole("button", { name: "应用官方成本配置" }).count() === 0, "Google UI leaked to other provider");
    const saved = await save();
    check(saved.output_credit_rate === 200 && saved.unit === "generation", "Repriced unrelated provider");
  }

  // Exercise the real ModelsPage and PATCH payload. All API requests stay mocked.
  const model = {
    id: 27, provider: "google", model: "gemini-3.1-flash-image", version: "gemini-3.1-flash-image",
    display_name: "Nano pricing test fixture", capability: "image", enabled: false, task_mode: "sync",
    allowed_plans: ["pro"], operation_codes: ["image.text_to_image", "image.image_to_image"],
    pricing: { unit: "generation", input_credit_rate: 0, output_credit_rate: 200, provider_concurrency_limit: 8 },
  };
  const writes = [];
  await page.route("**/api/v1/**", async route => {
    const path = await page.evaluate(url => new URL(url).pathname, route.request().url());
    let data;
    if (path.endsWith("/admin/session")) data = {
      admin_user: { id: 1, deep_auth_user_id: "Local pricing fixture", status: "active" },
      roles: [], permissions: ["admin.models.read", "admin.models.write"],
    };
    else if (path.endsWith("/admin/models/27")) {
      if (route.request().method() === "PATCH") writes.push(route.request().postDataJSON());
      data = model;
    } else if (path.endsWith("/admin/models")) data = { items: [model], total: 1, limit: 20, offset: 0 };
    else return route.fulfill({ status: 500, json: { code: 50000, message: "Unexpected fixture endpoint: " + path } });
    return route.fulfill({ json: { code: 0, data } });
  });
  await page.goto(origin + "/models");
  await page.getByRole("button", { name: "编辑", exact: true }).click();
  await page.getByText("当前计价配置与此模型不匹配").waitFor();
  await page.getByRole("button", { name: /^保\s*存$/ }).click();
  await page.getByText("此模型需要官方成本配置、有效汇率及 1 积分 = ¥0.02 的折算比例").waitFor();
  check(writes.length === 0, "Invalid cost config reached PATCH");
  await page.getByRole("button", { name: "应用官方成本配置" }).click();
  await page.getByText("图片输出成本（不含输入及思考）").waitFor();
  await page.getByRole("spinbutton", { name: "结算汇率", exact: true }).fill("");
  await page.getByRole("button", { name: /^保\s*存$/ }).click();
  await page.getByText("此模型需要官方成本配置、有效汇率及 1 积分 = ¥0.02 的折算比例").waitFor();
  check(writes.length === 0, "Missing FX reached PATCH");
  await page.getByRole("spinbutton", { name: "结算汇率", exact: true }).fill("7.3");
  await page.getByRole("button", { name: /^保\s*存$/ }).click();
  await page.getByText("已更新模型").waitFor();
  check(writes.length === 1 && writes[0].pricing.unit === "provider_cost" && writes[0].pricing.output_credit_rate === 0 && writes[0].pricing.provider_cost_cents_per_million_tokens_by_usage.image_output === 6000, "Wrong ModelsPage PATCH payload");
  check(errors.length === 0, errors.join("\n"));
  await page.unroute("**/api/v1/**");
  console.log("PASS: legacy, Nano 2/Pro, FX, advanced JSON, other providers, responsive layout, ModelsPage validation and PATCH payload");
}
