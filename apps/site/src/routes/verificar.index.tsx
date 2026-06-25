import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Button, Input } from "@heroui/react";

export const Route = createFileRoute("/verificar/")({
  component: VerificarIndexPage,
});

function VerificarIndexPage() {
  const navigate = useNavigate();
  const [code, setCode] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (code.trim()) {
      navigate({ to: "/verificar/$code", params: { code: code.trim() } });
    }
  };

  return (
    <div className="container mx-auto flex min-h-[60vh] flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-md text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">Verificar Documento</h1>
        <p className="text-gray-600 mb-8">
          Ingresa el código de verificación que aparece en tu receta o certificado.
        </p>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Input
            placeholder="Ej. BA-XXXX-XXXX"
            value={code}
            onChange={(e) => setCode((e.target as HTMLInputElement).value)}
            required
            autoFocus
          />
          <Button type="submit" className="w-full font-bold bg-primary text-white">
            Verificar Documento
          </Button>
        </form>
      </div>
    </div>
  );
}
