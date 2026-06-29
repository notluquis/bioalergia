import {
  Alert,
  Button,
  Card,
  Form,
  Input,
  Label,
  Skeleton,
  TextArea,
  TextField,
} from "@heroui/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Star } from "lucide-react";
import { type FormEvent, useState } from "react";

import { formatRelative } from "@/lib/relative-time";
import { catalogClient } from "@/lib/orpc-client";

function StarRow({
  value,
  outOf = 5,
  size = 16,
}: {
  value: number;
  outOf?: number;
  size?: number;
}) {
  return (
    <span
      aria-label={`${value} de ${outOf} estrellas`}
      className="inline-flex items-center gap-0.5"
    >
      {Array.from({ length: outOf }).map((_, i) => {
        const filled = i < Math.round(value);
        return (
          <Star
            aria-hidden="true"
            className={filled ? "fill-brand-amber text-brand-amber" : "text-line"}
            key={i}
            size={size}
          />
        );
      })}
    </span>
  );
}

function StarPicker({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <fieldset className="flex items-center gap-1 border-0 p-0">
      <legend className="sr-only">Tu calificación</legend>
      {[1, 2, 3, 4, 5].map((n) => {
        const filled = n <= value;
        return (
          <label className="cursor-pointer rounded p-1 hover:bg-surface-2" key={n}>
            <input
              aria-label={`${n} estrella${n > 1 ? "s" : ""}`}
              checked={n === value}
              className="sr-only"
              name="review-rating"
              onChange={() => onChange(n)}
              type="radio"
              value={n}
            />
            <Star
              aria-hidden="true"
              className={filled ? "fill-brand-amber text-brand-amber" : "text-line"}
              size={28}
            />
          </label>
        );
      })}
    </fieldset>
  );
}

export function Reviews({ productId }: { productId: number }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [rating, setRating] = useState(5);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Honeypot: bots fill it, humans never see it → drop the submission client-side.
  const [website, setWebsite] = useState("");

  const reviewsKey = ["shop", "reviews", productId] as const;
  const reviewsQ = useQuery({
    queryKey: reviewsKey,
    queryFn: () => catalogClient.listReviews({ id: productId }),
    staleTime: 1000 * 60 * 5,
  });

  const submitMutation = useMutation({
    mutationFn: () =>
      catalogClient.submitReview({
        product_id: productId,
        author_name: name,
        author_email: email,
        rating,
        title: title || undefined,
        body,
      }),
    onSuccess: () => {
      setSubmitted(true);
      setError(null);
      setName("");
      setEmail("");
      setRating(5);
      setTitle("");
      setBody("");
      setOpen(false);
      void queryClient.invalidateQueries({ queryKey: reviewsKey });
    },
    onError: (e) => setError(e instanceof Error ? e.message : "Error enviando reseña"),
  });

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (website) {
      setSubmitted(true);
      setOpen(false);
      return;
    }
    setError(null);
    submitMutation.mutate();
  };

  if (reviewsQ.isLoading) {
    return (
      <section className="space-y-3">
        <h2 className="font-display text-2xl text-foreground sm:text-[1.75rem]">Reseñas</h2>
        <Skeleton className="h-24 w-full" />
      </section>
    );
  }

  const reviews = reviewsQ.data?.data ?? [];
  const aggregate = reviewsQ.data?.aggregate ?? { count: 0, average: 0 };

  return (
    <section aria-labelledby="reviews-heading" className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <h2
            className="font-display text-2xl text-foreground sm:text-[1.75rem]"
            id="reviews-heading"
          >
            Reseñas
          </h2>
          {aggregate.count > 0 ? (
            <div className="flex items-center gap-2 text-sm">
              <StarRow value={aggregate.average} />
              <span className="font-medium text-foreground">{aggregate.average.toFixed(1)}</span>
              <span className="text-muted">
                · {aggregate.count} {aggregate.count === 1 ? "reseña" : "reseñas"}
              </span>
            </div>
          ) : (
            <p className="text-muted text-sm">Sin reseñas todavía. ¡Sé la primera!</p>
          )}
        </div>
        <Button onPress={() => setOpen((v) => !v)} variant="secondary">
          {open ? "Cancelar" : "Escribir reseña"}
        </Button>
      </header>

      {submitted && (
        <Alert status="success">
          <Alert.Content>
            <Alert.Description>Gracias, tu reseña está en revisión.</Alert.Description>
          </Alert.Content>
        </Alert>
      )}

      {open && (
        <Card className="rounded-2xl border-line">
          <Card.Header>
            <Card.Title className="text-foreground">Tu reseña</Card.Title>
          </Card.Header>
          <Card.Content>
            <Form className="space-y-3" onSubmit={onSubmit} validationBehavior="aria">
              <TextField isRequired onChange={setName} value={name}>
                <Label>Nombre</Label>
                <Input minLength={2} maxLength={80} />
              </TextField>
              <TextField isRequired onChange={setEmail} value={email}>
                <Label>Email (no se publica)</Label>
                <Input placeholder="tu@email.cl" type="email" />
              </TextField>
              <div className="space-y-1">
                <Label>Calificación</Label>
                <StarPicker onChange={setRating} value={rating} />
              </div>
              <TextField onChange={setTitle} value={title}>
                <Label>Título (opcional)</Label>
                <Input maxLength={80} />
              </TextField>
              <TextField isRequired onChange={setBody} value={body}>
                <Label>Tu opinión</Label>
                <TextArea maxLength={2000} minLength={10} rows={4} />
              </TextField>
              {/* Honeypot anti-spam: invisible para humanos, los bots lo llenan. */}
              <div aria-hidden="true" className="absolute left-[-9999px] size-0 overflow-hidden">
                <label htmlFor="review-website-hp">No llenar este campo</label>
                <input
                  aria-label="No llenar este campo"
                  autoComplete="off"
                  id="review-website-hp"
                  name="website"
                  onChange={(e) => setWebsite(e.target.value)}
                  tabIndex={-1}
                  type="text"
                  value={website}
                />
              </div>
              {error && (
                <Alert status="danger">
                  <Alert.Content>
                    <Alert.Description>{error}</Alert.Description>
                  </Alert.Content>
                </Alert>
              )}
              <Button isDisabled={submitMutation.isPending} type="submit" variant="primary">
                {submitMutation.isPending ? "Enviando…" : "Enviar reseña"}
              </Button>
            </Form>
          </Card.Content>
        </Card>
      )}

      {reviews.length > 0 && (
        <div className="space-y-3">
          {reviews.map((r) => (
            <Card className="rounded-2xl border-line" key={r.id}>
              <Card.Content className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-foreground">{r.author_name}</span>
                    {r.verified && (
                      <span className="rounded bg-doctoralia-green/10 px-1.5 py-0.5 text-doctoralia-green text-xs">
                        Compra verificada
                      </span>
                    )}
                  </div>
                  <span className="text-muted text-xs">{formatRelative(r.created_at)}</span>
                </div>
                <StarRow value={r.rating} />
                {r.title && <p className="font-semibold text-foreground">{r.title}</p>}
                <p className="whitespace-pre-line text-muted text-sm leading-relaxed">{r.body}</p>
              </Card.Content>
            </Card>
          ))}
        </div>
      )}
    </section>
  );
}
