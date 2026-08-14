/**
 * Product category presets and the Chinese -> English lexicon used to turn a
 * campaign's Chinese filming configuration into creator-facing English.
 *
 * Before this module the generator only knew a handful of pet phrases, so a
 * beauty or kitchen campaign silently lost its "必须展示内容" when the English
 * message was built. Everything here exists so that any category produces a
 * usable brief: a category preset supplies sensible defaults, the lexicon
 * translates the common phrasing operators actually type, and the fallbacks
 * guarantee the content clause is never dropped entirely.
 */

export type ProductCategoryId =
  | "pet"
  | "beauty"
  | "home"
  | "kitchen"
  | "apparel"
  | "electronics"
  | "baby"
  | "food"
  | "fitness"
  | "general";

export type ProductCategory = {
  id: ProductCategoryId;
  /** Chinese label shown in the campaign settings picker. */
  label: string;
  /** Chinese and English keywords used to auto-detect the category. */
  keywords: string[];
  /**
   * Generic English noun used when the product name cannot be translated.
   * Article-free: every template already supplies "the", so including one here
   * produces "the the pet product".
   */
  englishNoun: string;
  /** Short English phrase describing where the product is used. */
  useCasePhrase: string;
  /** Category-specific hook used by first-outreach script variants. */
  outreachHook: string;
  defaultSellingPoints: string;
  defaultKeyContentPoints: string[];
  defaultAvoidShots: string;
  defaultVideoLength: string;
  defaultVideoCount: string;
  /**
   * English content points used when none of the configured Chinese points can
   * be translated. Keeps the brief from collapsing to nothing.
   */
  fallbackContentPoints: string[];
  /** Category-specific Chinese -> English phrases, checked before the shared lexicon. */
  lexicon: Record<string, string>;
};

/**
 * Phrases every category shares. Kept separate from the per-category lexicons
 * so a new category only has to describe what makes it different.
 */
const SHARED_LEXICON: Record<string, string> = {
  开箱: "the unboxing",
  开箱过程: "the unboxing",
  拆箱: "the unboxing",
  使用过程: "the product in use",
  真实使用场景: "a real everyday use case",
  日常使用场景: "an everyday use case",
  真实日常场景: "a natural everyday moment",
  前后对比: "a clear before-and-after",
  使用前后对比: "a before-and-after comparison",
  效果: "the results",
  真实效果: "the real results",
  产品细节: "the product details",
  细节特写: "a close-up of the details",
  产品外观: "the product design",
  材质: "the material quality",
  做工: "the build quality",
  尺寸: "the size",
  包装: "the packaging",
  清洁过程: "the cleaning process",
  收纳: "how it stores away",
  安装过程: "the setup process",
  安装步骤: "the setup steps",
  操作步骤: "the steps to use it",
  使用方法: "how to use it",
  充电: "charging it",
  电池续航: "the battery life",
  静音效果: "how quiet it is",
  便携性: "how portable it is",
  性价比: "the value for money",
  价格: "the price",
  优惠: "the current discount",
  个人真实评价: "your honest opinion",
  真实评价: "your honest opinion",
  真实反应: "the real reaction",
  使用感受: "how it feels to use",
  对比同类产品: "a comparison with similar products",
  多种用法: "different ways to use it",
  适用人群: "who it is for",
  购买链接: "where to buy it",
  结尾引导购买: "a clear call to action at the end",
  出镜讲解: "you talking to camera",
  口播: "a short talking-head intro",
  字幕: "on-screen text",
  痛点: "the problem it solves",
  解决痛点: "the problem it solves",
  使用场景: "the use case",
};

/** Nouns the pattern translator can slot into "show ..." style phrases. */
const SHARED_NOUNS: Record<string, string> = {
  产品: "the product",
  效果: "the results",
  过程: "the process",
  细节: "the details",
  质感: "the quality feel",
  外观: "the design",
  包装: "the packaging",
  尺寸: "the size",
  颜色: "the color",
  用法: "how it is used",
  对比: "the comparison",
  场景: "the setting",
  反应: "the reaction",
};

