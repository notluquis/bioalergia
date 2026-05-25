import { Button, Input, Label, Modal, TextField } from "@heroui/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import { SearchIcon } from "lucide-react";
import { useState } from "react";

import type { ExpenseScope } from "@finanzas/orpc-contracts/expenses";
import { financeORPCClient } from "@/features/finance/orpc";
import { toast } from "@/lib/toast-interceptor";

import { expensesORPCClient, toExpensesApiError } from "../expenses-orpc";

interface Props {
  expectedAmount: number;
  expenseName: string;
  expensePublicId: string;
  onClose: () => void;
  onLinked: () => void;
  scope: ExpenseScope;
}

function formatCLP(value: number): string {
  return new Intl.NumberFormat("es-CL", {
    currency: "CLP",
    maximumFractionDigits: 0,
    style: "currency",
  }).format(value);
}

export function ExpenseLinkModal({
  expectedAmount,
  expenseName,
  expensePublicId,
  onClose,
  onLinked,
  scope: _scope,
}: Props) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [linkAmount, setLinkAmount] = useState(expectedAmount.toString());

  const txQuery = useQuery({
    queryFn: () =>
      financeORPCClient.transactionsList({
        from: dayjs().subtract(90, "day").format("YYYY-MM-DD"),
        page: 1,
        pageSize: 30,
        search: search || undefined,
        to: dayjs().add(7, "day").format("YYYY-MM-DD"),
        type: "EXPENSE",
      }),
    queryKey: ["finance", "transactions", "for-link", search],
  });

  const linkMutation = useMutation({
    mutationFn: (txId: number) =>
      expensesORPCClient.linkTransaction({
        amount: Number(linkAmount) || expectedAmount,
        publicId: expensePublicId,
        transactionId: txId,
      }),
    onError: (err) => toast.error(toExpensesApiError(err).message),
    onSuccess: () => {
      toast.success("Pago vinculado");
      void queryClient.invalidateQueries({ queryKey: ["finance"] });
      onLinked();
    },
  });

  type TxItem = {
    amount: number | string;
    date?: Date | string | undefined;
    description?: string | undefined;
    id: number;
  };
  const transactions: TxItem[] = (txQuery.data?.data ?? []) as TxItem[];

  return (
    <Modal isOpen onOpenChange={(open) => !open && onClose()}>
      <Modal.Backdrop>
        <Modal.Container>
          <Modal.Dialog className="sm:max-w-3xl">
            <Modal.CloseTrigger />
            <Modal.Header>
              <div>
                <Modal.Heading>Vincular pago a {expenseName}</Modal.Heading>
                <p className="text-default-500 text-sm">Esperado: {formatCLP(expectedAmount)}</p>
              </div>
            </Modal.Header>

            <Modal.Body className="gap-3">
              <div className="flex items-center gap-2">
                <SearchIcon className="size-4 text-default-400" />
                <TextField className="flex-1" value={search} onChange={setSearch}>
                  <Label className="sr-only">Buscar transacción</Label>
                  <Input placeholder="Buscar por descripción o monto…" />
                </TextField>
                <TextField className="w-40" value={linkAmount} onChange={setLinkAmount}>
                  <Label className="sr-only">Monto a vincular</Label>
                  <Input placeholder="Monto" />
                </TextField>
              </div>

              <div className="max-h-96 overflow-auto rounded-xl border border-default-200">
                <table className="w-full text-sm">
                  <thead className="bg-default-50">
                    <tr className="text-left text-default-600">
                      <th className="px-3 py-2">Fecha</th>
                      <th className="px-3 py-2">Descripción</th>
                      <th className="px-3 py-2 text-right">Monto</th>
                      <th className="px-3 py-2">
                        <span className="sr-only">Acciones</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {txQuery.isLoading ? (
                      <tr>
                        <td className="px-3 py-6 text-center text-default-400" colSpan={4}>
                          Cargando…
                        </td>
                      </tr>
                    ) : transactions.length === 0 ? (
                      <tr>
                        <td className="px-3 py-6 text-center text-default-400" colSpan={4}>
                          Sin transacciones para vincular
                        </td>
                      </tr>
                    ) : (
                      transactions.map((tx) => (
                        <tr className="border-default-100 border-t" key={tx.id}>
                          <td className="px-3 py-2 text-default-500 text-xs">
                            {dayjs(tx.date).format("DD MMM YYYY")}
                          </td>
                          <td className="px-3 py-2">{tx.description}</td>
                          <td className="px-3 py-2 text-right tabular-nums">
                            {formatCLP(Math.abs(Number(tx.amount)))}
                          </td>
                          <td className="px-3 py-2 text-right">
                            <Button
                              isDisabled={linkMutation.isPending}
                              size="sm"
                              variant="outline"
                              onPress={() => linkMutation.mutate(tx.id)}
                            >
                              Vincular
                            </Button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <p className="text-default-400 text-xs">
                Si el pago no está acá, registrá primero la transacción en /finance/transactions y
                volvé.
              </p>

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onPress={onClose}>
                  Cancelar
                </Button>
              </div>
            </Modal.Body>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
