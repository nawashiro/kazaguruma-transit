"use client";

import React, { InputHTMLAttributes, useId } from "react";

interface InputFieldProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "id"> {
  label: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  error?: string;
  testId?: string;
  description?: string;
  required?: boolean;
}

const InputField: React.FC<InputFieldProps> = ({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  error,
  testId,
  description,
  required = false,
  disabled = false,
  ...rest
}) => {
  // 一意のIDを生成
  const uniqueId = useId();
  const inputId = `input-${uniqueId}`;
  const labelId = `label-${uniqueId}`;
  const errorId = `error-${uniqueId}`;
  const descriptionId = `description-${uniqueId}`;

  // aria-describedbyに設定するID一覧
  const descriptionIds: string[] = [];
  if (description) descriptionIds.push(descriptionId);
  if (error) descriptionIds.push(errorId);

  // 各種aria属性を設定
  const ariaAttributes = {
    "aria-labelledby": labelId,
    "aria-describedby":
      descriptionIds.length > 0 ? descriptionIds.join(" ") : undefined,
    "aria-required": required ? ("true" as const) : undefined,
    "aria-invalid": error ? ("true" as const) : undefined,
  };

  return (
    <div className="form-control">
      <label htmlFor={inputId} className="label" id={labelId}>
        <span className="label-text">
          {label}
          {required && (
            <span className="text-error ml-1" aria-hidden="true">
              *
            </span>
          )}
        </span>
      </label>
      {description && (
        <div id={descriptionId} className="text-sm text-gray-500 mb-1">
          {description}
        </div>
      )}
      <input
        id={inputId}
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className={`input input-bordered w-full ${error ? "input-error" : ""}`}
        data-testid={testId}
        disabled={disabled}
        required={required}
        {...ariaAttributes}
        {...rest}
      />
      {error && (
        <div id={errorId} className="text-error text-sm mt-1">
          {error}
        </div>
      )}
    </div>
  );
};

export default InputField;
