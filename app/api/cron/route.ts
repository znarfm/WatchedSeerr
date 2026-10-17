import { NextResponse } from "next/server"
import { auditMedia } from "@/lib/audit"

export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization")
  const expectedSecret = process.env.CRON_SECRET

  if (expectedSecret && authHeader !== `Bearer ${expectedSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const report = await auditMedia()
    const safeCandidates = report.items.filter((i) => i.conflictStatus === "safe" && !i.isWhitelisted)
    const ghostRequests = report.items.filter((i) => i.conflictStatus === "ghost" && !i.isWhitelisted)

    const discordWebhookUrl = process.env.DISCORD_WEBHOOK_URL
    if (discordWebhookUrl) {
      const fields = [
        {
          name: "Safe to Purge",
          value:
            safeCandidates.length > 0
              ? safeCandidates.map((i) => `• **${i.title}** (${i.mediaType})`).slice(0, 10).join("\n")
              : "None",
          inline: false,
        },
        {
          name: "Ghost Requests",
          value:
            ghostRequests.length > 0
              ? ghostRequests.map((i) => `• **${i.title}** (Req: ${i.requester.username})`).slice(0, 10).join("\n")
              : "None",
          inline: false,
        },
      ]

      await fetch(discordWebhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          embeds: [
            {
              title: "WatchedSeerr Daily Retention Audit",
              description: `Audit finished with **${report.totalItems}** total items: **${report.safeCount}** safe to purge, **${report.conflictCount}** active conflicts, **${report.ghostCount}** ghost requests.`,
              color: safeCandidates.length > 0 ? 0x10b981 : 0x64748b,
              fields,
              timestamp: new Date().toISOString(),
            },
          ],
        }),
      })
    }

    return NextResponse.json({
      status: "success",
      reportSummary: {
        total: report.totalItems,
        safe: report.safeCount,
        conflicts: report.conflictCount,
        ghosts: report.ghostCount,
      },
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Audit execution failed" },
      { status: 500 }
    )
  }
}
