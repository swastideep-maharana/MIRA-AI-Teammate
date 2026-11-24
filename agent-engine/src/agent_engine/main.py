import asyncio
import json
import sys
from contextlib import asynccontextmanager
from typing import Any, AsyncGenerator, Literal

if sys.platform == "win32":
    # On Windows, psycopg async requires a Selector event loop instead of Proactor
    _set_policy = getattr(asyncio, "set_event_loop_policy", None)
    _policy_cls = getattr(asyncio, "WindowsSelectorEventLoopPolicy", None)
    if _set_policy and _policy_cls:
        _set_policy(_policy_cls())

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import StreamingResponse
from google import genai
from google.genai import types
from google.genai.errors import APIError
from langchain_core.messages import AIMessage, HumanMessage, ToolMessage
from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver
from langgraph.types import Command
from psycopg.rows import dict_row
from psycopg_pool import AsyncConnectionPool
from pydantic import BaseModel, Field

from agent_engine.config import settings
from agent_engine.graph import build_mira_graph
from agent_engine.memory import HybridMemoryStore, RetrievedMemory

# 1. Lifespan Manager: Initialize shared async clients ONCE at startup, close cleanly at shutdown
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: attach the Gemini client to app.state so every request reuses the same HTTP connection pool
    app.state.genai_client = genai.Client(api_key=settings.gemini_api_key)
    app.state.memory_store = HybridMemoryStore(
        dsn=settings.database_url,
        genai_client=app.state.genai_client,
        embedding_model=settings.embedding_model,
    )
    await app.state.memory_store.open()

    # PostgreSQL Checkpointer for LangGraph with connection pool
    app.state.checkpointer_pool = AsyncConnectionPool(
        conninfo=settings.database_url,
        min_size=1,
        max_size=10,
        open=False,
        kwargs={"autocommit": True, "prepare_threshold": 0, "row_factory": dict_row},
    )
    await app.state.checkpointer_pool.open()
    app.state.checkpointer = AsyncPostgresSaver(conn=app.state.checkpointer_pool)
    await app.state.checkpointer.setup()

    # Compile the LangGraph agent with checkpointer
    app.state.graph = build_mira_graph(
        memory_store=app.state.memory_store,
        checkpointer=app.state.checkpointer,
    )

    print("MIRA Agent Engine started: Gemini client, MemoryStore, & LangGraph Checkpointer initialized.")
    yield
    # Shutdown: clean up resources when container receives SIGTERM
    await app.state.memory_store.close()
    await app.state.checkpointer_pool.close()
    print("MIRA Agent Engine shutting down cleanly.")

app = FastAPI(title="MIRA Agent Engine", lifespan=lifespan)


# 2. Request & SSE Event Schemas (Pydantic v2)
class AgentRunRequest(BaseModel):
    org_id: str = Field(..., min_length=1, description="Tenant organization ID")
    project_id: str = Field(default="default_project", description="Project ID")
    session_id: str = Field(..., min_length=1, description="Active workspace session ID")
    prompt: str = Field(..., min_length=1, max_length=10000)


class AgentResumeRequest(BaseModel):
    org_id: str = Field(..., min_length=1, description="Tenant organization ID")
    session_id: str = Field(..., min_length=1, description="Active workspace session ID")
    approved: bool
    reason: str = ""


class SSEEvent(BaseModel):
    type: Literal["thought", "token", "error", "done", "approval_required"]
    content: str = ""
    payload: dict[str, Any] | None = None
    session_id: str

    def to_sse(self) -> str:
        # SSE protocol strictly requires: "data: <json>\n\n"
        return f"data: {self.model_dump_json(exclude_none=True)}\n\n"


# 3. Core Async Generator (Non-blocking token streaming with retry & fallback)
async def stream_gemini_response(
    req: AgentRunRequest,
    request: Request,
    client: genai.Client,
) -> AsyncGenerator[str, None]:
    models_to_try = [settings.primary_model, settings.fallback_model]
    last_error = None

    for model_name in models_to_try:
        for attempt in range(3):  # Up to 3 attempts per model
            try:
                yield SSEEvent(
                    type="thought",
                    content=f"Routing request to {model_name} (attempt {attempt + 1})...",
                    session_id=req.session_id,
                ).to_sse()

                response_stream = await client.aio.models.generate_content_stream(
                    model=model_name,
                    contents=req.prompt,
                    config=types.GenerateContentConfig(
                        system_instruction="You are MIRA, an autonomous engineering teammate. Be concise and technical.",
                        temperature=0.2,
                    ),
                )

                async for chunk in response_stream:
                    if await request.is_disconnected():
                        print(f"[ABORT] Client disconnected mid-stream | session={req.session_id}")
                        return
                    if chunk.text:
                        yield SSEEvent(
                            type="token",
                            content=chunk.text,
                            session_id=req.session_id,
                        ).to_sse()

                yield SSEEvent(type="done", session_id=req.session_id).to_sse()
                return  # Success — exit both loops

            except APIError as e:
                last_error = e
                # Retry once on transient capacity/rate-limit errors (429 or 503)
                if e.code in (429, 503) and attempt < 1:
                    wait_seconds = 0.5 * (2 ** attempt)
                    await asyncio.sleep(wait_seconds)
                    continue
                # For non-retryable errors or exhausted retries, notify client before falling back
                yield SSEEvent(
                    type="thought",
                    content=f"{model_name} unavailable ({e.code or 'error'}). Switching to fallback...",
                    session_id=req.session_id,
                ).to_sse()
                break
            except Exception as e:
                last_error = e
                break

    yield SSEEvent(
        type="error",
        content=f"All models failed after retries: {str(last_error)}",
        session_id=req.session_id,
    ).to_sse()


