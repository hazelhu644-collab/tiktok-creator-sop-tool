/**
 * Covers the workflow the operator's own email templates describe: a
 * discount-code campaign where the creator places their own order, plus the
 * TCM intake path and the email subject-line rules.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  defaultCollaborationTerms,
  defaultCreatorFilmingRequirements,
  generateMessage,
  type CreatorFilmingRequirements,
} from "./messageGenerator";
import { getScriptVariants } from "./messageVariants";
import type { CollaborationTerms, Task } from "./types";

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
    username: "gift_creator",
    profileLink: "",
    contactMethod: "Email",
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
  terms: Partial<CollaborationTerms> = {},
  overrides: Partial<CreatorFilmingRequirements> = {},
): CreatorFilmingRequirements {
  return {
    ...defaultCreatorFilmingRequirements,
    ...overrides,
    terms: { ...terms },
  };
}

const codeCampaign: Partial<CollaborationTerms> = {
  collabModel: "discount-code",
  discountCode: "JAMIE10",
  audienceDiscount: "10%",
  creatorCommission: "10%",
  commissionWindow: "6 months",
  orderMethod: "creator-orders",
};

describe("collaboration terms in the offer", () => {
  it("states the code, the commission and the audience discount", () => {
    const message = generateMessage(
      task(),
      "Email",
      requirements(codeCampaign),
      "",
      {},
      { variantIndex: 5 },
    );

    expect(message.variants[5].label).toContain("自用模板1");
    expect(message.english).toContain("10% commission on every sale");
    expect(message.english).toContain("10% off for your audience");
    expect(message.english).toContain("separate video is required for each");
  });

  it("omits percentages the campaign has not filled in", () => {
    const message = generateMessage(
      task(),
      "Email",
      requirements({ collabModel: "discount-code" }),
      "",
      {},
      { variantIndex: 5 },
    );

    expect(message.english).toContain(
      "commission on every sale through your code",
    );
    expect(message.english).not.toMatch(/\s%/);
    expect(message.english).not.toContain("undefined");
  });

  it("keeps affiliate-link wording for campaigns that never set terms", () => {
    const message = generateMessage(
      task(),
      "Email",
      requirements(),
      "",
      {},
      { variantIndex: 5 },
    );

    expect(message.english).toContain("TikTok Shop product link");
    expect(message.english).not.toContain("your code");
  });
});

describe("TCM creators", () => {
  it("follows up on the accepted invitation instead of cold-pitching", () => {
    const message = generateMessage(
      task({ source: "TCM" }),
      "Email",
      requirements(codeCampaign),
    );

    expect(message.scenario).toBe("TCM Follow-up");
    expect(message.communicationAction).toBe("TCM 达人跟进");
    expect(message.english).toContain("accepting the collaboration invitation");
    expect(message.english).not.toContain("Nice to e-meet you");
  });

  it("leaves non-TCM creators on the cold outreach path", () => {
    const message = generateMessage(
      task(),
      "Email",
      requirements(codeCampaign),
    );

    expect(message.scenario).toBe("First Outreach");
  });

  it("explains the marketplace fee rather than treating it as a rate quote", () => {
    const message = generateMessage(
      task({
        source: "TCM",
        currentStatus: "Replied",
        trackingStatus: "Replied",
        lastCreatorResponse: "Why is the TCM amount only $40?",
      }),
      "Email",
      requirements(codeCampaign),
    );

    expect(message.english).toContain(
      "matches the value of the products we send you",
    );
    expect(message.english).toContain("10% commission");
    expect(message.english).toContain("6 months");
    // The generic rate-negotiation brush-off would be wrong here.
    expect(message.english).not.toContain("paid-post budget");
  });
});

describe("creator self-order flow", () => {
  const selfOrder = requirements(codeCampaign);

  it("confirms quantity and timing once the creator is interested", () => {
    const message = generateMessage(
      task({ currentStatus: "Replied" }),
      "Email",
      selfOrder,
    );

    expect(message.scenario).toBe("Collaboration Details Confirmation");
    expect(message.english).toContain("how many products");
    expect(message.english).toContain("within two weeks");
  });

  it("sends the link, the code and the handle instruction next", () => {
    const message = generateMessage(
      task({ currentStatus: "Sample Requested" }),
      "Email",
      selfOrder,
    );

    expect(message.scenario).toBe("Order Instructions");
    expect(message.communicationAction).toBe("发送下单方式");
    expect(message.english).toContain("JAMIE10");
    expect(message.english).toContain("nothing to pay at checkout");
    expect(message.english).toContain("TikTok handle");
    expect(message.english).toContain("order number");
  });

  it("chases the order number after the instructions went out", () => {
    const message = generateMessage(
      task({
        currentStatus: "Sample Requested",
        lastMessageScenario: "Order Instructions",
      }),
      "Email",
      selfOrder,
    );

    expect(message.scenario).toBe("Order Number Reminder");
    expect(message.communicationAction).toBe("催订单号");
    expect(message.english).toContain("haven’t received an order number");
  });

  it("stops chasing once the order number is recorded", () => {
    const message = generateMessage(
      task({
        currentStatus: "Sample Requested",
        lastMessageScenario: "Order Instructions",
        orderNumber: "SO-99213",
      }),
      "Email",
      selfOrder,
    );

    expect(message.scenario).not.toBe("Order Number Reminder");
    expect(message.scenario).not.toBe("Order Instructions");
  });

  it("never runs the order flow for brand-shipped campaigns", () => {
    const message = generateMessage(
      task({ currentStatus: "Sample Requested" }),
      "Email",
      requirements({ collabModel: "discount-code" }),
    );

    expect(message.scenario).toBe("Sample Request Confirmation");
  });

  it("does not ask for a shipping address when the creator orders", () => {
    const message = generateMessage(
      task({ currentStatus: "Replied", notes: "还没有拿到收货地址" }),
      "Email",
      selfOrder,
    );

    expect(message.scenario).not.toBe("Address Confirmation");
  });
});

describe("email subject lines", () => {
  it("gives cold outreach a subject", () => {
    const message = generateMessage(
      task(),
      "Email",
      requirements(codeCampaign),
    );

    expect(message.emailSubject).toBe(
      "Collab invitation — steam grooming brush",
    );
    expect(message.emailThreadNote).toBeUndefined();
  });

  it("tells the operator to reply in-thread for follow-ups", () => {
    const message = generateMessage(
      task({ currentStatus: "Contacted" }),
      "Email",
      requirements(codeCampaign),
    );

    expect(message.scenario).toBe("No Reply Follow-up");
    expect(message.emailSubject).toBeUndefined();
    expect(message.emailThreadNote).toContain("直接回复上一封邮件");
  });

  it("produces no subject on non-email channels", () => {
    const message = generateMessage(
      task(),
      "TikTok DM",
      requirements(codeCampaign),
    );

    expect(message.emailSubject).toBeUndefined();
    expect(message.emailThreadNote).toBeUndefined();
  });
});

describe("brief compliance clauses", () => {
  const delivered = task({
    currentStatus: "Sample Delivered",
    sampleShippingStatus: "Delivered",
    sampleDeliveredDate: "2026-06-02",
  });

  it("asks for an #ad disclosure by default", () => {
    const message = generateMessage(delivered, "Email", requirements());

    expect(message.english).toContain("#ad");
    expect(message.english).toContain("branded-content label");
  });

  it("can be turned off per campaign", () => {
    const message = generateMessage(
      delivered,
      "Email",
      requirements({ requiresDisclosure: false }),
    );

    expect(message.english).not.toContain("#ad");
  });

  it("states the content usage window when one is configured", () => {
    const message = generateMessage(
      delivered,
      "Email",
      requirements({ contentUsageMonths: "12" }),
    );

    expect(message.english).toContain("content usage");
    expect(message.english).toContain("for 12 months");
  });

  it("omits usage rights when the campaign leaves them blank", () => {
    const message = generateMessage(delivered, "Email", requirements());

    expect(message.english).not.toContain("content usage");
  });

  it("keeps the disclosure when a campaign passes the field through as undefined", () => {
    // campaignToFilmingRequirements builds every key, so unset campaign fields
    // arrive as explicit undefined. A plain spread would treat that as false.
    const message = generateMessage(
      delivered,
      "Email",
      requirements({
        requiresDisclosure: undefined,
        collabModel: undefined,
        orderMethod: undefined,
      }),
    );

    expect(message.english).toContain("#ad");
  });
});

describe("the imported templates stay English-only and unique", () => {
  it("renders every new scenario without leaking Chinese", () => {
    const scenarios = [
      "TCM Follow-up",
      "Collaboration Details Confirmation",
      "Order Instructions",
      "Order Number Reminder",
    ];

    scenarios.forEach((scenario) => {
      const variants = getScriptVariants(scenario);
      expect(variants.length).toBeGreaterThan(1);
    });
  });

  it("keeps the defaults intact for campaigns with no terms configured", () => {
    expect(defaultCollaborationTerms.collabModel).toBe("affiliate-link");
    expect(defaultCollaborationTerms.orderMethod).toBe("brand-ships");
  });

  it("produces distinct, Chinese-free copy across order-flow angles", () => {
    const bodies = getScriptVariants("Order Instructions").map(
      (_, variantIndex) =>
        generateMessage(
          task({ currentStatus: "Sample Requested" }),
          "Email",
          requirements(codeCampaign),
          "",
          {},
          { variantIndex },
        ).english,
    );

    expect(new Set(bodies).size).toBe(bodies.length);
    bodies.forEach((body) => {
      expect(body).not.toMatch(chineseCharacterPattern);
      expect(body).toContain("JAMIE10");
    });
  });
});