export const PRODUCT_CATEGORIES: ProductCategory[] = [
  {
    id: "pet",
    label: "宠物用品",
    keywords: [
      "宠物",
      "猫",
      "狗",
      "毛",
      "梳",
      "猫砂",
      "逗猫",
      "牵引",
      "pet",
      "cat",
      "dog",
      "grooming",
      "litter",
    ],
    englishNoun: "pet product",
    useCasePhrase: "your daily pet-care routine",
    outreachHook: "your pet content",
    defaultSellingPoints: "日常宠物护理场景自然，效果直观，适合真实出镜。",
    defaultKeyContentPoints: [
      "展示产品使用过程",
      "展示宠物真实反应",
      "展示自然的日常宠物护理场景",
      "展示使用前后对比",
    ],
    defaultAvoidShots:
      "避免宠物出现明显抗拒或不适的画面；避免纯摆拍无宠物出镜。",
    defaultVideoLength: "每条视频 60 秒以上",
    defaultVideoCount: "每位达人 2 条视频",
    fallbackContentPoints: [
      "show the product in real use with your pet",
      "show your pet’s real reaction",
      "show a natural daily pet-care scene",
    ],
    lexicon: {
      雾化功能: "the mist feature",
      展示雾化功能: "show the mist feature",
      开雾: "the steam mist turning on",
      浮毛: "the loose hair",
      梳下来的浮毛: "the loose hair removed",
      展示梳下来的浮毛: "show the loose hair removed",
      梳毛过程: "the grooming process",
      收集毛发: "how the brush collects the hair",
      宠物真实反应: "your pet’s real reaction",
      展示宠物真实反应: "show your pet’s real reaction",
      自然的日常宠物护理场景: "a natural daily pet-care scene",
      展示自然的日常宠物护理场景: "show a natural daily pet-care scene",
      真实宠物护理场景: "a real pet-care moment",
      展示清理过程: "show the cleanup process",
      清理过程: "the cleanup process",
      猫咪真实互动: "your cat playing with it",
      逗猫棒弹性: "how springy the wand is",
      展示逗猫棒很好玩: "show that the cat teaser is fun to use",
      铃铛细节: "the bell detail",
      "羽毛/尾巴细节": "the feather and tail detail",
      羽毛细节: "the feather detail",
      清洁前后对比: "the before-and-after of the coat",
      手套使用方式: "how the glove is worn and used",
      宠物饮水: "your pet drinking from it",
      出水量: "the water flow",
      换滤芯: "changing the filter",
      猫砂: "the litter",
      除臭效果: "the odor control",
      狗狗: "your dog",
      猫咪: "your cat",
      宠物: "your pet",
    },
  },
  {
    id: "beauty",
    label: "美妆个护",
    keywords: [
      "美妆",
      "彩妆",
      "护肤",
      "面膜",
      "口红",
      "粉底",
      "精华",
      "洗发",
      "卷发",
      "直发",
      "个护",
      "beauty",
      "makeup",
      "skincare",
      "serum",
      "hair",
    ],
    englishNoun: "beauty product",
    useCasePhrase: "your daily routine",
    outreachHook: "your beauty content",
    defaultSellingPoints: "上手效果直观，适合真实出镜展示使用前后差别。",
    defaultKeyContentPoints: [
      "展示涂抹过程",
      "展示质地",
      "展示使用前后对比",
      "展示真实使用感受",
    ],
    defaultAvoidShots:
      "避免过度滤镜或美颜掩盖真实效果；避免宣称医疗或治疗功效。",
    defaultVideoLength: "每条视频 45 秒以上",
    defaultVideoCount: "每位达人 2 条视频",
    fallbackContentPoints: [
      "show the product being applied",
      "show a clear before-and-after",
      "share your honest opinion on the result",
    ],
    lexicon: {
      上妆效果: "the makeup application",
      妆前妆后对比: "a before-and-after of the makeup",
      质地: "the texture",
      上脸质地: "how the texture feels on skin",
      涂抹过程: "applying the product",
      显色度: "the color payoff",
      持妆效果: "how well it lasts through the day",
      遮瑕效果: "the coverage",
      卸妆过程: "removing it",
      肤感: "how it feels on the skin",
      吸收速度: "how fast it absorbs",
      护肤步骤: "your skincare routine",
      使用前后皮肤状态: "your skin before and after",
      试色: "a swatch test",
      香味: "the scent",
      头发效果: "how the hair looks after",
      卷发效果: "the curl result",
      造型过程: "the styling process",
      温度档位: "the heat settings",
      真实使用感受: "how it actually feels to use",
    },
  },
  {
    id: "home",
    label: "家居家装",
    keywords: [
      "家居",
      "收纳",
      "清洁",
      "拖把",
      "吸尘",
      "灯",
      "床品",
      "沙发",
      "装饰",
      "home",
      "storage",
      "cleaning",
      "vacuum",
      "decor",
    ],
    englishNoun: "home product",
    useCasePhrase: "your home",
    outreachHook: "your home content",
    defaultSellingPoints: "使用前后差别明显，适合真实家居场景拍摄。",
    defaultKeyContentPoints: [
      "展示使用前后对比",
      "展示使用过程",
      "展示摆放效果",
      "展示产品细节",
    ],
    defaultAvoidShots: "避免只拍产品静物图；避免与真实家居环境无关的纯棚拍。",
    defaultVideoLength: "每条视频 45 秒以上",
    defaultVideoCount: "每位达人 2 条视频",
    fallbackContentPoints: [
      "show the product being used in your home",
      "show a clear before-and-after of the space",
      "show how it looks once it is set up",
    ],
    lexicon: {
      收纳前后对比: "the before-and-after of the space",
      整理过程: "the organizing process",
      摆放效果: "how it looks in the room",
      承重: "how much weight it holds",
      空间利用: "how much space it saves",
      家居氛围: "the look it gives your home",
      清洁效果: "the cleaning result",
      吸力: "the suction power",
      去污效果: "how well it lifts stains",
      拼装过程: "the assembly process",
    },
  },
  {
    id: "kitchen",
    label: "厨房用品",
    keywords: [
      "厨房",
      "锅",
      "刀",
      "杯",
      "咖啡",
      "料理",
      "烤",
      "餐具",
      "保温",
      "kitchen",
      "cook",
      "coffee",
      "mug",
      "bottle",
    ],
    englishNoun: "kitchen product",
    useCasePhrase: "your kitchen",
    outreachHook: "your food and kitchen content",
    defaultSellingPoints: "出片效果好，适合真实烹饪流程展示。",
    defaultKeyContentPoints: [
      "展示烹饪过程",
      "展示成品效果",
      "展示清洗过程",
      "展示产品细节",
    ],
    defaultAvoidShots: "避免脏乱台面或不卫生的操作画面；避免只拍产品不拍使用。",
    defaultVideoLength: "每条视频 45 秒以上",
    defaultVideoCount: "每位达人 2 条视频",
    fallbackContentPoints: [
      "show the product being used while you cook",
      "show the finished result",
      "show how easy it is to clean",
    ],
    lexicon: {
      烹饪过程: "the cooking process",
      成品效果: "the finished dish",
      加热速度: "how fast it heats up",
      清洗过程: "how easy it is to clean",
      不粘效果: "the non-stick performance",
      容量: "the capacity",
      出餐效果: "the plated result",
      备菜过程: "the prep process",
      保温效果: "how well it keeps drinks hot or cold",
      密封性: "how well it seals",
    },
  },
  {
    id: "apparel",
    label: "服饰配件",
    keywords: [
      "服饰",
      "衣",
      "裤",
      "裙",
      "鞋",
      "包",
      "配饰",
      "内衣",
      "袜",
      "apparel",
      "clothing",
      "shoes",
      "bag",
      "outfit",
    ],
    englishNoun: "product",
    useCasePhrase: "your everyday outfits",
    outreachHook: "your styling content",
    defaultSellingPoints: "上身效果好，适合多套搭配展示。",
    defaultKeyContentPoints: [
      "展示上身效果",
      "展示多套搭配",
      "展示面料细节",
      "展示版型",
    ],
    defaultAvoidShots: "避免只拍平铺图；避免看不清版型和面料的远景。",
    defaultVideoLength: "每条视频 30 秒以上",
    defaultVideoCount: "每位达人 2 条视频",
    fallbackContentPoints: [
      "show how the item looks on",
      "show at least two ways to style it",
      "show a close-up of the fabric and fit",
    ],
    lexicon: {
      上身效果: "how it looks on",
      试穿: "trying it on",
      多套搭配: "several outfit combinations",
      面料细节: "the fabric detail",
      版型: "the fit",
      弹力: "the stretch",
      尺码建议: "sizing advice",
      走动效果: "how it moves when you walk",
      洗后效果: "how it looks after washing",
      搭配思路: "how you would style it",
    },
  },
  {
    id: "electronics",
    label: "3C 数码",
    keywords: [
      "数码",
      "耳机",
      "音响",
      "充电",
      "手机",
      "电脑",
      "键盘",
      "相机",
      "手表",
      "electronics",
      "headphone",
      "charger",
      "speaker",
      "gadget",
    ],
    englishNoun: "device",
    useCasePhrase: "your daily setup",
    outreachHook: "your tech content",
    defaultSellingPoints: "实测效果直观，适合真实使用场景演示。",
    defaultKeyContentPoints: [
      "展示开箱",
      "展示连接过程",
      "展示实际测试",
      "展示产品细节",
    ],
    defaultAvoidShots: "避免只念参数不做实测；避免与产品无关的跑分画面。",
    defaultVideoLength: "每条视频 60 秒以上",
    defaultVideoCount: "每位达人 2 条视频",
    fallbackContentPoints: [
      "show the device being set up and used",
      "show a real-world test rather than only specs",
      "show a close-up of the build and details",
    ],
    lexicon: {
      开机: "turning it on",
      连接过程: "pairing or connecting it",
      音质: "the sound quality",
      降噪效果: "the noise cancelling",
      画质: "the picture quality",
      充电速度: "the charging speed",
      参数: "the specs",
      实际测试: "a real-world test",
      佩戴舒适度: "how comfortable it is to wear",
      续航测试: "a battery life test",
    },
  },
  {
    id: "baby",
    label: "母婴用品",
    keywords: [
      "母婴",
      "宝宝",
      "婴儿",
      "儿童",
      "奶瓶",
      "推车",
      "辅食",
      "尿",
      "baby",
      "infant",
      "toddler",
      "stroller",
    ],
    englishNoun: "baby product",
    useCasePhrase: "your daily routine with your baby",
    outreachHook: "your parenting content",
    defaultSellingPoints: "使用场景真实，适合日常育儿场景展示。",
    defaultKeyContentPoints: [
      "展示使用过程",
      "展示宝宝真实反应",
      "展示安全设计",
      "展示清洗方式",
    ],
    defaultAvoidShots:
      "避免任何不安全的使用示范；避免宝宝无人看护的画面；避免宣称医疗功效。",
    defaultVideoLength: "每条视频 45 秒以上",
    defaultVideoCount: "每位达人 2 条视频",
    fallbackContentPoints: [
      "show the product in a real daily moment",
      "show how safely and easily it is used",
      "share your honest experience as a parent",
    ],
    lexicon: {
      宝宝真实反应: "your baby’s real reaction",
      安全设计: "the safety design",
      材质安全: "the safe materials",
      清洗方式: "how it is cleaned",
      使用月龄: "the age range it suits",
      哄睡效果: "how it helps with sleep",
      辅食制作: "making baby food",
      折叠收纳: "how it folds down",
    },
  },
  {
    id: "food",
    label: "食品饮料",
    keywords: [
      "食品",
      "零食",
      "饮料",
      "咖啡豆",
      "茶",
      "蛋白粉",
      "代餐",
      "糖",
      "food",
      "snack",
      "drink",
      "supplement",
    ],
    englishNoun: "product",
    useCasePhrase: "your day",
    outreachHook: "your food content",
    defaultSellingPoints: "口感和分量直观，适合真实试吃展示。",
    defaultKeyContentPoints: ["展示开袋", "展示试吃", "展示口感", "展示配料表"],
    defaultAvoidShots: "避免宣称减肥、治疗或健康功效；避免夸大口感描述。",
    defaultVideoLength: "每条视频 30 秒以上",
    defaultVideoCount: "每位达人 2 条视频",
    fallbackContentPoints: [
      "show the product being opened and tasted",
      "share an honest reaction to the taste",
      "show the packaging and portion size clearly",
    ],
    lexicon: {
      开袋: "opening the package",
      试吃: "tasting it",
      口感: "the taste and texture",
      配料表: "the ingredient list",
      制作过程: "how you prepare it",
      分量: "the portion size",
      真实吃播: "an honest tasting reaction",
      冲泡过程: "how you mix it",
    },
  },
  {
    id: "fitness",
    label: "运动健身",
    keywords: [
      "运动",
      "健身",
      "瑜伽",
      "跑步",
      "哑铃",
      "拉伸",
      "训练",
      "fitness",
      "workout",
      "yoga",
      "gym",
    ],
    englishNoun: "product",
    useCasePhrase: "your workout routine",
    outreachHook: "your fitness content",
    defaultSellingPoints: "动作演示直观，适合真实训练场景展示。",
    defaultKeyContentPoints: [
      "展示动作演示",
      "展示训练过程",
      "展示使用姿势",
      "展示便携收纳",
    ],
    defaultAvoidShots: "避免不安全的训练示范；避免宣称快速减重等夸大效果。",
    defaultVideoLength: "每条视频 45 秒以上",
    defaultVideoCount: "每位达人 2 条视频",
    fallbackContentPoints: [
      "show the product being used during a real workout",
      "show correct form clearly",
      "share your honest take after using it",
    ],
    lexicon: {
      动作演示: "the exercise demonstration",
      训练过程: "the workout",
      阻力档位: "the resistance levels",
      使用姿势: "the correct form",
      训练前后对比: "a before-and-after of your progress",
      便携收纳: "how it folds and stores",
    },
  },
  {
    id: "general",
    label: "通用 / 其它品类",
    keywords: [],
    englishNoun: "product",
    useCasePhrase: "your everyday routine",
    outreachHook: "your content",
    defaultSellingPoints: "使用效果直观，适合真实场景展示。",
    defaultKeyContentPoints: [
      "展示使用过程",
      "展示真实使用场景",
      "展示使用前后对比",
      "展示产品细节",
    ],
    defaultAvoidShots: "避免只拍产品静物；避免夸大或无法证明的效果宣称。",
    defaultVideoLength: "每条视频 45 秒以上",
    defaultVideoCount: "每位达人 2 条视频",
    fallbackContentPoints: [
      "show the product being used in a real setting",
      "show the main result clearly",
      "share your honest opinion",
    ],
    lexicon: {},
  },
];

