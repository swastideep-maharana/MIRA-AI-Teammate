import asyncio
import json
from typing import Any
from google import genai
from google.genai import types
from pgvector.psycopg import register_vector_async
from psycopg_pool import AsyncConnectionPool
from pydantic import BaseModel, Field


class RetrievedMemory(BaseModel):
    id: str
    content: str
    source_type: str
    rrf_score: float
    rerank_score: float = 0.0
    metadata: dict[str, Any] = Field(default_factory=dict)


class RerankOutput(BaseModel):
    ranked_indices: list[int] = Field(
        ...,
        description="Indices of the candidate chunks ordered from most relevant to least relevant.",
    )


class HybridMemoryStore:
    def __init__(self, dsn: str, genai_client: genai.Client, embedding_model: str = "gemini-embedding-001"):
        self.genai = genai_client
        self.embedding_model = embedding_model
        # Async connection pool: reuses DB connections across concurrent FastAPI requests
        self.pool = AsyncConnectionPool(
            conninfo=dsn,
            min_size=1,
            max_size=10,
            open=False,
            configure=self._configure_conn,
        )

    @staticmethod
    async def _configure_conn(conn):
        # Registers Python list[float] <-> Postgres vector type automatically
        await register_vector_async(conn)

    async def open(self):
        await self.pool.open()

    async def close(self):
        await self.pool.close()

    async def embed_text(self, text: str, task_type: str) -> list[float]:
        # Gemini embeddings distinguish between indexing a document vs searching a query
        res = await self.genai.aio.models.embed_content(
            model=self.embedding_model,
            contents=text,
            config=types.EmbedContentConfig(task_type=task_type, output_dimensionality=768),
        )
        if not res.embeddings or res.embeddings[0].values is None:
            raise RuntimeError("Failed to generate embedding: empty response from Gemini API.")
        return [float(v) for v in res.embeddings[0].values]

    async def ingest_memory(
        self,
        org_id: str,
        project_id: str,
        content: str,
        source_type: str = "chat_fact",
        metadata: dict | None = None,
    ) -> str:
        embedding = await self.embed_text(content, task_type="RETRIEVAL_DOCUMENT")
        async with self.pool.connection() as conn:
            async with conn.cursor() as cur:
                await cur.execute(
                    """
                    INSERT INTO agent_memories (org_id, project_id, source_type, content, embedding, metadata)
                    VALUES (%s, %s, %s, %s, %s::vector, %s::jsonb)
                    RETURNING id::text;
                    """,
                    (org_id, project_id, source_type, content, embedding, json.dumps(metadata or {})),
                )
                row = await cur.fetchone()
                if not row:
                    raise RuntimeError("Failed to insert memory: no row returned.")
                return str(row[0])

    async def hybrid_search(
        self,
        org_id: str,
        project_id: str,
        query: str,
        top_k: int = 5,
        rrf_k: int = 60,
    ) -> list[RetrievedMemory]:
        query_vec = await self.embed_text(query, task_type="RETRIEVAL_QUERY")

        # Single SQL query executing BOTH dense vector search and sparse BM25/tsvector search,
        # scoped strictly by org_id + project_id, fused via Reciprocal Rank Fusion (RRF).
        sql = """
        WITH dense_search AS (
            SELECT
                id,
                ROW_NUMBER() OVER (ORDER BY embedding <=> %s::vector) AS dense_rank
            FROM agent_memories
            WHERE org_id = %s AND project_id = %s
            ORDER BY embedding <=> %s::vector
            LIMIT 20
        ),
        sparse_search AS (
            SELECT
                id,
                ROW_NUMBER() OVER (ORDER BY ts_rank_cd(content_tsv, plainto_tsquery('english', %s)) DESC) AS sparse_rank
            FROM agent_memories
            WHERE org_id = %s AND project_id = %s
              AND content_tsv @@ plainto_tsquery('english', %s)
            ORDER BY ts_rank_cd(content_tsv, plainto_tsquery('english', %s)) DESC
            LIMIT 20
        ),
        fused AS (
            SELECT
                COALESCE(d.id, s.id) AS id,
                COALESCE(1.0 / (%s + d.dense_rank), 0.0) +
                COALESCE(1.0 / (%s + s.sparse_rank), 0.0) AS rrf_score
            FROM dense_search d
            FULL OUTER JOIN sparse_search s ON d.id = s.id
        )
        SELECT
            m.id::text,
            m.content,
            m.source_type,
            f.rrf_score,
            m.metadata
        FROM fused f
        JOIN agent_memories m ON m.id = f.id
        ORDER BY f.rrf_score DESC
        LIMIT 12;
        """

        params = (
            query_vec, org_id, project_id, query_vec,
            query, org_id, project_id, query, query,
            rrf_k, rrf_k,
        )

        async with self.pool.connection() as conn:
            async with conn.cursor() as cur:
                await cur.execute(sql, params)
                rows = await cur.fetchall()

        candidates = [
            RetrievedMemory(
                id=r[0], content=r[1], source_type=r[2], rrf_score=float(r[3]), metadata=r[4] or {}
            )
            for r in rows
        ]

        if len(candidates) <= 1:
            return candidates

        return await self._rerank(query, candidates, top_k=top_k)

    async def _rerank(self, query: str, candidates: list[RetrievedMemory], top_k: int) -> list[RetrievedMemory]:
        # Stage 2: Listwise Cross-Attention Reranking via structured output
        numbered_docs = "\n".join(f"[{i}] {c.content}" for i, c in enumerate(candidates))
        prompt = (
            f"Query: {query}\n\n"
            f"Rank the following memory snippets from most relevant to least relevant for answering the query. "
            f"Return only the top {top_k} indices.\n\n{numbered_docs}"
        )

        res = await self.genai.aio.models.generate_content(
            model="gemini-3.5-flash",
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=RerankOutput,
                temperature=0.0,
            ),
        )
        if not res.text:
            return candidates[:top_k]

        try:
            parsed = RerankOutput.model_validate_json(res.text)
        except Exception:
            return candidates[:top_k]
        reranked: list[RetrievedMemory] = []
        seen = set()
        for rank, idx in enumerate(parsed.ranked_indices):
            if 0 <= idx < len(candidates) and idx not in seen:
                seen.add(idx)
                item = candidates[idx]
                item.rerank_score = round(1.0 / (rank + 1), 4)
                reranked.append(item)
            if len(reranked) >= top_k:
                break

        return reranked or candidates[:top_k]