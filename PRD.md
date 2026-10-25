# PRD — AI Image Background Remover（海外站）

| 项目 | 内容 |
|---|---|
| 产品名 | 待定（本文用 `SnapBG` 作占位符，域名用 `snapbg.example` 占位） |
| 定位 | 面向海外用户的在线 AI 抠图工具站，一个核心动作：上传图片 → 得到透明背景 PNG |
| 目标关键词 | `image background remover` |
| 界面语言 | 全英文（站点无中文文案） |
| 文档版本 | v1.0 · 2026-10-25 |
| 本轮范围 | 只做 PRD，不写代码 |

---

## 0. 一页摘要

做一个「一个动作做到极致」的抠图站：英文界面、无需注册即可看到效果、Google 登录送 3 次额度、PayPal 买次数包、不做订阅。后端是一个 Cloudflare Workers 项目，同时吐出 HTML 页面和 JSON API，数据存 D1，去背景能力调用 remove.bg API，无自建服务器。

**三个必须做对的事**：

1. **首屏到结果 ≤ 5 秒**，拖进来就出图，没有注册墙；
2. **页面是服务端渲染的 HTML**（不是空壳 SPA），否则 `image background remover` 这种词根本进不了排名；
3. **成本可算**：一次成功出图 1 credit ≈ 我方成本 $0.20~0.25，定价必须守住 ≥ 40% 毛利。

**一个必须先知道的外部风险**：remove.bg 官方公告 2026-12-01 起背景移除服务迁移至 Leonardo.Ai（同属 Canva），API 计费口径可能变化。本产品把 remove.bg 封装成可替换的 provider 适配层，迁移或换供应商时只改一个文件。

---

## 1. 目标用户与使用场景

### 1.1 目标用户（按优先级）

| 优先级 | 用户画像 | 特征 | 为什么用我们 |
|---|---|---|---|
| P0 | **跨境电商 / Etsy / Shopify 小卖家** | 每天要处理 5~50 张商品图，需要纯白或透明底 | 批量、便宜、不需要订阅、出图即下载 |
| P0 | **自由设计师 / 接单者** | 临时救急，甲方半夜要一张去背图 | 打开即用、无水印、分辨率够用 |
| P1 | **社媒内容创作者 / YouTuber** | 做封面、贴纸、缩略图 | 透明 PNG 直接丢进 Canva/PS |
| P1 | **房地产 / 二手车 / 招聘信息发布者** | 房源图、车图、证件照去背 | 不懂 PS，只要一个干净结果 |
| P2 | **开发者小需求** | 偶尔批量处理几张图 | 后续可引导到 API（Phase 2，不进 MVP） |

**非目标用户**：需要精细蒙版/发丝级手修的商业摄影、需要整图重构的平面设计师、企业级批量 10 万张/年的客户（用 remove.bg 企业版更合适）。

### 1.2 核心使用场景（Job To Be Done）

| # | 场景 | 用户原话（英文，用于文案） | 我们要给的结果 |
|---|---|---|---|
| S1 | 商品上架前统一图片风格 | "I need a clean PNG for my Shopify listing in 1 minute." | 拖入 → 5 秒出图 → 下载透明 PNG |
| S2 | 临时救急 | "Client wants this cut out tonight." | 不用注册、不用装软件、无水印 |
| S3 | 做透明贴纸/头像 | "I want this person cut out for a thumbnail." | 边缘干净、透明通道正确 |
| S4 | 试过别家但被水印/订阅恶心到 | "Why do I have to subscribe for 3 images?" | 明确标价、按次付费、无订阅陷阱 |
| S5 | 担心隐私 | "Where do my photos go?" | 明示不存储、处理完即丢弃 |

### 1.3 用户从哪来（获客假设）

自然搜索占 80%（`image background remover` 及其长尾），Reddit / Pinterest / YouTube 教程导流占 20%。因此 SEO 是产品功能的一部分，不是上线后再补的活。

---

## 2. 核心功能（MVP）

### 2.1 功能清单（P0 = 上线必须有）

