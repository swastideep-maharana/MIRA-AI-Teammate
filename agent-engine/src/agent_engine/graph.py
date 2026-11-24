import sys
from pathlib import Path
from typing import Annotated, Any, Literal, cast
from typing_extensions import TypedDict

from langchain_core.messages import AIMessage, BaseMessage, SystemMessage, ToolMessage
from langchain_core.runnables import RunnableConfig
from langchain_core.tools import BaseTool, StructuredTool, tool
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_mcp_adapters.client import MultiServerMCPClient
from langgraph.checkpoint.base import BaseCheckpointSaver
from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver
from langgraph.graph import END, START, StateGraph
from langgraph.graph.message import add_messages
from langgraph.types import Command, interrupt

from agent_engine.config import settings
from agent_engine.memory import HybridMemoryStore

HIGH_RISK_MCP_TOOLS = {"execute_sandbox_shell"}


class MiraState(TypedDict):
    messages: Annotated[list[BaseMessage], add_messages]
    org_id: str
    project_id: str


def wrap_tool_with_hitl(mcp_tool: BaseTool) -> BaseTool:
    """Wraps a high-risk MCP tool with a LangGraph human-in-the-loop approval interrupt."""
    if mcp_tool.name not in HIGH_RISK_MCP_TOOLS:
        return mcp_tool

    async def gated_coroutine(**kwargs):
        approval = interrupt({
            "action": f"approve_{mcp_tool.name}",
            "tool_name": mcp_tool.name,
            "arguments": kwargs,
            "reason": f"Execution of `{mcp_tool.name}` requires explicit human approval.",
        })
        if not approval or not approval.get("approved", False):
            feedback = approval.get("reason", "Rejected by user.") if isinstance(approval, dict) else "Rejected."
            return f"TOOL_REJECTED_BY_USER: {feedback}. Choose a safer approach."

        # Forward approved arguments to the real MCP Server over JSON-RPC
        return await mcp_tool.ainvoke(kwargs)

    return StructuredTool.from_function(
        coroutine=gated_coroutine,
        name=mcp_tool.name,
        description=mcp_tool.description,
        args_schema=mcp_tool.args_schema,
    )


async def create_mcp_client() -> MultiServerMCPClient:
    server_script = str(Path(__file__).parent / "mcp_sandbox_server.py")
    return MultiServerMCPClient(
        {
            "mira-sandbox": {
                "command": sys.executable,  # Uses the exact uv .venv Python interpreter
                "args": [server_script],
                "transport": "stdio",
            }
        }
    )


async def build_mira_graph(
    memory_store: HybridMemoryStore,
    checkpointer: BaseCheckpointSaver,
    mcp_client: MultiServerMCPClient,
):
    @tool
    async def search_memory(query: str, config: RunnableConfig) -> str:
        """Search past workspace facts, error logs, and architecture decisions using hybrid vector+keyword search."""
        configurable = config.get("configurable", {})
        org_id = configurable.get("org_id", "")
        project_id = configurable.get("project_id", "")
        results = await memory_store.hybrid_search(org_id=org_id, project_id=project_id, query=query, top_k=4)
        if not results:
            return "No relevant workspace memories found."
        return "\n".join(f"- [{m.source_type}] (score={m.rrf_score:.4f}): {m.content}" for m in results)

    # Dynamically discover tools from the MCP server & wrap high-risk ones with HITL
    raw_mcp_tools = await mcp_client.get_tools()
    gated_mcp_tools = [wrap_tool_with_hitl(t) for t in raw_mcp_tools]

    all_tools = [search_memory, *gated_mcp_tools]
    tools_by_name = {t.name: t for t in all_tools}

    llm = ChatGoogleGenerativeAI(
        model=settings.primary_model,
        google_api_key=settings.gemini_api_key,
        temperature=0.2,
    ).bind_tools(all_tools)

    async def agent_node(state: MiraState):
        sys_msg = SystemMessage(
            content=(
                "You are MIRA, an autonomous engineering teammate. "
                "Check workspace memory when asked about past context. "
                "Use inspect_sandbox_workspace for read-only directory checks and execute_sandbox_shell for shell commands."
            )
        )
        response = await llm.ainvoke([sys_msg, *state["messages"]])
        return {"messages": [response]}

    async def tool_node(state: MiraState, config: RunnableConfig):
        last_message = state["messages"][-1]
        outputs: list[ToolMessage] = []
        if isinstance(last_message, AIMessage) and last_message.tool_calls:
            for tool_call in last_message.tool_calls:
                selected_tool = tools_by_name[tool_call["name"]]
                result = await selected_tool.ainvoke(tool_call["args"], config=config)
                outputs.append(
                    ToolMessage(
                        content=str(result),
                        name=tool_call["name"],
                        tool_call_id=tool_call["id"],
                    )
                )
        return {"messages": outputs}

    def should_continue(state: MiraState) -> Literal["tools", "__end__"]:
        last_message = state["messages"][-1]
        if isinstance(last_message, AIMessage) and last_message.tool_calls:
            return "tools"
        return "__end__"

    builder = StateGraph(cast(Any, MiraState))
    builder.add_node("agent", agent_node)
    builder.add_node("tools", tool_node)
    builder.add_edge(START, "agent")
    builder.add_conditional_edges("agent", should_continue, {"tools": "tools", "__end__": END})
    builder.add_edge("tools", "agent")

    return builder.compile(checkpointer=checkpointer)
