import {
  Button,
  Calendar,
  DateField,
  DatePicker,
  Description,
  FieldError,
  Form,
  Input,
  Label,
  NumberField,
  TextField,
} from "@heroui/react";
import { parseDate } from "@internationalized/date";
import dayjs from "dayjs";
import { z } from "zod";
import { AppModal } from "@/components/ui/AppModal";
import { useServiceMutations } from "../hooks/use-service-mutations";
import type { ServiceSchedule } from "../types";

// Services operate in CLP (no per-service currency field) → amounts have no
// decimals. Mirror lib/utils.ts::formatCurrency for CLP.
const CLP_FORMAT_OPTIONS: Intl.NumberFormatOptions = {
  style: "currency",
  currency: "CLP",
  currencyDisplay: "symbol",
  maximumFractionDigits: 0,
  minimumFractionDigits: 0,
};

const editScheduleSchema = z.object({
  dueDate: z.string().min(1, "Fecha requerida"),
  expectedAmount: z.coerce.number().min(0, "Monto debe ser mayor o igual a 0"),
  note: z.string().optional(),
});

interface EditScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  schedule: null | ServiceSchedule;
}

export function EditScheduleModal({ isOpen, onClose, schedule }: EditScheduleModalProps) {
  const { editSchedule, editSchedulePending } = useServiceMutations();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!schedule) {
      return;
    }

    const formData = new FormData(e.currentTarget);
    const formValues = {
      dueDate: formData.get("dueDate"),
      expectedAmount: formData.get("expectedAmount"),
      note: formData.get("note"),
    };

    // Validate with Zod
    const result = editScheduleSchema.safeParse(formValues);
    if (!result.success) {
      // Client-side validation failed - HeroUI FieldError should show messages
      return;
    }

    const dueDate = new Date(result.data.dueDate);
    const expectedAmount = result.data.expectedAmount;
    const note = result.data.note;

    await editSchedule(schedule.id, {
      dueDate,
      expectedAmount,
      note: note || undefined,
    });
  };

  if (!schedule) {
    return null;
  }

  return (
    <AppModal
      isOpen={isOpen}
      onClose={onClose}
      title="Editar cuota"
      size="md"
      footer={
        <>
          <Button isDisabled={editSchedulePending} onPress={onClose} variant="secondary">
            Cancelar
          </Button>
          <Button form="edit-schedule-form" isPending={editSchedulePending} type="submit">
            Guardar cambios
          </Button>
        </>
      }
    >
      <Form
        className="flex flex-col gap-4"
        id="edit-schedule-form"
        onSubmit={(e) => {
          void handleSubmit(e);
        }}
        validationBehavior="aria"
      >
        <DatePicker
          defaultValue={parseDate(dayjs(schedule.dueDate).format("YYYY-MM-DD"))}
          isRequired
          name="dueDate"
        >
          <Label>Fecha de vencimiento</Label>
          <DateField.Group>
            <DateField.InputContainer>
              <DateField.Input>
                {(segment) => <DateField.Segment segment={segment} />}
              </DateField.Input>
            </DateField.InputContainer>
            <DateField.Suffix>
              <DatePicker.Trigger>
                <DatePicker.TriggerIndicator />
              </DatePicker.Trigger>
            </DateField.Suffix>
          </DateField.Group>
          <FieldError />
          <DatePicker.Popover>
            <Calendar aria-label="Fecha de vencimiento">
              <Calendar.Header>
                <Calendar.YearPickerTrigger>
                  <Calendar.YearPickerTriggerHeading />
                  <Calendar.YearPickerTriggerIndicator />
                </Calendar.YearPickerTrigger>
                <Calendar.NavButton slot="previous" />
                <Calendar.NavButton slot="next" />
              </Calendar.Header>
              <Calendar.Grid>
                <Calendar.GridHeader>
                  {(day) => <Calendar.HeaderCell>{day}</Calendar.HeaderCell>}
                </Calendar.GridHeader>
                <Calendar.GridBody>{(date) => <Calendar.Cell date={date} />}</Calendar.GridBody>
              </Calendar.Grid>
              <Calendar.YearPickerGrid>
                <Calendar.YearPickerGridBody>
                  {({ year }) => <Calendar.YearPickerCell year={year} />}
                </Calendar.YearPickerGridBody>
              </Calendar.YearPickerGrid>
            </Calendar>
          </DatePicker.Popover>
        </DatePicker>

        <NumberField
          defaultValue={Number(schedule.expectedAmount)}
          formatOptions={CLP_FORMAT_OPTIONS}
          isRequired
          minValue={0}
          name="expectedAmount"
        >
          <Label>Monto esperado</Label>
          <NumberField.Group className="grid-cols-1">
            <NumberField.Input />
          </NumberField.Group>
          <FieldError />
        </NumberField>

        <TextField defaultValue={schedule.note ?? ""} name="note">
          <Label>Nota</Label>
          <Input placeholder="Opcional: agrega una nota sobre este ajuste" />
          <Description>Opcional: agrega una nota sobre este ajuste</Description>
        </TextField>
      </Form>
    </AppModal>
  );
}
