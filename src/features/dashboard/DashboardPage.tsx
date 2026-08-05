import { MessageComposer } from "../messaging/MessageComposer";
import type { DashboardPageProps } from "./dashboardTypes";

export function DashboardPage({ data, uiState, actions }: DashboardPageProps) {
  const {
    campaignCards,
    metricCards,
    selectedCampaignName,
    workbenchFilterLabel,
    highestPendingCount,
    queueItems,
    selectedCreator,
    hasNextTask,
    channelOptions,
    messageComposerProps,
  } = data;
  const {
    onlyCurrentCreator,
    queueExpanded,
    followupSearch,
    creatorSearchStatus,
    showArchivedCollaborations,
    urgency,
    showProcessedToday,
    selectedCreatorId,
    channel,
    historicalReadOnly,
    queueRef,
    currentCreatorRef,
  } = uiState;

  return (
    <>
      <div className="page-header">
        <div>
          <p className="eyebrow">TikTok Shop Creator SOP</p>
          <h1>今日工作台</h1>
          <p>每天打开后，先选产品项目，再按优先级处理今天要联系的达人。</p>
        </div>
        <button type="button" onClick={actions.openCreatorDatabase}>
          打开达人数据库
        </button>
      </div>
      <section className="campaign-overview">
        <div className="section-heading">
          <div>
            <h2>产品项目概览</h2>
            <p className="muted">
              按产品 Campaign 分离达人、样品、视频履约和失败风险。
            </p>
          </div>
        </div>
        <div className="campaign-card-grid">
          {campaignCards.map((campaign) => (
            <button
              type="button"
              key={campaign.value}
              className="campaign-card"
              aria-label={campaign.ariaLabel}
              onClick={() => actions.selectCampaignCard(campaign.value)}
            >
              <span className="product-badge">{campaign.label}</span>
              <strong>
                总合作记录 / 总达人数：{campaign.creatorCount} 位达人
              </strong>
              <div className="campaign-metrics">
                <span>
                  进行中 <b>{campaign.activeCount}</b>
                </span>
                <span>
                  今日需跟进 <b>{campaign.todayFollowUp}</b>
                </span>
                <span>
                  高优先级 <b>{campaign.highPriority}</b>
                </span>
                <span>
                  样品运输中 <b>{campaign.inTransit}</b>
                </span>
                <span>
                  到货待拍 <b>{campaign.deliveredPending}</b>
                </span>
                <span>
                  已发布视频 <b>{campaign.postedVideos}</b>
                </span>
                <span>
                  已完成 <b>{campaign.completed}</b>
                </span>
                <span>
                  已失败 <b>{campaign.failed}</b>
                </span>
              </div>
            </button>
          ))}
        </div>
      </section>
      <section className="dashboard-grid" aria-label="今日概览">
        {metricCards.map((card) => (
          <button
            type="button"
            key={card.label}
            className="metric-card"
            onClick={() => actions.selectMetricCard(card)}
          >
            <span>{card.label}</span>
            <strong>{card.value}</strong>
            <small>{selectedCampaignName}</small>
          </button>
        ))}
      </section>
      <section className="panel generator-panel workbench-panel" ref={queueRef}>
        <div className="section-heading">
          <div>
            <h2>今日待处理达人队列</h2>
            <p className="muted">
              当前队列已按「
              {selectedCampaignName}
              」过滤{workbenchFilterLabel ? ` · ${workbenchFilterLabel}` : ""}
              。选择达人后会自动收起长队列，直接进入处理区。
            </p>
            <p className="muted">最高优先级 {highestPendingCount}</p>
          </div>
          <div className="inline-actions">
            <button
              type="button"
              className="secondary"
              onClick={actions.toggleOnlyCurrentCreator}
            >
              {onlyCurrentCreator ? "显示达人队列" : "只看当前达人"}
            </button>
            {workbenchFilterLabel && (
              <button
                type="button"
                className="secondary"
                onClick={actions.clearWorkbenchFilter}
              >
                清除卡片筛选
              </button>
            )}
            <button
              type="button"
              className="secondary"
              onClick={actions.toggleQueue}
            >
              {queueExpanded ? "收起达人队列" : "展开达人队列"}
            </button>
          </div>
        </div>
        <div className="generator-controls workbench-controls">
          <label>
            搜索队列
            <input
              value={followupSearch}
              onChange={(event) =>
                actions.setFollowupSearch(event.target.value)
              }
              onKeyDown={(event) => {
                if (event.key === "Enter") actions.locateCreator();
              }}
              placeholder="达人 / 产品 / 状态 / 跟进状态 / 紧急程度"
            />
          </label>
          <button
            type="button"
            className="secondary"
            onClick={actions.locateCreator}
          >
            定位达人
          </button>
          {creatorSearchStatus && (
            <p className="ai-status">{creatorSearchStatus}</p>
          )}
          <label className="checkbox-field">
            <input
              aria-label="显示已归档合作"
              type="checkbox"
              checked={showArchivedCollaborations}
              onChange={(event) =>
                actions.setShowArchivedCollaborations(event.target.checked)
              }
            />
            显示归档达人
          </label>
          <label>
            紧急程度
            <select
              value={urgency}
              onChange={(event) =>
                actions.setUrgency(
                  event.target
                    .value as DashboardPageProps["uiState"]["urgency"],
                )
              }
            >
              <option value="All">全部</option>
              <option value="Highest">最高</option>
              <option value="High">高</option>
              <option value="Medium">中</option>
              <option value="Low">低</option>
            </select>
          </label>
          <label className="checkbox-field">
            <input
              type="checkbox"
              checked={showProcessedToday}
              onChange={(event) =>
                actions.setShowProcessedToday(event.target.checked)
              }
            />
            显示今日已处理
          </label>
          <label>
            选择达人
            <select
              aria-label="选择达人"
              value={selectedCreatorId}
              onChange={(event) => actions.selectCreator(event.target.value)}
            >
              {queueItems.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.creatorHandle} · {item.priorityLabel} ·{" "}
                  {item.statusLabel}
                </option>
              ))}
            </select>
          </label>
          <label>
            联系渠道
            <select
              value={channel}
              onChange={(event) =>
                actions.setChannel(
                  event.target
                    .value as DashboardPageProps["uiState"]["channel"],
                )
              }
            >
              {channelOptions.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={actions.generateMessage}
            disabled={!selectedCreator}
          >
            生成话术
          </button>
        </div>
        {!onlyCurrentCreator && queueExpanded && (
          <div className="queue-list compact-queue" data-testid="creator-queue">
            {queueItems.length > 0 ? (
              queueItems.map((item) => (
                <button
                  type="button"
                  key={item.id}
                  className={`queue-item ${selectedCreatorId === item.id ? "active" : ""}`}
                  onClick={() => actions.selectCreator(item.id)}
                >
                  <span className="queue-main-line">
                    <strong>{item.creatorHandle}</strong>
                    <span className="queue-badges">
                      <em>{item.priorityLabel}</em>
                      <em>{item.statusLabel}</em>
                      {item.multiSample && <em>同达人多样品</em>}
                    </span>
                  </span>
                  <span className="queue-sub-line">{item.subLine}</span>
                </button>
              ))
            ) : (
              <div className="empty-state compact-empty">
                <strong>当前筛选下暂无待处理达人。</strong>
              </div>
            )}
          </div>
        )}
        {!onlyCurrentCreator && !queueExpanded && (
          <div className="collapsed-copy queue-collapsed">
            <strong>达人队列已收起。</strong>
            <span>
              当前只显示处理区，点击「展开达人队列」可继续查看全部待处理达人。
            </span>
          </div>
        )}
        {selectedCreator ? (
          <div
            ref={currentCreatorRef}
            className="current-creator-panel"
            data-testid="current-creator-panel"
          >
            <div className="section-heading">
              <div>
                <h2>当前处理达人</h2>
                <p className="muted">
                  先确认状态，再生成 / 复制英文话术，发送后回到工具标记。
                </p>
                {historicalReadOnly && (
                  <p className="ai-status">
                    当前为历史统计下钻，只读展示；如需继续合作，请先恢复达人。
                  </p>
                )}
              </div>
              {hasNextTask && (
                <button
                  type="button"
                  className="secondary"
                  onClick={actions.processNextCreator}
                >
                  处理下一个达人
                </button>
              )}
            </div>
            <div className="current-creator-grid">
              <span>
                达人账号<b>{selectedCreator.displayName}</b>
              </span>
              <span>
                店铺 / 品牌<b>{selectedCreator.storeName}</b>
              </span>
              <span>
                产品项目<b>{selectedCreator.productName}</b>
              </span>
              <span>
                当前状态<b>{selectedCreator.statusLabel}</b>
              </span>
              <span>
                紧急程度<b>{selectedCreator.priorityLabel}</b>
              </span>
              <span>
                优先级原因<b>{selectedCreator.triggerReason}</b>
              </span>
              <span>
                沟通动作<b>{selectedCreator.suggestedAction}</b>
              </span>
              <span>
                跟进状态<b>{selectedCreator.trackingStatus}</b>
              </span>
              <span className="creator-note-preview">
                处理备注 / 达人备注<b>{selectedCreator.notes}</b>
              </span>
            </div>
            {selectedCreator.crossStoreCreator && (
              <div className="inline-warning duplicate-warning">
                <strong>跨店铺达人</strong>
                <span>
                  该达人在其他店铺也有合作记录，请确认本次沟通是否需要区分店铺。
                </span>
              </div>
            )}
            {selectedCreator.otherActiveSampleCount > 0 && (
              <div className="inline-warning duplicate-warning">
                <strong>同达人多样品</strong>
                <span>
                  该达人还有 {selectedCreator.otherActiveSampleCount}{" "}
                  个其他样品合作。该达人存在多个样品合作，请确认是否需要合并沟通。
                </span>
                <button
                  type="button"
                  className="secondary"
                  onClick={actions.showOtherSamples}
                >
                  查看其他样品记录
                </button>
                <button
                  type="button"
                  className="secondary"
                  onClick={actions.showMultiSampleReminder}
                >
                  生成多样品合并提醒
                </button>
              </div>
            )}
            <details
              className="more-info-card current-product-brief"
              data-testid="current-product-filming-requirements"
            >
              <summary>当前产品拍摄要求</summary>
              <div className="current-creator-grid secondary-grid">
                {selectedCreator.filmingRequirements.map((item) => (
                  <span key={item.label}>
                    {item.label}
                    <b>{item.value || "—"}</b>
                  </span>
                ))}
              </div>
            </details>
            <details className="more-info-card">
              <summary>更多信息</summary>
              <div className="current-creator-grid secondary-grid">
                {selectedCreator.moreInfo.map((item) => (
                  <span key={item.label}>
                    {item.label}
                    <b>{item.value}</b>
                  </span>
                ))}
              </div>
            </details>
          </div>
        ) : (
          <div className="empty-state">
            <strong>暂无待处理达人。</strong>
            <span>
              {workbenchFilterLabel
                ? "当前筛选下暂无待处理达人。"
                : "请导入达人数据，或切换到「全部产品」查看完整队列。"}
            </span>
          </div>
        )}
        {messageComposerProps && <MessageComposer {...messageComposerProps} />}
      </section>
    </>
  );
}
