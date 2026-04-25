import { useState, ReactNode } from 'react';

interface VscsStaticButtonProps {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
  disabled?: boolean;
  width?: string;
}

export default function VscsStaticButton({
  children,
  className = '',
  onClick,
  disabled = false,
  width,
}: VscsStaticButtonProps) {
  const [isPressed, setIsPressed] = useState(false);

  const handleMouseDown = () => {
    if (!disabled) {
      setIsPressed(true);
    }
  };

  const handleMouseUp = () => {
    setIsPressed(false);
    if (!disabled && onClick) {
      onClick();
    }
  };

  const handleMouseLeave = () => {
    setIsPressed(false);
  };

  const baseClasses = disabled 
    ? 'vscs-button state-unavailable cursor-not-allowed'
    : `vscs-button state-available ${isPressed ? 'state-touched' : ''}`;

  return (
    <div
      className={`${baseClasses} flex items-center justify-center ${className}`}
      style={width ? { width } : undefined}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
      onTouchStart={handleMouseDown}
      onTouchEnd={handleMouseUp}
    >
      {children}
    </div>
  );
}