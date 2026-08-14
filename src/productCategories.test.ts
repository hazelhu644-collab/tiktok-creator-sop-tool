import { describe, expect, it } from "vitest";
import {
  PRODUCT_CATEGORIES,
  detectProductCategory,
  getProductCategory,
  translateContentPointsDetailed,
  translateAvoidShots,
  translateContentPoint,
  translateContentPoints,
  translateProductName,
} from "./productCategories";

const chineseCharacterPattern = /[㐀-鿿]/;

describe("detectProductCategory", () => {
  it("picks the category whose keywords the text actually mentions", () => {
    expect(detectProductCategory("蒸汽梳毛器")).toBe("pet");
    expect(detectProductCategory("卷发棒", "造型过程")).toBe("beauty");
    expect(detectProductCategory("空气炸锅")).toBe("kitchen");
    expect(detectProductCategory("蓝牙耳机")).toBe("electronics");
  });

  it("falls back to the general preset when nothing matches", () => {
    expect(detectProductCategory("desk organizer tray")).toBe("general");
    expect(detectProductCategory("")).toBe("general");
    expect(detectProductCategory(undefined)).toBe("general");
  });

  it("lets the product name outweigh stale wording in the other fields", () => {
    // A campaign duplicated from a pet product keeps pet selling points until
    // someone edits them; the name is the reliable signal.
    expect(
      detectProductCategory(
        "空气炸锅",
        "蒸汽软化浮毛，梳毛同时收集毛发，适合日常宠物护理场景。",
      ),
    ).toBe("kitchen");
  });

  it("matches English keywords on word boundaries, not substrings", () => {
    // "cat" inside "application" and "dog" inside "dogma" used to score pet.
    expect(detectProductCategory("application dogma duplicate")).toBe(
      "general",
    );
    expect(detectProductCategory("cat toy")).toBe("pet");
  });
});

describe("translateContentPoint", () => {
  it("translates category phrases through the category lexicon", () => {
    expect(translateContentPoint("展示雾化功能", "pet")).toBe(
      "show the mist feature",
    );
    expect(translateContentPoint("展示上妆效果", "beauty")).toBe(
      "show the makeup application",
    );
    expect(translateContentPoint("展示烹饪过程", "kitchen")).toBe(
      "show the cooking process",
    );
  });

  it("translates shared phrases for any category", () => {
    expect(translateContentPoint("展示开箱", "electronics")).toBe(
      "show the unboxing",
    );
    expect(translateContentPoint("展示使用前后对比", "home")).toBe(
      "show a before-and-after comparison",
    );
  });

  it("maps the leading verb rather than requiring an exact phrase match", () => {
    expect(translateContentPoint("强调性价比", "general")).toBe(
      "highlight the value for money",
    );
    expect(translateContentPoint("演示使用方法", "general")).toBe(
      "demonstrate how to use it",
    );
  });

  it("joins compound phrases", () => {
    expect(translateContentPoint("展示材质和做工", "general")).toBe(
      "show the material quality and the build quality",
    );
  });

  it("passes English through untouched and returns nothing for unknown Chinese", () => {
    expect(translateContentPoint("show the loose hair", "pet")).toBe(
      "show the loose hair",
    );
    expect(translateContentPoint("完全无法识别的自定义描述", "general")).toBe(
      "",
    );
  });
});

describe("translateContentPoints", () => {
  it("keeps the points it can translate", () => {
    expect(translateContentPoints(["展示质地", "展示试色"], "beauty")).toEqual([
      "show the texture",
      "show a swatch test",
    ]);
  });

  it("falls back to the category defaults instead of returning nothing", () => {
    // The bug this guards: an untranslatable Chinese brief used to leave the
    // English message with no content guidance at all.
    const result = translateContentPoints(
      ["内容重点：完全自定义的中文描述"],
      "kitchen",
    );

    expect(result.length).toBeGreaterThan(0);
    expect(result).toEqual(getProductCategory("kitchen").fallbackContentPoints);
    result.forEach((point) =>
      expect(point).not.toMatch(chineseCharacterPattern),
    );
  });

  it("never returns Chinese for any category preset", () => {
    (
      [
        "pet",
        "beauty",
        "home",
        "kitchen",
        "apparel",
        "electronics",
        "baby",
        "food",
        "fitness",
        "general",
      ] as const
    ).forEach((categoryId) => {
      const category = getProductCategory(categoryId);
      translateContentPoints(
        category.defaultKeyContentPoints,
        categoryId,
      ).forEach((point) => {
        expect(point).not.toMatch(chineseCharacterPattern);
        expect(point.trim()).not.toBe("");
      });
    });
  });
});

describe("translateProductName", () => {
  it("uses the known product name when there is one", () => {
    expect(translateProductName("蒸汽梳毛器", "pet")).toBe(
      "steam grooming brush",
    );
    expect(translateProductName("空气炸锅", "kitchen")).toBe("air fryer");
  });

  it("falls back to the category noun rather than a flat 'product'", () => {
    expect(translateProductName("某款未知美妆产品", "beauty")).toBe(
      "beauty product",
    );
    expect(translateProductName("某款未知数码产品", "electronics")).toBe(
      "device",
    );
  });

  it("returns article-free nouns so templates can supply 'the'", () => {
    // Guards the "the the pet product" phrasing bug.
    PRODUCT_CATEGORIES.forEach((category) => {
      expect(category.englishNoun).not.toMatch(/^(?:the|a|an)\s/i);
    });
  });

  it("passes an English name through", () => {
    expect(translateProductName("Steam Brush Pro", "pet")).toBe(
      "Steam Brush Pro",
    );
  });
});

describe("translateAvoidShots", () => {
  it("sends the category warning when the configured text is Chinese", () => {
    const result = translateAvoidShots("避免宠物出现明显抗拒的画面", "pet");

    expect(result).not.toMatch(chineseCharacterPattern);
    expect(result).toContain("distressed");
  });

  it("keeps English text and stays empty when nothing is configured", () => {
    expect(translateAvoidShots("avoid studio lighting", "home")).toBe(
      "avoid studio lighting",
    );
    expect(translateAvoidShots("", "home")).toBe("");
  });
});

describe("translateContentPointsDetailed", () => {
  it("reports which points had no translation", () => {
    const result = translateContentPointsDetailed(
      ["展示开箱", "必须展示儿童防夹手设计"],
      "general",
    );

    expect(result.untranslated).toEqual(["必须展示儿童防夹手设计"]);
  });

  it("tops up the gap when only some points translate", () => {
    // The dangerous case: one good point used to make the untranslatable ones
    // vanish with no trace, so a safety shot never reached the creator.
    const result = translateContentPointsDetailed(
      ["展示开箱", "必须展示儿童防夹手设计"],
      "baby",
    );

    expect(result.points).toContain("show the unboxing");
    expect(result.points.length).toBeGreaterThan(1);
    result.points.forEach((point) =>
      expect(point).not.toMatch(chineseCharacterPattern),
    );
  });

  it("does not pad a brief that translated cleanly", () => {
    const result = translateContentPointsDetailed(
      ["展示开箱", "展示使用过程"],
      "general",
    );

    expect(result.untranslated).toEqual([]);
    expect(result.points).toEqual([
      "show the unboxing",
      "show the product in use",
    ]);
  });
});
