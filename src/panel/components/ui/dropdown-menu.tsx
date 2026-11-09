import React, { createContext, useContext, useRef, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { cn } from './utils';

interface DropdownContextType {
  open: boolean;
  setOpen: (v: boolean) => void;
  position: { top: number; right: number; left: number };
}

const DropdownContext = createContext<DropdownContextType | null>(null);

interface DropdownMenuProps {
  children: React.ReactNode;
}

export function DropdownMenu({ children }: DropdownMenuProps) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, right: 0, left: 0 });
  const triggerRef = useRef<HTMLDivElement>(null);

  const setOpenWithPosition = (v: boolean) => {
    if (v && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setPosition({
        top: rect.bottom + 4,
        right: window.innerWidth - rect.right,
        left: rect.left,
      });
    }
    setOpen(v);
  };

  return (
    <DropdownContext.Provider value={{ open, setOpen: setOpenWithPosition, position }}>
      <div className="relative" ref={triggerRef}>{children}</div>
    </DropdownContext.Provider>
  );
}

interface DropdownMenuTriggerProps {
  children: React.ReactNode;
  asChild?: boolean;
}

export function DropdownMenuTrigger({ children }: DropdownMenuTriggerProps) {
  const ctx = useContext(DropdownContext);
  if (!ctx) return null;
  return React.cloneElement(children as React.ReactElement, {
    onClick: (e: React.MouseEvent) => {
      e.stopPropagation();
      ctx.setOpen(!ctx.open);
    },
  });
}

interface DropdownMenuContentProps extends React.HTMLAttributes<HTMLDivElement> {
  align?: 'start' | 'end';
}

export function DropdownMenuContent({ className, align = 'start', children, ...props }: DropdownMenuContentProps) {
  const ctx = useContext(DropdownContext);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ctx?.open) return;
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        ctx.setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [ctx?.open]);

  if (!ctx?.open) return null;

  const style: React.CSSProperties = {
    position: 'fixed',
    top: ctx.position.top,
    ...(align === 'end'
      ? { right: ctx.position.right }
      : { left: ctx.position.left }),
  };

  return createPortal(
    <div
      ref={ref}
      style={style}
      className={cn(
        'z-[9999] min-w-36 rounded-md border border-border bg-popover shadow-md py-1',
        className
      )}
      {...props}
    >
      {children}
    </div>,
    document.body
  );
}

interface DropdownMenuItemProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  destructive?: boolean;
}

export function DropdownMenuItem({ className, destructive, onClick, children, ...props }: DropdownMenuItemProps) {
  const ctx = useContext(DropdownContext);
  return (
    <button
      className={cn(
        'flex w-full items-center gap-2 px-3 py-1.5 text-xs',
        'hover:bg-accent transition-colors text-left',
        destructive ? 'text-destructive' : 'text-foreground',
        className
      )}
      onClick={(e) => {
        ctx?.setOpen(false);
        onClick?.(e);
      }}
      {...props}
    >
      {children}
    </button>
  );
}

export function DropdownMenuSeparator() {
  return <div className="my-1 h-px bg-border" />;
}
