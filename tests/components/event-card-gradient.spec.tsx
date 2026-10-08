import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EventCard } from '@/modules/events/components/event-card';
import type { CampusEvent } from '@/modules/campus/data/fixtures';

describe('EventCard Gradient Redesign', () => {
  const mockEvent: CampusEvent = {
    id: '1',
    title: 'Building Campus Apps',
    category: 'Technology',
    time: '2:00 PM - 4:00 PM',
    day: '15', month: 'MAR', venue: 'Tech Hub', host: 'Synthetic host',
    description: 'Synthetic event details', agenda: ['14:00 · Demo session'],
    artwork: 'build',
  };

  it('should render full-bleed gradient background', () => {
    render(<EventCard event={mockEvent} />);

    const gradientBg = document.querySelector('.event-gradient-bg');
    expect(gradientBg).toBeInTheDocument();
    expect(gradientBg).toHaveClass('event-gradient-bg', 'workshop');
  });

  it('should render floating date badge', () => {
    render(<EventCard event={mockEvent} />);

    const badge = document.querySelector('.event-badge-date');
    expect(badge).toBeInTheDocument();
    expect(screen.getByText('15')).toBeInTheDocument();
    expect(screen.getByText('MAR')).toBeInTheDocument();
  });

  it('should render glassmorphism CTA button', () => {
    render(<EventCard event={mockEvent} />);

    const cta = screen.getByText(/view details/i);
    expect(cta).toHaveClass('event-cta', 'glass');
  });
});
// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