| 编号 | 功能 | 优先级 | 说明 |
|---|---|---|---|
| F1 | 上传图片（拖拽或点击选择） | P0 | 支持 JPG / PNG / WEBP，单张，≤ 12MB，≤ 25MP |
| F2 | 调用 remove.bg 去背景 | P0 | 服务端调用，API Key 不出服务端 |
| F3 | 原图 / 结果左右对比 | P0 | 桌面左右分栏，移动端上下叠放；可选棋盘格底看透明区 |
| F4 | 下载透明背景 PNG | P0 | 文件名 `{原名}-no-bg.png` |
| F5 | Google 登录 | P0 | OAuth 2.0 授权码模式，换取账号身份 |
| F6 | 新用户送 3 次免费额度 | P0 | 仅一次，绑定账号，不可重复领取 |
| F7 | PayPal 购买次数包 | P0 | 一次性付款买 credits，不做订阅 |
| F8 | 隐私政策 / 服务条款 / 退款政策 三页 | P0 | 独立 URL，页脚可达，PayPal 审核会看 |
| F9 | 账户页（余额 / 订单 / 使用记录） | P0 | 极简：剩余次数 + 订单列表 |
| F10 | 额度耗尽引导购买 | P0 | 结果页出现「Out of credits」+ 定价按钮，不打断已出图结果 |
| F11 | 批量上传（多张） | P1 | 不进 MVP |
| F12 | 换背景色 / 加白底 | P1 | 前端 canvas 合成即可，成本 0 |
| F13 | 开放 API | P2 | 有自然需求后再做 |

### 2.2 主流程（Happy Path）

```
[落地页 /]
   │  拖拽或点击上传
   ▼
[前端校验] 类型/大小/像素 → 不合格就地报错，不发请求
   │
   ├── 未登录 ──► [Google 登录] ──► 首次登录发 3 credits ──┐
   │                                                      │
   └── 已登录 ────────────────────────────────────────────┤
                                                          ▼
                                    [POST /api/jobs/remove]  multipart
                                                          │
                                    ① 原子扣 1 credit（失败即 402，不出图）
                                                          │
                                    ② 调 remove.bg（size=auto，PNG ≤10MP）
                                                          │
                              ┌───────────────────────────┴───────────┐
                          成功 │                                       │ 失败
                              ▼                                       ▼
                    返回 PNG 字节 + 剩余次数                自动退 1 credit
                              │                           返回错误码 + 文案
                              ▼
                   [结果页：左原图 / 右结果，棋盘格]
                              │
                    ┌─────────┴─────────┐
                    ▼                   ▼
              [Download PNG]      [Try another image]
```

### 2.3 关键交互规则（开发按这个实现）

| 规则 | 值 |
|---|---|
| 免费额度 | 3 credits，仅新账号首次登录发放，重登不再发 |
| 扣费时机 | **调用 remove.bg 之前**扣，失败自动退回（避免刷免费） |
| 1 credit 定义 | 1 张成功去背的全分辨率 PNG（remove.bg `size=auto`，PNG 上限 10MP） |
| 上传限制 | ≤ 12MB；≤ 25 百万像素；长边 ≤ 8000px；格式 JPG/PNG/WEBP |
| 速率限制 | 单账号 10 张/分钟；免费额度期 30 张/天 |
| 图片留存 | **默认不落盘**：结果以字节流返回浏览器，服务端不存原图、不存结果（隐私页可写字面承诺） |
| 未登录行为 | 允许选图，但点「Remove background」时弹 Google 登录（登录后自动续跑，不丢已选文件） |
| 下载 | 结果返回后即生成 blob 下载链接，可重复下载（同一结果不重复扣费，页面刷新后失效） |
| 移动端 | 上传入口同时提供「拍照/相册」调用（`accept="image/*"`） |

### 2.4 异常与边界（必须有明确文案）

| 情况 | HTTP | 前端文案（英文） |
|---|---|---|
| 未登录 | 401 | Sign in with Google to continue |
| 额度不足 | 402 | You're out of credits. Get more to keep removing backgrounds. |
| 文件太大 / 像素超限 | 413 / 422 | This image is too large. Max 12MB / 25 megapixels. |
| 格式不支持 | 415 | Please upload a JPG, PNG or WEBP file. |
| 抠图主体识别失败 | 422 | We couldn't find a clear subject. Try a photo with a distinct foreground. |
| remove.bg 限流 / 超时 | 429 / 504 | The service is busy. Your credit was refunded, please try again. |
| 服务端异常 | 500 | Something broke on our side. Your credit was refunded. |

