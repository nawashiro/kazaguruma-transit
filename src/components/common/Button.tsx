"use client";

import React from "react";

interface ButtonProps {
  type?: "button" | "submit" | "reset";
  onClick?: () => void;
  disabled?: boolean;
  loading?: boolean;
  className?: string;
  fullWidth?: boolean;
  secondary?: boolean;
  testId?: string;
  "aria-label"?: string;
  children: React.ReactNode;
}

export default function Button({
  type = "button",
  onClick,
  disabled = false,
  loading = false,
  className = "",
  fullWidth = false,
  secondary = false,
  testId,
  "aria-label": ariaLabel,
  children,
}: ButtonProps) {
  const baseClasses = secondary
    ? "btn bg-white text-gray-700 hover:bg-gray-100 border border-gray-200 px-6 py-2 rounded-lg shadow-sm transition-all duration-200"
    : "btn bg-gradient-to-r from-blue-500 to-indigo-500 text-white hover:from-blue-600 hover:to-indigo-600 px-6 py-2 rounded-lg shadow-md transition-all duration-200";
  const widthClass = fullWidth ? "w-full" : "";
  const disabledClass =
    disabled || loading ? "opacity-70 cursor-not-allowed" : "";
  const accessibilityClass = "min-h-[44px] min-w-[44px]";

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={`${baseClasses} ${widthClass} ${disabledClass} ${accessibilityClass} ${className}`}
      data-testid={testId}
      aria-label={ariaLabel}
    >
      {loading ? <span className="loading loading-spinner"></span> : children}
    </button>
  );
}
