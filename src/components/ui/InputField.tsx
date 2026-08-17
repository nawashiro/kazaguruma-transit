"use client";

import React, { useId } from "react";
import { ExclamationTriangleIcon } from "@heroicons/react/24/outline";

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
  endAdornment?: React.ReactNode;
  label?: string;
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
  endAdornment,
  label,
}: InputFieldProps) {
  const uniqueId = useId();
  const inputId = `input-${uniqueId}`;
  const descriptionId = description ? `description-${uniqueId}` : undefined;
  const errorId = error ? `error-${uniqueId}` : undefined;
  const hasError = !!error;

  // アクセシビリティのために必要なaria-describedby属性の値を構築
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
          id={inputId}
          type={type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          disabled={disabled}
          required={required}
          name={name}
          maxLength={maxLength}
          className={`input min-h-[44px] leading-relaxed ${hasError ? "input-error" : ""
            } ${endAdornment ? "join-item flex-1" : "w-full"} ${disabled ? "cursor-not-allowed" : ""
            }`}
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
          className="text-error text-base font-medium leading-relaxed"
          role="alert"
        >
          <ExclamationTriangleIcon className="w-4 h-4 inline mr-1" aria-hidden="true" />
          {error}
        </div>
      )}
    </div>
  );
}
