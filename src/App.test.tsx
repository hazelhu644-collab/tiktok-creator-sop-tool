import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";
import { CREATOR_ROWS_STORAGE_KEY } from "./creatorData";
import type { CreatorRow } from "./types";

const FILMING_REQUIREMENTS_STORAGE_KEY = "tiktokCreatorSop.filmingRequirements";

function creatorRow(overrides: Partial<CreatorRow> = {}): CreatorRow {
  return {
    id: "creator-1",
    username: "fluffy_creator",
    profileLink: "@fluffy_creator",
    contactMethod: "TikTok DM",
    product: "智能宠物饮水机",
    currentStatus: "Delivered",
    sampleShippingStatus: "Delivered",
    sampleDeliveredDate: "2026-06-02",
    videoProgress: "0 of 2",
    firstVideoPostedDate: "",
    lastContactDate: "2026-06-01",
    lastFollowUpCount: 0,
    notes: "",
    trackingStatus: "",
    lastMessageScenario: "",
    lastMessageChannel: "",
    lastMessageSentAt: "",
    nextFollowUpDate: "",
    lastCreatorResponse: "",
    followUpHistory: [],
    ...overrides,
  };
}

function seedCreators(rows: CreatorRow[]) {
  window.localStorage.setItem(CREATOR_ROWS_STORAGE_KEY, JSON.stringify(rows));
}

async function goTo(
  user: ReturnType<typeof userEvent.setup>,
  moduleName: RegExp,
) {
  const nav = screen.getByRole("navigation", { name: "主导航" });
  await user.click(within(nav).getByRole("button", { name: moduleName }));
}