const CATEGORY_BY_ID = new Map(
  PRODUCT_CATEGORIES.map((category) => [category.id, category]),
);

export const DEFAULT_PRODUCT_CATEGORY_ID: ProductCategoryId = "general";

export function getProductCategory(
  id: ProductCategoryId | string | undefined,
): ProductCategory {
  return (
    CATEGORY_BY_ID.get((id ?? "") as ProductCategoryId) ??
    CATEGORY_BY_ID.get(DEFAULT_PRODUCT_CATEGORY_ID)!
  );
}

/**
 * English keywords match on word boundaries — a bare `includes` would score
 * "cat" inside "application" and "dog" inside "dogma", pulling beauty and home
 * products into the pet category. Chinese has no word boundaries, so those
 * keywords stay substring matches.
 */
function matchesKeyword(text: string, keyword: string): boolean {
  const normalized = keyword.toLowerCase();
  if (!/^[a-z0-9 ]+$/.test(normalized)) return text.includes(normalized);
  return new RegExp(
    `\\b${normalized.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}s?\\b`,
  ).test(text);
}

function normalizeForDetection(
  values: Array<string | string[] | undefined>,
): string {
  return values
    .flat()
    .filter((value): value is string => typeof value === "string")
    .join(" ")
    .toLowerCase();
}

