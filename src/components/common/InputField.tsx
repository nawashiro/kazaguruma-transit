"use client";

import React from "react";

interface InputFieldProps {
  label?: string;
  placeholder?: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  disabled?: boolean;
  testId?: string;
  type?: string;
  required?: boolean;
}

export default function InputField({
  label,
  placeholder,
  value,
  onChange,
  disabled = false,
  testId,
  type = "text",
  required = false,
}: InputFieldProps) {
  return (
    <div className="form-control">
      {label && (
        <label className="label">
          <span className="label-text">{label}</span>
        </label>
      )}
      <input
        type={type}
        className="input input-bordered w-full bg-base-100 border border-base-200 rounded-md focus:border-primary focus:ring-1 focus:ring-primary transition-all duration-200"
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        disabled={disabled}
        data-testid={testId}
        required={required}
      />
    </div>
  );
}
