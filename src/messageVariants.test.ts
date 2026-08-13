import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  defaultCreatorFilmingRequirements,
  generateMessage,
  type CreatorFilmingRequirements,
} from "./messageGenerator";
import {
  CREATOR_TIERS,
  getScriptVariants,
  resolveVariantIndex,
} from "./messageVariants";
import type { Task } from "./types";

const chineseCharacterPattern = /[㐀-鿿]/;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-06-05T12:00:00Z"));
});

afterEach(() => {
  vi.useRealTimers();
});

function task(overrides: Partial<Task> = {}): Task {
  return {
    id: "creator-1",
    username: "fluffy_creator",
    profileLink: "",
    contactMethod: "TikTok DM",
    product: "蒸汽梳毛器",
    currentStatus: "To Contact",
    sampleShippingStatus: "",
    sampleDeliveredDate: "",
    videoProgress: "0 of 2",
    firstVideoPostedDate: "",
    lastContactDate: "",
    lastFollowUpCount: 0,
    notes: "",
    priority: "Low",
    priorityRank: 4,
    stageRank: 0,
    triggerReason: "",
    suggestedAction: "",
    failedWarnings: [],
    needsFollowUp: true,
    ...overrides,
  };
}

function requirements(
  overrides: Partial<CreatorFilmingRequirements> = {},
): CreatorFilmingRequirements {
  return { ...defaultCreatorFilmingRequirements, ...overrides };
}

describe("resolveVariantIndex", () => {
  it("wraps around so the switcher can increment forever", () => {
    const count = getScriptVariants("First Outreach").length;

    expect(resolveVariantIndex("First Outreach", count)).toBe(0);
    expect(resolveVariantIndex("First Outreach", count + 1)).toBe(1);
    expect(resolveVariantIndex("First Outreach", -1)).toBe(count - 1);
  });

  it("returns 0 for scenarios with no variant table", () => {
    expect(resolveVariantIndex("Creator Reply Follow-up", 3)).toBe(0);
  });
});

describe("script variant coverage", () => {
  const scenariosThatNeedVariants = [
    "First Outreach",
    "Re-engagement Outreach",
    "No Reply Follow-up",
    "Sample Request Reminder",
    "Sample Request Confirmation",
    "Sample In Transit Reminder",
    "Logistics Exception Confirmation",
    "Sample Delivered Follow-up",
    "Partial Video Completion Follow-up",
    "Needs Revision Reminder",
    "Final Follow-up Before Failed Candidate",
    "Completed Thank You",
    "Failed Archive Confirmation",
    "Light Follow-up",
    "Address Confirmation",
  ];

  it("gives every outreach scenario more than one angle", () => {
    scenariosThatNeedVariants.forEach((scenario) => {
      expect(getScriptVariants(scenario).length).toBeGreaterThan(1);
    });
  });

  it("uses unique ids and non-empty Chinese labels", () => {
    const seen = new Set<string>();
    scenariosThatNeedVariants.forEach((scenario) => {
      getScriptVariants(scenario).forEach((variant) => {
        expect(seen.has(variant.id)).toBe(false);
        seen.add(variant.id);
        expect(variant.label.trim()).not.toBe("");
        expect(variant.angle.trim()).not.toBe("");
      });
    });
  });
});

describe("generateMessage variant switching", () => {
  it("defaults to the first angle and reports what is available", () => {
    const message = generateMessage(task(), "Email", requirements());

    expect(message.scenario).toBe("First Outreach");
    expect(message.variantIndex).toBe(0);
    expect(message.variants.length).toBeGreaterThan(1);
    expect(message.english).toContain(
      "We’re reaching out about a potential collaboration",
    );
  });

  it("produces genuinely different copy for each angle", () => {
    const bodies = getScriptVariants("First Outreach").map(
      (_, index) =>
        generateMessage(
          task(),
          "Email",
          requirements(),
          "",
          {},
          { variantIndex: index },
        ).english,
    );

    expect(new Set(bodies).size).toBe(bodies.length);
    bodies.forEach((body) => {
      expect(body).not.toMatch(chineseCharacterPattern);
      expect(body).toContain("steam grooming brush");
    });
  });

  it("wraps out-of-range indexes instead of falling back to the default", () => {
    const count = getScriptVariants("First Outreach").length;
    const wrapped = generateMessage(
      task(),
      "Email",
      requirements(),
      "",
      {},
      { variantIndex: count + 2 },
    );

    expect(wrapped.variantIndex).toBe(2);
  });

  it("names the chosen angle in the Chinese explanation", () => {
    const message = generateMessage(
      task(),
      "Email",
      requirements(),
      "",
      {},
      { variantIndex: 2 },
    );

    expect(message.chineseExplanation).toContain("当前话术角度：");
    expect(message.chineseExplanation).toContain(message.variants[2].label);
  });
});

