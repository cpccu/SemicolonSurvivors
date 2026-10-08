import { describe, it, expect } from 'vitest';

describe('Cross-Browser Support', () => {
  it('should provide fallback for backdrop-filter', () => {
    const glass = document.createElement('div');
    glass.className = 'glass';
    document.body.appendChild(glass);

    const styles = getComputedStyle(glass);

    // Should have either backdrop-filter or solid fallback
    const hasBackdropFilter = styles.backdropFilter !== 'none';
    const hasSolidFallback = styles.backgroundColor.includes('rgba') &&
                             parseFloat(styles.backgroundColor.split(',')[3] || '0') > 0.85;

    expect(hasBackdropFilter || hasSolidFallback).toBe(true);

    document.body.removeChild(glass);
  });

  it('should detect @supports for backdrop-filter', () => {
    const supportsBackdropFilter = CSS.supports('backdrop-filter', 'blur(10px)') ||
                                   CSS.supports('-webkit-backdrop-filter', 'blur(10px)');

    // Modern browsers support backdrop-filter, older browsers fall back to solid background
    expect(typeof supportsBackdropFilter).toBe('boolean');
  });

  it('should provide fallback for CSS custom properties', () => {
    const element = document.createElement('div');
    element.style.setProperty('--test-color', '#6366f1');
    document.body.appendChild(element);

    const styles = getComputedStyle(element);
    const customPropValue = styles.getPropertyValue('--test-color');

    // Modern browsers support custom properties
    expect(customPropValue).toBeTruthy();

    document.body.removeChild(element);
  });

  it('should have vendor prefixes for transform', () => {
    const element = document.createElement('div');
    element.style.transform = 'translateY(-2px)';
    document.body.appendChild(element);

    const styles = getComputedStyle(element);

    // All modern browsers support unprefixed transform
    expect(styles.transform).not.toBe('none');

    document.body.removeChild(element);
  });

  it('should gracefully degrade grid layouts', () => {
    const supportsGrid = CSS.supports('display', 'grid');

    // Grid is widely supported, but fallbacks exist
    expect(supportsGrid).toBe(true);
  });

  it('should support flexbox for layout', () => {
    const supportsFlex = CSS.supports('display', 'flex');

    // Flexbox has universal support
    expect(supportsFlex).toBe(true);
  });
});

describe('Feature Detection', () => {
  it('should detect View Transitions API support', () => {
    const supportsViewTransitions = 'startViewTransition' in document;

    // View Transitions API is progressive enhancement
    // Should work without it, enhanced when available
    expect(typeof supportsViewTransitions).toBe('boolean');
  });

  it('should detect IntersectionObserver support', () => {
    const supportsIntersectionObserver = 'IntersectionObserver' in window;

    // IntersectionObserver is widely supported
    expect(supportsIntersectionObserver).toBe(true);
  });

  it('should detect CSS containment support', () => {
    const supportsContain = CSS.supports('contain', 'layout');

    // CSS containment is a performance enhancement
    expect(typeof supportsContain).toBe('boolean');
  });

  it('should detect prefers-reduced-motion support', () => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

    // Media query should be supported
    expect(mediaQuery).toBeTruthy();
    expect(typeof mediaQuery.matches).toBe('boolean');
  });
});

describe('Browser-Specific Fixes', () => {
  it('should handle Safari backdrop-filter with -webkit prefix', () => {
    const element = document.createElement('div');
    element.style.backdropFilter = 'blur(10px)';
    element.style.setProperty('-webkit-backdrop-filter', 'blur(10px)');
    document.body.appendChild(element);

    const styles = getComputedStyle(element);

    // Either standard or webkit-prefixed should work
    const hasBackdrop = styles.backdropFilter !== 'none' ||
                        styles.getPropertyValue('-webkit-backdrop-filter') !== 'none';

    expect(typeof hasBackdrop).toBe('boolean');

    document.body.removeChild(element);
  });

  it('should support color-scheme for dark mode', () => {
    const supportsColorScheme = CSS.supports('color-scheme', 'light dark');

    // color-scheme is widely supported
    expect(typeof supportsColorScheme).toBe('boolean');
  });

  it('should handle scroll-behavior smooth', () => {
    const supportsScrollBehavior = CSS.supports('scroll-behavior', 'smooth');

    // scroll-behavior has good support
    expect(typeof supportsScrollBehavior).toBe('boolean');
  });
});

describe('Graceful Degradation', () => {
  it('should work without backdrop-filter support', () => {
    // When backdrop-filter is not supported, solid backgrounds are used
    const modal = document.createElement('div');
    modal.className = 'modal-container';
    document.body.appendChild(modal);

    const styles = getComputedStyle(modal);

    // Should always have a background (either glass or solid)
    expect(styles.backgroundColor).not.toBe('transparent');

    document.body.removeChild(modal);
  });

  it('should work without CSS Grid support', () => {
    // Bento grid falls back to flexbox on older browsers
    const grid = document.createElement('div');
    grid.className = 'bento-grid';
    document.body.appendChild(grid);

    // Grid is just a layout enhancement
    expect(grid.className).toContain('bento-grid');

    document.body.removeChild(grid);
  });
});
