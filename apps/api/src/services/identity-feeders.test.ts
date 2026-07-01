import { beforeEach, describe, expect, it, vi } from "vitest";

const { getSetting } = vi.hoisted(() => ({ getSetting: vi.fn() }));
const { doctoralia, orphan, guardian, dte } = vi.hoisted(() => ({
  doctoralia: vi.fn(),
  orphan: vi.fn(),
  guardian: vi.fn(),
  dte: vi.fn(),
}));

vi.mock("../lib/settings.ts", () => ({ getSetting }));
vi.mock("./doctoralia-identity-sync.ts", () => ({ runDoctoraliaIdentitySync: doctoralia }));
vi.mock("./backfill-orphan-series.ts", () => ({ runBackfillOrphanSeries: orphan }));
vi.mock("./backfill-guardians.ts", () => ({ runBackfillGuardians: guardian }));
vi.mock("./patients-router.ts", () => ({ syncPatientDteSaleSources: dte }));

import { feedDoctoraliaIdentity, feedDteTitular } from "./identity-feeders.ts";

beforeEach(() => {
  vi.clearAllMocks();
  doctoralia.mockResolvedValue({});
  orphan.mockResolvedValue({});
  guardian.mockResolvedValue({});
  dte.mockResolvedValue({});
});

describe("identity-feeders toggle (DB Setting, no env)", () => {
  it("setting 'false' → NO corre (doctoralia)", async () => {
    getSetting.mockResolvedValue("false");
    await feedDoctoraliaIdentity("test");
    expect(doctoralia).not.toHaveBeenCalled();
    expect(orphan).not.toHaveBeenCalled();
    expect(guardian).not.toHaveBeenCalled();
  });

  it("setting ausente (null) → corre incremental (onlyUnlinked)", async () => {
    getSetting.mockResolvedValue(null);
    await feedDoctoraliaIdentity("test");
    expect(doctoralia).toHaveBeenCalledWith({ dryRun: false, onlyUnlinked: true });
    expect(orphan).toHaveBeenCalledWith({ dryRun: false });
    expect(guardian).toHaveBeenCalledWith({ dryRun: false });
  });

  it("dte: setting 'false' → NO corre", async () => {
    getSetting.mockResolvedValue("false");
    await feedDteTitular("test");
    expect(dte).not.toHaveBeenCalled();
  });

  it("dte: ON → resolveTitular", async () => {
    getSetting.mockResolvedValue("true");
    await feedDteTitular("test");
    expect(dte).toHaveBeenCalledWith({ dryRun: false, resolveTitular: true });
  });
});
