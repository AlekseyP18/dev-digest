import type { Agent } from "@devdigest/shared";
import type { UpdateAgentInput } from "@/lib/hooks/agents";

/** Editable fields of an agent, as held by the Config form. */
export type AgentForm = Pick<
  Agent,
  "name" | "description" | "provider" | "model" | "system_prompt" | "strategy" | "ci_fail_on" | "repo_intel" | "enabled"
>;

export function toForm(agent: Agent): AgentForm {
  return {
    name: agent.name,
    description: agent.description,
    provider: agent.provider,
    model: agent.model,
    system_prompt: agent.system_prompt,
    strategy: agent.strategy,
    ci_fail_on: agent.ci_fail_on,
    repo_intel: agent.repo_intel,
    enabled: agent.enabled,
  };
}

/** The PUT body — every editable field, so the saved agent matches the form. */
export function toPatch(form: AgentForm): UpdateAgentInput["patch"] {
  return { ...form };
}
