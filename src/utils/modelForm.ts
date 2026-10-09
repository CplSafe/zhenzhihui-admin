import type { ModelWriteBody } from "@/api/models";
import type { ModelVersion } from "@/types/domain";

// 模型详情 → 抽屉表单值(编辑回填用)。
export function modelFormValues(d: ModelVersion): ModelWriteBody {
  return {
    provider: d.provider,
    model: d.model,
    version: d.version,
    display_name: d.display_name,
    logo_url: d.logo_url,
    capability: d.capability,
    enabled: d.enabled,
    task_mode: d.task_mode,
    allowed_plans: d.allowed_plans,
    operation_codes: d.operation_codes,
    pricing: d.pricing,
    params_schema: d.params_schema,
    result_schema: d.result_schema,
    system_prompts: d.system_prompts,
  };
}

// 复制一条模型作为新建表单的初值:沿用全部配置(价格 / 参数 / 操作码 / 提示词…),
// 只清空 version 逼运营填新的模型 ID(provider+version 唯一),并默认停用,测通再启用。
// 深拷贝避免表单编辑反向改到源记录的缓存对象。
export function copiedModelFormValues(d: ModelVersion): ModelWriteBody {
  return {
    ...structuredClone(modelFormValues(d)),
    version: "",
    display_name: `${d.display_name} (副本)`,
    enabled: false,
  };
}
