import { useState, useCallback } from "react";
import { z } from "zod";

export interface FormState<T> {
  values: T;
  errors: Partial<Record<keyof T, string>>;
  isSubmitting: boolean;
  isValid: boolean;
  touched: Partial<Record<keyof T, boolean>>;
}

export interface UseFormOptions<T> {
  initialValues: T;
  validationSchema?: z.ZodSchema<T>;
  onSubmit?: (values: T) => Promise<void> | void;
  validateOnChange?: boolean;
  validateOnBlur?: boolean;
}

export function useForm<T extends Record<string, any>>({
  initialValues,
  validationSchema,
  onSubmit,
  validateOnChange = false,
  validateOnBlur = true,
}: UseFormOptions<T>) {
  const [state, setState] = useState<FormState<T>>({
    values: { ...initialValues },
    errors: {},
    isSubmitting: false,
    isValid: true,
    touched: {},
  });

  const validateField = useCallback(
    (name: keyof T, value: any) => {
      if (!validationSchema) return null;

      try {
        validationSchema.parse({ ...state.values, [name]: value });
        return null; // No error
      } catch (error) {
        if (error instanceof z.ZodError) {
          const fieldError = error.issues.find((err) => err.path[0] === name);
          return fieldError?.message || null;
        }
        return "Valor inválido";
      }
    },
    [validationSchema, state.values]
  );

  const validateAllFields = useCallback(() => {
    if (!validationSchema) return {};

    try {
      validationSchema.parse(state.values);
      return {};
    } catch (error) {
      if (error instanceof z.ZodError) {
        return error.issues.reduce((acc: Partial<Record<keyof T, string>>, err: z.ZodIssue) => {
          const field = err.path[0] as keyof T;
          acc[field] = err.message;
          return acc;
        }, {});
      }
      return {};
    }
  }, [validationSchema, state.values]);

  const setValue = useCallback(
    (name: keyof T, value: any) => {
      setState((prev) => {
        const newValues = { ...prev.values, [name]: value };
        const errors = { ...prev.errors };

        if (validateOnChange) {
          const fieldError = validateField(name, value);
          if (fieldError) {
            errors[name] = fieldError;
          } else {
            delete errors[name];
          }
        }

        return {
          ...prev,
          values: newValues,
          errors,
          isValid: Object.keys(errors).length === 0,
        };
      });
    },
    [validateOnChange, validateField]
  );

  const setTouched = useCallback((name: keyof T, isTouched = true) => {
    setState((prev) => ({
      ...prev,
      touched: { ...prev.touched, [name]: isTouched },
    }));
  }, []);

  const handleChange = useCallback(
    (name: keyof T) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      const { value, type } = event.target;
      const finalValue = type === "checkbox" ? (event.target as HTMLInputElement).checked : value;
      setValue(name, finalValue);
    },
    [setValue]
  );

  const handleBlur = useCallback(
    (name: keyof T) => () => {
      setTouched(name, true);

      if (validateOnBlur) {
        const fieldError = validateField(name, state.values[name]);
        setState((prev) => ({
          ...prev,
          errors: fieldError ? { ...prev.errors, [name]: fieldError } : { ...prev.errors, [name]: undefined },
        }));
      }
    },
    [validateOnBlur, validateField, state.values, setTouched]
  );

  const handleSubmit = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault();

      if (!onSubmit) return;

      setState((prev) => ({ ...prev, isSubmitting: true }));

      try {
        const allErrors = validateAllFields();

        if (Object.keys(allErrors).length > 0) {
          setState((prev) => ({
            ...prev,
            errors: allErrors,
            isValid: false,
            isSubmitting: false,
            touched: Object.keys(allErrors).reduce(
              (acc, key) => {
                acc[key as keyof T] = true;
                return acc;
              },
              {} as Partial<Record<keyof T, boolean>>
            ),
          }));
          return;
        }

        await onSubmit(state.values);
      } catch (error) {
        console.error("Form submission error:", error);
      } finally {
        setState((prev) => ({ ...prev, isSubmitting: false }));
      }
    },
    [onSubmit, validateAllFields, state.values]
  );

  const reset = useCallback(() => {
    setState({
      values: { ...initialValues },
      errors: {},
      isSubmitting: false,
      isValid: true,
      touched: {},
    });
  }, [initialValues]);

  const setErrors = useCallback((errors: Partial<Record<keyof T, string>>) => {
    setState((prev) => ({
      ...prev,
      errors,
      isValid: Object.keys(errors).length === 0,
    }));
  }, []);

  const getFieldProps = useCallback(
    (name: keyof T) => {
      const value = state.values[name];
      return {
        name: String(name),
        value: typeof value === "boolean" ? value : (value ?? ""),
        onChange: handleChange(name),
        onBlur: handleBlur(name),
      };
    },
    [state.values, handleChange, handleBlur]
  );

  const getFieldError = useCallback(
    (name: keyof T) => {
      return state.touched[name] ? state.errors[name] : undefined;
    },
    [state.touched, state.errors]
  );

  return {
    ...state,
    setValue,
    setTouched,
    setErrors,
    handleChange,
    handleBlur,
    handleSubmit,
    reset,
    getFieldProps,
    getFieldError,
    validateField,
    validateAllFields,
  };
}
