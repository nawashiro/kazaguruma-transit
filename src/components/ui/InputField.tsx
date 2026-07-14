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
      {description && (
        <div
          id={descriptionId}
          className="text-sm opacity-70 leading-relaxed ruby-text"
        >
          {description}
        </div>
      )}
      <div className={endAdornment ? "join w-full" : undefined}>
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
            } ${endAdornment ? "join-item flex-1" : "w-full"} ${disabled ? "opacity-70 cursor-not-allowed" : ""
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
          className="text-error text-sm font-medium leading-relaxed"
          role="alert"
        >
          <ExclamationTriangleIcon className="w-4 h-4 inline mr-1" aria-hidden="true" />
          {error}
        </div>
      )}
    </div>
  );
}
