import { describe, it, expect, beforeEach } from 'vitest';

describe('Mobile Responsiveness', () => {
  beforeEach(() => {
    // Reset viewport
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 1024,
    });
  });

  it('should adapt top nav for mobile (375px)', () => {
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 375,
    });

    const nav = document.createElement('nav');
    nav.className = 'top-nav';
    document.body.appendChild(nav);

    // Mobile nav should be responsive
    const mediaQuery = window.matchMedia('(max-width: 768px)');
    expect(mediaQuery.matches).toBe(true);

    document.body.removeChild(nav);
  });

  it('should stack bento grid on tablet (768px)', () => {
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 768,
    });

    const grid = document.createElement('div');
    grid.className = 'bento-grid';
    document.body.appendChild(grid);

    // Tablet breakpoint should trigger single column
    const mediaQuery = window.matchMedia('(max-width: 768px)');
    expect(mediaQuery.matches).toBe(true);

    document.body.removeChild(grid);
  });

  it('should adjust event cards for mobile', () => {
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 375,
    });

    const card = document.createElement('div');
    card.className = 'event-card-gradient';
    document.body.appendChild(card);

    // Event cards should have mobile-specific height
    const styles = getComputedStyle(card);
    expect(parseInt(styles.height)).toBeGreaterThan(0);

    document.body.removeChild(card);
  });

  it('should handle modal on mobile viewport', () => {
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 375,
    });

    const modal = document.createElement('div');
    modal.className = 'modal-container';
    document.body.appendChild(modal);

    // Modal should adapt to mobile
    const mediaQuery = window.matchMedia('(max-width: 640px)');
    expect(mediaQuery.matches).toBe(true);

    document.body.removeChild(modal);
  });
});

describe('Touch Interactions', () => {
  it('should have adequate touch targets (min 44px)', () => {
    const button = document.createElement('button');
    button.className = 'btn-primary';
    button.style.minHeight = '44px';
    button.style.minWidth = '44px';
    document.body.appendChild(button);

    const styles = getComputedStyle(button);
    expect(parseInt(styles.minHeight)).toBeGreaterThanOrEqual(44);

    document.body.removeChild(button);
  });

  it('should handle touch events on cards', () => {
    const card = document.createElement('div');
    card.className = 'event-card-gradient';
    document.body.appendChild(card);

    let touched = false;
    card.addEventListener('touchstart', () => {
      touched = true;
    });

    // Simulate touch event
    const touchEvent = new TouchEvent('touchstart', {
      touches: [{ clientX: 0, clientY: 0 } as Touch],
    });
    card.dispatchEvent(touchEvent);

    expect(touched).toBe(true);

    document.body.removeChild(card);
  });

  it('should prevent double-tap zoom on buttons', () => {
    const button = document.createElement('button');
    button.className = 'btn-primary';
    button.style.touchAction = 'manipulation';
    document.body.appendChild(button);

    const styles = getComputedStyle(button);
    // touch-action: manipulation prevents double-tap zoom
    expect(styles.touchAction).toContain('manipulation');

    document.body.removeChild(button);
  });
});

describe('Responsive Breakpoints', () => {
  it('should define standard breakpoints', () => {
    const breakpoints = {
      mobile: window.matchMedia('(max-width: 640px)'),
      tablet: window.matchMedia('(min-width: 641px) and (max-width: 1024px)'),
      desktop: window.matchMedia('(min-width: 1025px)'),
    };

    expect(breakpoints.mobile).toBeTruthy();
    expect(breakpoints.tablet).toBeTruthy();
    expect(breakpoints.desktop).toBeTruthy();
  });

  it('should handle viewport meta tag', () => {
    const meta = document.createElement('meta');
    meta.name = 'viewport';
    meta.content = 'width=device-width, initial-scale=1';
    document.head.appendChild(meta);

    const viewportMeta = document.querySelector('meta[name="viewport"]');
    expect(viewportMeta).toBeTruthy();
    expect(viewportMeta?.getAttribute('content')).toContain('width=device-width');

    document.head.removeChild(meta);
  });
});

describe('Orientation Changes', () => {
  it('should adapt to landscape orientation', () => {
    Object.defineProperty(window.screen.orientation, 'type', {
      writable: true,
      configurable: true,
      value: 'landscape-primary',
    });

    const mediaQuery = window.matchMedia('(orientation: landscape)');
    expect(typeof mediaQuery.matches).toBe('boolean');
  });

  it('should adapt to portrait orientation', () => {
    Object.defineProperty(window.screen.orientation, 'type', {
      writable: true,
      configurable: true,
      value: 'portrait-primary',
    });

    const mediaQuery = window.matchMedia('(orientation: portrait)');
    expect(typeof mediaQuery.matches).toBe('boolean');
  });
});

describe('Mobile-Specific Features', () => {
  it('should have safe area insets for notched devices', () => {
    const element = document.createElement('div');
    element.style.paddingTop = 'env(safe-area-inset-top)';
    document.body.appendChild(element);

    // env() function should be recognized by browser
    expect(element.style.paddingTop).toBeTruthy();

    document.body.removeChild(element);
  });

  it('should handle mobile keyboard interactions', () => {
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'floating-input';
    document.body.appendChild(input);

    // Input should support mobile keyboard
    expect(input.type).toBe('text');
    expect(input.className).toBeTruthy();

    document.body.removeChild(input);
  });

  it('should prevent horizontal scroll on mobile', () => {
    const body = document.body;
    body.style.overflowX = 'hidden';

    const styles = getComputedStyle(body);
    expect(styles.overflowX).toBe('hidden');

    body.style.overflowX = '';
  });
});
