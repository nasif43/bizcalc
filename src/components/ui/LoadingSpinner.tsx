import { Loader } from 'lucide-react';
import { cn } from '../../lib/utils';

type LoadingSpinnerProps = {
  size?: number;
  className?: string;
  fullScreen?: boolean;
  message?: string;
};

export function LoadingSpinner({ 
  size = 24, 
  className, 
  fullScreen = false,
  message = 'Loading...'
}: LoadingSpinnerProps) {
  const spinner = (
    <div className={cn(
      "flex items-center justify-center",
      fullScreen ? "fixed inset-0 bg-white bg-opacity-80 z-50" : "",
      className
    )}>
      <div className="flex flex-col items-center">
        <Loader size={size} className="animate-spin text-blue-500" />
        {message && <p className="mt-2 text-gray-600">{message}</p>}
      </div>
    </div>
  );
  
  return spinner;
}