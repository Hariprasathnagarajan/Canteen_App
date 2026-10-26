import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import TokenPill from './TokenPill';

describe('TokenPill Component', () => {
  it('renders token value and accessibility label', () => {
    render(<TokenPill value={75} />);
    const pill = screen.getByLabelText('75 tokens available');
    expect(pill).toBeInTheDocument();
    expect(screen.getByText('75 tokens')).toBeInTheDocument();
  });

  it.each([
    ['light', 'bg-cobalt-50'],
    ['dark', 'bg-slate-900'],
    ['ink', 'bg-slate-950'],
  ])('applies appropriate class styling for "%s" tone', (tone, expectedClass) => {
    render(<TokenPill value={50} tone={tone} />);
    const pill = screen.getByLabelText('50 tokens available');
    expect(pill.className).toContain(expectedClass);
  });
});
