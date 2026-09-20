import React from "react";
import {
  Dialog as LWDialog,
  DialogContent as LWDialogContent,
  DialogHeader as LWDialogHeader,
  DialogTitle as LWDialogTitle,
  DialogDescription as LWDialogDescription,
  DialogFooter as LWDialogFooter,
} from "@/components/lightswind/dialog";
import { cn } from "@/lib/utils";

export interface DialogProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: "sm" | "md" | "lg" | "xl";
}

const maxWidthMap = {
  sm: "sm:max-w-sm",
  md: "sm:max-w-md",
  lg: "sm:max-w-lg",
  xl: "sm:max-w-xl",
};

/**
 * Dialog modal component powered directly by Lightswind Dialog.
 */
export const Dialog: React.FC<DialogProps> = ({
  isOpen,
  onClose,
  title,
  description,
  children,
  footer,
  maxWidth = "md",
}) => {
  return (
    <LWDialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      {isOpen && (
        <LWDialogContent
          className={cn("p-6 rounded-xl border border-border bg-card shadow-2xl", maxWidthMap[maxWidth])}
        >
          {(title || description) && (
            <LWDialogHeader className="space-y-1 mb-4">
              {title && (
                <LWDialogTitle className="text-lg font-semibold text-foreground tracking-tight">
                  {title}
                </LWDialogTitle>
              )}
              {description && (
                <LWDialogDescription className="text-xs text-muted-foreground">
                  {description}
                </LWDialogDescription>
              )}
            </LWDialogHeader>
          )}

          <div className="py-2">{children}</div>

          {footer && <LWDialogFooter className="mt-6 gap-2">{footer}</LWDialogFooter>}
        </LWDialogContent>
      )}
    </LWDialog>
  );
};

export default Dialog;
