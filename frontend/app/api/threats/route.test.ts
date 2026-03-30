import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("fs", () => ({
  default: {
    readFileSync: vi.fn(),
  },
}));

vi.mock("path", () => ({
  default: {
    join: vi.fn((...args: string[]) => args.join("/")),
  },
}));

describe("GET /api/threats", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns threats from file newest-first", async () => {
    const fs = (await import("fs")).default;
    vi.mocked(fs.readFileSync).mockReturnValue(
      JSON.stringify([
        { id: "t-001", timestamp: "2026-01-01 00:00:01" },
        { id: "t-002", timestamp: "2026-01-01 00:00:02" },
      ])
    );

    const { GET } = await import("./route");
    const response = await GET(new Request("http://localhost/api/threats"));
    const body = await response.json();

    expect(body.threats[0].id).toBe("t-002");
    expect(body.threats[1].id).toBe("t-001");
  });

  it("returns empty array when file is missing", async () => {
    const fs = (await import("fs")).default;
    vi.mocked(fs.readFileSync).mockImplementation(() => {
      throw new Error("ENOENT");
    });

    const { GET } = await import("./route");
    const response = await GET(new Request("http://localhost/api/threats"));
    const body = await response.json();

    expect(body.threats).toEqual([]);
  });

  it("respects limit query param", async () => {
    const fs = (await import("fs")).default;
    const entries = Array.from({ length: 10 }, (_, i) => ({ id: `t-${i}` }));
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(entries));

    const { GET } = await import("./route");
    const response = await GET(new Request("http://localhost/api/threats?limit=3"));
    const body = await response.json();

    expect(body.threats).toHaveLength(3);
  });
});
