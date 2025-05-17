"use client";

import React, { useId } from "react";

interface InputFieldProps {
  label: string;
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
}

export default function InputField({
  label,
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
    <div className="form-control w-full">
      <label htmlFor={inputId} className="label">
        <span className="label-text font-medium text-foreground">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </span>
      </label>
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
        className={`input input-bordered w-full min-h-[44px] text-base leading-relaxed ${
          hasError
            ? "input-error border-2 border-error"
            : "border border-gray-300 hover:border-gray-400"
        } ${disabled ? "opacity-70 cursor-not-allowed" : ""}`}
        aria-invalid={hasError ? "true" : undefined}
        aria-required={required ? "true" : undefined}
        aria-describedby={ariaDescribedby}
        data-testid={testId}
      />
      {description && (
        <div
          id={descriptionId}
          className="text-sm text-gray-600 mt-1 leading-relaxed"
        >
          {description}
        </div>
      )}
      {hasError && (
        <div
          id={errorId}
          className="text-error text-sm mt-1 font-medium leading-relaxed"
          role="alert"
        >
          <span className="mr-1" aria-hidden="true">
            ⚠️
          </span>
          {error}
        </div>
      )}
    </div>
  );
}
