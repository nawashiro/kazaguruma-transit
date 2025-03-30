"use client";

import React from "react";

interface ButtonProps {
  type?: "button" | "submit" | "reset";
  onClick?: () => void;
  disabled?: boolean;
  loading?: boolean;
  className?: string;
  fullWidth?: boolean;
  testId?: string;
  children: React.ReactNode;
}

export default function Button({
  type = "button",
  onClick,
  disabled = false,
  loading = false,
  className = "",
  fullWidth = false,
  testId,
  children,
}: ButtonProps) {
  const baseClasses =
    "btn bg-gray-200 text-gray-700 hover:bg-gray-300 px-6 py-2 shadow-sm transition-all duration-200";
  const widthClass = fullWidth ? "w-full" : "";

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={`${baseClasses} ${widthClass} ${className}`}
      data-testid={testId}
    >
      {loading ? <span className="loading loading-spinner"></span> : children}
    </button>
  );
}
