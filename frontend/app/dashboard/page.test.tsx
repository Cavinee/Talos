import * as React from "react";
import { render, screen } from "@testing-library/react";
import { vi } from "vitest";

vi.mock("framer-motion", () => {
  const motion = new Proxy(
    {},
    {
      get: (_target, tag: string) => {
        return function MotionComponent({
          children,
          ...props
        }: React.PropsWithChildren<Record<string, unknown>>) {
          return React.createElement(tag, props, children);
        };
      },
    }
  );
  return { motion };
});

vi.spyOn(global, "fetch").mockResolvedValue({
  ok: true,
  json: async () => ({ threats: [] }),
} as Response);

describe("DashboardPage", () => {
  it("renders the dashboard heading", () => {
    render(React.createElement(require("./page").default));
    expect(
      screen.getByRole("heading", { name: /threat intelligence dashboard/i })
    ).toBeVisible();
  });
});
