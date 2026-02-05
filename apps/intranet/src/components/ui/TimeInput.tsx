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
  const formatTimeValue = (time: Time) => {
    const hours = String(time.hour).padStart(2, "0");
    const minutes = String(time.minute).padStart(2, "0");
    return `${hours}:${minutes}`;
  };

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
      granularity="minute"
      hourCycle={24}
      isDisabled={disabled}
      onBlur={onBlur}
      onChange={(val) => {
        if (!val) {
          onChange("");
        } else {
          onChange(formatTimeValue(val));
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
