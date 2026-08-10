import type { RoundReviewPageProps } from "./roundReviewTypes";

export function RoundReviewPage({
  data,
  uiState,
  actions,
}: RoundReviewPageProps) {
  if (data.needsProductSelection) {
    return (
      <section className="panel">
        <div className="empty-state">
          <strong>请先在顶部选择一个产品项目</strong>
          <span>轮次属于单个产品，「全部产品」视图下无法复盘。</span>
        </div>
      </section>
    );
  }

  if (data.rounds.length === 0) {
    return (
      <section className="panel">
        <div className="empty-state">
          <strong>「{data.productName}」还没有达人记录</strong>
          <span>导入或新增达人后，这里会按轮次显示每一轮的结果。</span>
        </div>
      </section>
    );
  }

  return (
    <section className="panel">
      <div className="section-heading">
        <div>
          <h2>「{data.productName}」轮次复盘</h2>
          <p className="muted">
            每一轮结束后，未完成履约的达人会标红。点开某一轮可以看到具体是谁，
            以及他们是否在别的轮次也合作过。
          </p>
        </div>
      </div>

      <div className="round-list">
        {data.rounds.map((round) => {
          const expanded = uiState.expandedRound === round.round;
          return (
            <div className="round-card" key={round.round}>
              <button
                type="button"
                className="secondary round-card-header"
                aria-expanded={expanded}
                onClick={() => actions.toggleRound(round.round)}
              >
                <span>
                  第 {round.round} 轮
                  {round.isCurrent && (
                    <em className="round-current-tag">进行中</em>
                  )}
                </span>
                <span className="round-card-stats">
                  共 {round.total} 位 · 完成 {round.completed} · 未完成{" "}
                  <b className={round.incomplete > 0 ? "round-bad" : ""}>
                    {round.incomplete}
                  </b>
                  {round.active > 0 && ` · 处理中 ${round.active}`}
                </span>
              </button>

              {expanded && (
                <ul className="round-creator-list">
                  {round.creators.map((creator) => (
                    <li
                      key={creator.rowId}
                      className={creator.completed ? "" : "round-bad-row"}
                    >
                      <button
                        type="button"
                        className="secondary"
                        onClick={() =>
                          actions.openCreatorInDatabase(creator.rowId)
                        }
                      >
                        {creator.displayName}
                      </button>
                      <span className="round-creator-meta">
                        {creator.completed ? "已完成" : "未完成"} ·{" "}
                        {creator.videoProgress} · {creator.statusLabel} · 跟进{" "}
                        {creator.followUpCount} 次
                        {creator.alsoInRounds.length > 0 &&
                          ` · 也出现在第 ${creator.alsoInRounds.join("、")} 轮`}
                      </span>
                      {creator.notes && (
                        <span className="muted">{creator.notes}</span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
