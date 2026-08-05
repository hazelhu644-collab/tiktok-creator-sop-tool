import { CampaignSettingsPage } from "../campaigns/CampaignSettingsPage";
import type { SettingsPageProps } from "./settingsTypes";

export function SettingsPage({ data, uiState, actions }: SettingsPageProps) {
  const { campaignSettingsProps, generatedPrompt, promptCopyStatus } = data;
  const { promptHelperOpen, promptHelperForm } = uiState;

  return (
    <>
      <CampaignSettingsPage {...campaignSettingsProps} />
      <section className="panel prompt-helper">
        <div className="section-heading">
          <div>
            <h2>用 ChatGPT 辅助生成拍摄要求（可选）</h2>
            <p className="muted">
              只生成可复制提示词；不会调用 API，也不会自动修改数据。
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
            <label>
              产品卖点
              <input
                value={promptHelperForm.sellingPoints}
                onChange={(event) =>
                  actions.updatePromptHelperField(
                    "sellingPoints",
                    event.target.value,
                  )
                }
              />
            </label>
            <label>
              单条视频时长要求
              <input
                value={promptHelperForm.durationRequirement}
                onChange={(event) =>
                  actions.updatePromptHelperField(
                    "durationRequirement",
                    event.target.value,
                  )
                }
              />
            </label>
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
            <button type="button" onClick={actions.generatePrompt}>
              生成可复制提示词
            </button>
            {generatedPrompt && (
              <>
                <p className="ai-status">提示词已生成。请复制到 ChatGPT 使用。</p>
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