afterEach(() => {
  window.localStorage.clear();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("operations workbench navigation and dashboard", () => {
  it("renders the fixed module navigation and opens each redesigned page", async () => {
    const user = userEvent.setup();
    render(<App />);

    expect(screen.getByText("Creator SOP")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "今日工作台" }),
    ).toBeInTheDocument();

    await goTo(user, /达人数据库/);
    expect(
      screen.getByRole("heading", { name: "达人数据库" }),
    ).toBeInTheDocument();
    expect(screen.getByText("数据导入 / 导出")).toBeInTheDocument();

    await goTo(user, /沟通话术模板/);
    expect(
      screen.getByRole("heading", { name: "沟通话术模板" }),
    ).toBeInTheDocument();

    await goTo(user, /样品追踪/);
    expect(
      screen.getByRole("heading", { name: "样品追踪" }),
    ).toBeInTheDocument();

    await goTo(user, /达人跟进中心/);
    expect(
      screen.getByRole("heading", { name: "今日工作台" }),
    ).toBeInTheDocument();

    await goTo(user, /内容审核/);
    expect(
      screen.getByRole("heading", { name: "内容审核" }),
    ).toBeInTheDocument();

    await goTo(user, /投流素材库/);
    expect(
      screen.getByRole("heading", { name: "投流素材库" }),
    ).toBeInTheDocument();

    await goTo(user, /设置/);
    expect(screen.getByRole("heading", { name: "设置" })).toBeInTheDocument();
  });

  it("keeps Chinese sidebar order with Follow-up Center above Creator Database and Templates", () => {
    render(<App />);
    const navText =
      screen.getByRole("navigation", { name: "主导航" }).textContent ?? "";
    expect(navText.indexOf("达人跟进中心")).toBeGreaterThan(
      navText.indexOf("今日工作台"),
    );
    expect(navText.indexOf("达人跟进中心")).toBeLessThan(
      navText.indexOf("达人数据库"),
    );
    expect(navText.indexOf("达人数据库")).toBeLessThan(
      navText.indexOf("沟通话术模板"),
    );
  });

  it("shows the eight Dashboard metric cards and a priority todo list", () => {
    seedCreators([
      creatorRow({
        id: "invite",
        username: "invite_creator",
        currentStatus: "To Contact",
        sampleShippingStatus: "",
        sampleDeliveredDate: "",
        videoProgress: "0 of 2",
      }),
      creatorRow({
        id: "follow",
        username: "follow_creator",
        currentStatus: "Delivered",
        sampleShippingStatus: "Delivered",
        sampleDeliveredDate: "2026-05-20",
        videoProgress: "0 of 2",
      }),
      creatorRow({
        id: "request",
        username: "request_creator",
        currentStatus: "Sample Requested",
        sampleShippingStatus: "Not Shipped",
        sampleDeliveredDate: "",
      }),
      creatorRow({
        id: "approved",
        username: "approved_creator",
        currentStatus: "Sample Approved",
        sampleShippingStatus: "Not Shipped",
        sampleDeliveredDate: "",
      }),
      creatorRow({
        id: "shipped",
        username: "shipped_creator",
        currentStatus: "Sample Shipped",
        sampleShippingStatus: "In Transit",
        sampleDeliveredDate: "",
      }),
      creatorRow({
        id: "posted",
        username: "posted_creator",
        currentStatus: "Posted",
        sampleShippingStatus: "Delivered",
        videoProgress: "1 of 2",
        firstVideoPostedDate: "2026-06-01",
      }),
      creatorRow({
        id: "revision",
        username: "revision_creator",
        currentStatus: "Need Revision",
        sampleShippingStatus: "Delivered",
        videoProgress: "1 of 2",
      }),
      creatorRow({
        id: "ads",
        username: "ads_creator",
        currentStatus: "Ready for Ads",
        sampleShippingStatus: "Delivered",
        videoProgress: "2 of 2",
      }),
    ]);

    render(<App />);

    [
      "今日待邀约达人数量",
      "今日待跟进达人数量",
      "待寄样达人数量",
      "已寄样待签收数量",
      "已签收待发视频数量",
      "本周已发布视频数量",
      "待验收视频数量",
      "可投流素材数量",
    ].forEach((label) =>
      expect(
        screen.getByRole("button", { name: new RegExp(label) }),
      ).toBeInTheDocument(),
    );

    expect(
      screen.getByRole("heading", { name: "今日待处理达人队列" }),
    ).toBeInTheDocument();
    expect(screen.getByText("follow_creator")).toBeInTheDocument();
    expect(screen.getByTestId("creator-queue")).toHaveClass("compact-queue");
    expect(screen.getByTestId("current-creator-panel")).toBeInTheDocument();
  });

  it("uses product-first workflow to filter overview, queue, and current creator panel while preserving 全部产品", async () => {
    const user = userEvent.setup();
    seedCreators([
      creatorRow({
        id: "fountain",
        username: "fountain_creator",
        product: "Pet Fountain",
        currentStatus: "Delivered",
        sampleShippingStatus: "Delivered",
        sampleDeliveredDate: "2026-05-20",
      }),
      creatorRow({
        id: "comb",
        username: "comb_creator",
        product: "Pet Comb",
        currentStatus: "Delivered",
        sampleShippingStatus: "Delivered",
        sampleDeliveredDate: "2026-05-20",
      }),
    ]);

    render(<App />);

    expect(screen.getByTestId("creator-queue")).toHaveTextContent(
      "fountain_creator",
    );
    expect(screen.getByTestId("creator-queue")).toHaveTextContent(
      "comb_creator",
    );

    await user.selectOptions(
      screen.getAllByLabelText("当前产品项目")[0],
      "Pet Fountain",
    );

    expect(
      screen.getByRole("button", { name: /今日待跟进达人数量1Pet Fountain/ }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("creator-queue")).toHaveTextContent(
      "fountain_creator",
    );
    expect(screen.getByTestId("creator-queue")).not.toHaveTextContent(
      "comb_creator",
    );
    expect(screen.getByTestId("current-creator-panel")).toHaveTextContent(
      "Pet Fountain",
    );

    await user.selectOptions(
      screen.getAllByLabelText("当前产品项目")[0],
      "ALL",
    );
    expect(screen.getByTestId("creator-queue")).toHaveTextContent(
      "comb_creator",
    );
  });

  it("selecting a creator collapses the compact queue and processing next creator advances within the filter", async () => {
    const user = userEvent.setup();
    seedCreators([
      creatorRow({
        id: "first",
        username: "first_creator",
        product: "Pet Fountain",
        currentStatus: "Delivered",
        sampleShippingStatus: "Delivered",
        sampleDeliveredDate: "2026-05-20",
      }),
      creatorRow({
        id: "second",
        username: "second_creator",
        product: "Pet Fountain",
        currentStatus: "Delivered",
        sampleShippingStatus: "Delivered",
        sampleDeliveredDate: "2026-05-21",
      }),
    ]);

    render(<App />);
    await user.selectOptions(screen.getByLabelText("选择达人"), "first");

    expect(screen.queryByTestId("creator-queue")).not.toBeInTheDocument();
    expect(screen.getByText("达人队列已收起。")).toBeInTheDocument();
    expect(screen.getByTestId("current-creator-panel")).toHaveTextContent(
      "first_creator",
    );

    await user.click(screen.getByRole("button", { name: "生成话术" }));
    await user.click(screen.getByRole("button", { name: "标记为已发送" }));
    const nextButtons = screen.getAllByRole("button", {
      name: "处理下一个达人",
    });
    await user.click(nextButtons[nextButtons.length - 1]);

    expect(screen.getByTestId("current-creator-panel")).toHaveTextContent(
      "second_creator",
    );
  });

  it("clicking an overview card stays on Today Workbench and filters the processing queue", async () => {
    const user = userEvent.setup();
    seedCreators([
      creatorRow({
        id: "invite",
        username: "invite_creator",
        currentStatus: "To Contact",
        sampleShippingStatus: "",
        sampleDeliveredDate: "",
      }),
      creatorRow({
        id: "delivered",
        username: "delivered_creator",
        currentStatus: "Delivered",
        sampleShippingStatus: "Delivered",
      }),
    ]);

    render(<App />);
    await user.click(
      screen.getByRole("button", { name: /今日待邀约达人数量/ }),
    );

    expect(
      screen.getByRole("heading", { name: "今日工作台" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "达人数据库" }),
    ).not.toBeInTheDocument();
    expect(screen.getByTestId("creator-queue")).toHaveTextContent(
      "invite_creator",
    );
    expect(screen.getByTestId("creator-queue")).not.toHaveTextContent(
      "delivered_creator",
    );
    expect(screen.getByTestId("current-creator-panel")).toHaveTextContent(
      "invite_creator",
    );
  });

  it("shows an actionable empty state when there are no todo items", () => {
    render(<App />);

    expect(screen.getByText("暂无待处理达人。")).toBeInTheDocument();
    expect(
      screen.getByText("请导入达人数据，或切换到「全部产品」查看完整队列。"),
    ).toBeInTheDocument();
  });
});

describe("creator database redesigned table", () => {
  it("supports search, status filtering, and editable table fields", async () => {
    const user = userEvent.setup();
    seedCreators([
      creatorRow({
        id: "alpha",
        username: "alpha_creator",
        product: "Water Fountain",
        currentStatus: "To Contact",
        sampleShippingStatus: "",
        sampleDeliveredDate: "",
      }),
      creatorRow({
        id: "beta",
        username: "beta_creator",
        product: "Pet Comb",
        currentStatus: "Ready for Ads",
        sampleShippingStatus: "Delivered",
        videoProgress: "2 of 2",
      }),
    ]);

    render(<App />);
    await goTo(user, /达人数据库/);

    await user.type(screen.getByLabelText("搜索"), "alpha");
    expect(screen.getByDisplayValue("alpha_creator")).toBeInTheDocument();
    expect(screen.queryByDisplayValue("beta_creator")).not.toBeInTheDocument();

    await user.clear(screen.getByLabelText("搜索"));
    await user.selectOptions(
      screen.getAllByLabelText("合作状态")[0],
      "Ready for Ads",
    );
    expect(screen.getByDisplayValue("beta_creator")).toBeInTheDocument();
    expect(screen.queryByDisplayValue("alpha_creator")).not.toBeInTheDocument();

    await user.clear(screen.getAllByLabelText("产品名称")[0]);
    await user.type(screen.getAllByLabelText("产品名称")[0], "Updated Brush");
    await waitFor(() => {
      const saved = JSON.parse(
        window.localStorage.getItem(CREATOR_ROWS_STORAGE_KEY) ?? "[]",
      ) as CreatorRow[];
      expect(saved.find((row) => row.id === "beta")?.product).toBe(
        "Updated Brush",
      );
    });
  });

  it("bulk-selects creators, copies outreach scripts, and bulk-updates status", async () => {
    const user = userEvent.setup();
    const writeText = vi.fn(async () => undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    seedCreators([
      creatorRow({
        id: "alpha",
        username: "alpha_creator",
        currentStatus: "To Contact",
        sampleShippingStatus: "",
        sampleDeliveredDate: "",
      }),
      creatorRow({
        id: "beta",
        username: "beta_creator",
        currentStatus: "To Contact",
        sampleShippingStatus: "",
        sampleDeliveredDate: "",
      }),
    ]);

    render(<App />);
    await goTo(user, /达人数据库/);

    await user.click(screen.getByLabelText("选择 alpha_creator"));
    await user.click(screen.getByLabelText("选择 beta_creator"));
    expect(screen.getByText("已选择 2 位达人")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "批量复制邀约话术" }));
    expect(writeText).toHaveBeenCalledWith(
      expect.stringContaining("@alpha_creator"),
    );
    expect(writeText).toHaveBeenCalledWith(
      expect.stringContaining("@beta_creator"),
    );

    await user.selectOptions(
      within(
        screen
          .getByText("已选择 2 位达人")
          .closest(".sticky-action-bar") as HTMLElement,
      ).getByRole("combobox"),
      "Sample Approved",
    );
    await user.click(screen.getByRole("button", { name: "批量更新状态" }));

    await waitFor(() => {
      const saved = JSON.parse(
        window.localStorage.getItem(CREATOR_ROWS_STORAGE_KEY) ?? "[]",
      ) as CreatorRow[];
      expect(saved.map((row) => row.currentStatus)).toEqual([
        "Sample Approved",
        "Sample Approved",
      ]);
    });
    expect(screen.getByRole("status")).toHaveTextContent(
      "已更新 2 位达人状态为 样品已通过。",
    );
  });

  it("adds and deletes creators from the redesigned database page", async () => {
    const user = userEvent.setup();
    seedCreators([creatorRow({ id: "alpha", username: "alpha_creator" })]);

    render(<App />);
    await goTo(user, /达人数据库/);
    await user.click(screen.getByRole("button", { name: "新增达人" }));

    expect(screen.getAllByLabelText("达人名称")).toHaveLength(2);

    await user.click(screen.getAllByRole("button", { name: "删除达人" })[0]);
    await waitFor(() => {
      const saved = JSON.parse(
        window.localStorage.getItem(CREATOR_ROWS_STORAGE_KEY) ?? "[]",
      ) as CreatorRow[];
      expect(saved).toHaveLength(1);
    });
  });
});

