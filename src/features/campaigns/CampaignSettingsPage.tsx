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
