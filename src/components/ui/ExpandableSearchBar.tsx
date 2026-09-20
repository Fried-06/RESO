import React, { useState, useRef } from "react";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ExpandableSearchBarProps {
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

export const ExpandableSearchBar: React.FC<ExpandableSearchBarProps> = ({
  placeholder = "Rechercher un équipement, IP, type...",
  value,
  onChange,
  className,
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleClear = () => {
    onChange("");
    inputRef.current?.focus();
  };

  return (
    <div
      className={cn(
        "relative flex items-center transition-all duration-300 rounded-lg border bg-background/80 backdrop-blur-xs",
        isFocused
          ? "border-accent ring-2 ring-accent/20 w-64 md:w-80 shadow-sm"
          : "border-border w-48 md:w-64 hover:border-border/80",
        className
      )}
    >
      <div className="pl-3 text-muted-foreground flex items-center pointer-events-none">
        <Search className="h-4 w-4" />
      </div>

      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        placeholder={placeholder}
        className="w-full bg-transparent px-3 py-1.5 text-xs md:text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
      />

      {value && (
        <button
          type="button"
          onClick={handleClear}
          className="pr-2.5 text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
};
