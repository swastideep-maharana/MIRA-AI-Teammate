import asyncio
import json
from contextlib import asynccontextmanager
from typing import AsyncGenerator, Literal

from fastapi import FastAPI, Request
from fastapi.responses import StreamingResponse
from google import genai
from google.genai import types
from google.genai.errors import APIError
from pydantic import BaseModel, Field

from agent_engine.config import settings

# 1. Lifespan Manager: Initialize shared async clients ONCE at startup, close cleanly at shutdown
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: attach the Gemini client to app.state so every request reuses the same HTTP connection pool
    app.state.genai_client = genai.Client(api_key=settings.gemini_api_key)
    print("MIRA Agent Engine started: Gemini client initialized.")
    yield
    # Shutdown: clean up resources when container receives SIGTERM
    print("MIRA Agent Engine shutting down cleanly.")

app = FastAPI(title="MIRA Agent Engine", lifespan=lifespan)


# 2. Request & SSE Event Schemas (Pydantic v2)
class AgentRunRequest(BaseModel):
    org_id: str = Field(..., min_length=1, description="Tenant organization ID")
    session_id: str = Field(..., min_length=1, description="Active workspace session ID")
    prompt: str = Field(..., min_length=1, max_length=10000)


class SSEEvent(BaseModel):
    type: Literal["thought", "token", "error", "done"]
    content: str = ""
    session_id: str

    def to_sse(self) -> str:
        # SSE protocol strictly requires: "data: <json>\n\n"
        return f"data: {self.model_dump_json()}\n\n"


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


# 4. HTTP Endpoint
@app.post("/api/v1/agent/stream")
async def agent_stream_endpoint(body: AgentRunRequest, request: Request):
    client: genai.Client = request.app.state.genai_client
    return StreamingResponse(
        stream_gemini_response(body, request, client),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",  # Critical for Nginx/Cloud Run so chunks aren't held back
        },
    )