/** Best-matching category for one blob of text, or null when nothing matches. */
function bestCategoryFor(text: string): ProductCategoryId | null {
  if (!text.trim()) return null;

  let bestId: ProductCategoryId | null = null;
  let bestScore = 0;
  for (const category of PRODUCT_CATEGORIES) {
    const score = category.keywords.reduce(
      (total, keyword) => (matchesKeyword(text, keyword) ? total + 1 : total),
      0,
    );
    if (score > bestScore) {
      bestScore = score;
      bestId = category.id;
    }
  }
  return bestId;
}

/**
 * Guesses the category from the product name plus any supporting text. The name
 * is weighted heavily: a campaign called 空气炸锅 is a kitchen product even when
 * its selling points still carry wording copied from an earlier pet campaign.
 *
 * Used so campaigns saved before categories existed still get a sensible
 * lexicon instead of falling straight through to "general".
 */
export function detectProductCategory(
  productName?: string | string[],
  ...supportingText: Array<string | string[] | undefined>
): ProductCategoryId {
  // The name decides on its own whenever it matches anything. Supporting text
  // is only consulted for names that say nothing useful ("Model A2", "新品").
  return (
    bestCategoryFor(normalizeForDetection([productName])) ??
    bestCategoryFor(normalizeForDetection(supportingText)) ??
    DEFAULT_PRODUCT_CATEGORY_ID
  );
}

