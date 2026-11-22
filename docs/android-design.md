# 小拼手 SpellPal · Android v1 设计文档

> 版本 v1.1 ｜ 2026-11-20 ｜ 目标平台 Android 8.0+（minSdk 26）
> 对应桌面端 v0.12.0（19 册 / 115 单元 / 1765 词 / 564 句 / 1529 条音频）

## 决策记录

| 项 | 结论 | 影响 |
|---|---|---|
| 技术栈 | 原生 Kotlin + Jetpack Compose | 全量重写，但复用数据与音频 |
| 首版范围 | 完整对齐桌面端 | 错题本、SRS、守护都做 |
| 应用名 | 小拼手 | — |
| 包名 | `com.spellpal.app` | **发布后不可更改**，debug 包加 `.debug` 后缀并存 |
| 图标 | 复用桌面版主体 | 需重做各密度与自适应前景，见 §9.5 |
| 进度迁移 | 不做同步 | 手机与桌面各自记账，字段格式保持一致以便将来导出 |
| 分发 | **暂不上架商店**，自装 APK | 合规从"关键路径"降为"将来上架前的前置"，见 §13 |

---

## 1. 目标与非目标

**目标**

1. 与桌面端**能力对齐**的 Android 原生应用，全量教材随包发布，安装即用
2. **完全离线**：不申请网络权限、无账号、无广告、无第三方 SDK
3. 触屏优先：竖屏单列、自绘键盘、拇指可达
4. 家长可控：6 位密码 + 每日时长 + 沉浸式全屏 + 时间到锁屏

**非目标（v1 明确不做）**

| 不做的事 | 原因 |
|---|---|
| iOS 端 | 单独立项，不在本期 |
| 平板双栏布局 | 只做居中限宽，双栏留 v2 |
| 云同步 / 多端进度互通 | 需要后端与账号，与"零收集"冲突 |
| 教材在线更新 | 音频与词库随包发布，更新走应用版本 |
| 跟读录音评分 | 需 ASR，v2 评估 |

---

## 2. 可复用资产盘点

| 资产 | 位置 | 体量 | Android 侧处理 |
|---|---|---|---|
| 词库 JSON | `src/data/books/*.json` | 19 个 / 956 KB | 原样进 `assets/books/`，结构不改 |
| 音频 | `public/voice/*.mp3` | 1529 条 / 18.3 MB | 打包期转码进 `assets/voice/`，见 §7 |
| 音频索引 | `src/data/voice-index.json` | 1529 键 | 原样复用，键为 sha1 前 12 位 |
| 输入判定 | `src/core/typing.ts` | 155 行 | Kotlin 重写为纯函数 |
| 词句配对 | `src/core/pairing.ts` | 112 行 | Kotlin 重写（最大匹配 + 屈折变体） |
| 错题本 SRS | `src/utils/srs.ts` | 6 档间隔 0/1/3/7/16/35 天 | Kotlin 重写，字段与桌面一致 |
| 密码散列 | `src/core/pin.ts` | djb2 + FNV 反向 + 固定盐 | 同算法 Kotlin 实现，散列可互通 |
| 视觉规范 | `tailwind.config` + CSS 变量 | — | 映射为 Compose `Theme` |

**不可复用**：全部 UI 组件（桌面为鼠标 + 自绘键盘，触屏需重排）、窗口控制、Web Audio 处理链。

---

## 3. 平台差异与设计影响

三件事必须先定，否则后面返工。

### 3.1 "无法关闭软件"在 Android 上的真实边界

普通应用**拦不住 Home 键与最近任务**，这是系统级限制。可行手段与代价：

| 手段 | 能拦住 | 代价 |
|---|---|---|
| 沉浸式全屏 + 返回键拦截 | 状态栏、导航栏、返回键 | 无，必做 |
| 屏幕固定（系统功能） | Home / 最近任务 | 需引导家长在系统设置开启 |
| LockTask（设备管理员） | 全部，接近 kiosk | 需设备所有者，家庭场景要 adb 初始化 |
| 无障碍服务监听 | 跳出后拉回 | **上架审核高风险，儿童类常被拒** |

**v1 决策**：沉浸式全屏 + 返回键拦截 + 屏幕固定引导页，**不申请无障碍与设备管理员权限**，保证过审。