> 原则：**任何失败都自动退额度**，并且文案里明确说「已退款」——这类站点最大的差评来源就是「扣了钱没出图」。

---

## 3. 页面结构

### 3.1 站点地图

| 路径 | 页面 | 渲染方式 | 是否索引 |
|---|---|---|---|
| `/` | 首页 = 工具页（H1 + 上传区 + 对比区 + FAQ + 内链） | SSR | ✅ |
| `/pricing` | 定价页（3 个次数包 + 退款说明 + FAQ 片段） | SSR | ✅ |
| `/account` | 账户页（余额、订单、使用记录） | SSR（需登录） | ❌ noindex |
| `/privacy` | Privacy Policy | SSR | ✅ |
| `/terms` | Terms of Service | SSR | ✅ |
| `/refund` | Refund Policy | SSR | ✅ |
| `/login` | 登录中转（也可做成弹层，这里是兜底直链） | SSR | ❌ |
| `/auth/google/callback` | OAuth 回调，处理完 302 回站内 | 无页面 | ❌ |
| `/404` | 兜底页 + 返回工具入口 | SSR | ❌ |
| `/robots.txt`、`/sitemap.xml` | 由 Worker 动态输出 | 纯文本/XML | — |

> MVP 不做的页面：博客、AI 换背景、批量页、API 文档、多语言。这些是 Phase 2 的 SEO 扩量位。

### 3.2 各页要素

**`/` 首页（唯一重要的页面）**

| 区块 | 内容 |
|---|---|
| 顶部导航 | Logo · Pricing · FAQ(锚点) · Sign in / 头像+剩余次数 |
| Hero | H1：**Free AI Image Background Remover**；副标题一句说清「Upload a photo, get a transparent PNG in seconds — no watermark」 |
| 上传区 | 大拖拽区（`Drop your image here or click to upload`）+ 支持格式/大小提示 + `Remove Background` 按钮 |
| 结果区 | 左 Original / 右 Result（棋盘格透明底）；按钮：`Download PNG`、`Try another`；顶部提示「1 credit used · X left」 |
| 价值点（3 列） | No watermark · Full resolution · Pay per image, no subscription |
| 使用步骤（3 步） | Upload → AI removes the background → Download transparent PNG |
| 适用场景 | 商品图 / 头像 / 贴纸 / 房源车图（每项一张小样图，纯 CSS 或静态图） |
| FAQ | 8~10 条（见 §6.3），首条默认展开 |
| 页脚 | Pricing · Privacy · Terms · Refund · 版权 · 联系邮箱 |

**`/pricing`**：3 个价格卡（含每张单价换算）、`What's a credit?` 说明、退款链接、PayPal 付款按钮、常见问题 4 条。「No subscription. Credits never auto-renew.」

**`/account`**：剩余 credits 大字、`Buy more credits` 按钮、订单表（日期/包名/金额/PayPal 交易号/状态）、使用记录（日期/文件名/张数）。不做图片历史。

**三张法律页**：MVP 阶段用模板化英文文本（隐私页必须写清：图片仅用于本次处理、不存储、不用于训练；使用 Google OAuth 获取 email 与基础资料；使用 PayPal 处理支付；使用 Cloudflare 作为基础设施；Cookie 仅用于会话）。

---

## 4. 定价方案（参考 remove.bg）

### 4.1 竞品实测（2026-10-25 抓取）

| remove.bg 项目 | 数值 |
|---|---|
| 按量付费（PAYG） | 3 credits = **$3**（约 $1.00/张） |
| 订阅 | **40 credits / 月 = $9**（约 $0.225/张，但必须订阅） |
| API 免费额度 | 每月 **50 次** 免费调用 |
| API 计费 | `preview`(0.25MP) = **0.25 credit**；全分辨率 = **1 credit** |
| 输出上限 | PNG **≤ 10MP**；输入 ≤ 22MB / 50MP |
| 限速 | 每分钟 500 张 ÷ 输入百万像素 |
| 备注 | 官方公告：**2026-12-01 起迁移至 Leonardo.Ai**，计费口径可能变动 |

