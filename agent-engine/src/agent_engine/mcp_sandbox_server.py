import os
import subprocess
from mcp.server.fastmcp import FastMCP

# Initialize an MCP Server named "mira-sandbox"
mcp = FastMCP("mira-sandbox")


@mcp.tool()
def inspect_sandbox_workspace(directory: str = ".") -> str:
    """List files and sizes inside the sandbox workspace directory (read-only safe)."""
    target = os.path.abspath(directory)
    if not os.path.exists(target):
        return f"Directory not found: {directory}"
    entries = []
    for name in sorted(os.listdir(target))[:50]:
        full_path = os.path.join(target, name)
        kind = "DIR" if os.path.isdir(full_path) else f"FILE ({os.path.getsize(full_path)}B)"
        entries.append(f"{kind:15} | {name}")
    return "\n".join(entries) if entries else "Directory is empty."


@mcp.tool()
def execute_sandbox_shell(command: str, timeout_seconds: int = 15) -> str:
    """Execute a shell command inside the sandbox environment and return stdout/stderr."""
    # In production MIRA, this dispatches to Daytona SDK's sandbox.process.exec(command)
    try:
        completed = subprocess.run(
            command,
            shell=True,
            capture_output=True,
            text=True,
            timeout=timeout_seconds,
        )
        return (
            f"exit_code={completed.returncode}\n"
            f"STDOUT:\n{completed.stdout.strip() or '(empty)'}\n"
            f"STDERR:\n{completed.stderr.strip() or '(empty)'}"
        )
    except subprocess.TimeoutExpired:
        return f"ERROR: Command timed out after {timeout_seconds}s."


if __name__ == "__main__":
    # Runs over stdio JSON-RPC transport when spawned by the MCP client
    mcp.run(transport="stdio")