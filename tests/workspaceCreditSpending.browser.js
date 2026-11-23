async (page) => {
  const origin = new URL(page.url()).origin;
  if (!/^http:\/\/(localhost|127\.0\.0\.1):/.test(origin)) throw new Error("Local dev server required");
  await page.setViewportSize({ width: 1280, height: 960 });
  const check = (condition, message) => { if (!condition) throw new Error(message); };
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  const workspaces = [
    { id: 11, name: "创作团队", type: "team", status: "enabled", owner_user_id: 99 },
    { id: 12, name: "企业空间", type: "enterprise", status: "disabled", owner_user_id: 99 },
    { id: 13, name: "个人空间", type: "personal", status: "enabled", owner_user_id: 99 },
    { id: 14, name: "已解散团队", type: "team", status: "disbanded", owner_user_id: 99 },
  ];
  const wallets = new Map([[11, { workspace_id: 11, balance: 400, frozen: 20 }]]);
  const writes = [];
  let readonly = false;
  let started;
  let release;
  const firstWrite = new Promise(resolve => { started = resolve; });
  await page.route("**/api/v1/**", async route => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const workspaceMatch = path.match(/\/admin\/workspaces\/(\d+)(?:\/(.*))?$/);
    let data;
    if (path.endsWith("/admin/session")) {
      const permissions = ["admin.workspaces.read"];
      if (!readonly) permissions.push("admin.grants.write");
      data = { admin_user: { id: 1, deep_auth_user_id: "Local workspace fixture", status: "active" }, roles: [], permissions };
    } else if (path.endsWith("/admin/workspaces")) {
      data = { items: workspaces, total: workspaces.length, limit: 20, offset: 0 };
    } else if (workspaceMatch) {
      const id = Number(workspaceMatch[1]);
      const workspace = workspaces.find(row => row.id === id);
      if (workspaceMatch[2] === "credit-spending" && request.method() === "PATCH") {
        const body = request.postDataJSON();
        writes.push({ id, body });
        if (writes.length === 1) {
          await new Promise(resolve => { release = resolve; started(); });
          return route.fulfill({ status: 503, json: { code: 10503, message: "模拟更新失败" } });
        }
        const wallet = wallets.get(id) ?? { workspace_id: id, balance: 0, frozen: 0 };
        wallets.set(id, { ...wallet, spending_paused: body.paused });
        data = { paused: body.paused };
      } else if (workspaceMatch[2] === "usage-summary") {
        data = { used_credits: 0, video_count: 0, image_count: 0, remaining_credits: wallets.get(id)?.balance ?? null };
      } else if (!workspaceMatch[2]) {
        data = { workspace, member_count: 6, wallet: wallets.get(id) ?? null };
      }
    }
    return data === undefined
      ? route.fulfill({ status: 500, json: { code: 50000, message: "Unexpected fixture endpoint: " + path } })
      : route.fulfill({ json: { code: 0, data } });
  });

  await page.goto(origin + "/workspaces");
  const team = page.getByRole("row").filter({ has: page.getByRole("cell", { name: "创作团队", exact: true }) });
  await team.getByRole("button", { name: "使用统计" }).click();
  const pause = page.getByRole("button", { name: "暂停积分使用", exact: true });
  const resume = page.getByRole("button", { name: "恢复积分使用", exact: true });
  const cancel = page.getByRole("button", { name: /^取\s*消$/ });
  const confirmPause = page.getByRole("button", { name: "确认暂停", exact: true });
  const confirmResume = page.getByRole("button", { name: "确认恢复", exact: true });
  await page.getByText("未暂停", { exact: true }).waitFor();
  await pause.click();
  await page.getByText(/已预占积分的任务仍会正常结算/).waitFor();
  await cancel.click();
  check(writes.length === 0, "Cancelling unexpectedly made a write");

  await pause.click();
  await confirmPause.click();
  await firstWrite;
  try {
    await cancel.and(page.locator("button:disabled")).waitFor();
  } finally {
    release();
  }
  await page.getByText("模拟更新失败", { exact: true }).waitFor();
  await confirmPause.click();
  await page.getByText("已暂停", { exact: true }).waitFor();
  await resume.click();
  await confirmResume.click();
  await page.getByText("未暂停", { exact: true }).waitFor();
  check(writes.length === 3 && writes.every((write, i) => write.id === 11 && write.body.paused === (i < 2)), "Wrong write path or body");

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(origin + "/workspaces?workspace_id=12");
  await pause.click();
  const dialog = page.getByRole("dialog", { name: "暂停团队积分使用" });
  const bounds = await dialog.boundingBox();
  check(bounds && bounds.x >= 0 && bounds.x + bounds.width <= 390, "Confirmation extends beyond the mobile viewport");
  await confirmPause.click();
  await page.getByText("已暂停", { exact: true }).waitFor();
  check(writes[3]?.id === 12 && writes[3]?.body.paused === true, "No-wallet enterprise space cannot pause");

  readonly = true;
  await page.reload();
  await page.getByText("已暂停", { exact: true }).waitFor();
  check(await resume.count() === 0, "Read-only admin can see the resume action");
  readonly = false;
  for (const id of [13, 14]) {
    await page.goto(origin + "/workspaces?workspace_id=" + id);
    await page.getByText(workspaces.find(row => row.id === id).name + " · 空间 #" + id, { exact: true }).waitFor();
    check(await pause.count() === 0 && await resume.count() === 0, "Unsupported workspace exposes a write action");
  }
  check(errors.length === 0, errors.join("\n"));
  await page.unroute("**/api/v1/**");
  return { result: "PASS", cases: "pause, resume, cancellation, pending, failure retry, no-wallet, read-only, unsupported spaces, mobile" };
}