**我们的切入点**：remove.bg 单张贵、订阅绑定、水印/降分辨率逼你付费；我们的差异是 **按张买、不用订阅、不加水印、单价明确**。

### 4.2 成本模型（决定定价的底线）

| 项 | 假设值 | 说明 |
|---|---|---|
| remove.bg 单张成本 | **$0.20 ~ $0.25** | 按批量/订阅档折算的 credit 成本，取中位 $0.22 计 |
| PayPal 手续费 | 3.49% + $0.49/笔（跨境另加） | 小额包的费率吃掉不少利润 |
| Cloudflare | $5/月 Workers Paid + D1/R2 用量 | 前期可忽略，算固定成本 |
| 单笔失败成本 | 3 credits ≈ $0.66 | 免费额度实际是获客成本 |

### 4.3 建议定价（MVP 首发）

| 包名 | 价格 | 图片数 | 单张价 | 我方成本 | PayPal 费 | 毛利 | 毛利率 |
|---|---|---|---|---|---|---|---|
| **Starter** | $4.90 | 10 | $0.49 | $2.20 | ≈$0.66 | **$2.04** | 42% |
| **Creator**（主推） | $12.90 | 30 | $0.43 | $6.60 | ≈$0.94 | **$5.36** | 42% |
| **Pro** | $29.90 | 80 | $0.37 | $17.60 | ≈$1.53 | **$10.77** | 36% |
| 免费体验 | $0 | 3 | — | $0.66 | — | 获客成本 | — |

**定价理由**

- 定价区间卡在 remove.bg 的 **$1.00 单张** 和 **$0.225 订阅价** 之间：比单张便宜 50%+，又不用订阅。
- 不收 $2.99/$4.99 以下的极小包：PayPal 固定费 $0.49 会把毛利吃到 20% 以下。
- 不做「无限次」：成本是线性的，无限次必然崩。
- 上线 2 周后做一次 **Creator 包 $9.90 限时价** A/B，看转化率与毛利率的平衡点。

**退款规则（与 `/refund` 页面文案一致）**

- 未使用的 credits：购买后 **14 天内**可全额退（PayPal 原路退回）。
- 已消耗的 credits：不退。
- 技术故障导致的失败：系统自动退 credit；若反复失败，人工全额退款。
- 明确写「Credits never expire」（对比 remove.bg 的积分到期，是我们的信任卖点）。

**Phase 2 可加的变现**：$19/月订阅（150 张）、白底/换底色增值、批量 ZIP 下载。

---

## 5. 技术方案

### 5.1 总体架构

```
                    ┌──────────────────────────────────────────┐
   Browser  ──────► │  Cloudflare Workers（单项目，单域名）      │
   (HTML/CSS/JS)    │                                          │
                    │  GET  /、/pricing、/privacy … → SSR HTML  │
                    │  POST /api/jobs/remove        → 抠图      │
                    │  GET  /api/auth/google/*      → 登录      │
                    │  POST /api/paypal/*           → 支付      │
                    └───────┬──────────────┬───────────────────┘
                            │              │
                  ┌─────────▼──────┐  ┌────▼─────────────┐
                  │ D1 (SQLite)    │  │ remove.bg API    │
                  │ users/credits  │  │ (X-Api-Key)      │
                  │ orders/jobs    │  └──────────────────┘
                  └────────────────┘
                            │
                  ┌─────────▼──────────┐
                  │ Google OAuth 2.0   │
                  │ PayPal Orders v2   │
                  └────────────────────┘
```

**硬性约束（用户已定，不再讨论）**

- 一个 Cloudflare Workers 项目同时提供网页与接口，**不用 Next.js**，**无自建服务器**。
- 数据库用 **Cloudflare D1**。
- 所有密钥只存在 **`.env`（本地）** 与 **Cloudflare 环境变量 / Secret（线上）**，代码里零硬编码，`.env` 进 `.gitignore`。

### 5.2 技术栈选型

