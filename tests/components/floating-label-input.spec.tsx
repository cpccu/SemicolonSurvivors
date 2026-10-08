import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FloatingLabelInput } from '@/components/forms/floating-label-input';

describe('FloatingLabelInput', () => {
  it('should render with floating label', () => {
    render(<FloatingLabelInput label="Email" name="email" />);

    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    expect(document.querySelector('.field-floating')).toBeInTheDocument();
  });

  it('should float label on focus', () => {
    render(<FloatingLabelInput label="Email" name="email" />);

    const input = screen.getByLabelText('Email');
    fireEvent.focus(input);

    const label = document.querySelector('.floating-label');
    expect(label).toBeInTheDocument();
  });
});
// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
