import type { ReplyTone } from "../../messageGenerator";
import type { MessageComposerProps } from "./messageComposerTypes";

export function MessageComposer({
  data,
  uiState,
  actions,
}: MessageComposerProps) {
  const {
    creatorReply,
    notes,
    channel,
    chineseTranslation,
    errorMessage,
    message,
    messageSource,
    chineseExplanation,
    trackingStatus,
    lastProcessingResult,
    hasNextTask,
  } = data;
  const {
    historicalReadOnly,
    loadingAction,
    translationExpanded,
    translationEditing,
    advancedReplyOpen,
    replyFocus,
    relationshipNote,
    replyTone,
    replyGoal,
    replyConcession,
    showNextCreatorPrompt,
    messageOutputRef,
  } = uiState;

  return (
    <section className="reply-panel" data-testid="reply-handling-panel">
      <div className="section-heading">
        <div>
          <h2>达人回复处理</h2>
          <p className="muted">
            默认只保留日常 BD 必填信息；高级策略字段已折叠。
          </p>
        </div>
      </div>
      <div className="reply-two-column">
        <div className="reply-column">
          <h3>达人回复</h3>
          <label>
            达人回复原文
            <textarea
              value={creatorReply}
              onChange={(event) =>
                actions.updateCreatorReply(event.target.value)
              }
              placeholder="可粘贴或手动修正达人原始回复"
              rows={4}
            />
          </label>
          <p className="muted compact-helper">
            可粘贴或手动修正达人原始回复，DeepSeek
            会基于这里的内容翻译和生成回复。
          </p>
          <label>
            处理备注 / 达人备注
            <textarea
              value={notes}
              disabled={historicalReadOnly}
              onChange={(event) => actions.updateNotes(event.target.value)}
              placeholder="例如：周末发布 / 回复慢，不要每天催 / 脚受伤，周五后再跟进 / 已沟通，等待剪辑 / 今天不催"
              rows={3}
            />
          </label>
          <div className="inline-actions deepseek-near-focus">
            <button
              type="button"
              className="secondary"
              onClick={actions.generateDeepSeekReply}
              disabled={loadingAction !== null}
            >
              根据上方重点生成英文回复
            </button>
          </div>
          <div className="inline-actions">
            <button
              type="button"
              className="secondary"
              onClick={actions.translateCreatorReply}
              disabled={loadingAction !== null}
            >
              DeepSeek 翻译达人回复
            </button>
          </div>
          <div
            className={`translation-card ${translationExpanded ? "expanded" : ""}`}
            data-testid="translation-card"
          >
            <div className="translation-card-header">
              <h3>中文翻译</h3>
              {chineseTranslation && (
                <button
                  type="button"
                  className="link-button"
                  onClick={actions.copyTranslation}
                >
                  复制翻译
                </button>
              )}
            </div>
            {translationEditing ? (
              <textarea
                aria-label="编辑中文翻译"
                value={chineseTranslation}
                onChange={(event) =>
                  actions.updateTranslation(event.target.value)
                }
                rows={3}
              />
            ) : (
              <p className="translation-text">
                {chineseTranslation ||
                  "点击 DeepSeek 翻译达人回复后，这里只显示直译中文。"}
              </p>
            )}
            {chineseTranslation && (
              <div className="inline-actions compact-actions">
                <button
                  type="button"
                  className="link-button"
                  onClick={() =>
                    actions.setTranslationExpanded(!translationExpanded)
                  }
                >
                  {translationExpanded ? "收起" : "展开全文"}
                </button>
                <button
                  type="button"
                  className="link-button"
                  onClick={() =>
                    actions.setTranslationEditing(!translationEditing)
                  }
                >
                  {translationEditing ? "完成编辑" : "编辑翻译"}
                </button>
              </div>
            )}
          </div>
          {loadingAction === "translate_creator_reply" && (
            <p className="ai-status" role="status">
              DeepSeek 生成中…
            </p>
          )}
          {errorMessage && (
            <p className="error" role="alert">
              {errorMessage}
            </p>
          )}
        </div>
        <div className="reply-column">
          <h3>生成英文回复</h3>
          <label>
            我想回复的重点
            <textarea
              value={replyFocus}
              onChange={(event) => actions.setReplyFocus(event.target.value)}
              placeholder="例如：表示理解，确认具体发布时间，方便安排投流"
              rows={3}
            />
          </label>
          <div className="inline-actions deepseek-near-focus">
            <button
              type="button"
              className="secondary"
              onClick={actions.generateDeepSeekReply}
              disabled={loadingAction !== null}
            >
              根据上方重点生成英文回复
            </button>
          </div>
          <div className="reply-inline-fields">
            <p className="readonly-channel">当前联系渠道：{channel}</p>
            <label>
              回复语气
              <select
                value={replyTone}
                onChange={(event) =>
                  actions.setReplyTone(event.target.value as ReplyTone)
                }
              >
                <option>中立专业</option>
                <option>友好一点</option>
                <option>坚定推进</option>
                <option>最后确认</option>
              </select>
            </label>
          </div>
          <details
            className="advanced-reply-settings"
            open={advancedReplyOpen}
            onToggle={(event) =>
              actions.setAdvancedReplyOpen(event.currentTarget.open)
            }
          >
            <summary>高级设置</summary>
            <div className="reply-fields">
              <label>
                达人关系备注（可选）
                <textarea
                  value={relationshipNote}
                  onChange={(event) =>
                    actions.setRelationshipNote(event.target.value)
                  }
                  placeholder="例如：她之前视频质量不错 / 沟通比较慢"
                />
              </label>
              <label>
                这次回复目标（可选）
                <textarea
                  value={replyGoal}
                  onChange={(event) => actions.setReplyGoal(event.target.value)}
                  placeholder="例如：确认发布时间 / 推进剩余视频"
                />
              </label>
              <label>
                可接受让步（可选）
                <textarea
                  value={replyConcession}
                  onChange={(event) =>
                    actions.setReplyConcession(event.target.value)
                  }
                  placeholder="例如：可以周五发布 / 不能不挂车"
                />
              </label>
            </div>
          </details>
          <p className="muted compact-helper">
            默认先使用本地专业话术。DeepSeek 仅用于复杂回复或需要个性化优化时。
          </p>
          <p className="muted compact-helper">
            DeepSeek 翻译只做直译；英文回复会把你的中文重点准确转成
            creator-facing English。
          </p>
          {message && (
            <div ref={messageOutputRef} className="message-output">
              <h3>场景 / 沟通动作</h3>
              <p>
                {message.scenario} · {message.communicationAction}
              </p>
              <h3>英文话术</h3>
              <p className="message-source-label">
                {messageSource === "deepseek"
                  ? "DeepSeek 优化版"
                  : "免费本地话术"}
              </p>
              <label className="sr-only" htmlFor="generated-english-message">
                英文话术
              </label>
              <textarea
                id="generated-english-message"
                value={message.english}
                onChange={(event) =>
                  actions.updateEnglishMessage(event.target.value)
                }
                rows={7}
              />
              {loadingAction === "generate_personalized_reply" && (
                <p className="ai-status" role="status">
                  DeepSeek 生成中…
                </p>
              )}
              <h3>中文对照 / 中文解释</h3>
              <span className="sr-only">中文解释</span>
              <p>{chineseExplanation || message.chineseExplanation}</p>
              <h3>发送后追踪</h3>
              <p>
                发送后请点击「标记为已发送」，系统会更新最近联系日期、跟进次数和下一次跟进日期。
              </p>
              <div className="inline-actions">
                <button type="button" onClick={actions.copyEnglishMessage}>
                  复制英文话术
                </button>
                <button
                  type="button"
                  onClick={actions.markMessageSent}
                  disabled={historicalReadOnly}
                >
                  标记为已发送
                </button>
                <button
                  type="button"
                  className="secondary"
                  onClick={actions.markCreatorReplied}
                  disabled={historicalReadOnly}
                >
                  标记达人已回复
                </button>
                <button
                  type="button"
                  className="secondary"
                  onClick={actions.markCreatorNoReply}
                  disabled={historicalReadOnly}
                >
                  标记未回复
                </button>
                <button
                  type="button"
                  className="secondary"
                  onClick={actions.markVideoProgress}
                  disabled={historicalReadOnly}
                >
                  发布 1 条视频
                </button>
                <details className="advanced-actions">
                  <summary>更多操作 / 高级操作</summary>
                  <div className="inline-actions">
                    <button
                      type="button"
                      className="secondary"
                      onClick={actions.updateVideoProgressManually}
                      disabled={historicalReadOnly}
                    >
                      手动更新视频进度
                    </button>
                    <button
                      type="button"
                      className="secondary"
                      onClick={() => actions.markCreatorOutcome("Completed")}
                      disabled={historicalReadOnly}
                    >
                      合作完成
                    </button>
                    <button
                      type="button"
                      className="danger secondary"
                      onClick={() => actions.markCreatorOutcome("Failed")}
                      disabled={historicalReadOnly}
                    >
                      合作失败
                    </button>
                  </div>
                </details>
              </div>
              <div className="skip-today-control">
                <button
                  type="button"
                  className="secondary"
                  onClick={actions.markCreatorSkippedToday}
                  disabled={historicalReadOnly}
                >
                  今日暂不跟进
                </button>
              </div>
              {trackingStatus && (
                <p className="tracking-status">{trackingStatus}</p>
              )}
              {showNextCreatorPrompt && (
                <div className="next-creator-prompt">
                  <strong>{lastProcessingResult || "已记录处理结果。"}</strong>
                  <div className="inline-actions">
                    <button
                      type="button"
                      onClick={actions.processNextCreator}
                      disabled={!hasNextTask}
                    >
                      处理下一个达人
                    </button>
                    <button
                      type="button"
                      className="secondary"
                      onClick={actions.stayOnCurrentCreator}
                    >
                      留在当前达人
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
