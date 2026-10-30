"use client";

import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import type { DynamicToolUIPart, ToolUIPart } from "ai";
import {
  CheckCircle2,
  ChevronDown,
  Circle,
  Clock,
  Cpu,
  XCircle,
} from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import { isValidElement } from "react";

import { CodeBlock } from "./code-block";

export type ToolProps = ComponentProps<typeof Collapsible> & {
  state?: ToolPart["state"];
};

export const Tool = ({ className, state, ...props }: ToolProps) => {
  const isRunning = state === "input-available" || state === "input-streaming" || state === "approval-requested";

  return (
    <Collapsible
      className={cn(
        "group not-prose my-1.5 w-full max-w-2xl rounded-lg border border-border/70 bg-card/70 hover:bg-card/90 transition-all duration-150 overflow-hidden text-xs shadow-2xs",
        isRunning && "border-cyan-500/40 bg-cyan-500/5 ring-1 ring-cyan-500/20",
        className
      )}
      {...props}
    />
  );
};

export type ToolPart = ToolUIPart | DynamicToolUIPart;

export type ToolHeaderProps = {
  title?: string;
  className?: string;
  icon?: React.ComponentType<{ className?: string; strokeWidth?: number | string }>;
} & (
  | { type: ToolUIPart["type"]; state: ToolUIPart["state"]; toolName?: never }
  | {
      type: DynamicToolUIPart["type"];
      state: DynamicToolUIPart["state"];
      toolName: string;
    }
);

const statusLabels: Record<ToolPart["state"], string> = {
  "approval-requested": "Action Required",
  "approval-responded": "Approved",
  "input-available": "Running",
  "input-streaming": "Executing",
  "output-available": "Completed",
  "output-denied": "Denied",
  "output-error": "Failed",
};

export const getStatusBadge = (status: ToolPart["state"]) => {
  const isExecuting = status === "input-available" || status === "input-streaming";

  if (isExecuting) {
    return (
      <Badge
        className="gap-1 rounded-full px-2 py-0 text-[10px] h-4.5 font-medium bg-cyan-500/10 text-cyan-400 border border-cyan-500/25"
        variant="secondary"
      >
        <span className="size-1.5 rounded-full bg-cyan-400 animate-ping" />
        {statusLabels[status]}
      </Badge>
    );
  }

  if (status === "output-error" || status === "output-denied") {
    return (
      <Badge
        className="gap-1 rounded-full px-2 py-0 text-[10px] h-4.5 font-medium bg-red-500/10 text-red-400 border border-red-500/25"
        variant="secondary"
      >
        <XCircle className="size-2.5 text-red-400" strokeWidth={1.75} />
        {statusLabels[status]}
      </Badge>
    );
  }

  if (status === "output-available") {
    return (
      <Badge
        className="gap-1 rounded-full px-2 py-0 text-[10px] h-4.5 font-medium bg-muted/60 text-muted-foreground border border-border/70"
        variant="secondary"
      >
        <CheckCircle2 className="size-2.5 text-emerald-500 dark:text-emerald-400" strokeWidth={1.75} />
        {statusLabels[status]}
      </Badge>
    );
  }

  return (
    <Badge
      className="gap-1 rounded-full px-2 py-0 text-[10px] h-4.5 font-medium bg-amber-500/10 text-amber-400 border border-amber-500/25"
      variant="secondary"
    >
      <Clock className="size-2.5 text-amber-400" strokeWidth={1.75} />
      {statusLabels[status]}
    </Badge>
  );
};

export const ToolHeader = ({
  className,
  title,
  type,
  state,
  toolName,
  icon: CustomIcon,
  ...props
}: ToolHeaderProps) => {
  const derivedName =
    type === "dynamic-tool" ? toolName : type.split("-").slice(1).join("-");

  const IconComponent = CustomIcon ?? Cpu;

  return (
    <CollapsibleTrigger
      className={cn(
        "flex w-full items-center justify-between gap-2.5 px-2.5 py-1.5 text-xs transition-colors hover:bg-muted/40 cursor-pointer select-none",
        className
      )}
      {...props}
    >
      <div className="flex items-center gap-2 min-w-0">
        <div className="flex size-5 shrink-0 items-center justify-center rounded bg-secondary/80 text-muted-foreground border border-border/70 shadow-2xs">
          <IconComponent className="size-3 text-cyan-500" strokeWidth={1.75} />
        </div>
        <span className="font-mono text-[11px] font-medium text-foreground truncate max-w-[240px] sm:max-w-[420px]">
          {title ?? derivedName}
        </span>
        {getStatusBadge(state)}
      </div>
      <ChevronDown className="size-3.5 shrink-0 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180" strokeWidth={1.75} />
    </CollapsibleTrigger>
  );
};

export type ToolContentProps = ComponentProps<typeof CollapsibleContent>;

export const ToolContent = ({ className, ...props }: ToolContentProps) => (
  <CollapsibleContent
    className={cn(
      "border-t border-border/50 bg-muted/15 p-2.5 space-y-2 font-mono text-[11px] text-foreground outline-none data-[state=closed]:animate-out data-[state=open]:animate-in data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className
    )}
    {...props}
  />
);

export type ToolInputProps = ComponentProps<"div"> & {
  input: ToolPart["input"];
};

export const ToolInput = ({ className, input, ...props }: ToolInputProps) => (
  <div className={cn("space-y-1.5 overflow-hidden", className)} {...props}>
    <h4 className="font-medium text-muted-foreground text-[10px] uppercase tracking-wide">
      Parameters
    </h4>
    <div className="rounded bg-muted/40 text-[11px]">
      <CodeBlock code={JSON.stringify(input, null, 2)} language="json" />
    </div>
  </div>
);

export type ToolOutputProps = ComponentProps<"div"> & {
  output: ToolPart["output"];
  errorText: ToolPart["errorText"];
};

export const ToolOutput = ({
  className,
  output,
  errorText,
  ...props
}: ToolOutputProps) => {
  if (!(output || errorText)) {
    return null;
  }

  let Output = <div>{output as ReactNode}</div>;

  if (typeof output === "object" && !isValidElement(output)) {
    Output = (
      <CodeBlock code={JSON.stringify(output, null, 2)} language="json" />
    );
  } else if (typeof output === "string") {
    Output = <CodeBlock code={output} language="json" />;
  }

  return (
    <div className={cn("space-y-1.5", className)} {...props}>
      <h4 className="font-medium text-muted-foreground text-[10px] uppercase tracking-wide">
        {errorText ? "Error" : "Result"}
      </h4>
      <div
        className={cn(
          "overflow-x-auto rounded text-[11px] [&_table]:w-full",
          errorText
            ? "bg-destructive/10 text-destructive p-2"
            : "bg-muted/40 text-foreground"
        )}
      >
        {errorText && <div>{errorText}</div>}
        {Output}
      </div>
    </div>
  );
};
