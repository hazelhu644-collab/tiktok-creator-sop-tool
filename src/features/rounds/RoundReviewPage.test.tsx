import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { RoundReviewPage } from "./RoundReviewPage";
import type {
  RoundCreatorOutcome,
  RoundReviewPageProps,
} from "./roundReviewTypes";

function creator(
  patch: Partial<RoundCreatorOutcome> & Pick<RoundCreatorOutcome, "rowId">,
): RoundCreatorOutcome {
  return {
    displayName: patch.rowId,
    completed: true,
    statusLabel: "Completed",
    videoProgress: "2/2",
    followUpCount: 1,
    notes: "",
    alsoInRounds: [],
    ...patch,
  };
}

function createProps(
  overrides: Partial<RoundReviewPageProps> = {},
): RoundReviewPageProps {
  return {
    data: {
      productName: "蒸汽梳毛器",
      needsProductSelection: false,
      rounds: [
        {
          round: 2,
          isCurrent: true,
          total: 1,
          completed: 0,
          incomplete: 1,
          active: 1,
          creators: [
            creator({
              rowId: "r2-a",
              displayName: "@amy",
              completed: false,
              statusLabel: "Delivered",
              videoProgress: "0/2",
              alsoInRounds: [1],
            }),
          ],
        },
        {
          round: 1,
          isCurrent: false,
          total: 2,
          completed: 1,
          incomplete: 1,
          active: 0,
          creators: [
            creator({ rowId: "r1-a", displayName: "@amy", alsoInRounds: [2] }),
            creator({
              rowId: "r1-b",
              displayName: "@leo",
              completed: false,
              videoProgress: "1/2",
              notes: "拖了很久",
            }),
          ],
        },
      ],
    },
    uiState: { expandedRound: null },
    actions: { toggleRound: vi.fn(), openCreatorInDatabase: vi.fn() },
    ...overrides,
  };
}

describe("RoundReviewPage", () => {
  it("asks for a product first, since rounds belong to one", () => {
    const props = createProps();
    props.data.needsProductSelection = true;

    render(<RoundReviewPage {...props} />);

    expect(screen.getByText("请先在顶部选择一个产品项目")).toBeVisible();
    expect(screen.queryByText(/第 1 轮/)).not.toBeInTheDocument();
  });

  it("explains the empty case rather than showing a bare list", () => {
    const props = createProps();
    props.data.rounds = [];

    render(<RoundReviewPage {...props} />);

    expect(
      screen.getByText("「蒸汽梳毛器」还没有达人记录"),
    ).toBeInTheDocument();
  });

  it("lists newest round first and marks the one in progress", () => {
    render(<RoundReviewPage {...createProps()} />);

    const headers = screen
      .getAllByRole("button", { expanded: false })
      .map((button) => button.textContent ?? "");

    expect(headers[0]).toContain("第 2 轮");
    expect(headers[0]).toContain("进行中");
    expect(headers[1]).toContain("第 1 轮");
    expect(headers[1]).not.toContain("进行中");
    expect(headers[1]).toContain("共 2 位 · 完成 1 · 未完成 1");
  });

  it("keeps rounds collapsed until asked", async () => {
    const user = userEvent.setup();
    const props = createProps();

    render(<RoundReviewPage {...props} />);
    expect(screen.queryByText("@leo")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /第 1 轮/ }));
    expect(props.actions.toggleRound).toHaveBeenCalledWith(1);
  });

  it("flags the creators who did not deliver and where else they appear", async () => {
    const user = userEvent.setup();
    const props = createProps();
    props.uiState.expandedRound = 1;

    render(<RoundReviewPage {...props} />);

    const leo = screen.getByText("@leo").closest("li");
    const amy = screen.getByText("@amy").closest("li");
    expect(leo).toHaveClass("round-bad-row");
    expect(amy).not.toHaveClass("round-bad-row");
    expect(leo).toHaveTextContent("未完成");
    expect(leo).toHaveTextContent("拖了很久");
    expect(amy).toHaveTextContent("也出现在第 2 轮");

    await user.click(screen.getByRole("button", { name: "@leo" }));
    expect(props.actions.openCreatorInDatabase).toHaveBeenCalledWith("r1-b");
  });
});