补充控制（不依赖系统权限也能成立）：

- 应用不在前台即**暂停计时**，回到前台继续
- 时间到立刻锁屏，解锁必须密码
- 家长按 Home 离开不消耗额度，回来仍受限 —— 目标（控制学习时长）依然达成

> 定位声明：这是**自律工具**，不是防沉迷系统。家长可强行停止应用绕过，文档与商店描述里如实写明。

### 3.2 发音

桌面端"中文音色念英文"的根因在 Android 同样存在，且各厂商 TTS 质量差异比 Windows 更大。自带音频包后与系统 TTS 无关，且可在打包期完成响度归一化，运行期零处理。`TextToSpeech` 仅作索引未命中时的兜底。

### 3.3 输入

**不用系统输入法**。候选栏、联想、自动纠错都会干扰拼写判定，且不同 ROM 的 IME 高度不可控。全部自绘键盘，不弹 IME：

```kotlin
WindowCompat.setDecorFitsSystemWindows(window, false)
// 不使用 TextField，键盘为 Compose 自绘的 Button 网格
```

---

## 4. 技术选型

| 维度 | 选择 | 理由 |
|---|---|---|
| 语言 | Kotlin 2.x | 官方主推，协程与 Compose 原生配合 |
| UI | Jetpack Compose（BOM）+ Material3 | 声明式，动画与自适应布局成本低 |
| 最低版本 | minSdk 26 / Android 8.0 | 覆盖 95%+ 存量设备，且支持自适应图标 |
| 目标版本 | targetSdk 取上架当年商店要求 | 商店逐年提高，预留升级余量 |
| 序列化 | kotlinx.serialization | 编译期生成，无反射，冷启动快 |
| 存储 | DataStore（Preferences + 自定义 Serializer） | 见 §6，不用 Room |
| 并发 | Coroutines + Flow | 与 Compose 的 `collectAsStateWithLifecycle` 直连 |
| DI | 无框架，手工单例容器 | 模块数 < 10，Hilt 的编译耗时与包体不划算 |
| 音频 | 系统 `MediaPlayer` 双实例轮换 | 单文件短音频够用，省掉 ExoPlayer 约 400 KB |
| 网络 | **不引入** | 无网络权限，见 §13 |
| 测试 | JUnit4 + Truth + Robolectric + Compose UI Test | 纯函数用 JVM 单测，UI 用设备测试 |

---

## 5. 架构设计

**单 Activity + 自研极简路由**（4 个目的地，不引 Navigation 组件，省一层样板）。

单向数据流：

```
Compose UI ──事件──▶ ViewModel ──调用──▶ domain 纯函数
    ▲                                        │
    └───────── UiState (StateFlow) ◀─────────┘
                       │
                       └── 旁路持久化 ──▶ DataStore
```

domain 层**零 Android 依赖**，全部可在 JVM 上单测，这是质量的底线。

### 包结构

```
app/src/main/java/com/spellpal/app/
├── MainActivity.kt              // 单 Activity，窗口装饰与沉浸式
├── App.kt                       // Application，容器初始化
├── di/Container.kt              // 手工依赖容器（懒加载单例）
├── data/
│   ├── BookRepository.kt        // assets 读 JSON，内存缓存
│   ├── VoiceRepository.kt       // 索引加载 + 播放器池
│   ├── SettingsStore.kt         // 主题/字号/音量/键盘
│   ├── ProgressStore.kt         // 单元进度
│   ├── SrsStore.kt              // 错题本
│   └── GuardStore.kt            // 守护状态
├── domain/
│   ├── TypingEngine.kt          // 输入判定（纯函数）
│   ├── Pairing.kt               // 词句配对（纯函数）
│   ├── SrsScheduler.kt          // 复习排程（纯函数）
│   ├── GuardClock.kt            // 计时/跨天/额度（纯函数）
│   └── model/                   // Book / Unit / Word / Sentence / Token
└── ui/
    ├── theme/                   // 配色、字号、圆角
    ├── common/                  // 键盘、进度环、抖动动画
    ├── shelf/                   // 书架
    ├── practice/                // 练习
    ├── result/                  // 结果
    ├── settings/                // 设置
    └── guard/                   // 设置密码、验证、锁屏
```

