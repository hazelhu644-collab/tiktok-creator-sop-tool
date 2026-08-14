import { describe, expect, it } from "vitest";
import {
  FIRST_ROUND,
  campaignIdFromName,
  campaignIdentity,
  campaignToFilmingRequirements,
  createCampaignFromName,
  currentRoundOf,
  detectCampaignNames,
  mergeDetectedCampaigns,
  normalizeStoreId,
  productIdForCampaign,
  roundOf,
  rowMatchesCampaignIdentity,
  rowsInRound,
} from "./campaignData";
import { defaultCreatorFilmingRequirements } from "./messageGenerator";
import type { CreatorRow } from "./types";

function row(
  product: string,
  storeName = "默认店铺",
  storeId = "default-store",
): CreatorRow {
  return {
    id: product || "missing",
    username: `creator-${product}`,
    profileLink: "",
    contactMethod: "TikTok DM",
    storeId,
    storeName,
    campaignId: campaignIdFromName(product),
    productId: productIdForCampaign(storeId, campaignIdFromName(product)),
    product,
    currentStatus: "Delivered",
    sampleShippingStatus: "Delivered",
    sampleDeliveredDate: "2026-06-01",
    videoProgress: "0 of 2",
    firstVideoPostedDate: "",
    lastContactDate: "",
    lastFollowUpCount: 0,
    notes: "",
    trackingStatus: "",
    lastMessageScenario: "",
    lastMessageChannel: "",
    lastMessageSentAt: "",
    nextFollowUpDate: "",
    lastCreatorResponse: "",
    followUpHistory: [],
  };
}

describe("campaign data helpers", () => {
  it("detects unique product campaigns from uploaded creator rows", () => {
    expect(
      detectCampaignNames([
        row("宠物蒸汽梳毛器"),
        row("逗猫棒"),
        row("宠物蒸汽梳毛器"),
        row(""),
      ]).map((item) => item.productName),
    ).toEqual(["宠物蒸汽梳毛器", "逗猫棒"]);
  });

  it("merges detected products into campaign objects with product-specific presets", () => {
    const campaigns = mergeDetectedCampaigns(
      [],
      [row("宠物蒸汽梳毛器"), row("逗猫棒"), row("宠物清洁手套")],
      defaultCreatorFilmingRequirements,
    );

    expect(campaigns.map((campaign) => campaign.productName)).toEqual([
      "宠物蒸汽梳毛器",
      "逗猫棒",
      "宠物清洁手套",
    ]);
    expect(
      campaigns.find((campaign) => campaign.productName === "逗猫棒")
        ?.keyContentPoints,
    ).toContain("展示猫咪真实互动");
    expect(
      campaigns.find((campaign) => campaign.productName === "宠物清洁手套")
        ?.requirements,
    ).toContain("每条视频 40 秒以上");
  });

  it("scopes same product names by store when merging detected campaigns", () => {
    const campaigns = mergeDetectedCampaigns(
      [],
      [
        row("Pet Dental Wipes", "TerraPaw", "terrapaw"),
        row("Pet Dental Wipes", "PinePaw", "pinepaw"),
      ],
      defaultCreatorFilmingRequirements,
    );

    expect(campaigns).toHaveLength(2);
    expect(
      campaigns
        .map((campaign) => campaignIdentity(campaign.storeId!, campaign.id))
        .sort(),
    ).toEqual(["pinepaw::pet-dental-wipes", "terrapaw::pet-dental-wipes"]);
    expect(new Set(campaigns.map((campaign) => campaign.productId)).size).toBe(
      2,
    );
    expect(campaigns.every((campaign) => Boolean(campaign.productId))).toBe(
      true,
    );
  });

  it("uses stable ids instead of a matching product name when a row has explicit identity", () => {
    const campaign = {
      ...createCampaignFromName(
        "Pet Brush",
        defaultCreatorFilmingRequirements,
        "TerraPaw",
        "terrapaw",
      ),
      id: "campaign-a",
      productId: "product-a",
    };
    const otherCampaignRow = {
      ...row("Pet Brush", "TerraPaw", "terrapaw"),
      campaignId: "campaign-b",
      productId: "product-b",
    };

    expect(rowMatchesCampaignIdentity(otherCampaignRow, campaign)).toBe(false);
  });

  it("converts a campaign into isolated filming requirements for message generation", () => {
    const campaign = createCampaignFromName(
      "逗猫棒",
      defaultCreatorFilmingRequirements,
    );
    const requirements = campaignToFilmingRequirements(
      { ...campaign, referenceLinks: ["https://example.com/cat"] },
      defaultCreatorFilmingRequirements,
    );

    expect(requirements.productName).toBe("逗猫棒");
    expect(requirements.keyContentPoints).toContain("展示逗猫棒弹性");
    expect(requirements.referenceLinks).toEqual(["https://example.com/cat"]);
  });
  it("keeps the eight campaign filming fields independent per product", () => {
    const petBrush = createCampaignFromName(
      "Pet Brush",
      defaultCreatorFilmingRequirements,
    );
    const catWand = createCampaignFromName(
      "Cat Wand",
      defaultCreatorFilmingRequirements,
    );
    petBrush.keyContentPoints = ["show brushing scene"];
    petBrush.sellingPoints = "removes loose fur";
    petBrush.videoLength = "45 seconds+";
    petBrush.videoCount = "2 videos";
    petBrush.avoidShots = "do not show unsafe use";
    petBrush.tagRequirement = "attach product link";
    petBrush.referenceLinks = ["https://example.com/brush"];
    catWand.keyContentPoints = ["show cat jumping"];
    catWand.sellingPoints = "interactive play";
    catWand.videoLength = "30 seconds+";
    catWand.videoCount = "1 video";
    catWand.avoidShots = "do not force the cat";
    catWand.tagRequirement = "attach wand product link";
    catWand.referenceLinks = ["https://example.com/wand"];

    const brushRequirements = campaignToFilmingRequirements(
      petBrush,
      defaultCreatorFilmingRequirements,
    );
    const wandRequirements = campaignToFilmingRequirements(
      catWand,
      defaultCreatorFilmingRequirements,
    );

    expect(brushRequirements).toMatchObject({
      productName: "Pet Brush",
      requiredScenes: "show brushing scene",
      sellingPoints: "removes loose fur",
      videoLength: "45 seconds+",
      videoCount: "2 videos",
      avoidShots: "do not show unsafe use",
      productLinkRequirement: "attach product link",
      referenceVideoLinks: "https://example.com/brush",
    });
    expect(wandRequirements.requiredScenes).toBe("show cat jumping");
    expect(wandRequirements.productLinkRequirement).toBe(
      "attach wand product link",
    );
    expect(wandRequirements.requiredScenes).not.toBe(
      brushRequirements.requiredScenes,
    );
  });
});

