import { Card, Chip } from "@heroui/react";
import dayjs from "dayjs";
import {
  AlertTriangle,
  ClipboardList,
  FileText,
  Pill,
  ScrollText,
  Stethoscope,
  Users,
} from "lucide-react";

type Anthropometric = Record<string, string>;

export type RecordCardProps = {
  consultDate: string | null;
  patientName: string | null;
  ageLabel: string | null;
  history: string | null;
  physicalExam: string | null;
  diagnosis: string | null;
  indications: string[];
  antecedents: { personal: string[]; family: string[] } | null;
  medications: string[];
  knownAllergies: string[];
  observations: string | null;
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
    <Card className="p-4" data-phi-block>
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
        {props.antecedents &&
          (props.antecedents.personal.length > 0 || props.antecedents.family.length > 0) && (
            <Section
              icon={Users}
              label="Antecedentes"
              body={
                <div className="space-y-2">
                  {props.antecedents.personal.length > 0 && (
                    <div>
                      <p className="font-medium text-default-600 text-xs uppercase tracking-wide">
                        Personales
                      </p>
                      <ul className="list-disc space-y-0.5 pl-5">
                        {props.antecedents.personal.map((line, idx) => (
                          // biome-ignore lint/suspicious/noArrayIndexKey: stable lines
                          <li key={idx}>{line}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {props.antecedents.family.length > 0 && (
                    <div>
                      <p className="font-medium text-default-600 text-xs uppercase tracking-wide">
                        Familiares
                      </p>
                      <ul className="list-disc space-y-0.5 pl-5">
                        {props.antecedents.family.map((line, idx) => (
                          // biome-ignore lint/suspicious/noArrayIndexKey: stable lines
                          <li key={idx}>{line}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              }
            />
          )}
        {props.knownAllergies.length > 0 && (
          <Section
            icon={AlertTriangle}
            label="Alergias conocidas"
            body={
              <ul className="list-disc space-y-0.5 pl-5">
                {props.knownAllergies.map((line, idx) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: stable lines
                  <li key={idx} className="text-warning-700">
                    {line}
                  </li>
                ))}
              </ul>
            }
          />
        )}
        <Section icon={Stethoscope} label="Examen físico" body={props.physicalExam} />
        <Section icon={ClipboardList} label="Diagnóstico" body={props.diagnosis} />
        {props.medications.length > 0 && (
          <Section
            icon={Pill}
            label="Medicamentos actuales"
            body={
              <ul className="list-disc space-y-0.5 pl-5">
                {props.medications.map((line, idx) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: stable lines
                  <li key={idx}>{line}</li>
                ))}
              </ul>
            }
          />
        )}
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
        {props.observations && (
          <Section icon={ScrollText} label="Observaciones" body={props.observations} />
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
