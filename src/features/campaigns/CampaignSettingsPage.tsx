import {
  PRODUCT_CATEGORIES,
  type ProductCategoryId,
} from "../../productCategories";
import type { CollabModel, OrderMethod } from "../../types";
import type { CampaignSettingsPageProps } from "./campaignSettingsTypes";

export function CampaignSettingsPage({
  data,
  uiState,
  actions,
}: CampaignSettingsPageProps) {
  const target = data.target;

  return (
    <>
      <div className="page-header">
        <div>
          <p className="eyebrow">TikTok Shop Creator SOP</p>
          <h1>设置</h1>
          <p>管理产品项目、拍摄要求、提示词助手和本地数据。</p>
        </div>
      </div>
      <section className="panel sop-card">
        <div className="section-heading">
          <div>
            <h2>产品项目设置</h2>
            <p className="muted">
              达人拍摄要求是 Campaign 核心配置。每个产品项目独立保存 8
              个拍摄要求字段，供工作台、话术、DeepSeek 和内容审核调用。
            </p>
          </div>
        </div>
        <label className="campaign-picker">
          选择产品 / Campaign
          <select
            value={target?.selectValue ?? ""}
            onChange={(event) => actions.selectCampaign(event.target.value)}
          >
            {data.campaignOptions.map((campaign) => (
              <option key={campaign.value} value={campaign.value}>
                {campaign.label}
              </option>
            ))}
          </select>
        </label>
        <label className="checkbox-field">
          <input
            type="checkbox"
            checked={uiState.showArchivedProducts}
            onChange={(event) =>
              actions.setShowArchivedProducts(event.target.checked)
            }
          />
          显示已归档产品
        </label>
        {target && (
          <div className="inline-actions campaign-actions">
            <button
              type="button"
              className="secondary"
              onClick={actions.createCampaign}
            >
              新增产品
            </button>
            <button
              type="button"
              className="secondary"
              onClick={actions.announceEditable}
            >
              编辑
            </button>
            <button
              type="button"
              className="secondary"
              onClick={actions.duplicateCampaign}
            >
              复制
            </button>
            <button
              type="button"
              className="secondary"
              onClick={actions.archiveCampaign}
            >
              归档
            </button>
            {target.campaign.archivedAt && (
              <button
                type="button"
                className="secondary"
                onClick={actions.restoreCampaign}
              >
                恢复
              </button>
            )}
            <button
              type="button"
              className="danger secondary"
              onClick={actions.deleteCampaign}
            >
              删除
            </button>
          </div>
        )}
        {target && (
          <div
            className="settings-form campaign-settings"
            data-testid="campaign-settings-form"
          >
            <label>
              店铺 / 品牌
              <select
                value={target.storeId}
                onChange={(event) => actions.assignStore(event.target.value)}
              >
                {data.storeOptions.map((store) => (
                  <option key={store.id} value={store.id}>
                    {store.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              产品名称
              <input
                value={target.campaign.productName}
                onChange={(event) => actions.renameProduct(event.target.value)}
              />
            </label>
            <label>
              产品品类
              <select
                value={target.categoryId}
                onChange={(event) =>
                  actions.selectCategory(
                    event.target.value as ProductCategoryId,
                  )
                }
              >
                {PRODUCT_CATEGORIES.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.label}
                  </option>
                ))}
              </select>
            </label>
            <div className="inline-actions">
              <button
                type="button"
                className="secondary"
                onClick={actions.applyCategoryPreset}
              >
                套用品类预设
              </button>
              <span className="muted">
                {target.categoryIsDetected
                  ? "当前品类由产品名称自动识别，选择后即固定。"
                  : "品类决定英文话术里的用词和默认拍摄要求。"}
                套用预设会覆盖必须展示内容、卖点、时长数量和避免事项。
              </span>
            </div>
            <label>
              必须展示内容
              <textarea
                value={target.keyContentPointsText}
                onChange={(event) =>
                  actions.updateKeyContentPoints(event.target.value)
                }
                rows={5}
              />
            </label>
            <label>
              产品卖点
              <textarea
                aria-label="Campaign 产品卖点"
                value={target.campaign.sellingPoints}
                onChange={(event) =>
                  actions.updateSellingPoints(event.target.value)
                }
                rows={3}
              />
            </label>
            <label>
              视频时长要求
              <input
                value={target.campaign.videoLength}
                onChange={(event) =>
                  actions.updateVideoLength(event.target.value)
                }
              />
            </label>
            <label>
              视频数量要求
              <input
                value={target.campaign.videoCount}
                onChange={(event) =>
                  actions.updateVideoCount(event.target.value)
                }
              />
            </label>
            <div className="inline-actions">
              <button
                type="button"
                className="secondary"
                onClick={actions.syncVideoCount}
              >
                同步视频数量到达人记录
              </button>
              <span className="muted">
                会更新 0/2 → 0/1 等安全记录，并保留已发布视频数量。
              </span>
            </div>
            <div className="round-block">
              <div>
                <strong>当前第 {target.currentRound} 轮建联</strong>
                <p className="muted">
                  本轮还有 {target.activeRoundCreatorCount} 位达人在进行中。
                  结束本轮会把这些记录全部归档（不会删除），未完成的标红；
                  之后新增的达人进入第 {target.currentRound + 1} 轮，
                  同一个达人可以再次建联而不算重复。
                </p>
              </div>
              <button
                type="button"
                className="secondary"
                onClick={actions.endCurrentRound}
                disabled={target.activeRoundCreatorCount === 0}
              >
                结束第 {target.currentRound} 轮
              </button>
            </div>
            <label>
              不希望达人这样拍
              <textarea
                value={target.campaign.avoidShots}
                onChange={(event) =>
                  actions.updateAvoidShots(event.target.value)
                }
                rows={3}
              />
            </label>
            <label>
              挂车 / TikTok Shop 产品链接要求
              <textarea
                value={target.productLinkRequirementText}
                onChange={(event) =>
                  actions.updateProductLinkRequirement(event.target.value)
                }
                rows={3}
              />
            </label>
            <label>
              参考视频链接
              <textarea
                value={target.referenceLinksText}
                onChange={(event) =>
                  actions.updateReferenceLinks(event.target.value)
                }
                rows={3}
              />
            </label>
            <p className="ai-status">
              产品项目设置会自动保存到 localStorage，并作为当前 Campaign
              拍摄要求的唯一配置来源。
            </p>
          </div>
        )}
      </section>
      {target && (
        <section className="panel sop-card">
          <div className="section-heading">
            <div>
              <h2>合作模式与条款</h2>
              <p className="muted">
                决定话术里怎么说佣金、折扣码和下单方式，也决定跟进队列走「品牌直发」还是「达人自下单」流程。
              </p>
            </div>
          </div>
          <div className="settings-form campaign-settings">
            <label>
              合作模式
              <select
                value={target.collabModel}
                onChange={(event) =>
                  actions.selectCollabModel(event.target.value as CollabModel)
                }
              >
                <option value="affiliate-link">
                  挂车联盟（TikTok Shop 商品链接）
                </option>
                <option value="discount-code">折扣码寄样（达人专属码）</option>
              </select>
            </label>
            <label>
              下单方式
              <select
                value={target.orderMethod}
                onChange={(event) =>
                  actions.selectOrderMethod(event.target.value as OrderMethod)
                }
              >
                <option value="brand-ships">品牌直发</option>
                <option value="creator-orders">达人自己下单</option>
              </select>
            </label>
            {target.collabModel === "discount-code" && (
              <label>
                达人折扣码
                <input
                  value={target.discountCode}
                  placeholder="例如 JAMIE10"
                  onChange={(event) =>
                    actions.updateDiscountCode(event.target.value)
                  }
                />
              </label>
            )}
            {target.collabModel === "discount-code" && (
              <label>
                粉丝折扣
                <input
                  value={target.audienceDiscount}
                  placeholder="例如 10%"
                  onChange={(event) =>
                    actions.updateAudienceDiscount(event.target.value)
                  }
                />
              </label>
            )}
            <label>
              达人佣金
              <input
                value={target.creatorCommission}
                placeholder="例如 10%"
                onChange={(event) =>
                  actions.updateCreatorCommission(event.target.value)
                }
              />
            </label>
            <label>
              佣金归因窗口
              <input
                value={target.commissionWindow}
                placeholder="例如 6 months"
                onChange={(event) =>
                  actions.updateCommissionWindow(event.target.value)
                }
              />
            </label>
            <label>
              内容授权月数
              <input
                value={target.contentUsageMonths}
                placeholder="例如 12，留空则不写进 brief"
                onChange={(event) =>
                  actions.updateContentUsageMonths(event.target.value)
                }
              />
            </label>
            <label className="checkbox-field">
              <input
                type="checkbox"
                checked={target.requiresDisclosure}
                onChange={(event) =>
                  actions.setRequiresDisclosure(event.target.checked)
                }
              />
              brief 中要求 #ad / 品牌合作标注
            </label>
            <p className="ai-status">
              佣金、折扣和归因窗口留空时话术会自动省略，不会出现空档。金额相关字段会原样写进发给达人的英文邮件，填写前请确认无误。
            </p>
          </div>
        </section>
      )}
      <section className="panel sop-card">
        <div className="section-heading">
          <div>
            <h2>店铺清理</h2>
            <p className="muted">
              空的错别字店铺会在产品归档后从顶部下拉中隐藏；仍有关联产品或达人记录的店铺需要先迁移或合并。
            </p>
          </div>
        </div>
        <div className="inline-actions">
          {data.storeCleanupItems.map((item) => (
            <button
              key={item.id}
              type="button"
              className="secondary"
              onClick={() => actions.inspectStore(item.id)}
            >
              {item.canHide
                ? `隐藏空店铺：${item.name}`
                : `检查店铺：${item.name}`}
            </button>
          ))}
        </div>
      </section>
    </>
  );
}
