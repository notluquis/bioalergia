import {
  Description,
  FieldError,
  Input as HeroInput,
  TextArea as HeroTextArea,
  InputGroup,
  Label,
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
}

type InputProps = InputBaseProps &
  Omit<React.InputHTMLAttributes<HTMLInputElement>, "size"> & {
    enterKeyHint?: "done" | "enter" | "go" | "next" | "previous" | "search" | "send";
    inputMode?: "decimal" | "email" | "none" | "numeric" | "search" | "tel" | "text" | "url";
  };

type SelectProps = InputBaseProps & Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "size">;
type TextareaProps = InputBaseProps & React.TextareaHTMLAttributes<HTMLTextAreaElement>;

type Props =
  | (InputProps & { as?: "input" })
  | (SelectProps & { as: "select" })
  | (TextareaProps & { as: "textarea" });

// Helper: Password toggle
const createPasswordToggle = (isVisible: boolean, onToggle: () => void) => (
  <button
    aria-label="Toggle password visibility"
    className="text-default-400 hover:text-default-600 focus:outline-none flex items-center justify-center p-1"
    onClick={onToggle}
    type="button"
  >
    {isVisible ? <EyeOff size={18} /> : <Eye size={18} />}
  </button>
);

export default function Input(props: Props) {
  const {
    as = "input",
    className,
    containerClassName,
    error,
    helper,
    label,
    size = "md",
    type,
    ...rest
  } = props;

  // -- PASSWORD LOGIC --
  const [isPasswordVisible, setIsPasswordVisible] = React.useState(false);
  const isPassword = type === "password";
  const inputType = isPassword && isPasswordVisible ? "text" : type;
  const toggleVisibility = () => setIsPasswordVisible(!isPasswordVisible);
  const passwordToggle = isPassword
    ? createPasswordToggle(isPasswordVisible, toggleVisibility)
    : null;

  // Resolve start/end content
  const startContent = (props as InputProps).startContent;
  const explicitEndContent = (props as InputProps).endContent;
  const rightElement = (props as InputProps).rightElement;

  // Combine end content (password toggle OR explicit endContent OR rightElement)
  const finalEndContent = passwordToggle ?? explicitEndContent ?? rightElement;
  const hasGroup = !!startContent || !!finalEndContent;

  const commonTextFieldProps = {
    className: containerClassName,
    isInvalid: !!error,
  };

  const labelElement = label ? <Label>{label}</Label> : null;
  const descriptionElement = helper ? <Description>{helper}</Description> : null;
  const errorElement = error ? <FieldError>{error}</FieldError> : null;

  // -- RENDER: TEXTAREA --
  if (as === "textarea") {
    const taProps = rest as React.TextareaHTMLAttributes<HTMLTextAreaElement>;
    return (
      <TextField {...commonTextFieldProps}>
        {labelElement}
        {/* InputGroup for textarea is rare but explicitly supported via InputGroup.TextArea if needed.
            For now assuming standard TextArea. */}
        <HeroTextArea
          className={cn(
            "w-full",
            size === "xs" && "text-xs", // Handle xs sizing manually if needed
            className,
          )}
          placeholder={props.placeholder}
          // HeroUI TextArea supports standard HTML attributes
          {...taProps}
        />
        {descriptionElement}
        {errorElement}
      </TextField>
    );
  }

  // -- RENDER: SELECT --
  if (as === "select") {
    const selProps = rest as React.SelectHTMLAttributes<HTMLSelectElement>;
    // IMPORTANT: using TextField + InputGroup.Input as="select" to simulate native select behavior
    // while maintaining HeroUI composition.
    return (
      <TextField {...commonTextFieldProps}>
        {labelElement}
        <InputGroup>
          <InputGroup.Input
            as="select"
            className={cn(
              "w-full bg-transparent outline-none h-full", // Basic reset
              size === "xs" && "text-xs",
              className,
            )}
            {...(selProps as any)}
          >
            {props.children}
          </InputGroup.Input>
        </InputGroup>
        {descriptionElement}
        {errorElement}
      </TextField>
    );
  }

  // -- RENDER: INPUT (Standard) --
  const inProps = rest as React.InputHTMLAttributes<HTMLInputElement>;

  if (hasGroup) {
    return (
      <TextField {...commonTextFieldProps}>
        {labelElement}
        <InputGroup className={cn("bg-default-100", !!error && "bg-danger-50 border-danger")}>
          {startContent && (
            <InputGroup.Prefix className="text-default-400">{startContent}</InputGroup.Prefix>
          )}
          <InputGroup.Input
            className={cn("h-full", size === "xs" && "text-xs", className)}
            type={inputType}
            placeholder={props.placeholder}
            {...inProps}
          />
          {finalEndContent && (
            <InputGroup.Suffix className="text-default-400">{finalEndContent}</InputGroup.Suffix>
          )}
        </InputGroup>
        {descriptionElement}
        {errorElement}
      </TextField>
    );
  }

  // Simple Input (No Group)
  return (
    <TextField {...commonTextFieldProps}>
      {labelElement}
      <HeroInput
        className={cn("w-full", size === "xs" && "text-xs", className)}
        type={inputType}
        placeholder={props.placeholder}
        {...inProps}
      />
      {descriptionElement}
      {errorElement}
    </TextField>
  );
}
