import { auth } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"
import { desc, eq } from "drizzle-orm"
import { db } from "@/db"
import { usageLedgers } from "@/db/schema"
import { UsageDashboard, type UsageByBotItem } from "@/components/usage-dashboard"

export const maxDuration = 60

export default async function UsagePage() {
  const { userId } = await auth()
  if (!userId) {
    redirect("/sign-in")
  }

  const rows = await db.query.usageLedgers.findMany({
    where: eq(usageLedgers.userId, userId),
    orderBy: [desc(usageLedgers.createdAt)],
    limit: 200,
    with: {
      bot: true,
      chat: true,
    },
  })

  let totalCostUsd = 0
  let totalTokens = 0
  let promptTokens = 0
  let completionTokens = 0
  let totalSandboxSeconds = 0

  const botMap = new Map<string, UsageByBotItem>()

  for (const row of rows) {
    totalCostUsd += row.estimatedCostUsd ?? 0
    totalTokens += row.totalTokens ?? 0
    promptTokens += row.promptTokens ?? 0
    completionTokens += row.completionTokens ?? 0
    totalSandboxSeconds += row.sandboxDurationSeconds ?? 0

    const botName = row.bot?.name || "AI Teammate"
    const existing = botMap.get(botName) || {
      botName,
      runs: 0,
      totalTokens: 0,
      sandboxSeconds: 0,
      estimatedCostUsd: 0,
    }
    existing.runs += 1
    existing.totalTokens += row.totalTokens ?? 0
    existing.sandboxSeconds += row.sandboxDurationSeconds ?? 0
    existing.estimatedCostUsd += row.estimatedCostUsd ?? 0
    botMap.set(botName, existing)
  }

  const byBot = Array.from(botMap.values()).sort((a, b) => b.totalTokens - a.totalTokens)
  const recentRuns = rows.slice(0, 25).map((row) => ({
    id: row.id,
    botName: row.bot?.name || "AI Teammate",
    chatName: row.chat?.name || "Direct Workspace",
    promptTokens: row.promptTokens ?? 0,
    completionTokens: row.completionTokens ?? 0,
    totalTokens: row.totalTokens ?? 0,
    sandboxDurationSeconds: row.sandboxDurationSeconds ?? 0,
    estimatedCostUsd: row.estimatedCostUsd ?? 0,
    createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : "",
  }))

  return (
    <UsageDashboard
      totalCostUsd={totalCostUsd}
      totalTokens={totalTokens}
      promptTokens={promptTokens}
      completionTokens={completionTokens}
      totalSandboxSeconds={totalSandboxSeconds}
      runCount={rows.length}
      byBot={byBot}
      recentRuns={recentRuns}
    />
  )
}

