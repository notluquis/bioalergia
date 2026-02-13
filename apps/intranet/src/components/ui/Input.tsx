import {
  Button,
  Description,
  FieldError,
  Input as HeroInput,
  TextArea as HeroTextArea,
  InputGroup,
  Label,
  SurfaceContext,
  TextField,
} from "@heroui/react";
import { Eye, EyeOff } from "lucide-react";
import React from "react";

import { cn } from "@/lib/utils";

interface InputBaseProps {
  containerClassName?: string;
  error?: string;
  helper?: string;
  label?: string;
  placeholder?: string;
  rightElement?: React.ReactNode;
  size?: "xs" | "sm" | "md" | "lg";
  startContent?: React.ReactNode;
  endContent?: React.ReactNode;
  type?: string;
  variant?: "primary" | "secondary";
}

type InputProps = InputBaseProps &
  Omit<React.InputHTMLAttributes<HTMLInputElement>, "size"> & {
    enterKeyHint?: "done" | "enter" | "go" | "next" | "previous" | "search" | "send";
    inputMode?: "decimal" | "email" | "none" | "numeric" | "search" | "tel" | "text" | "url";
  };
type TextareaProps = InputBaseProps & React.TextareaHTMLAttributes<HTMLTextAreaElement>;

type Props = (InputProps & { as?: "input" }) | (TextareaProps & { as: "textarea" });

// Helper: Password toggle
const createPasswordToggle = (isVisible: boolean, onToggle: () => void) => (
  <Button
    aria-label="Toggle password visibility"
    isIconOnly
    size="sm"
    variant="ghost"
    className="text-default-400 hover:text-default-600"
    onPress={onToggle}
  >
    {isVisible ? <EyeOff size={18} /> : <Eye size={18} />}
  </Button>
);

const getInputExtras = (props: Props) => {
  const startContent = (props as InputProps).startContent;
  const explicitEndContent = (props as InputProps).endContent;
  const rightElement = (props as InputProps).rightElement;

  return {
    startContent,
    explicitEndContent,
    rightElement,
  };
};

const usePasswordToggle = (type?: string) => {
  const [isPasswordVisible, setIsPasswordVisible] = React.useState(false);
  const isPassword = type === "password";
  const inputType = isPassword && isPasswordVisible ? "text" : type;
  const toggleVisibility = () => setIsPasswordVisible((prev) => !prev);
  const passwordToggle = isPassword
    ? createPasswordToggle(isPasswordVisible, toggleVisibility)
    : null;

  return { inputType, passwordToggle };
};

const renderTextArea = (
  props: React.TextareaHTMLAttributes<HTMLTextAreaElement>,
  options: {
    className?: string;
    size: "xs" | "sm" | "md" | "lg";
    labelElement: React.ReactNode;
    descriptionElement: React.ReactNode;
    errorElement: React.ReactNode;
    commonTextFieldProps: { className?: string; isInvalid: boolean };
    variant: "primary" | "secondary";
  },
) => (
  <TextField {...options.commonTextFieldProps}>
    {options.labelElement}
    <HeroTextArea
      className={cn("w-full", options.size === "xs" && "text-xs", options.className)}
      placeholder={props.placeholder}
      variant={options.variant}
      {...props}
    />

    {options.descriptionElement}
    {options.errorElement}
  </TextField>
);

const renderGroupedInput = (
  props: React.InputHTMLAttributes<HTMLInputElement>,
  options: {
    className?: string;
    size: "xs" | "sm" | "md" | "lg";
    labelElement: React.ReactNode;
    descriptionElement: React.ReactNode;
    errorElement: React.ReactNode;
    commonTextFieldProps: { className?: string; isInvalid: boolean };
    inputType?: string;
    startContent?: React.ReactNode;
    endContent?: React.ReactNode;
    placeholder?: string;
    hasError: boolean;
    variant: "primary" | "secondary";
  },
) => (
  <TextField {...options.commonTextFieldProps}>
    {options.labelElement}
    <InputGroup className={cn("bg-default-100", options.hasError && "border-danger bg-danger-50")}>
      {options.startContent && (
        <InputGroup.Prefix className="text-default-400">{options.startContent}</InputGroup.Prefix>
      )}
      <InputGroup.Input
        className={cn("h-full", options.size === "xs" && "text-xs", options.className)}
        type={options.inputType}
        placeholder={options.placeholder}
        {...props}
      />

      {options.endContent && (
        <InputGroup.Suffix className="text-default-400">{options.endContent}</InputGroup.Suffix>
      )}
    </InputGroup>
    {options.descriptionElement}
    {options.errorElement}
  </TextField>
);

const renderSimpleInput = (
  props: React.InputHTMLAttributes<HTMLInputElement>,
  options: {
    className?: string;
    size: "xs" | "sm" | "md" | "lg";
    labelElement: React.ReactNode;
    descriptionElement: React.ReactNode;
    errorElement: React.ReactNode;
    commonTextFieldProps: { className?: string; isInvalid: boolean };
    inputType?: string;
    placeholder?: string;
    variant: "primary" | "secondary";
  },
) => (
  <TextField {...options.commonTextFieldProps}>
    {options.labelElement}
    <HeroInput
      className={cn("w-full", options.size === "xs" && "text-xs", options.className)}
      type={options.inputType}
      placeholder={options.placeholder}
      variant={options.variant}
      {...props}
    />

    {options.descriptionElement}
    {options.errorElement}
  </TextField>
);
export function Input(props: Props) {
  const surface = React.useContext(SurfaceContext);
  const {
    as = "input",
    className,
    containerClassName,
    error,
    helper,
    label,
    size = "md",
    type,
    variant,
    ...rest
  } = props;

  const { inputType, passwordToggle } = usePasswordToggle(type);

  const { explicitEndContent, rightElement, startContent } = getInputExtras(props);

  const finalEndContent = passwordToggle ?? explicitEndContent ?? rightElement;
  const hasGroup = Boolean(startContent) || Boolean(finalEndContent);
  const resolvedVariant = variant ?? (surface?.variant ? "secondary" : "primary");

  const commonTextFieldProps = {
    className: containerClassName,
    isInvalid: Boolean(error),
  };

  const labelElement = label ? <Label>{label}</Label> : null;
  const descriptionElement = helper ? <Description>{helper}</Description> : null;
  const errorElement = error ? <FieldError>{error}</FieldError> : null;

  if (as === "textarea") {
    return renderTextArea(rest as React.TextareaHTMLAttributes<HTMLTextAreaElement>, {
      className,
      commonTextFieldProps,
      descriptionElement,
      errorElement,
      labelElement,
      size,
      variant: resolvedVariant,
    });
  }

  if (hasGroup) {
    return renderGroupedInput(rest as React.InputHTMLAttributes<HTMLInputElement>, {
      className,
      commonTextFieldProps,
      descriptionElement,
      endContent: finalEndContent,
      errorElement,
      hasError: Boolean(error),
      inputType,
      labelElement,
      placeholder: props.placeholder,
      size,
      startContent,
      variant: resolvedVariant,
    });
  }

  return renderSimpleInput(rest as React.InputHTMLAttributes<HTMLInputElement>, {
    className,
    commonTextFieldProps,
    descriptionElement,
    errorElement,
    inputType,
    labelElement,
    placeholder: props.placeholder,
    size,
    variant: resolvedVariant,
  });
}
