// Regex patterns for blacklisted dangerous commands in bash
const DANGEROUS_COMMAND_PATTERNS: Array<{ pattern: RegExp; reason: string }> = [
  {
    pattern: /(?:^|[;&|`$()]\s*)rm\s+(-[a-zA-Z]*[rf][a-zA-Z]*|-r\s+-f|-f\s+-r)\s+(?:\/|\/\*|~\/|~|\$HOME|\.\.|\/\.\.)(?:\s|[;&|]|$)/i,
    reason: "Destructive root/home recursive deletion is strictly prohibited.",
  },
  {
    pattern: /:\s*\(\s*\)\s*\{\s*:\s*\|\s*:\s*&\s*\}\s*;\s*:/,
    reason: "Fork bombs and resource-exhaustion commands are prohibited.",
  },
  {
    pattern: /(?:^|[;&|`$()]\s*)(?:>|>>|tee|sed|chmod|chown|rm)\s+.*\/etc\/(?:passwd|shadow|sudoers|pam\.d)/i,
    reason: "Modifying critical operating system authentication files (/etc/passwd, shadow, sudoers) is prohibited.",
  },
  {
    pattern: /(?:^|[;&|`$()]\s*)(?:mkfs|fdisk|dd\s+.*of=\/dev\/(?:sd[a-z]|nvme|hd[a-z]|null|zero)|rm\s+.*\/boot)/i,
    reason: "Disk reformatting, raw partition writes, and altering /boot are prohibited.",
  },
  {
    pattern: /(?:^|[;&|`$()]\s*)(?:shutdown|reboot|poweroff|init\s+[06])(?:\s|[;&|]|$)/i,
    reason: "System shutdown and reboot commands are disabled in this environment.",
  },
]

export function checkCommandSafety(command: string): { safe: boolean; reason?: string } {
  for (const item of DANGEROUS_COMMAND_PATTERNS) {
    if (item.pattern.test(command)) {
      return { safe: false, reason: item.reason }
    }
  }
  return { safe: true }
}

const HIGH_RISK_COMMAND_PATTERNS: Array<{ pattern: RegExp; reason: string }> = [
  {
    pattern: /(?:^|[;&|`$()]\s*)rm\s+(?:-[a-zA-Z]*[rf][a-zA-Z]*|-r\b|-f\b)/i,
    reason: "Recursive or forced file deletion requires human approval.",
  },
  {
    pattern: /(?:^|[;&|`$()]\s*)(?:sudo|su)\s+/i,
    reason: "Elevated privilege execution (sudo/su) requires human approval.",
  },
  {
    pattern: /(?:curl|wget)\b[^|;\n]*\|\s*(?:sh|bash|zsh|python3?)\b/i,
    reason: "Piping remote downloads directly into a shell requires human approval.",
  },
  {
    pattern: /(?:^|[;&|`$()]\s*)git\s+(?:push|reset\s+--hard|clean\s+-[a-zA-Z]*f)/i,
    reason: "Destructive or remote-mutating git operations require human approval.",
  },
  {
    pattern: /(?:^|[;&|`$()]\s*)(?:kill\s+-9|pkill|killall)\b/i,
    reason: "Force-terminating processes requires human approval.",
  },
  {
    pattern: /(?:^|[;&|`$()]\s*)(?:chmod\s+-R\s+777|chown\s+-R)\b/i,
    reason: "Recursive permission or ownership changes require human approval.",
  },
]

export function isHighRiskCommand(command: string): { highRisk: boolean; reason?: string } {
  for (const item of HIGH_RISK_COMMAND_PATTERNS) {
    if (item.pattern.test(command)) {
      return { highRisk: true, reason: item.reason }
    }
  }
  return { highRisk: false }
}