---

## 6. 数据与存储

### 只读资源（assets，随包发布）

```
assets/books/*.json        // 19 个，结构与桌面一致
assets/voice-index.json    // 1529 键
assets/voice/*.m4a         // 1529 条，见 §7
```

首次启动**不拷贝到内部存储**，直接读 assets；音频用 `AssetFileDescriptor` 打开，零拷贝。

### 用户数据（DataStore）

| 文件 | 内容 | 估算 |
|---|---|---|
| `settings` | theme, fontScale(0/1/2), volume, kbOn, bookId | < 1 KB |
| `guard` | on, pinHash, minutes, date, usedSec, bonusSec | < 0.5 KB |
| `progress` | `{"bookId#unit": {done, acc, at, times}}` | ~2 KB |

> M1 落地时进度先用 `SharedPreferences` 存一段 JSON（`ProgressStore`），字段名与桌面端 `spellpal:progress` 完全一致；等 M3/M4 上 SRS 与守护时再统一搬 DataStore，迁移只需换存储层。
| `srs` | `{cards:[{id, box, wrong, right, due, last}]}` | 满 564 条约 90 KB |

不用 Room 的理由：数据量小、单用户、结构简单，且**保留 JSON 便于与桌面端互导**。单文件 < 100 KB，全量读写成本可忽略，写入放在 `Dispatchers.IO`。

**散列兼容**：pin 算法与桌面完全一致（djb2 + FNV 反向 + 固定盐，输出 `g1:` 前缀），同一密码在两端散列相同，将来做备份迁移可直接校验。

**迁移**：每个文件带 `schemaVersion`，读取时版本低于当前则走升级函数，不做破坏性重写。

---

## 7. 音频方案

桌面端在运行时做归一化与裁剪，是因为 Web Audio 提供了处理链。Android 上改到**打包期一次性完成**，运行期只播文件，链路短、延迟低、可控。

### 转码流水线（新增 `scripts/audio_android.py`）

1. 读 `public/voice/*.mp3` 与 `voice-index.json`
2. 裁首尾静音（`silenceremove` 阈值 -42 dB，两端各留 30 ms）
3. 响度归一化（`loudnorm` I=-18 LUFS，对齐桌面端 -18 dBFS 目标）
4. 转 AAC-LC 单声道 24 kHz 48 kbps → `assets/voice/<hash>.m4a`
5. 输出 `assets/voice-index.json`（键不变，只改扩展名映射）
6. **校验**：抽 20 条 `ffprobe` 读峰值与 RMS，断言 peak < -1 dBFS、RMS ∈ [-20, -16]

预期体积 18.3 MB → **12–13 MB**，主要收益来自裁掉每条尾部 0.9–1.1 秒空白（桌面端实测 `hello` 全长 1.87 s、有声仅 0.56 s）。

### 播放

- 双 `MediaPlayer` 实例轮换：当前播放 + 预取下一条，首播目标 < 150 ms
- `setDataSource(afd.fileDescriptor, afd.startOffset, afd.length)`，不落盘
- 音量走 `setVolume(v, v)`，曲线沿用桌面 `pow(x, 1.5)` 手感
- 音频焦点：短暂获取 `AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK`，来电或其他应用播放时暂停，回来重播该条
- 索引未命中 → 系统 TTS 兜底；系统无英文音色则提示"该词暂无录音"，**不再静默用中文音色念英文**

---

## 8. 练习引擎

### 判定规则（与桌面逐条对齐）

| 规则 | 说明 |
|---|---|
| 大小写 | 不敏感 |
| 标点 | 不参与输入，也不计错（`.,?!'` 等） |
| 空格 | 归入 SKIP 集合（含 `\u00A0` `\u2007` `\u202F`） |
| 打错 | 抖动 + 计数，光标不前进 |
| token 完成 | 自动进下一个 token |
| 整条完成 | 停在原地，等空格/回车确认 |
| 词组 | 按空格拆成多个 token（`pocket money` 两个） |

### 练习顺序

单元内队列 = **能配到例句的词与其句子成组**（词在前、句紧随），配不上的句子排尾。配对用增广路最大匹配 + 屈折变体（`smile` / `smiles` / `smiling`），避免"两个词抢同一句"导致后面借不到句子。