# 4. Memory Endpoints & Schemas
class IngestMemoryRequest(BaseModel):
    org_id: str = Field(..., min_length=1, description="Tenant organization ID")
    project_id: str = Field(..., min_length=1, description="Project ID")
    content: str = Field(..., min_length=1)
    source_type: str = "chat_fact"
    metadata: dict[str, Any] = Field(default_factory=dict)


class IngestMemoryResponse(BaseModel):
    id: str
    status: str = "stored"


class SearchMemoryRequest(BaseModel):
    org_id: str = Field(..., min_length=1, description="Tenant organization ID")
    project_id: str = Field(..., min_length=1, description="Project ID")
    query: str = Field(..., min_length=1)
    top_k: int = Field(default=5, ge=1, le=50)


class SearchMemoryResponse(BaseModel):
    memories: list[RetrievedMemory]


@app.post("/api/v1/memory/ingest", response_model=IngestMemoryResponse)
async def ingest_memory_endpoint(body: IngestMemoryRequest, request: Request):
    store: HybridMemoryStore = request.app.state.memory_store
    memory_id = await store.ingest_memory(
        org_id=body.org_id,
        project_id=body.project_id,
        content=body.content,
        source_type=body.source_type,
        metadata=body.metadata,
    )
    return IngestMemoryResponse(id=memory_id, status="stored")


@app.post("/api/v1/memory/search", response_model=SearchMemoryResponse)
async def search_memory_endpoint(body: SearchMemoryRequest, request: Request):
    store: HybridMemoryStore = request.app.state.memory_store
    results = await store.hybrid_search(
        org_id=body.org_id,
        project_id=body.project_id,
        query=body.query,
        top_k=body.top_k,
    )
    return SearchMemoryResponse(memories=results)


# 5. Core LangGraph Stream Processor (with HITL interrupt support)
async def stream_graph_run(
    session_id: str,
    stream: AsyncGenerator[dict[str, Any], None],
    request: Request,
) -> AsyncGenerator[str, None]:
    try:
        async for chunk in stream:
            try:
                if await request.is_disconnected():
                    print(f"[ABORT] Client disconnected mid-stream | session={session_id}")
                    return
            except Exception:
                pass

            # Check for LangGraph human-in-the-loop __interrupt__ event
            if "__interrupt__" in chunk:
                interrupt_tuple = chunk["__interrupt__"]
                payload = interrupt_tuple[0].value if interrupt_tuple else {}
                yield SSEEvent(
                    type="approval_required",
                    payload=payload,
                    session_id=session_id,
                ).to_sse()
                return  # Stop cleanly on interrupt

            # Process node updates
            for node_name, node_update in chunk.items():
                if not isinstance(node_update, dict):
                    continue
                messages = node_update.get("messages", [])
                for msg in messages:
                    if isinstance(msg, AIMessage):
                        if getattr(msg, "tool_calls", None):
                            for tc in msg.tool_calls:
                                yield SSEEvent(
                                    type="thought",
                                    content=f"Invoking tool `{tc['name']}` with {tc['args']}",
                                    session_id=session_id,
                                ).to_sse()
                        if msg.content:
                            yield SSEEvent(
                                type="token",
                                content=str(msg.content),
                                session_id=session_id,
                            ).to_sse()
                    elif isinstance(msg, ToolMessage):
                        yield SSEEvent(
                            type="thought",
                            content=f"Tool output: {msg.content}",
                            session_id=session_id,
                        ).to_sse()

        # Completed cleanly without interrupt
        yield SSEEvent(type="done", session_id=session_id).to_sse()

    except Exception as e:
        import traceback
        traceback.print_exc()
        yield SSEEvent(
            type="error",
            content=f"Agent graph execution error: {str(e)}",
            session_id=session_id,
        ).to_sse()


# 6. LangGraph Agent Endpoints
@app.post("/api/v1/agent/run")
async def agent_run_endpoint(body: AgentRunRequest, request: Request):
    graph = request.app.state.graph
    config = {
        "configurable": {
            "thread_id": body.session_id,
            "org_id": body.org_id,
            "project_id": body.project_id,
        },
        "recursion_limit": 10,
    }
    input_state = {
        "messages": [HumanMessage(content=body.prompt)],
        "org_id": body.org_id,
        "project_id": body.project_id,
    }
    stream = graph.astream(input_state, config=config, stream_mode="updates")
    return StreamingResponse(
        stream_graph_run(body.session_id, stream, request),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@app.post("/api/v1/agent/resume")
async def agent_resume_endpoint(body: AgentResumeRequest, request: Request):
    graph = request.app.state.graph
    config = {
        "configurable": {
            "thread_id": body.session_id,
        },
        "recursion_limit": 10,
    }

    # Security check: verify tenant org_id matches the checkpointed state
    snapshot = await graph.aget_state(config)
    if not snapshot or not snapshot.values:
        raise HTTPException(status_code=404, detail="Session not found or expired.")

    checkpoint_org_id = snapshot.values.get("org_id")
    if checkpoint_org_id and checkpoint_org_id != body.org_id:
        raise HTTPException(status_code=403, detail="Forbidden: org_id mismatch for this session.")

    resume_command = Command(resume={"approved": body.approved, "reason": body.reason})
    stream = graph.astream(resume_command, config=config, stream_mode="updates")
    return StreamingResponse(
        stream_graph_run(body.session_id, stream, request),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@app.post("/api/v1/agent/stream")
async def agent_stream_endpoint(body: AgentRunRequest, request: Request):
    return await agent_run_endpoint(body, request)