import React, { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Accordion as LWAccordion,
  AccordionItem as LWAccordionItem,
  AccordionTrigger as LWAccordionTrigger,
  AccordionContent as LWAccordionContent,
} from "@/components/lightswind/accordion";

export interface AccordionItemProps {
  title: string;
  subtitle?: string;
  badge?: React.ReactNode;
  icon?: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
  className?: string;
}

/**
 * Diagnostic AccordionItem component providing expandable L3/L7 layer details.
 */
export const AccordionItem: React.FC<AccordionItemProps> = ({
  title,
  subtitle,
  badge,
  icon,
  defaultOpen = false,
  children,
  className,
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div
      className={cn(
        "rounded-xl border border-border/80 bg-card/70 overflow-hidden transition-all duration-200",
        className
      )}
    >
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-4 text-left hover:bg-muted/30 transition-colors select-none"
      >
        <div className="flex items-center gap-3 min-w-0">
          {icon && <div className="shrink-0">{icon}</div>}
          <div className="min-w-0">
            <div className="text-xs md:text-sm font-semibold text-foreground tracking-tight truncate">
              {title}
            </div>
            {subtitle && (
              <div className="text-[11px] font-mono text-muted-foreground truncate">
                {subtitle}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0 ml-3">
          {badge}
          <ChevronDown
            className={cn(
              "h-4 w-4 text-muted-foreground transition-transform duration-200",
              isOpen && "rotate-180"
            )}
          />
        </div>
      </button>

      {isOpen && (
        <div className="px-4 pb-4 pt-1 border-t border-border/50 bg-background/40">
          {children}
        </div>
      )}
    </div>
  );
};

export {
  LWAccordion as Accordion,
  LWAccordionItem as LightswindAccordionItem,
  LWAccordionTrigger as AccordionTrigger,
  LWAccordionContent as AccordionContent,
};

export default AccordionItem;
