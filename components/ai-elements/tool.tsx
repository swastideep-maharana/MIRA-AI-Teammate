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
  CheckCircleIcon,
  ChevronDownIcon,
  CircleIcon,
  ClockIcon,
  WrenchIcon,
  XCircleIcon,
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
        "group not-prose mb-3 w-full rounded-xl border border-border bg-card overflow-hidden transition-all duration-200",
        isRunning && "border-cyan-500/40 bg-cyan-500/5 shadow-xs ring-1 ring-cyan-500/20 animate-pulse",
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
        className="gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium bg-cyan-500/10 text-cyan-400 border border-cyan-500/25"
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
        className="gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium bg-red-500/10 text-red-400 border border-red-500/25"
        variant="secondary"
      >
        <XCircleIcon className="size-3 text-red-400" />
        {statusLabels[status]}
      </Badge>
    );
  }

  if (status === "output-available") {
    return (
      <Badge
        className="gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium bg-muted text-muted-foreground border border-border"
        variant="secondary"
      >
        <CheckCircleIcon className="size-3 text-emerald-500" />
        {statusLabels[status]}
      </Badge>
    );
  }

  return (
    <Badge
      className="gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium bg-amber-500/10 text-amber-400 border border-amber-500/25"
      variant="secondary"
    >
      <ClockIcon className="size-3 text-amber-400" />
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
  ...props
}: ToolHeaderProps) => {
  const derivedName =
    type === "dynamic-tool" ? toolName : type.split("-").slice(1).join("-");

  return (
    <CollapsibleTrigger
      className={cn(
        "flex w-full items-center justify-between gap-3 px-3.5 py-2.5 text-xs transition-colors hover:bg-muted/50 cursor-pointer select-none",
        className
      )}
      {...props}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="flex size-6 shrink-0 items-center justify-center rounded-md bg-secondary text-muted-foreground border border-border">
          <WrenchIcon className="size-3.5 text-cyan-500" />
        </div>
        <span className="font-mono text-xs font-medium text-foreground truncate max-w-[280px] sm:max-w-[420px]">
          {title ?? derivedName}
        </span>
        {getStatusBadge(state)}
      </div>
      <ChevronDownIcon className="size-4 shrink-0 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180" />
    </CollapsibleTrigger>
  );
};

export type ToolContentProps = ComponentProps<typeof CollapsibleContent>;

export const ToolContent = ({ className, ...props }: ToolContentProps) => (
  <CollapsibleContent
    className={cn(
      "border-t border-border bg-muted/20 p-3.5 space-y-3 font-mono text-xs text-foreground outline-none data-[state=closed]:animate-out data-[state=open]:animate-in data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className
    )}
    {...props}
  />
);

export type ToolInputProps = ComponentProps<"div"> & {
  input: ToolPart["input"];
};

export const ToolInput = ({ className, input, ...props }: ToolInputProps) => (
  <div className={cn("space-y-2 overflow-hidden", className)} {...props}>
    <h4 className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
      Parameters
    </h4>
    <div className="rounded-md bg-muted/50">
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
    <div className={cn("space-y-2", className)} {...props}>
      <h4 className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
        {errorText ? "Error" : "Result"}
      </h4>
      <div
        className={cn(
          "overflow-x-auto rounded-md text-xs [&_table]:w-full",
          errorText
            ? "bg-destructive/10 text-destructive"
            : "bg-muted/50 text-foreground"
        )}
      >
        {errorText && <div>{errorText}</div>}
        {Output}
      </div>
    </div>
  );
};
