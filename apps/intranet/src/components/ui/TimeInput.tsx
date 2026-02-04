import { DateInputGroup, Label, TimeField } from "@heroui/react";
import { parseTime, type Time } from "@internationalized/date";

interface TimeInputProps {
  className?: string;
  disabled?: boolean;
  onBlur?: () => void;
  onChange: (value: string) => void;
  placeholder?: string;
  value: string;
}

export default function TimeInput({
  className,
  disabled,
  onBlur,
  onChange,
  value,
}: Readonly<TimeInputProps>) {
  let timeValue: Time | null = null;
  try {
    if (value) {
      timeValue = parseTime(value);
    }
  } catch {
    // Ignore invalid time format
    timeValue = null;
  }

  return (
    <TimeField
      aria-label="Hora"
      className={className}
      hourCycle={24}
      isDisabled={disabled}
      onBlur={onBlur}
      onChange={(val) => {
        if (!val) {
          onChange("");
        } else {
          onChange(val.toString());
        }
      }}
      placeholderValue={parseTime("00:00")}
      shouldForceLeadingZeros
      value={timeValue}
    >
      <Label className="hidden">Hora</Label>
      <DateInputGroup>
        <DateInputGroup.Input>
          {(segment) => <DateInputGroup.Segment segment={segment} />}
        </DateInputGroup.Input>
      </DateInputGroup>
    </TimeField>
  );
}
