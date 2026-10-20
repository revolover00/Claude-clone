import { DEFAULT_CHAT_TOOLS } from "../chatStreamHelpers";
import { executeSkillFunctionCall } from "../skills/toolLoop";
import { createConnectorToolRegistry, type ConnectorToolRegistry } from "./toolRegistry";

const USER_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function emptyRegistry(): ConnectorToolRegistry {
  return { declarations: [], handlers: new Map(), execute: async () => null };
}

export async function prepareChatToolSupport(userId: string | undefined, signal: AbortSignal, enabled: boolean) {
  let connectorToolRegistry = emptyRegistry();
  if (enabled && userId && USER_ID_PATTERN.test(userId)) {
    try {
      connectorToolRegistry = await createConnectorToolRegistry(userId, signal);
    } catch (error: any) {
      console.warn(`[Connectors] Unable to prepare MCP tools for chat: ${String(error?.message || "unknown error").slice(0, 200)}`);
    }
  }

  const defaultDeclarations = DEFAULT_CHAT_TOOLS.flatMap((tool: any) =>
    Array.isArray(tool.functionDeclarations) ? tool.functionDeclarations : []
  );
  const toolExecutionState = { skillLoadsCount: 0, totalBytesLoaded: 0 };
  const executeToolCall = async (call: any, state = toolExecutionState) => {
    const connectorResult = await connectorToolRegistry.execute(call?.name, call?.args || {});
    if (connectorResult) return connectorResult;
    return executeSkillFunctionCall(userId, call, state);
  };

  return {
    externalTools: enabled ? connectorToolRegistry.declarations : [],
    geminiTools: enabled ? [{ functionDeclarations: [...defaultDeclarations, ...connectorToolRegistry.declarations] }] : undefined,
    executeSkillFunctionCall,
    executeToolCall,
  };
}
