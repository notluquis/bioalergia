import {
  AbilityBuilder,
  createMongoAbility,
  type MongoAbility,
  type RawRuleOf,
} from "@casl/ability";

export type AppAbility = MongoAbility;

export const ability = createMongoAbility();

export function updateAbility(rules: RawRuleOf<AppAbility>[]) {
  const { can, rules: newRules } = new AbilityBuilder(createMongoAbility);
  if (rules) {
    for (const rule of rules) {
      can(rule.action, rule.subject as string, rule.conditions);
    }
  }
  ability.update(newRules);
}