const CHINESE_PATTERN = /[\u3400-\u9fff]/;

export function hasChinese(value: string): boolean {
  return CHINESE_PATTERN.test(value);
}

/** Leading verbs that map onto an English "show ..." style phrase. */
const VERB_PREFIXES: Array<[RegExp, string]> = [
  [/^(?:必须)?展示/, "show"],
  [/^(?:必须)?展现/, "show"],
  [/^(?:必须)?呈现/, "show"],
  [/^(?:必须)?演示/, "demonstrate"],
  [/^(?:必须)?拍摄/, "film"],
  [/^(?:必须)?突出/, "highlight"],
  [/^(?:必须)?强调/, "highlight"],
  [/^(?:必须)?说明/, "explain"],
  [/^(?:必须)?讲解/, "explain"],
  [/^(?:必须)?介绍/, "introduce"],
  [/^(?:必须)?体现/, "show"],
  [/^(?:必须)?记录/, "capture"],
  [/^(?:必须)?对比/, "compare"],
];

function lookupPhrase(
  phrase: string,
  category: ProductCategory,
): string | undefined {
  return (
    category.lexicon[phrase] ?? SHARED_LEXICON[phrase] ?? SHARED_NOUNS[phrase]
  );
}

/**
 * Translates one Chinese content point. Returns an empty string only when the
 * phrase is genuinely unknown — callers fall back to the category defaults so
 * the English brief never ends up empty.
 */
