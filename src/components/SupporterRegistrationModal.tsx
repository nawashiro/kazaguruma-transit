"use client";

import React from "react";
import SupporterRegistration from "./SupporterRegistration";

interface SupporterRegistrationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SupporterRegistrationModal({
  isOpen,
  onClose,
}: SupporterRegistrationModalProps) {
  if (!isOpen) return null;

  return (
    <div className="modal modal-open">
      <div className="modal-box relative max-w-md">
        <button
          onClick={onClose}
          className="btn btn-sm btn-circle absolute right-2 top-2"
        >
          ✕
        </button>
        <SupporterRegistration onComplete={onClose} />
      </div>
    </div>
  );
}
