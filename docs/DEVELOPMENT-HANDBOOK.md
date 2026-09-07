# Pathwise 开发档案与接力手册

> 换电脑、换开发者或重新打开 Codex 后的唯一接力入口。先读本文，再改代码。

## 产品北极星

Pathwise 是会因真实证据改变路线的职业成长操作系统，不是一次性职业建议生成器。

```text
事实输入 → 结构化解析 → 岗位判断 → 难度加权路径 → 当前行动
       ↑                                      ↓
成果/面试反馈 ← 可验证证据链 ← 完成行动 ← 具体指导
```

每份简历、项目成果或面试复盘都要说明：哪个岗位判断变了、哪个缺口被缩小或暴露、现在最值得做什么。北极星指标是有效职业行动完成率，而不是点击量、卡片数或文字长度。

## 用户主线

- 首次打开为空状态，不预填“大三/211/信息安全”；先建立画像或上传简历。
- 简历解析出阶段、学校、专业、经历和 AI 推荐方向；推荐必须显示依据与置信度，由用户确认。
- 规划输出现在可投、毕业可达、差距、三个阶段，以及每个行动的指导与完成标准。
- 行动可设为当前行动，按预计难度生成截止日期；承诺本身不增加进度。
- 完成行动后提交成果，成果进入证据链并触发重新规划。
- 地图显示主路线、补证支线和岗位分岔；分叉必须有原因。
- 成长报告记录最近证据如何改变路线、为什么改变、下一步是什么。

## 目录地图

| 路径 | 作用 |
| --- | --- |
| `career.html` / `career.js` | 核心工作台、画像、规划、行动与证据闭环 |
| `map.html` / `map.js` | 游戏化职业进步地图 |
| `report.html` / `report.js` | 连续变化成长报告 |
| `redesign.css` / `report.css` | 全局视觉与响应式样式 |
| `server.py` | 本地静态服务器、AI 代理、PDF/文档解析 |
| `functions/api/` | Cloudflare Pages Functions |
| `path-model.js` | 路径状态、难度加权进度与迁移 |
| `continuity-model.mjs` | 新证据前后路线差异 |
| `commitment-model.js` | 当前行动承诺与回访锁定 |
| `game-feedback-model.js` | 需要成果证明的里程碑 |
| `data/` | 公开案例/RAG 数据；个人材料不得提交 |
| `tests/` | 模型、API、UI、隐私和发布 smoke |

## 状态与 AI 契约

浏览器 localStorage 默认持久化：`pathwiseProfile`、`pathwisePlan`、`pathwiseEvidence`、`pathwiseTrajectoryHistory`、`pathwiseCommitment`、`pathwiseMapMilestones`。写入必须有容量保护和坏数据恢复；AI 失败时保留上一次有效路径。

前端只调用同源 `/api/*`。Key 仅放本地 `.env` 或 Cloudflare Secret，永远不进浏览器和 Git。AI 输出必须是 JSON；服务端清理 Markdown/重复大括号、拒绝 placeholder、校验岗位/阶段/actionGuide。流式响应需处理截断、超时、client gone 和缺少 `[DONE]`，解析失败走规则降级。

## 本地开发与测试

```bash
cd /Users/bytedance/Documents/Codex/2026-08-20/wo-xi
python3 -m pip install -r requirements.txt
python3 server.py
npm test
git diff --check
```

打开 `http://127.0.0.1:8787/career.html`，并检查：

```bash
curl -sS http://127.0.0.1:8787/api/health
curl -sS https://pathwise-web.pages.dev/api/health
```

测试覆盖本地 PDF 解析（CJK 兼容字符、研究生优先）、路径模型、承诺闭环、里程碑、AI 降级、轨迹更新、UI、隐私、发布 smoke。

## 发布流程

```bash
git status --short
git add <相关文件>                 # 排除 README.md（若有用户未提交修改）和 .env
git diff --cached --check
git commit -m "feat: ..."
git push origin main
```

Cloudflare Pages 使用 GitHub `main` 自动部署。部署后检查 `/career.html`、`/map.html`、`/report.html`、`/api/health`。若 API 返回 524，优先检查上游网关和流式结束标记，不要简单延长前端等待。

## 不可违反的注意事项

1. 不提交 API Key、简历原文、面试录音或个人文件。
2. 不用默认画像伪装新用户，不让 AI 静默替用户决定目标岗位。
3. 不按完成数量涨进度；进度按行动难度、预计投入、成果质量加权。
4. 不把简历全文铺在进展流；只展示结构化证据和变化摘要。
5. 新功能必须挂在职业规划主线上：输入事实、改变判断、产生行动或反馈。
6. 改动前先读测试和契约；改动后跑 `npm test` 与页面 smoke。
7. 保持移动端无页面横向溢出；地图仅允许内部画布横向探索。
8. 视觉优先信息层级、留白和可读性，不堆卡片、渐变和装饰。

## 下一轮路线

### P0 可靠性

- 为 `/api/plan`、`/api/evidence-insight` 增加流式截断、超时和幂等测试。
- 前端显示 request id、重试入口和上一次有效规划时间，区分未配置、上游超时、解析失败。
- 用同一组 contract test 对齐本地 server 与 Cloudflare Functions。

### P1 AI-native

- 将简历、JD、面试反馈统一映射为 Evidence schema，保存来源、时间、置信度和影响字段。
- AI 负责解释和候选建议，确定性模型负责进度、分叉和状态迁移。
- 每个岗位判断可回溯到具体证据句，而非泛泛总结。

### P1 体验

- 地图强化当前营地、能力山口、岗位城堡和已解锁旗帜，减少流程图式文字。
- 工作台首屏只保留“现在状态 / 下一步 / 为什么”三层信息。
- 完成行动后用成果输入和轻量正反馈形成闭环，不使用廉价撒花。

### P2 开源与传播

- README 增加 90 秒演示、架构图、隐私说明、贡献指南和 issue 模板。
- 提供无 Key 的 deterministic demo mode，clone 后可体验完整闭环。
- 用匿名合成案例做浏览器录屏，作为发布前回归和项目展示素材。

## 换电脑接力清单

1. `git clone https://github.com/Dengdeng857/pathwise.git`
2. 阅读本文和 `docs/product-principles.md`、`docs/demo-script.md`。
3. 安装依赖，运行 `npm test`。
4. 创建本地 `.env`，填自己的 Secret，不从聊天记录复制旧 Key。
5. 启动 `python3 server.py`，确认健康检查和三页面可访问。
6. 用合成画像跑：建立画像 → 生成规划 → 设当前行动 → 提交成果 → 查看地图/报告。
7. 处理一个明确 issue，保持小提交、可回滚、附测试。
