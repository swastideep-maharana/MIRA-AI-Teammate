import re
from pydantic import BaseModel


class GuardrailResult(BaseModel):
    allowed: bool
    reason: str = ""


# Fast regex patterns for prompt injection & catastrophic shell commands
BLOCKED_PATTERNS = [
    (r"ignore\s+(all\s+)?previous\s+instructions", "Prompt injection attempt detected."),
    (r"system\s+prompt|reveal\s+your\s+instructions", "System prompt extraction attempt blocked."),
    (r"rm\s+-rf\s+(/|\*|~)", "Catastrophic filesystem deletion blocked by policy."),
    (r":\(\)\s*\{\s*:\|\:&\s*\}\s*;:", "Fork bomb command blocked by policy."),
    (r"(mkfs\.|dd\s+if=/dev/)", "Raw disk write command blocked by policy."),
]

# Secret redaction patterns for outbound SSE tokens
SECRET_PATTERNS = [
    (re.compile(r"AIza[0-9A-Za-z\-_]{35}"), "[REDACTED_GEMINI_KEY]"),
    (re.compile(r"sk-[a-zA-Z0-9]{20,}"), "[REDACTED_API_KEY]"),
    (re.compile(r"postgres(?:ql)?://[^\s\"']+"), "[REDACTED_DATABASE_URL]"),
]


def check_input_guardrails(prompt: str) -> GuardrailResult:
    lowered = prompt.lower()
    for pattern, reason in BLOCKED_PATTERNS:
        if re.search(pattern, lowered):
            return GuardrailResult(allowed=False, reason=reason)
    return GuardrailResult(allowed=True)


def sanitize_output_text(text: str) -> str:
    sanitized = text
    for regex, replacement in SECRET_PATTERNS:
        sanitized = regex.sub(replacement, sanitized)
    return sanitized