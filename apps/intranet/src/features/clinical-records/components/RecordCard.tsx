import { Card, Chip } from "@heroui/react";
import dayjs from "dayjs";
import { ClipboardList, FileText, Pill, Stethoscope } from "lucide-react";

type Anthropometric = Record<string, string>;

export type RecordCardProps = {
  consultDate: string | null;
  patientName: string | null;
  ageLabel: string | null;
  history: string | null;
  physicalExam: string | null;
  diagnosis: string | null;
  indications: string[];
  weightKg: number | null;
  heightCm: number | null;
  headCircumferenceCm: number | null;
  anthropometric: Anthropometric;
};

function fmtDate(value: string | null): string {
  if (!value) return "Sin fecha";
  return dayjs(value).format("DD MMM YYYY");
}

function Section({
  icon: Icon,
  label,
  body,
}: {
  icon: typeof FileText;
  label: string;
  body: React.ReactNode;
}) {
  if (!body) return null;
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2 text-default-700">
        <Icon size={14} />
        <span className="font-semibold text-xs uppercase tracking-wide">{label}</span>
      </div>
      <div className="whitespace-pre-wrap text-default-900 text-sm leading-relaxed">{body}</div>
    </div>
  );
}

export function RecordCard(props: RecordCardProps) {
  const anthroPills = Object.entries(props.anthropometric).slice(0, 6);
  return (
    <Card className="p-4">
      <Card.Header className="!flex !items-start !justify-between gap-3 p-0 pb-3">
        <div>
          <p className="font-semibold text-base">{fmtDate(props.consultDate)}</p>
          {props.ageLabel && <p className="text-default-500 text-xs">Edad: {props.ageLabel}</p>}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {props.weightKg != null && (
            <Chip size="sm" variant="soft">
              <Chip.Label>{props.weightKg} kg</Chip.Label>
            </Chip>
          )}
          {props.heightCm != null && (
            <Chip size="sm" variant="soft">
              <Chip.Label>{props.heightCm} cm</Chip.Label>
            </Chip>
          )}
          {props.headCircumferenceCm != null && (
            <Chip size="sm" variant="soft">
              <Chip.Label>CC {props.headCircumferenceCm}</Chip.Label>
            </Chip>
          )}
        </div>
      </Card.Header>
      <Card.Content className="flex flex-col gap-4 p-0">
        <Section icon={FileText} label="Historia" body={props.history} />
        <Section icon={Stethoscope} label="Examen físico" body={props.physicalExam} />
        <Section icon={ClipboardList} label="Diagnóstico" body={props.diagnosis} />
        {props.indications.length > 0 && (
          <Section
            icon={Pill}
            label="Indicaciones"
            body={
              <ol className="list-decimal space-y-1 pl-5">
                {props.indications.map((line, idx) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: indications are stable lines
                  <li key={idx}>{line}</li>
                ))}
              </ol>
            }
          />
        )}
        {anthroPills.length > 0 && (
          <div className="flex flex-wrap gap-1.5 border-default-200 border-t pt-3">
            {anthroPills.map(([k, v]) => (
              <Chip key={k} size="sm" variant="soft">
                <Chip.Label>
                  {k}: {v}
                </Chip.Label>
              </Chip>
            ))}
          </div>
        )}
      </Card.Content>
    </Card>
  );
}
