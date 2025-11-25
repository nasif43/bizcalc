import { ReactNode } from 'react';
import { cn } from '../../lib/utils';

type LinkProps = {
  href: string;
  children: ReactNode;
  className?: string;
  onClick?: (e: React.MouseEvent<HTMLAnchorElement>) => void;
};

export function Link({ href, children, className, onClick }: LinkProps) {
  return (
    <a 
      href={href} 
      className={cn("text-blue-600 hover:text-blue-800 hover:underline", className)}
      onClick={(e) => {
        // Prevent default navigation for hash links or if onClick is provided
        if (href === '#' || onClick) {
          e.preventDefault();
          onClick?.(e);
        }
      }}
    >
      {children}
    </a>
  );
}