| 层 | 选型 | 理由 |
|---|---|---|
| 运行时 | Cloudflare Workers（Paid 计划 $5/月） | 需要 SSR + 长请求 + 更高限额 |
| 路由/框架 | **Hono**（约 20KB，Workers 原生） | 路由/中间件/多路由清晰；也可以零依赖手写 router，不作硬要求 |
| 静态资源 | Workers Static Assets（`assets` 绑定） | CSS/JS/图片走 CDN，不占 Worker 请求 |
| 页面渲染 | 服务端字符串模板（模板字面量或 tiny 模板函数） | **必须 SSR**，SEO 是核心需求；不引入 SPA 框架 |
| 前端交互 | 原生 JS + `fetch`（约 200 行） | 只有上传/进度/对比/下载，无需框架 |
| 数据库 | D1 | 关系型、够用、$0 起 |
| 会话 | 签名 HttpOnly Cookie（JWT/HS256，`SESSION_SECRET`） | 无状态、无需 session 表 |
| 图片处理 | 服务端直接调 remove.bg，结果字节流回传 | 不在服务端存图（隐私承诺 + 省 R2 成本） |
| 支付 | PayPal Orders v2（Create + Capture）+ Webhook | 服务端 capture 校验金额，防篡改 |
| 部署 | `wrangler deploy` | 单命令上线 |

### 5.3 目录结构（建议，编码阶段可直接建）

```
bg-remover/
├─ .env                      # 本地密钥唯一真源（git 忽略）
├─ .dev.vars                 # 由 npm run env:sync 从 .env 生成（git 忽略）
├─ .gitignore
├─ wrangler.toml             # name/assets/d1_bindings/observability
├─ package.json
├─ migrations/
│  └─ 0001_init.sql
├─ public/                   # Workers Assets 静态资源
│  ├─ styles.css
│  ├─ app.js                 # 上传/对比/下载交互
│  └─ img/*                  # 示例图、logo、og-image
└─ src/
   ├─ index.js               # Worker 入口，挂载所有路由
   ├─ routes/
   │  ├─ pages.js            # SSR 页面路由
   │  ├─ auth.js             # Google OAuth
   │  ├─ jobs.js             # 抠图接口
   │  └─ paypal.js           # 下单/捕获/webhook
   ├─ services/
   │  ├─ provider.js         # ⭐ remove.bg 适配层（可替换供应商）
   │  ├─ credits.js          # 原子扣费/退款/查询
   │  ├─ paypal.js           # PayPal REST 封装
   │  └─ session.js          # Cookie 签发/校验
   ├─ views/                 # 页面模板（home/pricing/account/legal/404）
   └─ lib/
      ├─ http.js             # json() / html() / error() 工具
      └─ validate.js         # 文件类型/大小/像素校验
```

> `services/provider.js` 是对抗「remove.bg 迁移 Leonardo」风险的关键：所有外部抠图调用只经过这一个文件，换供应商只改这里。

### 5.4 接口契约

| 方法 | 路径 | 鉴权 | 入参 | 出参 |
|---|---|---|---|---|
| `POST` | `/api/jobs/remove` | 登录 | `multipart/form-data`: `image` | `200` `image/png` 二进制；Header: `X-Credits-Remaining`；失败返回 JSON |
| `GET` | `/api/me` | 登录 | — | `{email, name, avatar, credits, freeGranted}` |
| `GET` | `/api/auth/google` | 公开 | — | `302` → Google 授权页（带 `state`） |
| `GET` | `/api/auth/google/callback` | 公开 | `code`, `state` | `302` → 站内，写会话 Cookie |
| `POST` | `/api/auth/logout` | 登录 | — | `204`，清 Cookie |
| `GET` | `/api/packs` | 公开 | — | `[{id, name, price, currency, credits}]` |
| `POST` | `/api/paypal/orders` | 登录 | `{packId}` | `{paypalOrderId, approveUrl}` |
| `POST` | `/api/paypal/orders/:id/capture` | 登录 | — | `{status, credits, balance}` |
| `POST` | `/api/paypal/webhook` | PayPal 签名 | PayPal 事件体 | `200`（幂等） |
| `GET` | `/api/health` | 公开 | — | `{ok:true, ts}` |

