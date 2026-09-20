import React from "react";
import { Button as LightswindButton, type ButtonProps as LWButtonProps } from "@/components/lightswind/button";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "destructive" | "default";
export type ButtonSize = "sm" | "default" | "lg" | "icon" | "md";

export interface ButtonProps extends Omit<LWButtonProps, "variant" | "size"> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
}

/**
 * Button component powered directly by Lightswind.
 * Includes loading state with subtle aeronautic indicator.
 */
export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = "default",
      size = "default",
      isLoading = false,
      disabled,
      children,
      ...props
    },
    ref
  ) => {
    // Map our semantic variant to Lightswind
    const lwVariant = variant === "primary" ? "default" : variant;
    const lwSize = size === "md" ? "default" : size;

    return (
      <LightswindButton
        ref={ref}
        variant={lwVariant}
        size={lwSize}
        disabled={disabled || isLoading}
        className={cn(
          "font-medium transition-all active:scale-[0.98] select-none",
          variant === "primary" && "bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm",
          className
        )}
        {...props}
      >
        {isLoading && <Loader2 className="h-4 w-4 animate-spin shrink-0 mr-2" />}
        {children}
      </LightswindButton>
    );
  }
);

Button.displayName = "Button";
export default Button;