describe("outreach rounds", () => {
  const campaign = createCampaignFromName("Pet Brush", undefined, "TerraPaw");

  function row(patch: Partial<CreatorRow> & { id: string }): CreatorRow {
    return {
      username: patch.id,
      profileLink: "",
      contactMethod: "",
      storeId: normalizeStoreId(campaign.storeId, campaign.storeName),
      storeName: campaign.storeName,
      campaignId: campaign.id,
      productId: campaign.productId,
      product: campaign.productName,
      currentStatus: "",
      sampleShippingStatus: "",
      sampleDeliveredDate: "",
      videoProgress: "0/2",
      firstVideoPostedDate: "",
      lastContactDate: "",
      lastFollowUpCount: 0,
      notes: "",
      ...patch,
    };
  }

  it("treats data saved before rounds existed as round 1", () => {
    expect(roundOf(undefined)).toBe(FIRST_ROUND);
    expect(roundOf({})).toBe(FIRST_ROUND);
    expect(currentRoundOf(undefined)).toBe(FIRST_ROUND);
    expect(currentRoundOf(campaign)).toBe(FIRST_ROUND);
  });

  it("ignores round numbers that are not usable", () => {
    expect(roundOf({ round: 0 })).toBe(FIRST_ROUND);
    expect(roundOf({ round: -3 })).toBe(FIRST_ROUND);
    expect(roundOf({ round: 2.5 })).toBe(FIRST_ROUND);
    expect(roundOf({ round: 4 })).toBe(4);
  });

  it("selects the rows of one round, archived or not", () => {
    const rows = [
      row({ id: "a" }),
      row({ id: "b", round: 1 }),
      row({ id: "c", round: 2 }),
      row({ id: "d", round: 2, archivedAt: "2026-08-05" }),
    ];

    expect(rowsInRound(rows, campaign, 1).map((r) => r.id)).toEqual(["a", "b"]);
    expect(rowsInRound(rows, campaign, 2).map((r) => r.id)).toEqual(["c", "d"]);
  });
});

describe("createCampaignFromName category defaults", () => {
  it("starts a detected non-pet campaign from its own category preset", () => {
    // The app-wide fallback is the pet configuration. Preferring it meant a
    // kitchen product opened with the pet preset's 60-second requirement.
    const campaign = createCampaignFromName("空气炸锅");

    expect(campaign.categoryId).toBe("kitchen");
    expect(campaign.videoLength).toBe("每条视频 45 秒以上");
    expect(campaign.requirements).toContain("每条视频 45 秒以上");
    expect(campaign.requirements).not.toContain("每条视频 60 秒以上");
    expect(campaign.keyContentPoints).toContain("展示烹饪过程");
  });

  it("still honours a named product preset over the category", () => {
    const campaign = createCampaignFromName("宠物蒸汽梳毛器");

    expect(campaign.categoryId).toBe("pet");
    expect(campaign.videoLength).toBe("每条视频 60 秒以上");
    expect(campaign.keyContentPoints).toContain("展示开雾");
  });

  it("prefers a fallback the operator actually customised", () => {
    const campaign = createCampaignFromName("空气炸锅", {
      ...defaultCreatorFilmingRequirements,
      videoLength: "每条视频 90 秒以上",
    });

    expect(campaign.videoLength).toBe("每条视频 90 秒以上");
  });
});
