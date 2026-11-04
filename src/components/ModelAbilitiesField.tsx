import { Checkbox, Empty, Space } from "antd";
import type { BusinessAbility } from "@/types/domain";
import {
  modelAbilityOptions,
  type ModelExecution,
} from "@/utils/businessAbilities";

interface Props {
  abilities: BusinessAbility[];
  model: ModelExecution;
  modelId: number;
  assigned?: string[];
  value?: string[];
  onChange?: (value: string[]) => void;
}

export function ModelAbilitiesField({
  abilities,
  model,
  modelId,
  assigned = [],
  value = [],
  onChange,
}: Props) {
  const options = modelAbilityOptions(
    abilities,
    model,
    [...new Set([...assigned, ...value])],
    modelId,
  );
  if (!options.length)
    return (
      <Empty
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        description="暂无匹配能力，请先填写操作码并启用业务能力"
      />
    );
  return (
    <Checkbox.Group value={value} onChange={onChange}>
      <Space orientation="vertical">
        {options.map((option) => (
          <Checkbox
            key={option.value}
            value={option.value}
            disabled={option.disabled}
          >
            {option.label}
          </Checkbox>
        ))}
      </Space>
    </Checkbox.Group>
  );
}