### 状态机

```
Idle → Typing(item, token) ──token完成──▶ Typing(token+1)
                    │                          │
                    └──末token完成──▶ ItemDone ──空格──▶ Typing(next item)
                                                              │
                                                    末条完成 ──▶ RoundDone → Result
```

判定入口保持纯函数签名，便于 JVM 单测：

```kotlin
fun typeKey(state: TypingState, ch: Char): TypingResult
// TypingResult: Progress | Wrong | Skip | Complete
```

---

## 9. 界面设计

竖屏锁定，四屏。

### 9.1 书架

- 三组教材纵向排列（启蒙 / 人教 PEP / 外研新标准），组标题用品牌色块
- 单元网格：宽度 < 400dp 两列，≥ 400dp 三列
- 单元卡：单元号 + 主题 + 进度环（完成度 + 正确率），点击进入练习
- 右上角齿轮进设置，卡片右上角留"长按查看词表"（v1 可选）

### 9.2 练习

自上而下：

1. 进度条 + `第 n / m 条`
2. 中文提示（20sp，可放大）
3. token 行：已完成深色、当前高亮下划线、未开始浅色；长句自动换行
4. 键盘区（自绘）：26 字母 + 空格 + 删除，键高 48dp
5. 底部工具：听英文 / 看提示 / 跳过

### 9.3 结果

正确率环 + 用时 + 错题列表（可点开重练）+「再来一遍 / 回书架」。

### 9.4 设置

四组：常规（主题 / 字号三档 / 虚拟键盘开关）、声音（音量滑块）、守护（开关 / 时长 / 今日进度）、关于（版本 / 隐私政策 / 忘记密码说明）。

### 尺寸规范

| 项 | 值 |
|---|---|
| 正文 | 16sp（字号档 ×0.9 / 1.0 / 1.15） |
| 中文提示 | 20sp |
| 键盘键高 | 48dp，最小触控区 44dp |
| 左右边距 | 20dp |
| 平板 | 宽度 > 600dp 时内容列限宽 560dp 居中 |

配色与桌面浅色主题同源（`Theme.kt`：`#FFF8F0` 奶油底 + 纯白卡片 + `#4A80F0` 主色 + 糖果色磁贴），状态栏透明、图标转深色。深色仅作后续夜间可选项，**默认浅色**。

---

## 10. 少儿守护

### 流程

1. **首次开启**：设 6 位数字 → 再输一次确认 → 选每日时长（10–180，默认 30）
2. **开启后**：启动即沉浸式全屏；返回键无效；关闭应用需过密码
3. **计时**：仅前台可见累计，每 10 秒落盘一次（防杀进程丢量）
4. **到点**：全屏锁屏页显示今日已学 / 额度，密码解锁 **+10 分钟**
5. **跨天**：日期变更自动归零
6. **改时长 / 关守护**：需密码，关闭设置页自动重新上锁

### Android 实现要点

| 点 | 做法 |
|---|---|
| 返回键 | `BackHandler(enabled = guardOn) { /* 吞掉 */ }` |
| 全屏 | `WindowInsetsControllerCompat.hide(systemBars())` + `BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE` |
| 下拉状态栏 | 仍可唤出，**无法完全屏蔽**（如实告知，不虚假承诺） |
| 屏幕固定 | 开启守护时检测 `ActivityManager.lockTaskModeState`，未固定则弹一次引导 |
| 杀进程 | 家长可强行停止，防不住；定位为自律工具 |

---

## 11. 性能与体积

| 指标 | 目标 |
|---|---|
| 冷启动 → 书架可交互 | < 1.2 s（中端机） |
| 单条音频首播延迟 | < 150 ms |
| 内存常驻 | < 120 MB |
| 词库首次解析 | < 200 ms（后台线程，kotlinx.serialization） |
| **APK** | **< 35 MB** |

兼容：minSdk 26；不使用 GMS 任何组件；小米 / 华为 / OPPO / vivo / 荣耀主流 ROM 真机验证。

---

## 12. 测试与验收

