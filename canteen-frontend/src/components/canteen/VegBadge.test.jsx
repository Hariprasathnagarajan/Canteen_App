import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import VegBadge from './VegBadge';

describe('VegBadge Component', () => {
  it('renders vegetarian indicator correctly by default', () => {
    render(<VegBadge isVeg={true} />);
    const badge = screen.getByLabelText('Vegetarian dish');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveAttribute('title', 'Vegetarian');
  });

  it('renders non-vegetarian indicator when isVeg is false', () => {
    render(<VegBadge isVeg={false} />);
    const badge = screen.getByLabelText('Non-Vegetarian dish');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveAttribute('title', 'Non-Vegetarian');
  });

  it('renders readable text label when showLabel is true', () => {
    render(<VegBadge isVeg={true} showLabel={true} />);
    expect(screen.getByText('Veg')).toBeInTheDocument();

    render(<VegBadge isVeg={false} showLabel={true} />);
    expect(screen.getByText('Non-Veg')).toBeInTheDocument();
  });
});
