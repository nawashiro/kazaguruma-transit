"use client";

import React, { useId } from "react";
import { TriangleAlert } from "lucide-react";

interface InputFieldProps {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  type?: string;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  error?: string;
  testId?: string;
  description?: string;
  name?: string;
  maxLength?: number;
  label?: string;
  autoComplete?: string;
  onBlur?: React.FocusEventHandler<HTMLInputElement>;
  onKeyDown?: React.KeyboardEventHandler<HTMLInputElement>;
  onCompositionStart?: React.CompositionEventHandler<HTMLInputElement>;
  onCompositionEnd?: React.CompositionEventHandler<HTMLInputElement>;
  controls?: string;
}

export default function InputField({
  value,
  onChange,
  type = "text",
  placeholder = "",
  disabled = false,
  required = false,
  error = "",
  testId,
  description,
  name,
  maxLength,
  label,
  autoComplete = "true",
  onBlur,
  onKeyDown,
  onCompositionStart,
  onCompositionEnd,
  controls,
}: InputFieldProps) {
  const uniqueId = useId();
  const inputId = `input-${uniqueId}`;
  const descriptionId = description ? `description-${uniqueId}` : undefined;
  const errorId = error ? `error-${uniqueId}` : undefined;
  const hasError = !!error;

  const ariaDescribedby =
    [descriptionId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div className="form-control min-w-0 w-full space-y-2 text-base">
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
      <input
        id={inputId}
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        disabled={disabled}
        required={required}
        name={name}
        maxLength={maxLength}
        className={`input min-w-0 w-full text-base min-h-[44px] leading-relaxed ${hasError ? "input-error" : ""} ${disabled ? "cursor-not-allowed" : ""}`}
        aria-invalid={hasError ? "true" : undefined}
        aria-required={required ? "true" : undefined}
        aria-describedby={ariaDescribedby}
        data-testid={testId}
        autoComplete={autoComplete}
        aria-controls={controls}
        onBlur={onBlur}
        onKeyDown={onKeyDown}
        onCompositionStart={onCompositionStart}
        onCompositionEnd={onCompositionEnd}
      />
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
}
