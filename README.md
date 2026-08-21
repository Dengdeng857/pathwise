# Pathwise 小径

面向学生和应届生的个人职业规划陪伴助手。它根据画像、简历、项目、面试复盘和持续进展，动态生成“现在可投、毕业可达、当前差距”以及三阶段行动路径。

## 核心闭环

1. 上传简历或填写基础画像。
2. AI 返回岗位范围、差距和三个行动阶段。
3. 每个行动项都有个性化执行指导、预计耗时和完成标准。
4. 完成行动后记录成果，自动进入“进展与证据链”。
5. AI 根据新证据重新调整岗位匹配与后续路径。

## 本地运行

```bash
python3 -m pip install -r requirements.txt
python3 server.py
```

打开 `http://127.0.0.1:8787/career.html`。

模型配置放在项目根目录 `.env`，不要提交到 Git：

```bash
MODELSNEXUS_API_KEY=your_key
AI_BASE_URL=https://modelsnexus.org/v1
AI_MODEL=qwen3.7-max
AI_TRANSPORT=curl
```

没有模型 Key 时，产品会使用本地规划和本地行动指导，完整交互仍可演示。

## 上传 GitHub

先在 GitHub 新建一个空仓库，例如 `pathwise`，不要勾选自动创建 README。然后在本项目目录执行：

```bash
git init
git add .
git commit -m "feat: launch Pathwise career companion"
git branch -M main
git remote add origin https://github.com/YOUR_NAME/pathwise.git
git push -u origin main
```

提交前运行 `git status`，确认 `.env` 没有进入暂存区。曾在聊天或日志中出现过的 Key 应先作废并重新生成。

## 部署 Cloudflare Pages

推荐使用 Cloudflare Pages 的 Git 集成：

1. 进入 **Workers & Pages → Create → Pages → Connect to Git**。
2. 选择 GitHub 中的 `pathwise` 仓库。
3. Framework preset 选择 `None`。
4. Build command 留空，Build output directory 填 `/`。
5. 在 **Settings → Variables and Secrets** 添加加密 Secret `MODELSNEXUS_API_KEY`。
6. 可选添加 `AI_BASE_URL=https://modelsnexus.org/v1` 和 `AI_MODEL=qwen3.7-max`。

重新部署后访问 `https://YOUR_PROJECT.pages.dev/`。

Cloudflare Pages Functions 位于 `functions/api/`，线上 Key 只存在于 Cloudflare Secret，不会进入浏览器。线上材料解析支持 PDF、TXT、MD、JSON、CSV；本地 Python 版额外支持已配置的图片和音频解析。

## 项目结构

- `career.html`：核心产品界面
- `career.js`：状态、交互、AI 请求与本地留存
- `redesign.css`：完整的响应式界面系统
- `server.py`：本地 Python API、模型代理和材料解析
- `functions/api/`：Cloudflare Pages Functions
- `package.json`：Cloudflare PDF 解析依赖

所有用户数据默认保存在当前浏览器的 `localStorage`。一键重置只清理该浏览器中的 Pathwise 数据，不会删除服务器配置或模型 Secret。
