import type { BusinessAbility, ModelVersion } from "@/types/domain";

export type ModelExecution = Pick<
  ModelVersion,
  "provider" | "model" | "version" | "capability" | "operation_codes"
>;

// Mirror catalog.AbilitySupportsModel: server validation remains authoritative.
export function abilitySupportsModel(
  ability: BusinessAbility,
  model: ModelExecution,
  abilities: BusinessAbility[] = [],
): boolean {
  const execution = ability.execution_operation_code || ability.operation_code;
  const declared = model.operation_codes?.some((operation) => {
    if (operation === ability.operation_code || operation === execution)
      return true;
    const other = abilities.find(
      (candidate) => candidate.operation_code === operation,
    );
    return (
      other &&
      (other.execution_operation_code || other.operation_code) === execution &&
      other.tool_code === ability.tool_code &&
      other.tool_version === ability.tool_version
    );
  });
  if (!declared) return false;
  const prefix = execution.split(".")[0];
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
  abilities: BusinessAbility[] = [],
  previousOperationCode?: string,
) {
  return models
    .map((model) =>
      previousOperationCode && previousOperationCode !== ability.operation_code
        ? {
            ...model,
            operation_codes: model.operation_codes?.map((operation) =>
              operation === previousOperationCode
                ? ability.operation_code
                : operation,
            ),
          }
        : model,
    )
    .filter(
      (model) =>
        model.ability_codes?.includes(ability.code) &&
        abilitySupportsModel(ability, model, abilities),
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
        (ability.enabled && abilitySupportsModel(ability, model, abilities)),
    )
    .map((ability) => ({
      value: ability.code,
      label: `${ability.display_name} (${ability.code})${ability.enabled ? "" : " · 已停用"}${abilitySupportsModel(ability, model, abilities) ? "" : " · 模型或操作不匹配"}${modelId > 0 && ability.default_model_version_id === modelId ? " · 当前默认模型，请先清除默认再取消" : ""}`,
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
  field: "name" | "description" | "operation",
  value: string | undefined,
): boolean {
  return (
    new TextEncoder().encode(value?.trim() ?? "").length <=
    (field === "description" ? 4096 : 128)
  );
}

// Keep execution choices shared by the model form and business binding editor.
export const DIRECT_OPERATIONS = [
 "image.text_to_image", "image.image_to_image", "image.upscale", "video.upscale",
 "responses.multimodal", "prompt.enhance.video", "prompt.enhance.image", "prompt.enhance.polish",
 "image.face_blur", "image.face_detect", "video.replicate", "video.generate", "video.edit", "video.extend",
 "agent.chat", "audio.speech_to_text", "audio.generate", "audio.text_to_speech",
];

export function modelOperationOptions(
 abilities: Pick<BusinessAbility, "operation_code" | "display_name" | "enabled">[],
 selected: string[] = [],
) {
 const choices = new Map(DIRECT_OPERATIONS.map(code => [code, {value: code, label: code}]));
 for (const ability of abilities) choices.set(ability.operation_code, {
  value: ability.operation_code,
  label: `${ability.display_name} · ${ability.operation_code}${ability.enabled ? "" : "（已停用）"}`,
 });
 for (const code of selected) if (!choices.has(code)) choices.set(code, {value: code, label: code});
 return [...choices.values()];
}

export function reconcileModelOperations(
 selected: string[],
 previous: Pick<BusinessAbility, "code" | "operation_code">[],
 current: Pick<BusinessAbility, "code" | "operation_code">[],
 assigned: string[],
) {
 const renames = previous.flatMap(before => {
  const after = current.find(item => item.code === before.code);
  return after && after.operation_code !== before.operation_code ? [{...before, next:after.operation_code}] : [];
 });
 const values = selected.map(code => DIRECT_OPERATIONS.includes(code) ? code : (renames.find(item => item.operation_code === code)?.next ?? code));
 for (const item of renames) {
  if (DIRECT_OPERATIONS.includes(item.operation_code) && selected.includes(item.operation_code) && assigned.includes(item.code)) values.push(item.next);
 }
 return [...new Set(values)];
}
