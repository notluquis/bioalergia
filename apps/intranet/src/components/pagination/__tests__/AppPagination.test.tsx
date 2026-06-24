import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { AppPagination } from "../AppPagination";

// AppPagination es la paginación presentacional única (HeroUI). Contrato 0-based
// en `page`/`onPageChange`, muestra números 1-based. Estos tests fijan la
// conversión y los límites (fuente histórica de bugs off-by-one).

function setup(overrides: Partial<Parameters<typeof AppPagination>[0]> = {}) {
  const onPageChange = vi.fn<(page: number) => void>();
  render(
    <AppPagination
      loading={false}
      onPageChange={onPageChange}
      page={0}
      pageSize={20}
      totalCount={100}
      totalPages={5}
      {...overrides}
    />
  );
  return { onPageChange };
}

describe("AppPagination", () => {
  it("se oculta cuando totalCount <= pageSize", () => {
    const { onPageChange } = setup({ totalCount: 20, pageSize: 20, totalPages: 1 });
    expect(screen.queryByText(/Página/)).not.toBeInTheDocument();
    expect(onPageChange).not.toHaveBeenCalled();
  });

  it("muestra el número de página 1-based", () => {
    setup({ page: 2 });
    expect(screen.getByText("Página 3 de 5")).toBeInTheDocument();
  });

  it("Siguiente emite el índice 0-based incrementado", async () => {
    const user = userEvent.setup();
    const { onPageChange } = setup({ page: 0 });
    await user.click(screen.getByRole("button", { name: /Siguiente/i }));
    expect(onPageChange).toHaveBeenCalledWith(1);
  });

  it("Anterior emite el índice 0-based decrementado (sin bajar de 0)", async () => {
    const user = userEvent.setup();
    const { onPageChange } = setup({ page: 2 });
    await user.click(screen.getByRole("button", { name: /Anterior/i }));
    expect(onPageChange).toHaveBeenCalledWith(1);
  });

  it("Anterior está deshabilitado en la primera página", () => {
    const { onPageChange } = setup({ page: 0 });
    expect(screen.getByRole("button", { name: /Anterior/i })).toBeDisabled();
    expect(onPageChange).not.toHaveBeenCalledWith(-1);
  });

  it("un link de página numérico emite (n-1)", async () => {
    const user = userEvent.setup();
    const { onPageChange } = setup({ page: 0 });
    await user.click(screen.getByRole("button", { name: "3" }));
    expect(onPageChange).toHaveBeenCalledWith(2);
  });

  it("deriva totalPages desde totalCount cuando no se entrega", () => {
    setup({ page: 0, totalCount: 45, pageSize: 20, totalPages: undefined });
    expect(screen.getByText("Página 1 de 3")).toBeInTheDocument();
  });

  it("total desconocido (totalPages = -1): muestra 'Página N' sin total y Siguiente habilitado", () => {
    setup({ page: 0, totalCount: undefined, totalPages: -1 });
    expect(screen.getByText("Página 1")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Siguiente/i })).not.toBeDisabled();
  });
});
