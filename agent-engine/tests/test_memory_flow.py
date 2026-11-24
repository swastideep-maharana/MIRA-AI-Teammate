import asyncio
import selectors
import sys
from fastapi import Request

from agent_engine.main import (
    app,
    ingest_memory_endpoint,
    search_memory_endpoint,
    IngestMemoryRequest,
    SearchMemoryRequest,
)


async def run_test() -> None:
    async with app.router.lifespan_context(app):
        req = Request({"type": "http", "app": app})
        org_id = "org_test_mira"
        project_id = "proj_test_mira"

        memories: list[IngestMemoryRequest] = [
            IngestMemoryRequest(
                org_id=org_id,
                project_id=project_id,
                content="Container failed during microVM boot with error code ERR_SANDBOX_TIMEOUT_904 after waiting 30000ms for guest agent initialization.",
                source_type="sandbox_log",
                metadata={"error_code": "ERR_SANDBOX_TIMEOUT_904"},
            ),
            IngestMemoryRequest(
                org_id=org_id,
                project_id=project_id,
                content="When launching Daytona or Docker sandbox environments, network latency may cause container startup delays and timeout issues.",
                source_type="codebase_doc",
                metadata={"topic": "troubleshooting"},
            ),
            IngestMemoryRequest(
                org_id=org_id,
                project_id=project_id,
                content="Best practices for handling timeout exceptions in background tasks and retrying failed worker jobs.",
                source_type="chat_fact",
                metadata={"topic": "resilience"},
            ),
            IngestMemoryRequest(
                org_id=org_id,
                project_id=project_id,
                content="The frontend application uses Tailwind CSS v4 and Next.js App Router for server-rendered page layouts.",
                source_type="chat_fact",
                metadata={"topic": "frontend"},
            ),
            IngestMemoryRequest(
                org_id=org_id,
                project_id=project_id,
                content="User authentication is handled via Clerk webhooks syncing account data to Neon PostgreSQL.",
                source_type="chat_fact",
                metadata={"topic": "auth"},
            ),
        ]

        print("=== 1. Ingesting 5 sample memories via ingest_memory_endpoint ===", flush=True)
        for i, body in enumerate(memories):
            res = await ingest_memory_endpoint(body, req)
            print(f"Memory {i+1} Ingested -> ID: {res.id} | Status: {res.status}", flush=True)

        print("\n=== 2. Searching for exact code: ERR_SANDBOX_TIMEOUT_904 ===", flush=True)
        search_body = SearchMemoryRequest(
            org_id=org_id,
            project_id=project_id,
            query="ERR_SANDBOX_TIMEOUT_904",
            top_k=5,
        )
        search_res = await search_memory_endpoint(search_body, req)
        results = search_res.memories
        print(f"Retrieved {len(results)} results:\n", flush=True)

        for idx, r in enumerate(results):
            print(f"Rank #{idx+1}:", flush=True)
            print(f"  Content: {r.content}", flush=True)
            print(f"  Source: {r.source_type}", flush=True)
            print(f"  RRF Score: {r.rrf_score:.5f}", flush=True)
            print(f"  Rerank Score: {r.rerank_score}", flush=True)
            print(f"  Metadata: {r.metadata}\n", flush=True)

        assert len(results) > 0, "No memories returned"
        assert "ERR_SANDBOX_TIMEOUT_904" in results[0].content, "Expected exact code to be #1!"
        print(">>> VERIFICATION PASSED: ERR_SANDBOX_TIMEOUT_904 surfaced at Rank #1! <<<", flush=True)


if __name__ == "__main__":
    if sys.platform == "win32":
        asyncio.run(
            run_test(),
            loop_factory=lambda: asyncio.SelectorEventLoop(selectors.SelectSelector()),
        )
    else:
        asyncio.run(run_test())
