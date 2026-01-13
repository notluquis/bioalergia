export const loanKeys = {
  all: ["loans"] as const,
  lists: () => [...loanKeys.all, "list"] as const,
  detail: (id: string) => [...loanKeys.all, "detail", id] as const,
};
