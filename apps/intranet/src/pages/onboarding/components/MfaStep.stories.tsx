import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";

import { MfaStep } from "./MfaStep";

// Stories for the onboarding wizard MFA step. The component is purely
// presentational (props only): it renders either the "generate QR" prompt
// (mfaSecret === null) or the QR + TOTP-code entry (mfaSecret set). The
// `enforced` flag decides whether the "Omitir por ahora" escape is offered
// or replaced by a mandatory-second-factor notice.
//
// The harness holds the state the real onboarding page owns (mfaCode +
// mfaSecret) so play() can type a code and watch the "Verificar" button
// enable, and click "Generar código QR" to transition null → QR.

// A tiny valid PNG so the <img> has a real, decodable source in the browser
// runner (a fake string would still render but this keeps loading=lazy happy).
const FAKE_QR =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMBAQDJ/pLvAAAAAElFTkSuQmCC";

interface HarnessProps {
  enforced?: boolean;
  withSecret?: boolean;
}

function Harness({ enforced, withSecret }: HarnessProps) {
  const [mfaCode, setMfaCode] = useState("");
  const [mfaSecret, setMfaSecret] = useState<{ qrCodeUrl: string; secret: string } | null>(
    withSecret ? { qrCodeUrl: FAKE_QR, secret: "JBSWY3DPEHPK3PXP" } : null
  );

  return (
    <div className="mx-auto max-w-md p-8">
      <MfaStep
        enforced={enforced}
        mfaCode={mfaCode}
        mfaSecret={mfaSecret}
        onMfaCodeChange={setMfaCode}
        onPasskeyRegister={() => {}}
        onSetupMfa={() => setMfaSecret({ qrCodeUrl: FAKE_QR, secret: "JBSWY3DPEHPK3PXP" })}
        onSkip={() => {}}
        onVerifyMfa={() => {}}
      />
    </div>
  );
}

const meta: Meta<typeof MfaStep> = {
  title: "Onboarding/MfaStep",
  component: MfaStep,
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Paso MFA del asistente de onboarding. Sin secreto muestra el botón para generar el QR; con secreto muestra el QR + campo de código de 6 dígitos + registro de passkey. `enforced` oculta el botón «Omitir por ahora» y muestra un aviso de segundo factor obligatorio.",
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof MfaStep>;

// mfaSecret === null → the "generate QR" prompt. Clicking the button (harness
// wires onSetupMfa → set a fake secret) transitions to the QR view.
export const GenerateQr: Story = {
  name: "Opcional — generar QR",
  render: () => <Harness />,
  play: async ({ canvasElement }) => {
    const { expect, userEvent, within } = await import("storybook/test");
    const root = within(canvasElement.ownerDocument.body);
    const generate = await root.findByRole("button", { name: "Generar código QR" });
    await expect(generate).toBeVisible();
    await userEvent.click(generate);
    // QR now visible + the code input appeared.
    await expect(await root.findByRole("img", { name: /código qr/i })).toBeVisible();
    await expect(root.getByPlaceholderText("000000")).toBeVisible();
  },
};

// mfaSecret set, enforced=false → QR + code input + skip escape shown. Typing a
// full 6-digit code enables the "Verificar y activar" button.
export const OptionalWithSkip: Story = {
  name: "Opcional — QR + omitir",
  render: () => <Harness withSecret />,
  play: async ({ canvasElement }) => {
    const { expect, userEvent, within } = await import("storybook/test");
    const root = within(canvasElement.ownerDocument.body);
    await expect(await root.findByRole("img", { name: /código qr/i })).toBeVisible();
    // Skip escape is offered when not enforced.
    await expect(root.getByRole("button", { name: "Omitir por ahora" })).toBeVisible();
    // Verify button disabled until the code is complete.
    const verify = root.getByRole("button", { name: "Verificar y activar" });
    await expect(verify).toBeDisabled();
    await userEvent.type(root.getByPlaceholderText("000000"), "123456");
    await expect(verify).toBeEnabled();
  },
};

// mfaSecret set, enforced=true → QR shown, NO skip button; instead the
// mandatory-second-factor notice is rendered.
export const EnforcedNoSkip: Story = {
  name: "Obligatorio — sin omitir",
  render: () => <Harness enforced withSecret />,
  play: async ({ canvasElement }) => {
    const { expect, within } = await import("storybook/test");
    const root = within(canvasElement.ownerDocument.body);
    await expect(await root.findByRole("img", { name: /código qr/i })).toBeVisible();
    // Enforced: skip button gone, notice present.
    await expect(root.queryByRole("button", { name: "Omitir por ahora" })).toBeNull();
    await expect(root.getByText(/requiere un segundo factor/i)).toBeVisible();
  },
};