统一错误格式：`{ error: { code, message, creditsRefunded?: boolean } }`。

### 5.5 D1 数据模型（`migrations/0001_init.sql` 提纲）

```sql
-- 用户
CREATE TABLE users (
  id            TEXT PRIMARY KEY,            -- uuid
  google_sub    TEXT UNIQUE NOT NULL,
  email         TEXT NOT NULL,
  name          TEXT,
  avatar_url    TEXT,
  created_at    INTEGER NOT NULL,
  last_login_at INTEGER
);

-- 额度流水（唯一真源，余额 = SUM(delta)）
CREATE TABLE credits_ledger (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id),
  delta      INTEGER NOT NULL,              -- +N 充值/赠送，-1 消耗
  reason     TEXT NOT NULL,                  -- signup_bonus | purchase | job_charge | job_refund | manual
  ref_id     TEXT,                           -- job_id / order_id / 幂等键
  created_at INTEGER NOT NULL
);
CREATE INDEX idx_ledger_user ON credits_ledger(user_id, created_at);
CREATE UNIQUE INDEX uq_ledger_ref ON credits_ledger(ref_id, reason);  -- 幂等
CREATE UNIQUE INDEX uq_signup_bonus ON credits_ledger(user_id) WHERE reason='signup_bonus';

-- 订单
CREATE TABLE orders (
  id              TEXT PRIMARY KEY,
  user_id         TEXT NOT NULL REFERENCES users(id),
  pack_id         TEXT NOT NULL,
  credits         INTEGER NOT NULL,
  amount_cents    INTEGER NOT NULL,
  currency        TEXT NOT NULL DEFAULT 'USD',
  paypal_order_id TEXT UNIQUE NOT NULL,
  paypal_capture_id TEXT,
  status          TEXT NOT NULL,             -- created | captured | failed | refunded
  created_at      INTEGER NOT NULL,
  updated_at      INTEGER NOT NULL
);

-- 抠图任务（不存图片字节，只存元数据，用于计数与排障）
CREATE TABLE jobs (
  id           TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL REFERENCES users(id),
  status       TEXT NOT NULL,                -- ok | failed
  input_bytes  INTEGER,
  input_format TEXT,
  provider     TEXT NOT NULL DEFAULT 'remove_bg',
  duration_ms  INTEGER,
  error_code   TEXT,
  created_at   INTEGER NOT NULL
);
CREATE INDEX idx_jobs_user ON jobs(user_id, created_at DESC);
```

**扣费原子性做法（D1 无多语句事务，用单条 SQL 保证）**

```sql
INSERT INTO credits_ledger (id, user_id, delta, reason, ref_id, created_at)
SELECT ?1, ?2, -1, 'job_charge', ?3, ?4
WHERE (SELECT COALESCE(SUM(delta),0) FROM credits_ledger WHERE user_id = ?2) >= 1;
```
影响行数 = 0 → 直接 402，不调 remove.bg。失败时插入 `+1 / job_refund`，唯一索引保证不重复退。

### 5.6 密钥与环境变量

| 变量 | 用途 | 存放 |
|---|---|---|
| `REMOVE_BG_API_KEY` | remove.bg 调用 | `.env` / `wrangler secret` |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google OAuth | 同上 |
| `PAYPAL_CLIENT_ID` / `PAYPAL_CLIENT_SECRET` / `PAYPAL_MODE` | PayPal（sandbox/live） | 同上 |
| `SESSION_SECRET` | 会话 Cookie 签名（32+ 随机串） | 同上（**需新增**） |
| `APP_BASE_URL` | 回调地址拼接（`https://snapbg.example`） | 同上（**需新增**） |
| `ENVIRONMENT` | dev / prod | `wrangler.toml` vars |

**执行细节（避免踩坑）**

- 本地开发：Wrangler 只认 `.dev.vars`，所以保留 `.env` 作唯一真源，加一个 `npm run env:sync`（把 `.env` 转成 `.dev.vars`）。两个文件都进 `.gitignore`。
- 线上：`wrangler secret put REMOVE_BG_API_KEY` 逐个写入，**不要**把 secret 写进 `wrangler.toml`。
- 前端永不接触任何 Key；remove.bg 只从 Worker 出口调用（可在 Cloudflare 侧把出口 IP 报给 remove.bg，如对方支持白名单）。
- Google Console 与 PayPal 后台的回调白名单需登记线上域名与 `/api/...` 路径。

