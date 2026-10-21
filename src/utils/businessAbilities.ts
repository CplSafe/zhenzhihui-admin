import type { BusinessAbility, ModelVersion } from "@/types/domain";

export type ModelExecution = Pick<
  ModelVersion,
  "provider" | "model" | "version" | "capability" | "operation_codes"
>;

// Mirror catalog.AbilitySupportsModel: server validation remains authoritative.
export function abilitySupportsModel(
  ability: BusinessAbility,
  model: ModelExecution,
): boolean {
  if (!model.operation_codes?.includes(ability.operation_code)) return false;
  const prefix = ability.operation_code.split(".")[0];
  const capability = ["image", "video", "audio"].includes(prefix)
    ? prefix
    : "responses";
  if (model.capability !== capability) return false;
  if (!ability.tool_code) return true;
  const qwen =
    model.provider === "bailian" &&
    model.version === "qwen-image-2.0-2026-03-03";
  const panorama =
    (model.provider === "openai" &&
      ["gpt-image-2", "gpt-image-2.5-sunburst", "gpt-image-2.5-flare"].includes(
        model.model,
      )) ||
    (model.provider === "volcengine" &&
      [
        "doubao-seedream-5-0",
        "doubao-seedream-5-0-pro",
        "doubao-seedream-5-0-flash",
      ].includes(model.model));
  if (ability.tool_code === "image.relight" && qwen) return true;
  if (ability.tool_version === 1 && ability.tool_code !== "image.relight") {
    return ability.tool_code === "image.panorama"
      ? panorama
      : ["openai", "volcengine", "google"].includes(model.provider);
  }
  if (ability.tool_code === "image.multi_angle") return qwen;
  return (
    panorama ||
    (model.provider === "google" &&
      [
        "gemini-2.5-flash-image",
        "gemini-nano-banana-2.1",
        "gemini-3.1-flash-image",
        "gemini-3-pro-image",
      ].includes(model.model))
  );
}

export function abilityModelOptions(
  ability: BusinessAbility,
  models: ModelVersion[],
) {
  return models
    .filter(
      (model) =>
        model.ability_codes?.includes(ability.code) &&
        abilitySupportsModel(ability, model),
    )
    .map((model) => ({
      value: model.id,
      label: `${model.display_name || model.version} · ${model.provider ?? ""} #${model.id}${model.enabled ? "" : "（已停用）"}`,
      disabled: false,
    }));
}

// Keep existing assignments visible when a capability is disabled or operations
// are edited. Otherwise a hidden checked value could be silently lost on save.
export function modelAbilityOptions(
  abilities: BusinessAbility[],
  model: ModelExecution,
  assigned: string[],
  modelId: number,
) {
  const options = abilities
    .filter(
      (ability) =>
        assigned.includes(ability.code) ||
        (ability.enabled && abilitySupportsModel(ability, model)),
    )
    .map((ability) => ({
      value: ability.code,
      label: `${ability.display_name} (${ability.code})${ability.enabled ? "" : " · 已停用"}${abilitySupportsModel(ability, model) ? "" : " · 模型或操作不匹配"}${modelId > 0 && ability.default_model_version_id === modelId ? " · 当前默认模型，请先清除默认再取消" : ""}`,
      disabled: modelId > 0 && ability.default_model_version_id === modelId,
    }));
  for (const code of assigned) {
    if (!abilities.some((ability) => ability.code === code)) {
      options.push({
        value: code,
        label: `${code} · 能力不存在`,
        disabled: false,
      });
    }
  }
  return options;
}

export function fitsAbilityTextLimit(
  field: "name" | "description",
  value: string | undefined,
): boolean {
  return (
    new TextEncoder().encode(value?.trim() ?? "").length <=
    (field === "name" ? 128 : 4096)
  );
}
