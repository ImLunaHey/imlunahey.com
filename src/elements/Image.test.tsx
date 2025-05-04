import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { Image } from './Image';

describe('Image', () => {
  afterEach(cleanup);

  it('should render', () => {
    render(<Image src="https://via.placeholder.com/150" alt="test" />);

    expect(screen.getByAltText('test')).toBeInTheDocument();
  });
});
