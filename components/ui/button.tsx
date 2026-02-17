import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center whitespace-nowrap rounded-lg text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary/90',
        destructive: 'bg-accent text-accent-foreground hover:bg-accent/90',
        outline: 'border border-border bg-card hover:bg-primary-light text-foreground',
        secondary: 'bg-primary-light text-primary hover:bg-primary-light/80',
        ghost: 'hover:bg-primary-light text-foreground',
        link: 'text-primary underline-offset-4 hover:underline',
        success: 'bg-success text-white hover:bg-success/90',
        dashed: 'border-2 border-dashed border-primary bg-primary-light text-primary hover:bg-primary-light/80',
      },
      size: {
        default: 'h-12 px-5 py-3',
        sm: 'h-9 px-3 text-xs',
        lg: 'h-14 px-8 text-base',
        icon: 'h-10 w-10',
        full: 'h-12 w-full px-5 py-3',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';

export { Button, buttonVariants };