describe("generated copy hygiene", () => {
  const channels = [
    "TikTok DM",
    "TikTok Shop Affiliate Message",
    "Email",
    "WhatsApp",
  ] as const;

  it("does not append a period after a question mark in TikTok DMs", () => {
    // The DM joiner used to add "." unconditionally, so a variant whose
    // request ends in a question produced "on our side?. For the remaining...".
    const partialTask = task({
      currentStatus: "Posted",
      sampleShippingStatus: "Delivered",
      sampleDeliveredDate: "2026-06-01",
      videoProgress: "1 of 2",
    });

    channels.forEach((channel) => {
      getScriptVariants("Partial Video Completion Follow-up").forEach(
        (_, variantIndex) => {
          const { english } = generateMessage(
            partialTask,
            channel,
            requirements(),
            "",
            {},
            { variantIndex },
          );

          expect(english).not.toMatch(/[?!]\./);
          expect(english).not.toMatch(/\.\./);
        },
      );
    });
  });

  it("never doubles the article when the product name has no translation", () => {
    // "the ${product}" plus a category noun that carried its own article used
    // to render "the the pet product".
    const unknownProduct = task({ product: "某款未收录的宠物新品" });

    channels.forEach((channel) => {
      getScriptVariants("First Outreach").forEach((_, variantIndex) => {
        const { english } = generateMessage(
          unknownProduct,
          channel,
          requirements(),
          "",
          {},
          { variantIndex },
        );

        expect(english).not.toMatch(/\bthe the\b/i);
        expect(english).not.toMatch(chineseCharacterPattern);
      });
    });
  });
});

describe("creator tier tone layer", () => {
  it("keeps cold outreach free of unearned familiarity", () => {
    const cold = generateMessage(
      task(),
      "Email",
      requirements(),
      "",
      {},
      { creatorTier: "冷启动" },
    );

    expect(cold.english).not.toContain("We’ve been following");
    expect(cold.english).toContain("No pressure either way");
  });

  it("opens differently for mid-tier, top-tier and returning creators", () => {
    const [mid, top, returning] = (
      ["腰部达人", "头部达人", "老合作达人"] as const
    ).map(
      (creatorTier) =>
        generateMessage(
          task(),
          "Email",
          requirements(),
          "",
          {},
          { creatorTier },
        ).english,
    );

    expect(mid).toContain("We’ve been enjoying your pet content");
    expect(top).toContain("We’ve been following your pet content");
    expect(top).toContain("happy to work around your schedule");
    expect(returning).toContain("great working with you on the last campaign");
  });

  it("leaves revision reminders neutral regardless of tier", () => {
    const revisionTask = task({
      currentStatus: "Needs Revision",
      sampleShippingStatus: "Delivered",
      sampleDeliveredDate: "2026-06-01",
    });
    const bodies = CREATOR_TIERS.map(
      (creatorTier) =>
        generateMessage(
          revisionTask,
          "Email",
          requirements(),
          "",
          {},
          { creatorTier },
        ).english,
    );

    expect(new Set(bodies).size).toBe(1);
  });

  it("does not let tone lines push the ask out of a TikTok DM", () => {
    const dm = generateMessage(
      task(),
      "TikTok DM",
      requirements(),
      "",
      {},
      { creatorTier: "头部达人" },
    );

    expect(dm.english).toContain("We’ve been following your pet content");
    expect(dm.english).toContain(
      "We’re reaching out about a potential collaboration",
    );
    expect(dm.english).toContain("happy to work around your schedule");
  });
});

describe("scenarios added for the outreach stage", () => {
  it("uses re-engagement copy for a creator in a later round", () => {
    const message = generateMessage(
      task({ round: 2 }),
      "Email",
      requirements(),
    );

    expect(message.scenario).toBe("Re-engagement Outreach");
    expect(message.communicationAction).toBe("老达人再建联");
    expect(message.english).toContain("new campaign round");
  });

  it("treats a finished past collaboration as a returning creator", () => {
    const message = generateMessage(
      task({
        followUpHistory: [{ date: "2026-01-02", action: "Completed" }],
      }),
      "Email",
      requirements(),
    );

    expect(message.scenario).toBe("Re-engagement Outreach");
  });

  it("asks for shipping details when the sample is blocked on an address", () => {
    const message = generateMessage(
      task({
        currentStatus: "Sample Requested",
        notes: "还没有拿到收货地址",
      }),
      "Email",
      requirements(),
    );

    expect(message.scenario).toBe("Address Confirmation");
    expect(message.communicationAction).toBe("确认收货信息");
    expect(message.english).toContain("shipping name, full address");
    expect(message.english).not.toMatch(chineseCharacterPattern);
  });
});