describe("templates, follow-up, samples, review, and ads modules", () => {
  it("generates variable-based outreach templates and copies a scenario script", async () => {
    const user = userEvent.setup();
    const writeText = vi.fn(async (_text: string) => undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });

    render(<App />);
    await goTo(user, /沟通话术模板/);

    await user.type(screen.getByLabelText("达人名称"), "Bella Pets");
    await user.clear(screen.getByLabelText("产品名称"));
    await user.type(screen.getByLabelText("产品名称"), "Paw Cleaner");

    expect(screen.getByText("初次邀约")).toBeInTheDocument();
    expect(screen.getAllByText("英文话术").length).toBeGreaterThan(0);
    expect(screen.getAllByText("中文对照").length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Bella Pets/).length).toBeGreaterThan(0);
    expect(
      screen.getAllByRole("button", { name: "复制英文话术" }).length,
    ).toBeGreaterThan(0);

    await user.click(
      screen.getAllByRole("button", { name: "复制英文话术" })[0],
    );
    expect(writeText).toHaveBeenCalledWith(
      expect.stringContaining("Bella Pets"),
    );
    expect(String(writeText.mock.calls[0]?.[0] ?? "")).not.toMatch(
      /[\u3400-\u9fff]/,
    );
  });

  it("tracks sample logistics and shows automatic next-action hints", async () => {
    const user = userEvent.setup();
    seedCreators([
      creatorRow({
        id: "shipped",
        username: "shipped_creator",
        currentStatus: "Sample Shipped",
        sampleShippingStatus: "In Transit",
        sampleDeliveredDate: "",
        notes: "carrier: UPS\ntracking: 1Z999",
      }),
      creatorRow({
        id: "delivered",
        username: "delivered_creator",
        currentStatus: "Delivered",
        sampleShippingStatus: "Delivered",
        sampleDeliveredDate: "2026-05-20",
        videoProgress: "0 of 2",
      }),
    ]);

    render(<App />);
    await goTo(user, /样品追踪/);

    expect(screen.getByText("shipped_creator")).toBeInTheDocument();
    expect(screen.getByText("UPS")).toBeInTheDocument();
    expect(screen.getByText("1Z999")).toBeInTheDocument();
    expect(
      screen.getByText("已寄出但未签收：确认物流是否卡住。"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("已签收 5 天未发布：催发视频并确认拍摄计划。"),
    ).toBeInTheDocument();
  });

  it("generates follow-up copy and marks a message as sent", async () => {
    const user = userEvent.setup();
    const writeText = vi.fn(async () => undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    seedCreators([
      creatorRow({
        id: "follow",
        username: "follow_creator",
        sampleDeliveredDate: "2026-05-20",
        lastFollowUpCount: 1,
      }),
    ]);

    render(<App />);
    await goTo(user, /达人跟进中心/);
    await user.click(screen.getByRole("button", { name: "生成话术" }));

    expect(screen.getByText("场景 / 沟通动作")).toBeInTheDocument();
    expect(screen.getAllByText("英文话术").length).toBeGreaterThan(0);
    expect(screen.getByText("中文对照 / 中文解释")).toBeInTheDocument();
    expect(screen.getByText("发送后追踪")).toBeInTheDocument();
    expect(screen.getByText(/发送后请点击/)).toBeInTheDocument();
    expect(
      (screen.getByLabelText("英文话术") as HTMLTextAreaElement).value,
    ).not.toMatch(/[\u3400-\u9fff]/);

    await user.click(screen.getByRole("button", { name: "复制英文话术" }));
    expect(writeText).toHaveBeenCalledWith(
      expect.stringContaining("follow_creator"),
    );

    await user.click(screen.getByRole("button", { name: "标记为已发送" }));
    await waitFor(() => {
      const saved = JSON.parse(
        window.localStorage.getItem(CREATOR_ROWS_STORAGE_KEY) ?? "[]",
      )[0] as CreatorRow;
      expect(saved.trackingStatus).toBe("已发送待回复");
      expect(saved.lastFollowUpCount).toBe(2);
      expect(saved.followUpHistory?.[0]).toMatchObject({
        action: "Message Sent",
      });
    });
    expect(screen.getAllByText("已标记为已发送。").length).toBeGreaterThan(0);
  });

  it("records a creator reply from Follow-up Center", async () => {
    const user = userEvent.setup();
    vi.spyOn(window, "prompt").mockReturnValue("Creator can post Friday");
    seedCreators([creatorRow({ id: "reply", username: "reply_creator" })]);

    render(<App />);
    await goTo(user, /达人跟进中心/);
    await user.click(screen.getByRole("button", { name: "生成话术" }));
    await user.click(screen.getByRole("button", { name: "标记达人已回复" }));

    await waitFor(() => {
      const saved = JSON.parse(
        window.localStorage.getItem(CREATOR_ROWS_STORAGE_KEY) ?? "[]",
      )[0] as CreatorRow;
      expect(saved.currentStatus).toBe("Replied");
      expect(saved.lastCreatorResponse).toBe("Creator can post Friday");
      expect(saved.followUpHistory?.[0]).toMatchObject({
        action: "Creator Replied",
        note: "Creator can post Friday",
      });
    });
  });

  it("shows personalized reply processing fields and lets Chinese focus shape the generated reply", async () => {
    const user = userEvent.setup();
    seedCreators([
      creatorRow({
        id: "reply-focus",
        username: "focus_creator",
        trackingStatus: "达人回复待处理",
        currentStatus: "Replied",
        lastCreatorResponse: "No problem!",
        followUpHistory: [
          {
            date: "2026-06-10",
            action: "Creator Replied",
            note: "No problem!",
          },
        ],
      }),
    ]);

    render(<App />);
    await goTo(user, /达人跟进中心/);

    expect(
      screen.getByRole("heading", { name: "达人回复处理" }),
    ).toBeInTheDocument();
    await user.type(
      screen.getByLabelText("我想回复的重点"),
      "期待你拍的视频，有没有具体的时间让我团队安排投流计划",
    );
    await user.click(screen.getByRole("button", { name: "生成话术" }));

    const english = String(
      screen.getByLabelText("英文话术").getAttribute("value") ??
        (screen.getByLabelText("英文话术") as HTMLTextAreaElement).value,
    );
    expect(english).toContain("estimated posting date");
    expect(english).toMatch(/ad testing|boost timing|campaign planning/);
    expect(english).not.toMatch(/[㐀-鿿]/);
    expect(
      screen.getByText("中文对照 / 中文解释").nextElementSibling?.textContent ??
        "",
    ).toMatch(/[㐀-鿿]/);
  });

  it("shows DeepSeek optional reply buttons and helper text in creator reply handling", async () => {
    const user = userEvent.setup();
    seedCreators([
      creatorRow({
        id: "deepseek-ui",
        trackingStatus: "达人回复待处理",
        lastCreatorResponse: "Can I post Friday?",
      }),
    ]);

    render(<App />);
    await goTo(user, /达人跟进中心/);

    expect(
      screen.getByRole("button", { name: "DeepSeek 翻译达人回复" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "DeepSeek 生成英文回复" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "DeepSeek 翻译只做直译；英文回复会把你的中文重点准确转成 creator-facing English。",
      ),
    ).toBeInTheDocument();
  });

  it("clicking DeepSeek translate shows loading and then AI Chinese understanding", async () => {
    const user = userEvent.setup();
    let resolveFetch!: (response: Response) => void;
    const fetchMock = vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          resolveFetch = resolve;
        }),
    );
    vi.stubGlobal("fetch", fetchMock);
    seedCreators([
      creatorRow({
        id: "deepseek-translate",
        product: "Pet Fountain",
        trackingStatus: "达人回复待处理",
        lastCreatorResponse: "I can post Friday.",
      }),
    ]);

    render(<App />);
    await goTo(user, /达人跟进中心/);
    const originalReply = screen.getByLabelText(
      "达人回复原文",
    ) as HTMLTextAreaElement;
    await user.clear(originalReply);
    await user.type(originalReply, "Yes, I fell and sprained my ankle.");
    await user.click(
      screen.getByRole("button", { name: "DeepSeek 翻译达人回复" }),
    );

    expect(screen.getByRole("status")).toHaveTextContent("DeepSeek 生成中…");
    resolveFetch(
      new Response(
        JSON.stringify({
          chineseTranslation: "我可以周五发布。",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    await waitFor(() =>
      expect(screen.getByText("中文翻译")).toBeInTheDocument(),
    );
    expect(screen.getAllByText("我可以周五发布。").length).toBeGreaterThan(0);
    expect(screen.queryByText(/建议下一步/)).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/deepseek-reply",
      expect.objectContaining({ method: "POST" }),
    );
    const payload = JSON.parse(
      String(
        (fetchMock.mock.calls[0] as unknown[])[1] &&
          ((fetchMock.mock.calls[0] as unknown[])[1] as { body?: string }).body,
      ),
    );
    expect(payload).toMatchObject({
      action: "translate_creator_reply",
      channel: "TikTok DM",
      productName: "Pet Fountain",
      creatorReply: "Yes, I fell and sprained my ankle.",
    });
    expect(screen.getAllByText("中文翻译")).toHaveLength(1);
    expect(payload.campaignContext).toContain("Pet Fountain");
  });

  it("clicking DeepSeek generate fills English message and shows Chinese explanation", async () => {
    const user = userEvent.setup();
    let resolveFetch!: (response: Response) => void;
    const fetchMock = vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          resolveFetch = resolve;
        }),
    );
    vi.stubGlobal("fetch", fetchMock);
    seedCreators([
      creatorRow({
        id: "deepseek-generate",
        username: "deep_creator",
        product: "Pet Fountain",
        trackingStatus: "达人回复待处理",
        lastCreatorResponse:
          "I sprained my ankle but my daughter is editing today.",
      }),
    ]);

    render(<App />);
    await goTo(user, /达人跟进中心/);
    await user.clear(screen.getByLabelText("达人回复原文"));
    await user.type(
      screen.getByLabelText("达人回复原文"),
      "I cannot continue this content.",
    );
    await user.type(screen.getByLabelText("我想回复的重点"), "好的样品寄回来");
    await user.click(
      screen.getByRole("button", { name: "DeepSeek 生成英文回复" }),
    );

    expect(screen.getByRole("status")).toHaveTextContent("DeepSeek 生成中…");
    resolveFetch(
      new Response(
        JSON.stringify({
          englishMessage:
            "Hi @deep_creator, thank you for the update. Could you confirm the expected posting date so our team can plan the ad testing schedule?",
          chineseExplanation:
            "这条回复先表示理解，再确认发布时间，方便投流安排。",
          detectedIntent: "因个人情况延迟但仍会完成",
          recommendedTrackingStatus: "达人已回复，等待确认发布时间",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    await waitFor(() =>
      expect(
        (screen.getByLabelText("英文话术") as HTMLTextAreaElement).value,
      ).toContain("ad testing schedule"),
    );
    expect(
      (screen.getByLabelText("英文话术") as HTMLTextAreaElement).value,
    ).not.toMatch(/[㐀-鿿]/);
    expect(screen.getByText("中文解释")).toBeInTheDocument();
    expect(
      screen.getAllByText("这条回复先表示理解，再确认发布时间，方便投流安排。")
        .length,
    ).toBeGreaterThan(0);
    const payload = JSON.parse(
      String(
        (fetchMock.mock.calls[0] as unknown[])[1] &&
          ((fetchMock.mock.calls[0] as unknown[])[1] as { body?: string }).body,
      ),
    );
    expect(payload).toMatchObject({
      action: "generate_personalized_reply",
      channel: "TikTok DM",
      productName: "Pet Fountain",
      creatorReply: "I cannot continue this content.",
      userReplyFocus: "好的样品寄回来",
    });
    expect(payload.campaignContext).toContain("Pet Fountain");
  });

  it("DeepSeek API failure shows a clear error and keeps local fallback message", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              error: "未配置 DEEPSEEK_API_KEY，无法调用 DeepSeek。",
            }),
            { status: 500, headers: { "Content-Type": "application/json" } },
          ),
      ),
    );
    seedCreators([
      creatorRow({
        id: "deepseek-fail",
        username: "fail_creator",
        trackingStatus: "达人回复待处理",
        lastCreatorResponse: "No problem!",
      }),
    ]);

    render(<App />);
    await goTo(user, /达人跟进中心/);
    await user.click(screen.getByRole("button", { name: "生成话术" }));
    const localMessage = (
      screen.getByLabelText("英文话术") as HTMLTextAreaElement
    ).value;

    await user.click(
      screen.getByRole("button", { name: "DeepSeek 生成英文回复" }),
    );

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(
        "未配置 DEEPSEEK_API_KEY，无法调用 DeepSeek。",
      ),
    );
    expect(screen.getByLabelText("英文话术")).toHaveValue(localMessage);
  });

  it("marks a selected creator as sent from the standard template library", async () => {
    const user = userEvent.setup();
    seedCreators([
      creatorRow({
        id: "template-creator",
        username: "template_creator",
        product: "Cat Teaser Wand",
      }),
    ]);

    render(<App />);
    await goTo(user, /沟通话术模板/);
    await user.selectOptions(
      screen.getByLabelText("选择模板达人"),
      "template-creator",
    );
    await user.click(
      screen.getAllByRole("button", { name: "标记为已发送" })[0],
    );

    await waitFor(() => {
      const saved = JSON.parse(
        window.localStorage.getItem(CREATOR_ROWS_STORAGE_KEY) ?? "[]",
      )[0] as CreatorRow;
      expect(saved.trackingStatus).toBe("已发送待回复");
      expect(saved.lastFollowUpCount).toBe(1);
      expect(saved.lastMessageScenario).toBe("初次邀约");
      expect(saved.followUpHistory?.[0]).toMatchObject({
        action: "Message Sent",
        scenario: "初次邀约",
      });
    });
  });

  it("renders content review checklists and ads material tags", async () => {
    const user = userEvent.setup();
    seedCreators([
      creatorRow({
        id: "ads",
        username: "ads_creator",
        currentStatus: "Ready for Ads",
        videoProgress: "2 of 2",
        notes: "video url: https://tiktok.com/video/1\nhook: Before After",
      }),
    ]);

    render(<App />);
    await goTo(user, /内容审核/);
    expect(screen.getByText("是否 40s+")).toBeInTheDocument();
    expect(screen.getByText("是否可作为投流素材")).toBeInTheDocument();
    expect(screen.getByDisplayValue("审核通过")).toBeInTheDocument();

    await goTo(user, /投流素材库/);
    expect(screen.getByText("爪部清洁")).toBeInTheDocument();
    expect(screen.getByText("高 CTR 潜力")).toBeInTheDocument();
    expect(screen.getByText("https://tiktok.com/video/1")).toBeInTheDocument();
    expect(screen.getAllByText("Before After").length).toBeGreaterThan(0);
  });
});

