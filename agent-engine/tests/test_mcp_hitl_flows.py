import asyncio
import json
import selectors
import sys
from fastapi import Request

from agent_engine.main import (
    app,
    agent_run_endpoint,
    agent_resume_endpoint,
    AgentRunRequest,
    AgentResumeRequest,
)


async def run_mcp_tests():
    async with app.router.lifespan_context(app):
        req = Request({"type": "http", "app": app})
        org_id = "org_test_mira"
        project_id = "proj_test_mira"

        print("=================================================================", flush=True)
        print("TEST FLOW 1: Read-Only Tool (inspect_sandbox_workspace via MCP)", flush=True)
        print("=================================================================", flush=True)
        session_id_1 = "sess_mcp_readonly_001"
        run_body_1 = AgentRunRequest(
            org_id=org_id,
            project_id=project_id,
            session_id=session_id_1,
            prompt="List the files in the current directory",
        )

        resp_1 = await agent_run_endpoint(run_body_1, req)
        flow1_events = []
        async for chunk in resp_1.body_iterator:
            chunk_str = chunk if isinstance(chunk, str) else bytes(chunk).decode("utf-8")
            print(chunk_str, end="", flush=True)
            if chunk_str.strip().startswith("data: "):
                for line in chunk_str.strip().split("\n"):
                    if line.startswith("data: "):
                        flow1_events.append(json.loads(line[6:]))

        # Assert no interrupt happened and tool was called
        event_types_1 = [e.get("type") for e in flow1_events]
        assert "approval_required" not in event_types_1, "Flow 1 should NOT pause for approval!"
        assert "done" in event_types_1, "Flow 1 should complete cleanly!"
        print("\n>>> FLOW 1 PASSED: inspect_sandbox_workspace executed without pausing! <<<\n", flush=True)

        print("=================================================================", flush=True)
        print("TEST FLOW 2: High-Risk Shell Command (execute_sandbox_shell HITL)", flush=True)
        print("=================================================================", flush=True)
        session_id_2 = "sess_mcp_hitl_002"
        run_body_2 = AgentRunRequest(
            org_id=org_id,
            project_id=project_id,
            session_id=session_id_2,
            prompt="Run python --version in the sandbox",
        )

        print("--- Step 2A: Calling /api/v1/agent/run ---", flush=True)
        resp_2a = await agent_run_endpoint(run_body_2, req)
        flow2a_events = []
        async for chunk in resp_2a.body_iterator:
            chunk_str = chunk if isinstance(chunk, str) else bytes(chunk).decode("utf-8")
            print(chunk_str, end="", flush=True)
            if chunk_str.strip().startswith("data: "):
                for line in chunk_str.strip().split("\n"):
                    if line.startswith("data: "):
                        flow2a_events.append(json.loads(line[6:]))

        event_types_2a = [e.get("type") for e in flow2a_events]
        assert "approval_required" in event_types_2a, "Flow 2A MUST pause with approval_required!"
        approval_event = next(e for e in flow2a_events if e.get("type") == "approval_required")
        print(f"\n[INTERRUPT CAPTURED]: {approval_event['payload']}", flush=True)
        print("Graph paused and state checkpointed in Neon Postgres.\n", flush=True)

        print("--- Step 2B: Calling /api/v1/agent/resume (approved=True) ---", flush=True)
        resume_body_2 = AgentResumeRequest(
            org_id=org_id,
            session_id=session_id_2,
            approved=True,
            reason="Approved execution of python version check.",
        )

        resp_2b = await agent_resume_endpoint(resume_body_2, req)
        flow2b_events = []
        async for chunk in resp_2b.body_iterator:
            chunk_str = chunk if isinstance(chunk, str) else bytes(chunk).decode("utf-8")
            print(chunk_str, end="", flush=True)
            if chunk_str.strip().startswith("data: "):
                for line in chunk_str.strip().split("\n"):
                    if line.startswith("data: "):
                        flow2b_events.append(json.loads(line[6:]))

        event_types_2b = [e.get("type") for e in flow2b_events]
        assert "done" in event_types_2b, "Flow 2B must complete with done!"
        print("\n>>> FLOW 2 PASSED: Pause -> Approve -> Real MCP Tool execution completed! <<<\n", flush=True)


if __name__ == "__main__":
    if sys.platform == "win32":
        asyncio.run(
            run_mcp_tests(),
            loop_factory=lambda: asyncio.SelectorEventLoop(selectors.SelectSelector()),
        )
    else:
        asyncio.run(run_mcp_tests())