describe("creator reply intents for commercial questions", () => {
  function replyTask(reply: string): Task {
    return task({
      currentStatus: "Contacted",
      trackingStatus: "Replied",
      lastCreatorResponse: reply,
    });
  }

  it("answers a commission question with the actual terms", () => {
    const message = generateMessage(
      replyTask("Hey, is this paid? How much commission do I get?"),
      "Email",
      requirements(),
    );

    expect(message.scenario).toBe("Creator Reply Follow-up");
    expect(message.english).toContain("affiliate commission");
    expect(message.english).toContain("free of charge");
    expect(message.english).not.toContain("I’ll note this on our side");
  });

  it("declines a flat rate without closing the door", () => {
    const message = generateMessage(
      replyTask("My rate is $500 per post."),
      "Email",
      requirements(),
    );

    expect(message.english).toContain("rather than a flat posting fee");
    expect(message.english).toContain("campaigns that carry a budget");
    expect(message.english).not.toContain("Looking forward to seeing");
  });

  it("accepts a decline gracefully and stops pushing", () => {
    const message = generateMessage(
      replyTask("Thanks but not interested."),
      "Email",
      requirements(),
    );

    expect(message.english).toContain("won’t keep following up");
    expect(message.english).not.toContain("posting date");
  });

  it("offers to pause instead of following up when a creator is busy", () => {
    const message = generateMessage(
      replyTask("I'm too busy this month, traveling for work."),
      "Email",
      requirements(),
    );

    expect(message.english).toContain("checked back once things settle down");
  });

  it("handles a request for another unit", () => {
    const message = generateMessage(
      replyTask("Could you send one more in a different color?"),
      "Email",
      requirements(),
    );

    expect(message.english).toContain("which variant you need");
  });
});

describe("non-pet campaigns", () => {
  const beautyRequirements = requirements({
    categoryId: "beauty",
    productName: "卷发棒",
    requiredScenes: "展示造型过程；展示卷发效果；展示温度档位",
    sellingPoints: "",
    keyContentPoints: ["展示造型过程", "展示卷发效果"],
    avoidShots: "避免过度滤镜",
  });

  it("keeps the content clause instead of dropping untranslatable Chinese", () => {
    const message = generateMessage(
      task({
        product: "卷发棒",
        currentStatus: "Sample Delivered",
        sampleShippingStatus: "Delivered",
        sampleDeliveredDate: "2026-06-02",
      }),
      "Email",
      beautyRequirements,
    );

    expect(message.english).toContain("show the main product use case clearly");
    expect(message.english).toContain("the styling process");
    expect(message.english).toContain("the curl result");
    expect(message.english).not.toMatch(chineseCharacterPattern);
  });

  it("names the product in English rather than calling it 'the product'", () => {
    const message = generateMessage(
      task({ product: "卷发棒" }),
      "Email",
      beautyRequirements,
    );

    expect(message.english).toContain("curling wand");
  });

  it("sends the category warning when avoid-shots is Chinese", () => {
    const message = generateMessage(
      task({
        product: "卷发棒",
        currentStatus: "Sample Delivered",
        sampleShippingStatus: "Delivered",
        sampleDeliveredDate: "2026-06-02",
      }),
      "Email",
      beautyRequirements,
    );

    expect(message.english).toContain("avoid: heavy filters");
  });

  it("still produces a usable brief when the category is only inferred", () => {
    const message = generateMessage(
      task({
        product: "空气炸锅",
        currentStatus: "Sample Delivered",
        sampleShippingStatus: "Delivered",
        sampleDeliveredDate: "2026-06-02",
      }),
      "Email",
      requirements({
        categoryId: undefined,
        productName: "空气炸锅",
        requiredScenes: "展示烹饪过程；展示成品效果",
        keyContentPoints: ["展示烹饪过程", "展示成品效果"],
      }),
    );

    expect(message.english).toContain("air fryer");
    expect(message.english).toContain("the cooking process");
    expect(message.english).not.toMatch(chineseCharacterPattern);
  });
});
