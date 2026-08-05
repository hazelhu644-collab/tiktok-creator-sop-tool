import { CampaignSettingsPage } from "../campaigns/CampaignSettingsPage";
import type {
  SettingsPageProps,
  SettingsPromptHelperField,
} from "./settingsTypes";

export function SettingsPage({ data, uiState, actions }: SettingsPageProps) {
  const {
    campaignSettingsProps,
    generatedPrompt,
    promptCopyStatus,
    aiDraft,
    aiDraftLoading,
    aiDraftError,
    canApplyAiDraft,
    aiDraftAppliedTo,
  } = data;
  const { promptHelperOpen, promptHelperForm } = uiState;

  const textField = (field: SettingsPromptHelperField, label: string) => (
    <label>
      {label}
      <input
        value={promptHelperForm[field]}
        onChange={(event) =>
          actions.updatePromptHelperField(field, event.target.value)
        }
      />
    </label>
  );

  return (
    <>
      <CampaignSettingsPage {...campaignSettingsProps} />
      <section className="panel prompt-helper">
        <div className="section-heading">
          <div>
            <h2>辅助生成拍摄要求（可选）</h2>
            <p className="muted">
              可以生成提示词自己复制到 ChatGPT，也可以直接用 AI
              生成草稿再决定是否应用到当前产品项目。
            </p>
          </div>
          <button
            type="button"
            className="secondary"
            onClick={actions.togglePromptHelper}
          >
            {promptHelperOpen ? "收起辅助生成" : "展开辅助生成"}
          </button>
        </div>
        {promptHelperOpen && (
          <div className="settings-form">
            {textField("sellingPoints", "产品卖点")}
            {textField("videoCount", "目标视频数量")}
            {textField("durationRequirement", "单条视频时长要求")}
            {textField("targetPetOrScene", "目标宠物 / 使用场景")}
            {textField("mustShowShots", "必须展示的画面")}
            {textField("avoidShots", "不希望达人这样拍")}
            <label>
              对标视频链接（可选，每行一个）
              <textarea
                value={promptHelperForm.referenceLinks}
                onChange={(event) =>
                  actions.updatePromptHelperField(
                    "referenceLinks",
                    event.target.value,
                  )
                }
              />
            </label>

            <div className="inline-actions">
              <button
                type="button"
                onClick={actions.generateDraftWithAi}
                disabled={aiDraftLoading}
              >
                {aiDraftLoading ? "AI 生成中…" : "用 AI 直接生成草稿"}
              </button>
              <button
                type="button"
                className="secondary"
                onClick={actions.generatePrompt}
              >
                生成可复制提示词
              </button>
            </div>
            <p className="muted">
              「用 AI 直接生成草稿」会调用 OpenAI，需要部署环境配置
              OPENAI_API_KEY；生成后仍需你确认才会写入产品项目。
            </p>

            {aiDraftLoading && (
              <p className="ai-status" role="status">
                正在调用 AI 生成拍摄要求草稿…
              </p>
            )}
            {aiDraftError && (
              <p className="error" role="alert">
                {aiDraftError}
              </p>
            )}
            {aiDraftAppliedTo && (
              <p className="ai-status">
                已把草稿应用到「{aiDraftAppliedTo}
                」，可在上方产品项目设置中继续修改。
              </p>
            )}

            {aiDraft && (
              <div className="ai-draft">
                <h3>AI 草稿：{aiDraft.productName}</h3>
                <strong>达人拍摄要求</strong>
                <ul>
                  {aiDraft.requirements.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
                <strong>重点拍摄内容</strong>
                <ul>
                  {aiDraft.priorities.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
                <div className="inline-actions">
                  <button
                    type="button"
                    onClick={actions.applyAiDraft}
                    disabled={!canApplyAiDraft}
                  >
                    应用到当前产品项目
                  </button>
                  <button
                    type="button"
                    className="secondary"
                    onClick={actions.dismissAiDraft}
                  >
                    放弃这版草稿
                  </button>
                </div>
                {!canApplyAiDraft && (
                  <p className="muted">
                    当前没有可写入的产品项目，请先在上方新增一个产品。
                  </p>
                )}
              </div>
            )}

            {generatedPrompt && (
              <>
                <p className="ai-status">
                  提示词已生成。请复制到 ChatGPT 使用。
                </p>
                <label>
                  ChatGPT 提示词
                  <textarea value={generatedPrompt} readOnly rows={8} />
                </label>
                <button type="button" onClick={actions.copyPrompt}>
                  复制提示词
                </button>
                {promptCopyStatus && (
                  <p className="ai-status">{promptCopyStatus}</p>
                )}
              </>
            )}
          </div>
        )}
      </section>
      <section className="panel danger-zone">
        <div className="section-heading">
          <div>
            <h2>危险操作</h2>
            <p className="muted">
              仅清空当前浏览器 localStorage 中的达人数据，不影响产品项目设置。
            </p>
          </div>
          <button
            type="button"
            className="secondary danger"
            onClick={actions.clearLocalCreatorData}
          >
            清空当前数据
          </button>
        </div>
      </section>
    </>
  );
}
