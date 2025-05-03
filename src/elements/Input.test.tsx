import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { Input } from './Input';
import userEvent from '@testing-library/user-event';

describe('Input', () => {
  afterEach(cleanup);

  it('should render', () => {
    render(<Input placeholder="test" label="test" />);

    expect(screen.getByPlaceholderText('test')).toBeInTheDocument();
    expect(screen.getByLabelText('test')).toBeInTheDocument();
  });

  it('should call onChangeValue once when pasting text', async () => {
    const onChangeValue = vi.fn();
    render(<Input placeholder="test" label="test" onChangeValue={onChangeValue} />);

    const input = screen.getByPlaceholderText('test');

    const user = userEvent.setup();
    await user.click(input);
    await user.paste('test');

    expect(onChangeValue).toHaveBeenCalledWith('test');
  });

  it('should call onChangeValue for each character when typing text', async () => {
    const onChangeValue = vi.fn();
    render(<Input placeholder="test" label="test" onChangeValue={onChangeValue} />);

    const input = screen.getByPlaceholderText('test');

    const user = userEvent.setup();
    await user.click(input);
    await user.type(input, 'test');

    expect(onChangeValue).toHaveBeenCalledTimes(4);
    expect(onChangeValue).toHaveBeenNthCalledWith(1, 't');
    expect(onChangeValue).toHaveBeenNthCalledWith(2, 'te');
    expect(onChangeValue).toHaveBeenNthCalledWith(3, 'tes');
    expect(onChangeValue).toHaveBeenNthCalledWith(4, 'test');
  });

  it('should call the onChange with the event when typing text', async () => {
    const onChange = vi.fn();
    render(<Input placeholder="test" label="test" onChange={onChange} value="" />);

    const input = screen.getByPlaceholderText('test');

    const user = userEvent.setup();
    await user.click(input);
    await user.type(input, 'test');

    expect(onChange).toHaveBeenCalledTimes(4);
    const expectedValues = ['t', 'e', 's', 't'];
    expectedValues.forEach((value, index) => {
      expect(onChange).toHaveBeenNthCalledWith(
        index + 1,
        expect.objectContaining({
          nativeEvent: expect.objectContaining({
            data: value,
          }),
        }),
      );
    });
  });

  it('should call the onSubmit when the user presses enter', async () => {
    const onSubmit = vi.fn();
    render(<Input placeholder="test" label="test" onSubmit={onSubmit} />);

    const input = screen.getByPlaceholderText('test');

    const user = userEvent.setup();
    await user.click(input);
    await user.keyboard('{Enter}');

    expect(onSubmit).toHaveBeenCalled();
  });

  it('should not call the onSubmit when the user presses enter if the input is disabled', async () => {
    const onSubmit = vi.fn();
    render(<Input placeholder="test" label="test" onSubmit={onSubmit} disabled />);

    const input = screen.getByPlaceholderText('test');

    const user = userEvent.setup();
    await user.click(input);
    await user.keyboard('{Enter}');

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('should have a border when "required"', () => {
    render(<Input placeholder="test" label="test" required />);

    const input = screen.getByPlaceholderText('test');

    expect(input).toHaveClass('border-red');
  });
});
