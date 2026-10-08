'use client';

import { forwardRef, InputHTMLAttributes } from 'react';

interface FloatingLabelInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  name: string;
}

export const FloatingLabelInput = forwardRef<HTMLInputElement, FloatingLabelInputProps>(
  ({ label, name, className = '', ...props }, ref) => {
    return (
      <div className={`field-floating ${className}`}>
        <input
          ref={ref}
          id={name}
          name={name}
          placeholder=" "
          className="floating-input"
          {...props}
        />
        <label htmlFor={name} className="floating-label">
          {label}
        </label>
      </div>
    );
  }
);

FloatingLabelInput.displayName = 'FloatingLabelInput';
