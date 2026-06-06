import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ClassificationPagination } from "../ClassificationPagination";

// ClassificationPagination es presentacional + controlado por el padre. Recibe
// `page` 0-based y emite onPageChange con índice 0-based, pero muestra números
// 1-based. Estos tests fijan esa conversión y los límites (la fuente histórica
// de bugs off-by-one en paginaciones).

function setup(overrides: Partial<Parameters<typeof ClassificationPagination>[0]> = {}) {
  const onPageChange = vi.fn<(page: number) => void>();
  render(
    <ClassificationPagination
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

describe("ClassificationPagination", () => {
  it("se oculta cuando totalCount <= pageSize", () => {
    const { onPageChange } = setup({ totalCount: 20, pageSize: 20 });
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
    const prev = screen.getByRole("button", { name: /Anterior/i });
    expect(prev).toBeDisabled();
    expect(onPageChange).not.toHaveBeenCalledWith(-1);
  });

  it("un link de página numérico emite (n-1)", async () => {
    const user = userEvent.setup();
    const { onPageChange } = setup({ page: 0 });
    await user.click(screen.getByRole("button", { name: "3" }));
    expect(onPageChange).toHaveBeenCalledWith(2);
  });
});
