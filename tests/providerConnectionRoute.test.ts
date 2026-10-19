import { beforeEach, describe, expect, it, vi } from "vitest";
import { testProviderConnection } from "../server/lib/providers/connectionTest";
import providersRouter from "../server/routes/providers";

vi.mock("../server/lib/providers/connectionTest", () => ({ testProviderConnection: vi.fn() }));

function handler() {
  const route = providersRouter.stack.find((layer: any) =>
    layer.route?.path === "/:provider/test-connection" && layer.route.methods.post
  );
  expect(route).toBeDefined();
  return route!.route.stack[route!.route.stack.length - 1].handle;
}

async function call(body: any, provider = "openai") {
  let payload: any;
  let status = 200;
  const res: any = {
    json: (value: any) => { payload = value; return res; },
    status: (code: number) => { status = code; return res; },
  };
  await handler()({ user: { id: "user-1" }, params: { provider }, body }, res);
  return { payload, status };
}

beforeEach(() => vi.mocked(testProviderConnection).mockReset());

describe("POST /api/providers/:provider/test-connection", () => {
  it("uses the submitted key and returns the small chat probe result", async () => {
    vi.mocked(testProviderConnection).mockResolvedValue({ model: "gpt-5", latencyMs: 95, tokens: 6 });
    const result = await call({ key: "sk-test-key-123456" });
    expect(testProviderConnection).toHaveBeenCalledWith("openai", "sk-test-key-123456");
    expect(result).toEqual({
      status: 200,
      payload: { success: true, model: "gpt-5", latencyMs: 95, tokens: 6 },
    });
  });

});
