// src/lib/authz/ability.ts
import { Ability, AbilityBuilder, RawRuleOf, MongoAbility } from "@casl/ability";

export const ability = new Ability();

export function updateAbility(rules: RawRuleOf<MongoAbility>[]) {
  const { can, rules: newRules } = new AbilityBuilder(Ability);
  if (rules) {
    rules.forEach((rule) => {
      can(rule.action, rule.subject, rule.conditions);
    });
  }
  ability.update(newRules);
}
