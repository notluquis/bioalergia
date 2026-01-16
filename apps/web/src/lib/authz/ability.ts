import { AbilityBuilder, createMongoAbility, MongoAbility, RawRuleOf } from "@casl/ability";

export type AppAbility = MongoAbility;

export const ability = createMongoAbility();

export function updateAbility(rules: RawRuleOf<AppAbility>[]) {
  const { can, rules: newRules } = new AbilityBuilder(createMongoAbility);
  if (rules) {
    rules.forEach((rule) => {
      can(rule.action, rule.subject as string, rule.conditions);
    });
  }
  ability.update(newRules);
}