### 5.7 平台限额对齐（编码时按这张表设阈值）

| 限制 | Cloudflare 侧 | remove.bg 侧 | 我们取的值 |
|---|---|---|---|
| 请求体大小 | Workers 100MB | 22MB | **12MB** |
| 像素 | — | 50MP | **25MP** |
| PNG 输出 | — | ≤10MP | 请求 `size=auto`，PNG 输出按官方上限 |
| 单请求耗时 | CPU 30s（Paid） | 通常 2~8s | 前端 30s 超时，10s 起显示进度条 |
| 供应商限流 | — | 500 ÷ 百万像素 / 分钟 | 单账号 10 张/分钟，超限排队提示 |

### 5.8 部署与运维

- `wrangler deploy` 上线；`wrangler tail` 看实时日志；开启 Workers Observability 记录 `jobs` 成功/失败率。
- 每日看两个数：**fail rate**（>3% 就要查供应商）、**credits consumed vs purchased**（决定定价是否需要调）。
- 备份：`wrangler d1 export` 每日一次到本地（或 R2）。
- 灰度：先 sandbox PayPal 跑通全链路（登录→扣费→出图→退款），再切 `PAYPAL_MODE=live`。

---

## 6. SEO

### 6.1 关键词布局

| 层级 | 关键词 | 落位 |
|---|---|---|
| 主词 | image background remover | `/` 的 `<title>`、H1、正文首段 |
| 次主词 | remove background from image / background remover free / transparent PNG maker | H2、正文自然出现 |
| 长尾 | remove background from photo free, image background remover online, make background transparent png, remove white background from image | FAQ 问句、场景段落 |
| 交易词 | buy background remover credits, no subscription background remover | `/pricing` |

### 6.2 页面 Meta（逐页给出）

| 页面 | `<title>`（≤ 60 字符） | `<meta name="description">`（≤ 155 字符） |
|---|---|---|
| `/` | Image Background Remover — Free Transparent PNG in Seconds | Remove the background from any image in seconds. Free AI background remover, no watermark, full-resolution transparent PNG. No subscription — pay per image. |
| `/pricing` | Pricing — Buy Background Removal Credits, No Subscription | Buy credits from $4.90. 10 images for $4.90, no subscription, no auto-renew, credits never expire. Pay securely with PayPal. |
| `/privacy` | Privacy Policy — How We Handle Your Images | We process your image only to remove its background and never store it. Read how we handle your data, cookies and third-party services. |
| `/terms` | Terms of Service — Usage Rules and Limits | The rules for using our background remover: acceptable use, credits, accounts, liability and service availability. |
| `/refund` | Refund Policy — 14-Day Refund on Unused Credits | Unused credits are refundable within 14 days. Failed removals are refunded automatically. Read the full refund policy. |

**SEO 技术要点**

- 全部页面 SSR，首屏 HTML 里直接有正文与 FAQ 文本（不靠 JS 注入）。
- 每页唯一 `<title>` / `<h1>`；`/account`、`/login` 加 `noindex`。
- Open Graph + Twitter Card（`og:image` 用「原图/结果」对比图，1200×630）。
- `sitemap.xml` / `robots.txt` 由 Worker 动态生成，提交 Google Search Console + Bing。
- 内链：首页 → pricing → 三个法律页；FAQ 里链到 pricing，pricing 里链回工具。
- Canonical 用绝对 URL；只做英文（`hreflang` 暂不配）。
- 结构化数据：`WebApplication`（首页）+ `FAQPage`（首页 FAQ）+ `Product`/`Offer`（定价页）。

### 6.3 FAQ（首页展示 + FAQPage JSON-LD）

**1. Is this image background remover free?**
You get 3 free removals when you sign in with Google — no credit card needed. After that you buy credits in packs; 10 images cost $4.90 and credits never expire.