export function translateContentPoint(
  point: string,
  categoryId: ProductCategoryId | string | undefined,
): string {
  const normalized = point.trim().replace(/[。.；;]$/, "");
  if (!normalized) return "";
  if (!hasChinese(normalized)) return normalized;

  const category = getProductCategory(categoryId);

  // Whole-phrase match first: the lexicons store the natural English wording,
  // which reads better than anything assembled from parts.
  const direct = lookupPhrase(normalized, category);
  if (direct) return direct;

  for (const [pattern, verb] of VERB_PREFIXES) {
    if (!pattern.test(normalized)) continue;
    const remainder = normalized.replace(pattern, "").trim();
    if (!remainder) continue;

    const translatedRemainder = translateNounPhrase(remainder, category);
    if (!translatedRemainder) continue;
    return `${verb} ${translatedRemainder}`;
  }

  return "";
}

function translateNounPhrase(
  phrase: string,
  category: ProductCategory,
): string {
  const direct = lookupPhrase(phrase, category);
  if (direct) return direct;

  // "展示A和B" / "展示A、B" — translate the parts and join them.
  const parts = phrase
    .split(/[和、,，+＋]/)
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length > 1) {
    const translated = parts.map((part) => lookupPhrase(part, category));
    if (translated.every((item): item is string => Boolean(item))) {
      return joinEnglishList(translated);
    }
  }

  return "";
}

export function joinEnglishList(items: string[]): string {
  if (items.length === 0) return "";
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}

/**
 * Translates a whole list of content points and guarantees a usable result.
 * This is the function that fixes the silent-drop bug: if nothing survives
 * translation the category's own English fallbacks are returned instead.
 */
export type ContentPointTranslation = {
  /** Points to put in the brief: what translated, topped up with fallbacks. */
  points: string[];
  /** The configured Chinese points that had no translation. */
  untranslated: string[];
};

/**
 * Translates a list of content points and reports what it could not handle.
 *
 * A partly-translatable brief is the dangerous case: if one point translates,
 * the untranslatable ones used to disappear with no trace, so a
 * safety-critical shot could silently never reach the creator. Any gap is now
 * topped up with the category's own English guidance, and the dropped points
 * are returned so the operator can be told to rewrite them.
 */
