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

describe("GET /api/rankings", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns red and blue factions from file", async () => {
    const fs = (await import("fs")).default;
    const payload = {
      lastUpdated: "2026-01-01T00:00:00Z",
      red: [{ rank: 1, uid: "aabbccdd" }],
      blue: [{ rank: 1, uid: "eeffgghh" }],
    };
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(payload));

    const { GET } = await import("./route");
    const response = await GET(new Request("http://localhost/api/rankings"));
    const body = await response.json();

    expect(body.red).toHaveLength(1);
    expect(body.blue).toHaveLength(1);
    expect(body.lastUpdated).toBe("2026-01-01T00:00:00Z");
  });

  it("returns empty factions when file is missing", async () => {
    const fs = (await import("fs")).default;
    vi.mocked(fs.readFileSync).mockImplementation(() => {
      throw new Error("ENOENT");
    });

    const { GET } = await import("./route");
    const response = await GET(new Request("http://localhost/api/rankings"));
    const body = await response.json();

    expect(body.red).toEqual([]);
    expect(body.blue).toEqual([]);
    expect(body.lastUpdated).toBeNull();
  });
});