**2. Do I need to create an account?**
You can drop an image and try the tool right away. To use your free credits and keep track of purchases you sign in with Google in one click — we never see your password.

**3. What file formats and sizes can I upload?**
JPG, PNG and WEBP up to 12MB and 25 megapixels. The result is always a transparent PNG at full resolution.

**4. Will the downloaded image have a watermark?**
No. Every paid removal downloads a clean, full-resolution PNG with a transparent background and no watermark.

**5. How long does it take?**
Most images finish in 3 to 6 seconds. Large photos can take a little longer.

**6. Do you store my images?**
No. Your image is sent to our background-removal provider only to produce the result, then discarded. We don't keep your photos, and we never use them to train models.

**7. What happens if the removal fails?**
Your credit is refunded automatically and the error message tells you so. If it keeps failing, contact us and we'll refund the purchase.

**8. Can I use the images commercially?**
Yes. You keep all rights to the images you upload and to the results. See our Terms for the small print.

**9. Do credits expire?**
Never. Credits stay on your account until you use them.

**10. How do payments work?**
All payments are handled by PayPal. We never see or store your card details. Unused credits can be refunded within 14 days.

```html
<script type="application/ld+json">
{"@context":"https://schema.org","@type":"FAQPage","mainEntity":[
  {"@type":"Question","name":"Is this image background remover free?",
   "acceptedAnswer":{"@type":"Answer","text":"You get 3 free removals when you sign in with Google. After that, credits start at $4.90 for 10 images and never expire."}}
]}
</script>
```

---

## 7. 验收标准（MVP 上线判据）

1. 沙箱环境走通完整链路：Google 登录 → 得 3 credits → 出图 → 下载透明 PNG → 用 PayPal sandbox 买 10 credits → 弹新额度 → 扣 1 张 → 余额正确。
2. 失败场景实测：超大文件、非图片、remove.bg 断网（改 Key 模拟）→ 均自动退额度，前端文案正确。
3. 首页 HTML 源码（禁用 JS 情况下）能看到 H1、正文、10 条 FAQ 全文。
4. 移动端 Safari / Chrome 可完成全流程（含相册选图）。
5. 站点无任何硬编码密钥；`git grep -i "sk_\|api_key"` 无结果；`.env`、`.dev.vars` 未入库。
6. 三个法律页可访问，页脚全站可达；PayPal 后台已完成商家信息与政策页链接登记。

## 8. 里程碑

| 阶段 | 交付 |
|---|---|
| M1（第 1 周） | Workers 骨架 + D1 建表 + `/` SSR + remove.bg 打通（先不限额度） |
| M2（第 2 周） | Google 登录 + 会话 + 原子扣费/退款 + 对比与下载 UI |
| M3（第 3 周） | PayPal sandbox 全链路 + `/pricing` + `/account` + 三张法律页 |
| M4（第 4 周） | SEO 收尾（meta/sitemap/JSON-LD）、移动端打磨、切 live、Search Console 提交 |

## 9. 风险登记

| 风险 | 影响 | 应对 |
|---|---|---|
| **remove.bg 2026-12-01 起迁移 Leonardo.Ai，计费/接口可能变** | 核心能力中断或成本上升 | `services/provider.js` 适配层隔离；同步准备 1 个备选供应商（如 Photoroom / Clipdrop / 自建 rembg 在容器里），保证 1 天内可切换 |
| 关键词 `image background remover` 竞争极其激烈 | 自然流量起量慢 | 先吃长尾（`remove white background from image` 等）+ 做 3~5 个场景落地页；同时准备 Reddit/Pinterest 冷启动 |
| PayPal 对中国主体收款与提现限制 | 收不到钱或提现慢 | 上线前用真实小额验证 live 收款与提现；如受阻，备选 Paddle / Lemon Squeezy（Merchant of Record，顺带解决欧盟 VAT） |
| 成本线性、毛利薄（36~42%） | 价格战打不动 | 严守「不做无限量套餐」；量涨后重新谈 remove.bg 单价；Phase 2 加白底/批量增值 |
| 免费额度被刷 | 获客成本失控 | 必须登录才发额度 + 单账号速率限制 + 同 IP 注册监控 |