export function translateContentPointsDetailed(
  points: string[],
  categoryId: ProductCategoryId | string | undefined,
  limit = 4,
): ContentPointTranslation {
  const category = getProductCategory(categoryId);
  const translated: string[] = [];
  const untranslated: string[] = [];

  points.forEach((point) => {
    if (!point.trim()) return;
    const english = translateContentPoint(point, category.id);
    if (english) translated.push(english);
    else untranslated.push(point.trim());
  });

  const filled = [...translated];
  // Only top up when something was actually lost, so a fully-translated brief
  // is never padded with generic filler.
  if (untranslated.length > 0) {
    for (const fallback of category.fallbackContentPoints) {
      if (filled.length >= limit) break;
      if (!filled.includes(fallback)) filled.push(fallback);
    }
  }

  return { points: filled.slice(0, limit), untranslated };
}

export function translateContentPoints(
  points: string[],
  categoryId: ProductCategoryId | string | undefined,
  limit = 4,
): string[] {
  return translateContentPointsDetailed(points, categoryId, limit).points;
}

/**
 * English "please avoid" wording per category. The configured 不希望达人这样拍
 * field is free text, so arbitrary Chinese cannot be translated reliably — but
 * dropping it silently means the creator never hears the constraint at all.
 * When the field is set but untranslatable, the category's standard warning is
 * sent instead.
 */
const FALLBACK_AVOID_SHOTS: Record<ProductCategoryId, string> = {
  pet: "shots where the pet looks distressed, and staged clips with no pet on camera",
  beauty:
    "heavy filters that hide the real result, and any medical or treatment claims",
  home: "still-life product shots with no real use, and setups unrelated to a real home",
  kitchen:
    "unhygienic prep shots, and clips that show the product without using it",
  apparel:
    "flat-lay-only shots, and framing too far away to see the fit and fabric",
  electronics:
    "spec read-outs with no real test, and benchmark footage unrelated to the product",
  baby: "any unsafe demonstration, unattended-baby shots, and health or medical claims",
  food: "weight-loss, treatment, or health claims, and exaggerated taste descriptions",
  fitness:
    "unsafe form demonstrations, and rapid weight-loss or transformation claims",
  general:
    "still-life-only shots with no real use, and claims about results that cannot be shown",
};

export function translateAvoidShots(
  avoidShots: string,
  categoryId: ProductCategoryId | string | undefined,
): string {
  const normalized = avoidShots.trim();
  if (!normalized) return "";
  if (!hasChinese(normalized)) return normalized;
  return FALLBACK_AVOID_SHOTS[getProductCategory(categoryId).id];
}

const SHARED_PRODUCT_NAMES: Record<string, string> = {
  蒸汽梳毛器: "steam grooming brush",
  智能宠物饮水机: "smart pet water fountain",
  宠物蒸汽梳毛器: "steam grooming brush",
  逗猫棒: "cat teaser wand",
  宠物清洁手套: "pet grooming glove",
  猫砂盆: "litter box",
  卷发棒: "curling wand",
  直发梳: "straightening brush",
  粉底液: "liquid foundation",
  精华液: "facial serum",
  面膜: "face mask",
  收纳盒: "storage box",
  拖把: "mop",
  吸尘器: "vacuum",
  空气炸锅: "air fryer",
  保温杯: "insulated tumbler",
  咖啡机: "coffee maker",
  蓝牙耳机: "wireless earbuds",
  充电宝: "power bank",
  智能手表: "smart watch",
  瑜伽垫: "yoga mat",
  筋膜枪: "massage gun",
  奶瓶: "baby bottle",
  婴儿推车: "stroller",
};

/**
 * Translates a product name for creator-facing copy. Unknown Chinese names now
 * fall back to the category noun ("the beauty product") rather than the flat
 * "the product" every category used to get.
 */
export function translateProductName(
  productName: string,
  categoryId: ProductCategoryId | string | undefined,
): string {
  const normalized = productName.trim();
  const category = getProductCategory(categoryId);
  if (!normalized) return category.englishNoun;

  const direct = SHARED_PRODUCT_NAMES[normalized];
  if (direct) return direct;
  if (!hasChinese(normalized)) return normalized;
  return category.englishNoun;
}
