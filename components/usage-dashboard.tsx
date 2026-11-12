"use client"

import * as React from "react"
import Link from "next/link"
import {
  Activity,
  ArrowLeft,
  Coins,
  Cpu,
  Timer,
} from "lucide-react"
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { ThemeToggle } from "@/components/theme-toggle"
import { Badge } from "@/components/ui/badge"

export interface UsageRunItem {
  id: string
  botName: string
  chatName: string
  promptTokens: number
  completionTokens: number
  totalTokens: number
  sandboxDurationSeconds: number
  estimatedCostUsd: number
  createdAt: string
}

export interface UsageByBotItem {
  botName: string
  runs: number
  totalTokens: number
  sandboxSeconds: number
  estimatedCostUsd: number
}

export function UsageDashboard({
  totalCostUsd,
  totalTokens,
  promptTokens,
  completionTokens,
  totalSandboxSeconds,
  runCount,
  byBot,
  recentRuns,
}: {
  totalCostUsd: number
  totalTokens: number
  promptTokens: number
  completionTokens: number
  totalSandboxSeconds: number
  runCount: number
  byBot: UsageByBotItem[]
  recentRuns: UsageRunItem[]
}) {
  const [mounted, setMounted] = React.useState(false)
  React.useEffect(() => {
    setMounted(true)
  }, [])

  const formatDuration = (secs: number) => {
    if (secs < 60) return `${secs}s`
    const mins = Math.floor(secs / 60)
    const rem = secs % 60
    return `${mins}m ${rem}s`
  }

  return (
    <div className="flex flex-1 flex-col h-full min-h-0 overflow-y-auto bg-background text-foreground">
      <header className="flex h-14 items-center justify-between px-4 md:px-6 border-b border-border bg-background/80 backdrop-blur-md shrink-0 sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <SidebarTrigger className="-ml-1 size-8 text-muted-foreground hover:text-foreground hover:bg-accent/60 transition-colors cursor-pointer rounded-lg md:hidden" />
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="size-3.5" />
            <span>Workspace</span>
          </Link>
          <span className="text-border">/</span>
          <div className="flex items-center gap-2">
            <Activity className="size-4 text-cyan-500" />
            <h1 className="text-sm font-semibold tracking-tight">
              Agent Telemetry & Cost Ledger
            </h1>
          </div>
        </div>
        <ThemeToggle />
      </header>

      <main className="mx-auto w-full max-w-6xl p-4 md:p-6 space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="rounded-xl border border-border bg-card p-4 shadow-2xs">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Estimated Spend</span>
              <Coins className="size-4 text-cyan-500" />
            </div>
            <div className="mt-2 text-2xl font-semibold tracking-tight font-mono">
              ${totalCostUsd.toFixed(4)}
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Tokens + Daytona X11 runtime
            </p>
          </div>

          <div className="rounded-xl border border-border bg-card p-4 shadow-2xs">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Total Tokens</span>
              <Cpu className="size-4 text-cyan-500" />
            </div>
            <div className="mt-2 text-2xl font-semibold tracking-tight font-mono">
              {totalTokens.toLocaleString()}
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              {promptTokens.toLocaleString()} in / {completionTokens.toLocaleString()} out
            </p>
          </div>

          <div className="rounded-xl border border-border bg-card p-4 shadow-2xs">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Sandbox Compute</span>
              <Timer className="size-4 text-cyan-500" />
            </div>
            <div className="mt-2 text-2xl font-semibold tracking-tight font-mono">
              {formatDuration(totalSandboxSeconds)}
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Active container execution time
            </p>
          </div>

          <div className="rounded-xl border border-border bg-card p-4 shadow-2xs">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Completed Turns</span>
              <Activity className="size-4 text-cyan-500" />
            </div>
            <div className="mt-2 text-2xl font-semibold tracking-tight font-mono">
              {runCount}
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Persisted in `usageLedgers`
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          <div className="lg:col-span-3 rounded-xl border border-border bg-card p-4 shadow-2xs">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-sm font-semibold">Tokens by Teammate</h2>
                <p className="text-xs text-muted-foreground">
                  Token consumption across specialized agents
                </p>
              </div>
              <Badge variant="secondary" className="text-[11px] font-mono">
                {byBot.length} agents
              </Badge>
            </div>
            <div className="h-64 w-full">
              {mounted && byBot.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={byBot} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                    <XAxis dataKey="botName" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        borderColor: "hsl(var(--border))",
                        borderRadius: "8px",
                        fontSize: "12px",
                      }}
                    />
                    <Bar dataKey="totalTokens" fill="#06b6d4" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                  {byBot.length === 0
                    ? "No agent runs recorded yet. Start a chat to collect live telemetry."
                    : "Loading chart..."}
                </div>
              )}
            </div>
          </div>

          <div className="lg:col-span-2 rounded-xl border border-border bg-card p-4 shadow-2xs">
            <h2 className="text-sm font-semibold">Teammate Breakdown</h2>
            <p className="text-xs text-muted-foreground mb-3">
              Per-agent runs and metered cost
            </p>
            {byBot.length === 0 ? (
              <div className="py-12 text-center text-xs text-muted-foreground">
                No runs recorded yet.
              </div>
            ) : (
              <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
                {byBot.map((item) => (
                  <div
                    key={item.botName}
                    className="flex items-center justify-between rounded-lg border border-border/70 bg-muted/30 px-3 py-2 text-xs"
                  >
                    <div className="min-w-0">
                      <div className="font-medium truncate">{item.botName}</div>
                      <div className="text-[11px] text-muted-foreground">
                        {item.runs} runs · {formatDuration(item.sandboxSeconds)}
                      </div>
                    </div>
                    <div className="text-right font-mono shrink-0">
                      <div className="font-medium">${item.estimatedCostUsd.toFixed(4)}</div>
                      <div className="text-[11px] text-muted-foreground">
                        {item.totalTokens.toLocaleString()} tok
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card shadow-2xs overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold">Recent Agent Runs</h2>
              <p className="text-xs text-muted-foreground">
                Latest 25 metered turns from Postgres
              </p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/40 text-muted-foreground border-b border-border">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Teammate</th>
                  <th className="px-4 py-2.5 font-medium">Workspace Chat</th>
                  <th className="px-4 py-2.5 font-medium text-right">Input</th>
                  <th className="px-4 py-2.5 font-medium text-right">Output</th>
                  <th className="px-4 py-2.5 font-medium text-right">Sandbox</th>
                  <th className="px-4 py-2.5 font-medium text-right">Cost</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {recentRuns.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                      No metered runs yet.
                    </td>
                  </tr>
                ) : (
                  recentRuns.map((run) => (
                    <tr key={run.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-2.5 font-medium">{run.botName}</td>
                      <td className="px-4 py-2.5 text-muted-foreground truncate max-w-[200px]">
                        {run.chatName}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono">
                        {run.promptTokens.toLocaleString()}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono">
                        {run.completionTokens.toLocaleString()}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono">
                        {run.sandboxDurationSeconds}s
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono">
                        ${run.estimatedCostUsd.toFixed(5)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  )
}

