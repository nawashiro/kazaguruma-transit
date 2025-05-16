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
}: InputFieldProps) {
  const uniqueId = useId();
  const inputId = `input-${uniqueId}`;
  const descriptionId = description ? `description-${uniqueId}` : undefined;
  const hasError = !!error;

  return (
    <div className="form-control w-full">
      <label htmlFor={inputId} className="label">
        <span className="label-text font-medium">
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
        className={`input input-bordered w-full min-h-[44px] ${
          hasError ? "input-error" : ""
        }`}
        aria-invalid={hasError}
        aria-required={required ? "true" : undefined}
        aria-describedby={descriptionId}
        data-testid={testId}
      />
      {description && (
        <div id={descriptionId} className="text-sm text-gray-500 mt-1">
          {description}
        </div>
      )}
      {hasError && <div className="text-red-500 text-sm mt-1">{error}</div>}
    </div>
  );
}
