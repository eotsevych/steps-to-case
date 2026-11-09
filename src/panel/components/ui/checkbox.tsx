import React from 'react';
import { cn } from './utils';

interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
}

export const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, checked, onCheckedChange, onChange, ...props }, ref) => {
    return (
      <input
        ref={ref}
        type="checkbox"
        checked={checked}
        onChange={(e) => {
          onCheckedChange?.(e.target.checked);
          onChange?.(e);
        }}
        className={cn(
          'h-3.5 w-3.5 rounded border border-border text-primary cursor-pointer',
          'focus:ring-1 focus:ring-ring focus:outline-hidden',
          className
        )}
        {...props}
      />
    );
  }
);
Checkbox.displayName = 'Checkbox';
