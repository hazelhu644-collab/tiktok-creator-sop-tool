import type { CreatorDatabasePageProps } from "./creatorDatabaseTypes";

export function CreatorDatabasePage({
  data,
  uiState,
  actions,
}: CreatorDatabasePageProps) {
  const allSelected =
    data.rows.length > 0 &&
    data.rows.every((entry) => uiState.selectedIds.includes(entry.row.id));

  return (
    <>
      <div className="page-header">
        <div>
          <p className="eyebrow">TikTok Shop Creator SOP</p>
          <h1>达人数据库</h1>
          <p>管理达人信息、合作状态、物流状态、视频进度和跟进记录。</p>
        </div>
      </div>
      <section className="panel compact-panel">
        <div className="section-heading">
          <div>
            <h2>数据导入 / 导出</h2>
            <p className="muted">
              支持 Excel / CSV 导入导出，数据保存在当前浏览器。
            </p>
          </div>
          <div className="inline-actions">
            <label className="file-button">
              导入 Excel / CSV
              <input
                type="file"
                accept=".csv,.xls,.xlsx"
                onChange={(event) =>
                  void actions.importFile(event.target.files?.[0])
                }
              />
            </label>
            <button
              type="button"
              className="secondary"
              onClick={actions.exportCsv}
              disabled={data.exportableRowCount === 0}
            >
              导出 CSV
            </button>
            <button type="button" onClick={actions.addCreator}>
              新增达人
            </button>
          </div>
        </div>
        {uiState.fileName && (
          <p className="muted">已加载：{uiState.fileName}</p>
        )}
        {uiState.importSummary && (
          <p className="warning-text">{uiState.importSummary}</p>
        )}
        {uiState.pendingDuplicate && (
          <div className="inline-warning duplicate-warning">
            <strong>该达人已存在。你可以选择：</strong>
            <span>
              检测到该达人已存在。请确认这是重复录入，还是同一达人申请了不同样品。
            </span>
            <button type="button" onClick={actions.continueDuplicate}>
              继续新增为不同样品
            </button>
            <button
              type="button"
              className="secondary"
              onClick={actions.copyDuplicateBase}
            >
              复制已有达人基础信息
            </button>
            <button
              type="button"
              className="secondary"
              onClick={actions.cancelDuplicate}
            >
              取消新增
            </button>
          </div>
        )}
        {uiState.error && <p className="error">{uiState.error}</p>}
      </section>
      <section className="panel table-panel">
        <div className="filters-bar">
          <label>
            搜索
            <input
              value={uiState.search}
              onChange={(event) => actions.setSearch(event.target.value)}
              placeholder="搜索达人昵称 / 产品 / 状态"
            />
          </label>
          <label>
            合作状态
            <select
              value={uiState.statusFilter}
              onChange={(event) => actions.setStatusFilter(event.target.value)}
            >
              <option value="All">全部</option>
              {data.statusOptions.map((status) => (
                <option key={status.value} value={status.value}>
                  {status.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            达人类型
            <select
              value={uiState.creatorTypeFilter}
              onChange={(event) =>
                actions.setCreatorTypeFilter(event.target.value)
              }
            >
              <option value="All">全部</option>
              <option>Pet</option>
              <option>UGC</option>
              <option>Grooming</option>
            </select>
          </label>
          <label>
            粉丝量级
            <select
              value={uiState.followerFilter}
              onChange={(event) =>
                actions.setFollowerFilter(event.target.value)
              }
            >
              <option value="All">全部</option>
              <option>K</option>
              <option>M</option>
              <option>—</option>
            </select>
          </label>
          <label>
            平均播放
            <select
              value={uiState.avgViewsFilter}
              onChange={(event) =>
                actions.setAvgViewsFilter(event.target.value)
              }
            >
              <option value="All">全部</option>
              <option>K</option>
              <option>M</option>
              <option>—</option>
            </select>
          </label>
          <label>
            GMV 区间
            <select
              value={uiState.gmvFilter}
              onChange={(event) => actions.setGmvFilter(event.target.value)}
            >
              <option value="All">全部</option>
              <option>$</option>
              <option value="low">低</option>
              <option value="mid">中</option>
              <option value="high">高</option>
              <option>—</option>
            </select>
          </label>
        </div>
        <label className="checkbox-field">
          <input
            aria-label="显示已归档合作"
            type="checkbox"
            checked={uiState.showArchivedCollaborations}
            onChange={(event) =>
              actions.setShowArchivedCollaborations(event.target.checked)
            }
          />
          显示归档达人
        </label>
        {!uiState.showArchivedCollaborations &&
          data.archivedProductCount > 0 && (
            <p className="ai-status">
              当前显示 active records，已隐藏 {data.archivedProductCount}{" "}
              条已归档合作；开启“显示归档达人”可查看和搜索这些历史记录。默认 CSV
              导出包含所有历史记录。
            </p>
          )}
        <div className="sticky-action-bar">
          <span>当前产品总记录：{data.productTotalCount}</span>
          <span>当前显示：{data.rows.length}</span>
          <span>已选择：{uiState.selectedIds.length}</span>
          <span>已归档合作：{data.archivedProductCount}</span>
          <button
            type="button"
            className="secondary"
            onClick={actions.bulkCopyOutreach}
            disabled={uiState.selectedIds.length === 0}
          >
            批量复制邀约话术
          </button>
          <select
            value={uiState.bulkStatus}
            onChange={(event) => actions.setBulkStatus(event.target.value)}
          >
            {data.statusOptions.map((status) => (
              <option key={status.value} value={status.value}>
                {status.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={actions.bulkUpdateStatus}
            disabled={uiState.selectedIds.length === 0}
          >
            批量更新状态
          </button>
        </div>
        {data.rows.length === 0 ? (
          <div className="empty-state">
            <strong>
              {data.archivedSearchMatchCount > 0
                ? "该达人存在于已归档合作中，可开启显示已归档合作查看。"
                : "没有匹配的达人。"}
            </strong>
            <span>下一步：清空筛选、导入 CSV / Excel，或点击 新增达人。</span>
          </div>
        ) : (
          <div className="table-wrap spreadsheet-wrap">
            <table className="ops-table spreadsheet-table">
              <thead>
                <tr>
                  <th>
                    <input
                      aria-label="全选达人"
                      type="checkbox"
                      checked={allSelected}
                      onChange={(event) =>
                        actions.toggleSelectAll(event.target.checked)
                      }
                    />
                  </th>
                  <th>达人账号</th>
                  <th>主页链接</th>
                  <th>联系渠道</th>
                  <th>店铺 / 品牌</th>
                  <th>产品</th>
                  <th>合作状态</th>
                  <th>样品到货日期</th>
                  <th>视频进度</th>
                  <th>首条视频发布日期</th>
                  <th>最近联系日期</th>
                  <th>跟进次数</th>
                  <th>跟进状态</th>
                  <th>最近沟通动作</th>
                  <th>最近沟通渠道</th>
                  <th>下次跟进日期</th>
                  <th>达人回复</th>
                  <th>达人备注</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((entry) => (
                  <tr key={entry.row.id}>
                    <td>
                      <input
                        aria-label={`选择 ${entry.displayName}`}
                        type="checkbox"
                        checked={uiState.selectedIds.includes(entry.row.id)}
                        onChange={() => actions.toggleSelected(entry.row.id)}
                      />
                    </td>
                    <td>
                      <input
                        aria-label="达人账号"
                        value={entry.row.username}
                        onChange={(event) =>
                          actions.updateRow(
                            entry.row.id,
                            "username",
                            event.target.value,
                          )
                        }
                      />
                      {entry.archived && (
                        <span className="mini-badge">已归档</span>
                      )}
                      {entry.duplicate.multiSample && (
                        <span className="mini-badge">同店铺多样品</span>
                      )}
                      {entry.duplicate.crossStoreCreator && (
                        <span className="mini-badge">跨店铺达人</span>
                      )}
                      {entry.duplicate.possibleDuplicate && (
                        <small className="warning-text">
                          该达人在当前店铺的同一产品项目下可能已重复录入，建议检查是否需要合并。
                        </small>
                      )}
                    </td>
                    <td>
                      <input
                        aria-label="主页链接"
                        value={entry.row.profileLink}
                        onChange={(event) =>
                          actions.updateRow(
                            entry.row.id,
                            "profileLink",
                            event.target.value,
                          )
                        }
                        placeholder="@账号或主页链接"
                      />
                    </td>
                    <td>
                      <input
                        aria-label="联系渠道"
                        value={entry.row.contactMethod}
                        onChange={(event) =>
                          actions.updateRow(
                            entry.row.id,
                            "contactMethod",
                            event.target.value,
                          )
                        }
                      />
                    </td>
                    <td>
                      <input
                        aria-label="店铺 / 品牌"
                        value={entry.row.storeName || data.defaultStoreName}
                        onChange={(event) =>
                          actions.updateRow(
                            entry.row.id,
                            "storeName",
                            event.target.value,
                          )
                        }
                      />
                      {entry.duplicate.crossStoreCreator && (
                        <span className="mini-badge">跨店铺达人</span>
                      )}
                    </td>
                    <td>
                      <input
                        aria-label="产品名称"
                        value={entry.row.product}
                        onChange={(event) =>
                          actions.updateRow(
                            entry.row.id,
                            "product",
                            event.target.value,
                          )
                        }
                      />
                    </td>
                    <td>
                      <input
                        aria-label="合作状态"
                        value={entry.row.currentStatus}
                        onChange={(event) =>
                          actions.updateRow(
                            entry.row.id,
                            "currentStatus",
                            event.target.value,
                          )
                        }
                      />
                    </td>
                    <td>
                      <input
                        aria-label="样品到货日期"
                        type="date"
                        value={entry.row.sampleDeliveredDate}
                        onChange={(event) =>
                          actions.updateRow(
                            entry.row.id,
                            "sampleDeliveredDate",
                            event.target.value,
                          )
                        }
                      />
                    </td>
                    <td>
                      <input
                        aria-label="视频进度"
                        value={entry.row.videoProgress}
                        onChange={(event) =>
                          actions.updateRow(
                            entry.row.id,
                            "videoProgress",
                            event.target.value,
                          )
                        }
                      />
                    </td>
                    <td>
                      <input
                        aria-label="首条视频发布日期"
                        type="date"
                        value={entry.row.firstVideoPostedDate}
                        onChange={(event) =>
                          actions.updateRow(
                            entry.row.id,
                            "firstVideoPostedDate",
                            event.target.value,
                          )
                        }
                      />
                    </td>
                    <td>
                      <input
                        aria-label="最近联系日期"
                        type="date"
                        value={entry.row.lastContactDate}
                        onChange={(event) =>
                          actions.updateRow(
                            entry.row.id,
                            "lastContactDate",
                            event.target.value,
                          )
                        }
                      />
                    </td>
                    <td>
                      <input
                        aria-label="跟进次数"
                        type="number"
                        min="0"
                        value={entry.row.lastFollowUpCount}
                        onChange={(event) =>
                          actions.updateRow(
                            entry.row.id,
                            "lastFollowUpCount",
                            event.target.value,
                          )
                        }
                      />
                    </td>
                    <td>
                      <input
                        aria-label="跟进状态"
                        value={entry.row.trackingStatus ?? ""}
                        onChange={(event) =>
                          actions.updateRow(
                            entry.row.id,
                            "trackingStatus",
                            event.target.value,
                          )
                        }
                      />
                    </td>
                    <td>
                      <input
                        aria-label="最近沟通动作"
                        value={entry.row.lastMessageScenario ?? ""}
                        onChange={(event) =>
                          actions.updateRow(
                            entry.row.id,
                            "lastMessageScenario",
                            event.target.value,
                          )
                        }
                      />
                    </td>
                    <td>
                      <input
                        aria-label="最近沟通渠道"
                        value={entry.row.lastMessageChannel ?? ""}
                        onChange={(event) =>
                          actions.updateRow(
                            entry.row.id,
                            "lastMessageChannel",
                            event.target.value,
                          )
                        }
                      />
                    </td>
                    <td>
                      <input
                        aria-label="下次跟进日期"
                        type="date"
                        value={entry.row.nextFollowUpDate ?? ""}
                        onChange={(event) =>
                          actions.updateRow(
                            entry.row.id,
                            "nextFollowUpDate",
                            event.target.value,
                          )
                        }
                      />
                    </td>
                    <td>
                      <textarea
                        aria-label="达人回复"
                        value={entry.row.lastCreatorResponse ?? ""}
                        onChange={(event) =>
                          actions.updateRow(
                            entry.row.id,
                            "lastCreatorResponse",
                            event.target.value,
                          )
                        }
                        rows={1}
                      />
                    </td>
                    <td>
                      <textarea
                        aria-label="达人备注"
                        value={entry.row.notes}
                        onChange={(event) =>
                          actions.updateRow(
                            entry.row.id,
                            "notes",
                            event.target.value,
                          )
                        }
                        rows={1}
                      />
                    </td>
                    <td className="row-actions">
                      <button
                        type="button"
                        className="secondary compact-button"
                        onClick={() => actions.copyOutreach(entry.row.id)}
                      >
                        复制英文话术
                      </button>
                      <button
                        type="button"
                        className={`${entry.archived ? "" : "danger "}secondary compact-button`}
                        onClick={() =>
                          entry.archived
                            ? actions.restoreCreator(entry.row.id)
                            : actions.archiveCreator(entry.row.id)
                        }
                        disabled={entry.archived && !entry.canRestore}
                      >
                        {entry.archived
                          ? entry.canRestore
                            ? "恢复达人"
                            : "已归档"
                          : "归档达人"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
