import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  CREATOR_ROWS_STORAGE_KEY,
  clearSavedCreatorRows,
  loadCreatorRows,
  saveCreatorRows,
} from "./creatorData";
import {
  CAMPAIGNS_STORAGE_KEY,
  loadCampaigns,
  saveCampaigns,
} from "./campaignData";
import {
  demoCampaigns,
  demoCreatorRows,
  exitDemoModeUrl,
  isDemoMode,
} from "./demoMode";
import { analyzeCreators } from "./sopRules";
import type { CreatorRow } from "./types";

const REAL_ROW: CreatorRow = {
  id: "real-1",
  username: "real_creator",
  profileLink: "",
  contactMethod: "TikTok DM",
  storeId: "default-store",
  storeName: "默认店铺",
  product: "真实产品",
  currentStatus: "Delivered",
  sampleShippingStatus: "Delivered",
  sampleDeliveredDate: "2026-08-01",
  videoProgress: "0/2",
  firstVideoPostedDate: "",
  lastContactDate: "2026-08-02",
  lastFollowUpCount: 1,
  notes: "真实达人备注",
};

function enterDemoMode(search = "?demo=1") {
  window.history.replaceState({}, "", `/${search}`);
}

beforeEach(() => {
  window.localStorage.clear();
  window.history.replaceState({}, "", "/");
});

afterEach(() => {
  window.localStorage.clear();
  window.history.replaceState({}, "", "/");
});

describe("isDemoMode", () => {
  it("is off by default and on only for ?demo=1", () => {
    expect(isDemoMode()).toBe(false);

    enterDemoMode();
    expect(isDemoMode()).toBe(true);

    enterDemoMode("?demo=0");
    expect(isDemoMode()).toBe(false);

    enterDemoMode("?demo=true");
    expect(isDemoMode()).toBe(false);

    enterDemoMode("?other=1");
    expect(isDemoMode()).toBe(false);
  });

  it("drops only the demo param when building the exit url", () => {
    enterDemoMode("?demo=1&keep=yes");
    expect(exitDemoModeUrl()).toBe("/?keep=yes");

    enterDemoMode("?demo=1");
    expect(exitDemoModeUrl()).toBe("/");
  });
});

describe("demo seed data", () => {
  it("covers the follow-up ladder from Highest down to completed", () => {
    const tasks = analyzeCreators(demoCreatorRows(), new Date(), 2);
    const priorities = new Set(tasks.map((task) => task.priority));

    expect(priorities.has("Highest")).toBe(true);
    expect(priorities.has("High")).toBe(true);
    expect(priorities.has("Medium")).toBe(true);
    expect(tasks).toHaveLength(6);
  });

  it("marks every seeded creator as demo data", () => {
    for (const row of demoCreatorRows()) {
      expect(row.id.startsWith("demo-")).toBe(true);
      expect(row.username.startsWith("demo_")).toBe(true);
      expect(row.storeId).toBe("demo-store");
    }
  });
});

describe("demo mode storage isolation", () => {
  it("serves demo data instead of saved rows and campaigns", () => {
    saveCreatorRows([REAL_ROW]);
    saveCampaigns(
      demoCampaigns().map((c) => ({ ...c, productName: "真实产品" })),
    );

    enterDemoMode();

    const rows = loadCreatorRows();
    expect(rows.map((row) => row.id)).toEqual(
      demoCreatorRows().map((row) => row.id),
    );
    expect(rows.some((row) => row.username === "real_creator")).toBe(false);
    expect(loadCampaigns()[0].productName).not.toBe("真实产品");
  });

  it("never writes to real storage while demo mode is on", () => {
    saveCreatorRows([REAL_ROW]);
    const realSnapshot = window.localStorage.getItem(CREATOR_ROWS_STORAGE_KEY);

    enterDemoMode();
    saveCreatorRows([{ ...REAL_ROW, id: "demo-edit", username: "edited" }]);
    saveCampaigns([{ ...demoCampaigns()[0], productName: "演示中改的名字" }]);
    clearSavedCreatorRows();

    expect(window.localStorage.getItem(CREATOR_ROWS_STORAGE_KEY)).toBe(
      realSnapshot,
    );
    expect(window.localStorage.getItem(CAMPAIGNS_STORAGE_KEY)).toBeNull();
  });

  it("returns the untouched real data once demo mode is left", () => {
    saveCreatorRows([REAL_ROW]);

    enterDemoMode();
    saveCreatorRows([]);
    expect(loadCreatorRows()).toHaveLength(6);

    window.history.replaceState({}, "", "/");
    const restored = loadCreatorRows();
    expect(restored).toHaveLength(1);
    expect(restored[0].username).toBe("real_creator");
    expect(restored[0].notes).toBe("真实达人备注");
  });
});