describe("settings and prompt helper", () => {
  it("saves, displays, and restores optional reference links in Settings", async () => {
    const user = userEvent.setup();
    const { unmount } = render(<App />);
    await goTo(user, /设置/);

    expect(screen.queryByText("参考视频链接")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "编辑拍摄要求" }));
    await user.type(
      screen.getByLabelText("对标视频链接（可选，每行一个）"),
      " https://tiktok.com/reference-one \n\nhttps://shop.tiktok.com/reference-two ",
    );
    await user.click(screen.getByRole("button", { name: "保存拍摄要求" }));

    expect(screen.getByText("参考视频链接")).toBeInTheDocument();
    expect(
      screen.getByText("https://tiktok.com/reference-one"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("https://shop.tiktok.com/reference-two"),
    ).toBeInTheDocument();
    expect(
      JSON.parse(
        window.localStorage.getItem(FILMING_REQUIREMENTS_STORAGE_KEY) ?? "{}",
      ),
    ).toMatchObject({
      referenceLinks: [
        "https://tiktok.com/reference-one",
        "https://shop.tiktok.com/reference-two",
      ],
    });

    unmount();
    render(<App />);
    await goTo(user, /设置/);
    expect(
      screen.getByText("https://tiktok.com/reference-one"),
    ).toBeInTheDocument();
  });

  it("prefills saved reference links in the optional ChatGPT helper form", async () => {
    const user = userEvent.setup();
    window.localStorage.setItem(
      FILMING_REQUIREMENTS_STORAGE_KEY,
      JSON.stringify({
        productName: "蒸汽梳毛器",
        requirements: ["每位达人 2 条视频"],
        keyContentPoints: ["展示雾化功能"],
        referenceLinks: ["https://tiktok.com/prefill-reference"],
      }),
    );

    render(<App />);
    await goTo(user, /设置/);
    await user.click(screen.getByRole("button", { name: "展开辅助生成" }));

    expect(screen.getByLabelText("对标视频链接（可选，每行一个）")).toHaveValue(
      "https://tiktok.com/prefill-reference",
    );
  });

  it("generates and copies a local ChatGPT prompt without calling an API", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn();
    const writeText = vi.fn(async () => undefined);
    vi.stubGlobal("fetch", fetchMock);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });

    render(<App />);
    await goTo(user, /设置/);
    await user.click(screen.getByRole("button", { name: "展开辅助生成" }));
    await user.type(screen.getByLabelText("产品卖点"), "静音循环水");
    await user.click(screen.getByRole("button", { name: "生成可复制提示词" }));

    const prompt = screen.getByLabelText("ChatGPT 提示词");
    expect((prompt as HTMLTextAreaElement).value).toContain("静音循环水");
    expect(fetchMock).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "复制提示词" }));
    expect(writeText).toHaveBeenCalledWith(
      expect.stringContaining("静音循环水"),
    );
    expect(screen.getAllByText("已复制提示词。").length).toBeGreaterThan(0);
  });

  it("clears local creator data from Settings", async () => {
    const user = userEvent.setup();
    seedCreators([creatorRow({ id: "alpha", username: "alpha_creator" })]);

    render(<App />);
    await goTo(user, /设置/);
    await user.click(screen.getByRole("button", { name: "清空当前数据" }));

    await waitFor(() =>
      expect(window.localStorage.getItem(CREATOR_ROWS_STORAGE_KEY)).toBeNull(),
    );
    expect(screen.getByRole("status")).toHaveTextContent(
      "已清空本地达人数据。",
    );
  });
});
