"use client";

import React, { forwardRef, useId } from "react";
import { TriangleAlert } from "lucide-react";

export interface InputFieldProps {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onKeyDown?: React.KeyboardEventHandler<HTMLInputElement>;
  type?: string;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  error?: string;
  testId?: string;
  description?: string;
  name?: string;
  maxLength?: number;
  endAdornment?: React.ReactNode;
  label?: string;
}

const InputField = forwardRef<HTMLInputElement, InputFieldProps>(function InputField(
  {
    value,
    onChange,
    onKeyDown,
    type = "text",
    placeholder = "",
    disabled = false,
    required = false,
    error = "",
    testId,
    description,
    name,
    maxLength,
    endAdornment,
    label,
  },
  ref,
) {
  const uniqueId = useId();
  const inputId = `input-${uniqueId}`;
  const descriptionId = description ? `description-${uniqueId}` : undefined;
  const errorId = error ? `error-${uniqueId}` : undefined;
  const hasError = !!error;

  const ariaDescribedby =
    [descriptionId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div className="form-control w-full space-y-2">
      {label && (
        <label htmlFor={inputId} className="sr-only">
          {label}
        </label>
      )}
      {description && (
        <p
          id={descriptionId}
          className="text-base leading-relaxed ruby-text"
        >
          {description}
        </p>
      )}
      <div className={endAdornment ? "join w-full" : ""}>
        <input
          ref={ref}
          id={inputId}
          type={type}
          value={value}
          onChange={onChange}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          required={required}
          name={name}
          maxLength={maxLength}
          className={`input min-h-[44px] leading-relaxed ${hasError ? "input-error" : ""} ${endAdornment ? "join-item flex-1" : "w-full"} ${disabled ? "cursor-not-allowed" : ""}`}
          aria-invalid={hasError ? "true" : undefined}
          aria-required={required ? "true" : undefined}
          aria-describedby={ariaDescribedby}
          data-testid={testId}
          autoComplete="true"
        />
        {endAdornment}
      </div>
      {hasError && (
        <div
          id={errorId}
          className="text-base-content text-base font-medium leading-relaxed"
          role="alert"
        >
          <TriangleAlert className="w-4 h-4 inline mr-1" aria-hidden="true" />
          {error}
        </div>
      )}
    </div>
  );
});

InputField.displayName = "InputField";

export default InputField;
