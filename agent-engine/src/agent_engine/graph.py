from typing import Annotated, Any, Literal, cast
from typing_extensions import TypedDict
from langchain_core.messages import AIMessage, BaseMessage, SystemMessage, ToolMessage
from langchain_core.runnables import RunnableConfig
from langchain_core.tools import tool
from langchain_google_genai import ChatGoogleGenerativeAI
from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver
from langgraph.graph import END, START, StateGraph
from langgraph.graph.message import add_messages
from langgraph.types import Command, interrupt

from agent_engine.config import settings
from agent_engine.memory import HybridMemoryStore


# 1. Graph State Definition
class MiraState(TypedDict):
    messages: Annotated[list[BaseMessage], add_messages]
    org_id: str
    project_id: str


def build_mira_graph(memory_store: HybridMemoryStore, checkpointer: AsyncPostgresSaver):
    # 2. Define Tools
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

    @tool
    async def run_sandbox_command(command: str) -> str:
        """Execute a bash command inside the isolated Linux desktop sandbox. Requires human approval."""
        # HITL Interrupt: Pauses graph execution, persists state to Postgres, and surfaces payload to FastAPI
        approval = interrupt({
            "action": "approve_shell_command",
            "command": command,
            "reason": "Shell execution in sandbox requires explicit user confirmation.",
        })

        # Execution resumes here ONLY when FastAPI invokes graph with Command(resume=...)
        if not approval or not approval.get("approved", False):
            feedback = approval.get("reason", "User rejected the command.") if isinstance(approval, dict) else "Rejected."
            return f"COMMAND_REJECTED_BY_USER: {feedback}. Adjust your plan without running this command."

        # Simulated Daytona sandbox output (we will wire real MCP tool execution in Module 4)
        return f"[Sandbox stdout for `{command}`]: exit_code=0 | containers healthy, memory usage 42%"

    tools = [search_memory, run_sandbox_command]
    tools_by_name = {t.name: t for t in tools}

    # 3. Bind Tools to Gemini
    llm = ChatGoogleGenerativeAI(
        model=settings.primary_model,
        google_api_key=settings.gemini_api_key,
        temperature=0.2,
    ).bind_tools(tools)

    # 4. Graph Nodes
    async def agent_node(state: MiraState):
        sys_msg = SystemMessage(
            content=(
                "You are MIRA, an autonomous engineering teammate. "
                "Always check workspace memory first when asked about past bugs, configs, or project context. "
                "Use run_sandbox_command only when shell inspection or execution is necessary."
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
                # Pass RunnableConfig so tools can read tenant org_id/project_id securely
                result = await selected_tool.ainvoke(tool_call["args"], config=config)
                outputs.append(
                    ToolMessage(
                        content=str(result),
                        name=tool_call["name"],
                        tool_call_id=tool_call["id"],
                    )
                )
        return {"messages": outputs}

    # 5. Conditional Routing Edge
    def should_continue(state: MiraState) -> Literal["tools", "__end__"]:
        last_message = state["messages"][-1]
        if isinstance(last_message, AIMessage) and last_message.tool_calls:
            return "tools"
        return "__end__"

    # 6. Assemble & Compile StateGraph with Postgres Checkpointer
    builder = StateGraph(cast(Any, MiraState))
    builder.add_node("agent", agent_node)
    builder.add_node("tools", tool_node)

    builder.add_edge(START, "agent")
    builder.add_conditional_edges("agent", should_continue, {"tools": "tools", "__end__": END})
    builder.add_edge("tools", "agent")

    return builder.compile(checkpointer=checkpointer)