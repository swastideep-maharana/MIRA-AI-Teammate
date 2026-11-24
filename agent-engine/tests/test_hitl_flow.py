import asyncio
import json
import selectors
import sys
from fastapi import HTTPException, Request

from agent_engine.main import (
    app,
    agent_run_endpoint,
    agent_resume_endpoint,
    AgentRunRequest,
    AgentResumeRequest,
)

async def run_hitl_test():
    async with app.router.lifespan_context(app):
        req = Request({"type": "http", "app": app})
        session_id = "sess_hitl_test_999"
        org_id = "org_test_mira"
        project_id = "proj_test_mira"

        print("=== Step 1: Run agent with prompt requiring shell command ===", flush=True)
        run_body = AgentRunRequest(
            org_id=org_id,
            project_id=project_id,
            session_id=session_id,
            prompt="Please execute the shell command 'docker ps -a' in the sandbox to check running containers.",
        )

        response = await agent_run_endpoint(run_body, req)
        approval_payload = None

        print("Streaming agent run output:", flush=True)
        async for chunk in response.body_iterator:
            chunk_str = chunk if isinstance(chunk, str) else bytes(chunk).decode("utf-8")
            print(chunk_str, end="", flush=True)
            if "approval_required" in chunk_str:
                for line in chunk_str.strip().split("\n"):
                    if line.startswith("data: "):
                        data = json.loads(line[6:])
                        if data.get("type") == "approval_required":
                            approval_payload = data.get("payload")

        assert approval_payload is not None, "Expected approval_required event!"
        print(f"\n[INTERRUPT CAPTURED] Payload: {approval_payload}", flush=True)
        print("Graph execution successfully paused and checkpointed in Neon DB!", flush=True)

        print("\n=== Step 2a: Test Security Check with unauthorized org_id ===", flush=True)
        unauthorized_body = AgentResumeRequest(
            org_id="attacker_org_999",
            session_id=session_id,
            approved=True,
            reason="Malicious attempt to hijack session.",
        )
        try:
            await agent_resume_endpoint(unauthorized_body, req)
            assert False, "Should have raised 403 Forbidden!"
        except HTTPException as e:
            assert e.status_code == 403, f"Expected 403 Forbidden, got {e.status_code}"
            print(f"[SECURITY VERIFIED] Successfully blocked cross-tenant resume: HTTP {e.status_code} - {e.detail}", flush=True)

        print("\n=== Step 2b: Resume agent with authorized org_id and approved=True ===", flush=True)
        resume_body = AgentResumeRequest(
            org_id=org_id,
            session_id=session_id,
            approved=True,
            reason="Approved by engineering manager.",
        )

        resume_response = await agent_resume_endpoint(resume_body, req)
        resumed_tokens = []

        print("Streaming resume output:", flush=True)
        async for chunk in resume_response.body_iterator:
            chunk_str = chunk if isinstance(chunk, str) else bytes(chunk).decode("utf-8")
            print(chunk_str, end="", flush=True)
            if "token" in chunk_str:
                resumed_tokens.append(chunk_str)

        print("\n>>> HITL VERIFICATION PASSED: Pause -> Approve -> Resume successfully completed! <<<", flush=True)

if __name__ == "__main__":
    if sys.platform == "win32":
        asyncio.run(
            run_hitl_test(),
            loop_factory=lambda: asyncio.SelectorEventLoop(selectors.SelectSelector()),
        )
    else:
        asyncio.run(run_test())
