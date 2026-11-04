async (page) => {
  const origin = new URL(page.url()).origin;
  await page.setViewportSize({ width: 1280, height: 960 });
  if (!/^http:\/\/(localhost|127\.0\.0\.1):/.test(origin)) throw new Error("Local dev server required");
  const check = (condition, message) => { if (!condition) throw new Error(message); };
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  let readonly = false;
  let failAbilities = false;
  let abilities = [
    { code: "relight", display_name: "打光", description: "参考图打光", enabled: true, operation_code: "image.relight", execution_operation_code: "image.image_to_image", tool_code: "image.relight", tool_version: 1, default_model_version_id: 7 },
    { code: "image.retired", display_name: "旧版编辑", description: "", enabled: false, operation_code: "image.retired", execution_operation_code: "image.image_to_image", tool_code: "", tool_version: 0, default_model_version_id: 0 },
  ];
  const base = { provider: "bailian", model: "qwen-image-2.0-2026-03-03", version: "qwen-image-2.0-2026-03-03", capability: "image", enabled: false, task_mode: "sync", allowed_plans: [], operation_codes: ["image.relight", "image.retired"], ability_codes: ["relight", "image.retired"], pricing: { unit: "generation", output_credit_rate: 5 } };
  const models = [{ ...base, id: 7, display_name: "Qwen 首屏" }, { ...base, id: 101, display_name: "Qwen 第二页", enabled: true, ability_codes: ["relight"] }];
  const writes = [];
  const modelOffsets = [];
  await page.route("**/api/v1/**", async route => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    const method = route.request().method();
    let data;
    if (path.endsWith("/admin/session")) data = { admin_user: { id: 1, deep_auth_user_id: "Local ability fixture", status: "active" }, roles: [], permissions: readonly ? ["admin.models.read"] : ["admin.models.read", "admin.models.write"] };
    else if (path.endsWith("/admin/abilities") && method === "GET") {
      if (failAbilities) return route.fulfill({ status: 500, json: { code: 50000, message: "模拟能力加载失败" } });
      data = abilities;
    } else if (path.includes("/admin/abilities") && method !== "GET") {
      const body = route.request().postDataJSON();
      const code = decodeURIComponent(path.split("/").pop());
      if (abilities.some(a => a.code !== (method === "PATCH" ? code : body.code) && a.operation_code === body.operation_code)) {
        return route.fulfill({ status: 409, json: { code: 40900, code_string: "ABILITY_OPERATION_CONFLICT", message: "业务操作码已被其他能力使用" } });
      }
      writes.push({ path, body });
      if (method === "POST") { data = body; abilities.push(data); }
      else {
        const before = abilities.find(a => a.code === code);
        if (body.operation_code && body.operation_code !== before.operation_code) {
          for (const model of models) model.operation_codes = model.operation_codes.map(op => op === before.operation_code ? body.operation_code : op);
        }
        abilities = abilities.map(a => a.code === code ? { ...a, ...body } : a);
        data = abilities.find(a => a.code === code);
      }
    } else if (path.endsWith("/admin/models/exchange-rate")) data = { pair: "USD/CNY", rate_ppm: 7300000, rate_date: "2026-10-21", status: "ready", usable: true };
    else if (/\/admin\/models\/\d+$/.test(path)) {
      const id = Number(path.split("/").pop());
      const model = models.find(m => m.id === id);
      if (method === "PATCH") { const body = route.request().postDataJSON(); writes.push({ path, body }); Object.assign(model, body); }
      data = model;
    } else if (path.endsWith("/admin/models")) {
      const offset = Number(url.searchParams.get("offset") || 0);
      const limit = Number(url.searchParams.get("limit") || 20);
      modelOffsets.push(offset);
      // Simulate a server page smaller than the requested 100 to verify traversal.
      data = { items: limit === 100 ? models.slice(offset, offset + 1) : models, total: 2, limit, offset };
    } else return route.fulfill({ status: 500, json: { code: 50000, message: "Unexpected fixture endpoint " + path } });
    await route.fulfill({ json: { code: 0, data } });
  });
  await page.goto(origin + "/abilities");
  await page.getByRole("heading", { name: "业务能力" }).waitFor();
  await page.getByRole("button", { name: "编辑", exact: true }).first().click();
  await page.getByLabel("业务操作码 (operation_code)", { exact: true }).fill("brand/灯光 v2");
  check(await page.getByLabel("技术执行绑定", { exact: true }).isEnabled(), "Execution binding should be editable");
  await page.getByLabel("技术执行绑定", { exact: true }).click();
  await page.getByLabel("技术执行绑定", { exact: true }).fill("video.generate");
  await page.getByTitle("video.generate（直接执行）", { exact: true }).click();
  await page.getByText("#7（当前默认，已不可用，请重新选择或清除）", { exact: true }).waitFor();
  await page.getByLabel("技术执行绑定", { exact: true }).click();
  await page.getByLabel("技术执行绑定", { exact: true }).fill("image.multi_angle");
  await page.getByTitle("多角度编辑 · image.multi_angle v2", { exact: true }).click();
  await page.getByLabel("默认模型", { exact: true }).click();
  await page.getByTitle("Qwen 第二页 · bailian #101", { exact: true }).click();
  await page.getByLabel("技术执行绑定", { exact: true }).click();
  await page.getByLabel("技术执行绑定", { exact: true }).fill("video.generate");
  await page.getByTitle("video.generate（直接执行）", { exact: true }).click();
  await page.getByText("#101（当前默认，已不可用，请重新选择或清除）", { exact: true }).waitFor({ timeout: 3000 });
  await page.getByLabel("技术执行绑定", { exact: true }).click();
  await page.getByLabel("技术执行绑定", { exact: true }).fill("image.multi_angle");
  await page.getByTitle("多角度编辑 · image.multi_angle v2", { exact: true }).click();
  check(modelOffsets.includes(1), "Default model candidates silently dropped later pages");
  check(await page.getByLabel("能力代码", { exact: true }).isDisabled(), "Ability code editable");
  await page.getByRole("button", { name: /^保\s*存$/ }).click();
  await page.getByText("业务能力已保存", { exact: true }).waitFor();
  check(writes[0].body.default_model_version_id === 101 && writes[0].body.operation_code === "brand/灯光 v2" && writes[0].body.execution_operation_code === "image.image_to_image" && writes[0].body.tool_code === "image.multi_angle" && writes[0].body.tool_version === 2 && !("code" in writes[0].body), "PATCH lost public operation, execution binding, or stable identity");

  await page.getByRole("button", { name: "新增能力", exact: true }).click();
  await page.getByLabel("能力代码", { exact: true }).fill("product.relight");
  await page.getByLabel("显示名称", { exact: true }).fill("产品打光");
  await page.getByLabel("业务操作码 (operation_code)", { exact: true }).fill("brand/灯光 v2");
  await page.getByLabel("技术执行绑定", { exact: true }).click();
  await page.getByLabel("技术执行绑定", { exact: true }).fill("image.relight");
  await page.getByTitle("打光 · image.relight v1", { exact: true }).click();
  await page.getByRole("button", { name: /^保\s*存$/ }).click();
  await page.getByText("业务操作码已被其他能力使用", { exact: true }).waitFor();
  check(await page.getByLabel("业务操作码 (operation_code)", { exact: true }).inputValue() === "brand/灯光 v2", "Server conflict lost unsaved form");
  await page.getByLabel("业务操作码 (operation_code)", { exact: true }).fill("光".repeat(43));
  await page.getByRole("button", { name: /^保\s*存$/ }).click();
  await page.getByText("业务操作码最多 128 字节", { exact: true }).waitFor();
  await page.getByLabel("业务操作码 (operation_code)", { exact: true }).fill("创作/产品灯光 v1");
  await page.getByLabel("说明", { exact: true }).fill("光".repeat(1366));
  await page.getByRole("button", { name: /^保\s*存$/ }).click();
  await page.getByText("说明最多 4096 字节", { exact: true }).waitFor();
  check(writes.length === 1, "Oversize UTF-8 description reached POST");
  await page.getByLabel("说明", { exact: true }).fill("产品光影调节");
  await page.getByRole("button", { name: /^保\s*存$/ }).click();
  await page.getByRole("cell", { name: "product.relight", exact: true }).waitFor();
  const productRow = page.getByRole("row").filter({ has: page.getByRole("cell", { name: "product.relight", exact: true }) });
  await productRow.getByRole("button", { name: "停用", exact: true }).click();
  await productRow.getByRole("cell", { name: "disabled", exact: true }).waitFor();
  check(writes.find(w => w.path.endsWith("/product.relight")).body.enabled === false, "Ability disable did not send false");
  const created = writes.find(w => w.body.code === "product.relight").body;
  check(created.tool_code === "image.relight" && created.tool_version === 1 && created.operation_code === "创作/产品灯光 v1" && created.execution_operation_code === "image.image_to_image" && created.default_model_version_id === 0, "Wrong tool binding in create payload");

  await page.goto(origin + "/models");
  const firstRow = page.getByRole("row").filter({ has: page.getByRole("cell", { name: "Qwen 首屏", exact: true }) });
  await firstRow.getByRole("button", { name: "编辑", exact: true }).click();
  const retired = page.getByRole("checkbox", { name: /旧版编辑/ });
  check(await retired.isChecked(), "Disabled assignment was dropped");
  await retired.uncheck();
  await page.getByRole("checkbox", { name: /^打光 \(relight\)/ }).uncheck();
  await page.getByRole("button", { name: /^保\s*存$/ }).click();
  await page.getByText("已更新模型", { exact: true }).waitFor();
  const modelWrite = writes.find(w => w.path.endsWith("/admin/models/7"));
  check(Array.isArray(modelWrite.body.ability_codes) && modelWrite.body.ability_codes.length === 0, "Explicit ability clear [] lost");
  const secondRow = page.getByRole("row").filter({ has: page.getByRole("cell", { name: "Qwen 第二页", exact: true }) });
  await secondRow.getByRole("button", { name: "编辑", exact: true }).click();
  check(await page.getByRole("checkbox", { name: /当前默认模型/ }).isDisabled(), "Default model could detach without clearing default");
  await page.getByRole("button", { name: /^取\s*消$/ }).click();

  await page.goto(origin + "/abilities");
  await page.getByRole("button", { name: "编辑", exact: true }).first().click();
  await page.getByLabel("默认模型", { exact: true }).click();
  await page.getByTitle("不设置默认模型", { exact: true }).last().click();
  await page.getByRole("button", { name: /^保\s*存$/ }).click();
  await page.getByText("业务能力已保存", { exact: true }).waitFor();
  check(writes.some(w => w.body.default_model_version_id === 0 && w.path.endsWith("/relight")), "Clear default lost explicit zero");

  failAbilities = true;
  await page.goto(origin + "/models");
  await firstRow.getByRole("button", { name: "编辑", exact: true }).click();
  await page.getByText("业务能力加载失败", { exact: true }).waitFor();
  check(await page.getByRole("button", { name: /^保\s*存$/ }).isDisabled(), "Missing ability data did not block model save");
  failAbilities = false;
  await page.getByRole("button", { name: /^重\s*试$/ }).click();
  await page.getByRole("checkbox", { name: /^打光 \(relight\)/ }).waitFor();
  check(await page.getByRole("button", { name: /^保\s*存$/ }).isEnabled(), "Ability retry did not recover model form");
  await page.getByRole("button", { name: /^取\s*消$/ }).click();

  readonly = true;
  await page.reload();
  await page.getByRole("cell", { name: "Qwen 首屏", exact: true }).waitFor();
  check(await page.getByRole("button", { name: "编辑", exact: true }).count() === 0, "Read-only model writer exposed");
  await page.goto(origin + "/abilities");
  await page.getByRole("cell", { name: "product.relight", exact: true }).waitFor();
  check(await page.getByRole("button", { name: "新增能力", exact: true }).count() === 0 && await page.getByRole("button", { name: "编辑", exact: true }).count() === 0, "Read-only ability writes exposed");
  check(errors.length === 0, errors.join("\n"));
  await page.screenshot({ path: "output/playwright/abilities-readonly-desktop.png", fullPage: true, animations: "disabled" });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForFunction(() => document.documentElement.scrollWidth <= innerWidth && document.querySelector(".ant-layout-sider").getBoundingClientRect().width === 0);
  await page.screenshot({ path: "output/playwright/abilities-readonly-mobile.png", fullPage: true, animations: "disabled" });
  await page.unroute("**/api/v1/**");
  return { result: "PASS", cases: "default candidate pagination, stable ability identity, arbitrary public operation rename, editable execution binding, incompatible pending default, public/execution create payload, server conflict recovery, disabled assignments, clear [], default detach guard, explicit default clear, UTF-8 validation, enable/disable, failure retry, read-only permissions, desktop/mobile", pageErrors: errors.length };
}