| 层 | 内容 |
|---|---|
| domain 单测 | TypingEngine 40+ 用例、Pairing 10+、SrsScheduler 15+、GuardClock 10+（跨天、加时、边界） |
| 数据一致性 | voice-index 每个键都有对应 asset；每个 unit 的 wordId 都能解析；token 数与整句词数一致 |
| Compose UI | 四屏导航、拼完一个词、拼完一句、时间到锁屏、密码错误拒绝 |
| 真机 | 3 档屏幕（小屏 360dp / 常规 / 平板）+ 2 个 ROM |

**验收口径**：对齐桌面端 `verify` 的 46 项断言，逐条在 Android 侧复现。

---

## 13. 分发与合规

v1 **不上架商店**，走 GitHub Releases 自装 APK（与桌面版同一条分发路径），所以下面的商店前置不阻塞开发。

将来若要上架，这些是硬前置，**不能等代码写完再办**：

| 事项 | 说明 | 周期 |
|---|---|---|
| App 备案 | 工信部要求，无备案号国内商店不受理 | 长，需提前启动 |
| 软件著作权 | 商店普遍要求 | 长，与开发并行 |
| 隐私政策 + 首启同意弹窗 | 未弹窗即收集属违规；本应用零收集 | 中 |
| 权限清单 | v1 仅可能用 `VIBRATE`；**不申请 INTERNET / 存储 / 通讯录** | 中 |
| 儿童个人信息 | 《儿童个人信息网络保护规定》：零收集、无第三方 SDK | 中 |
| 商店素材 | 512 图标、5 张截图、分类「教育 > 学习工具」、适龄提示 | 低 |

**自装 APK 的现实影响**：应用内没有更新通道，发新版要用户手动覆盖安装（同签名可直接覆盖，数据不丢）。签名密钥必须备份，丢了就无法覆盖升级。

**不上架带来的自由**：守护功能可以选更硬的方案（设备管理员 / LockTask 真 kiosk），不必担心审核以"无障碍权限滥用"为由拒绝。v1 仍先用无权限方案，避免过度打扰家长。

---

## 14. 里程碑

| 阶段 | 内容 | 复杂度 | 完成定义 |
|---|---|---|---|
| **M0** 骨架 | 工程、Compose 主题、数据加载、书架 | 低 | 真机能滚动 19 册、点进单元 |
| **M1** 练习闭环 ✅ | 键盘、判定、配对、结果页 | **高** | 已实现（v0.2.0）：`domain/` 纯函数 + 27 项单测，真机验收待做 |
| **M2** 音频 | 转码流水线 + 播放器池 | 中 | 1529 条全部可播，首播 < 150 ms |
| **M3** 错题本 | 入库、复习、SRS 排程 | 中 | 答错入册、到期可复习 |
| **M4** 设置 + 守护 | 四组设置、密码、计时、锁屏 | 中高 | 时间到能锁、密码能解、返回键无效 |
| **M5** 打磨 | 测试、真机矩阵、签名打包 | 中 | 46 项验收通过、release APK 可安装 |

---

## 15. 风险登记

| 风险 | 影响 | 对策 |
|---|---|---|
| 各 ROM 沉浸式全屏行为不一致 | 守护体验打折 | 真机矩阵覆盖；降级为"系统栏常驻但仍计时" |
| MediaPlayer 首播延迟偏高 | 点击后约 200 ms 才出声 | 双实例预取；仍高则词用 SoundPool、句用 MediaPlayer |
| 转码后体积没降下来 | APK 超 35 MB | 降到 40 kbps / 16 kHz；再不行按册拆 asset 分包 |
| 签名密钥丢失 | 无法覆盖升级，只能卸载重装（丢进度） | 生成后立刻备份，写进项目文档 |
| 中文路径导致构建异常 | AGP 直接报错 | 已加 `android.overridePathCheck=true`，实测可编译 |
| 触屏误触 | 体验差 | 键高 48dp、按下放大、可关震动反馈 |

---

## 16. 已确认

1. 应用名 `小拼手`，包名 `com.spellpal.app`（debug 包加 `.debug` 后缀，可与正式包并存）
2. 图标复用桌面版主体，由 `scripts/make-icons.py` 生成各密度与自适应前景
3. 桌面端进度不做迁移；两端各自记账，字段格式保持一致，将来若要做导出不必改结构
