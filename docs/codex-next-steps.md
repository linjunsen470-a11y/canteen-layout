# Codex 下一步开发指南（简单易用 · 快速出图）

本文档用于指导后续多个迭代（含 Codex 自动开发与人工评审）。所有改动必须始终围绕核心价值：**让餐饮老板在看铺阶段 1 分钟出好看的第一稿、3 分钟出多版对比图、一键复制发微信群拍板**。

---

## 一、产品边界与不可破坏的不变量

开始任何任务前，先确认以下约束：

1. **数据唯一来源与兼容**：继续以整数毫米 `survey` + `parseProject`（[src/projectIO.ts](../src/projectIO.ts)）作为唯一项目解析入口；所有新增字段必须可选且向后兼容旧版 `.canteen.json` 项目包。
2. **保护用户手工编辑**：任何自动生成、切换候选或导出操作都不得静默覆盖用户已手工调整的桌椅或已锁定的实测构件；要么保留可一键撤销的历史记录，要么另存为独立草稿。
3. **已有画布行为规则不可回归**：
   - 智能分区生成的示意构件保留 `generated: 'concept'` 标记，锁定后视为实测构件。
   - 2D 中吊灯落在桌椅上方时保持点击穿透，优先选中下方桌椅。
   - 门窗开口始终通过 `openingSlot(..., bounds)` 限制在 `surveyWall()` 实测内墙范围内。
   - 3D 鸟瞰截图必须使用 `computeBirdseyeHiddenItemIds`（[src/wallVisibility3D.ts](../src/wallVisibility3D.ts)）同步隐藏近侧外墙、附着门窗及贴近近墙的招牌/挂画/灯箱，禁止招牌悬空。
4. **界面克制原则**：不把顶栏重新塞满低频按钮，不引入需要学习教程的专业 CAD 工具概念；新增能力优先融入现有的 `SketchWizard`、`BasicDraftBar`、`ImageExport` 弹窗或画布上下文快捷条。
5. **小步提交**：**每次 PR 只做下方一个 Step**，避免多特性耦合导致难以评审或回归。

---

## 二、按优先级排序的开发路线

### Step 1（P0）：一键装修风格与光照氛围，让“快速出图”直接出好图

**痛点**：当前 [src/basicLayout.ts](../src/basicLayout.ts) 生成基础草稿时固定使用 `themeId: 'keep'` 且 `includeLights: false`，导致新铺位首稿 3D 观感偏“水泥白模”，直接导出的合图缺乏说服力。

**开发目标**：
- 在 [src/BasicDraftBar.tsx](../src/BasicDraftBar.tsx) 和 [src/ImageExport.tsx](../src/ImageExport.tsx) 中增加轻量的一键风格胶囊（复用 [src/conceptPlanner.ts](../src/conceptPlanner.ts) 里的 `decorThemePresets`，提供 3–4 个高频餐饮氛围：`原木暖调` / `轻工业风` / `明快快餐` / `素净白模`）以及 `自然光 / 暖光营业` 快捷切换。
- 在「新建铺位 → 输入尺寸」直出草稿时，按所选业态自动匹配默认暖调/明快材质（或让用户在 1 行胶囊内点选，不增加必填步骤）。
- 切换风格仅提交 `project.style` 变更（支持 `撤销`，绝不重排或移动已有家具）。
- 在 `ImageExport` 弹窗内切换风格时，自动清空已缓存的 3D 截图与合图并重新生成预览，保持「复制图片 / 下载 PNG」一键可用。

**主要涉及文件**：
- `src/basicLayout.ts`
- `src/conceptPlanner.ts`
- `src/BasicDraftBar.tsx`
- `src/ImageExport.tsx`
- `src/App.tsx`

**验收标准**：
- 从空白画布 1 步直出草稿后，3D 鸟瞰与室内视角呈现自然装修质感而非纯白模。
- 在「导出图片」弹窗中切换风格后，合图预览自动更新且原项目家具坐标、座位数完全不变，按一次 `撤销` 可恢复切换前风格。
- 在 `tests/quick-export.mjs` 增加风格切换后重新出图的断言。

---

### Step 2（P0）：多候选布局一键秒切（释放 `basicLayout` 已有算力）

**痛点**：[src/basicLayout.ts](../src/basicLayout.ts) 内部已经枚举了 4 个旋转方向 × 多种厨位比例，但最终只保留了最高分 1 稿，其余全部丢弃。看铺店主最常纠结「后厨放后还是放侧面」「能多摆几座」。

**开发目标**：
- 在 [src/basicLayout.ts](../src/basicLayout.ts) 新增 `generateBasicLayoutCandidates(shell, business, maxCount = 3)`（保留原 `generateBasicLayout` 签名兼容现有调用与测试）。
- 对枚举出的可行方案按「后厨朝向 + 桌椅布局特征 + 座位数」去重，挑选最多 3 个明显不同的高分方案，每个候选附带简短中文标签（例如：`方案 1 · 后置后厨 · 24 座`、`方案 2 · 侧置后厨 · 20 座`）。
- 通过 [src/basicLayout.worker.ts](../src/basicLayout.worker.ts) 与 [src/requestBasicLayout.ts](../src/requestBasicLayout.ts) 返回候选列表，在 [src/BasicDraftBar.tsx](../src/BasicDraftBar.tsx) 提供一键切换按钮。
- **手改保护**：
  - 尚未手工改动当前草稿时，点击候选胶囊直接切换（且可撤销）。
  - 一旦用户已拖动/删改过桌椅，点击其他候选时提供「另存为新稿打开（保留当前修改）」而不直接覆盖。

**主要涉及文件**：
- `src/basicLayout.ts`
- `src/basicLayout.worker.ts`
- `src/requestBasicLayout.ts`
- `src/BasicDraftBar.tsx`
- `src/model.ts` / `src/projectIO.ts`（如需持久化候选元数据，必须保证可选与向后兼容）

**验收标准**：
- 常规矩形（7×10m）与 L 形（8.5×6m 缺角 3×2m）铺位均能产出 ≥2 个有差异且无严重冲突的候选方案。
- 拖动一张桌子后切换候选，不会丢失手改稿。
- 在 `tests/basic-layout.mjs` 和 `tests/editable-draft.mjs` 补充候选去重与手改保护测试。

---

### Step 3（P0）：A/B 双方案一图对比导出

**痛点**：店主用「另生成一稿」做出两版摆法后，只能分别导图再手动发多张图给合伙人/房东，难以直观对比座位、餐厨比和空间松紧。

**开发目标**：
- 在 [src/ImageExport.tsx](../src/ImageExport.tsx) 增加「**A/B 对比图**」格式选项（当项目库存在至少 1 个其他未删除项目时启用，默认优先推荐同铺位/同面积的另一份草稿）。
- 生成一张 `2400 × 1500` 横版对比图 PNG：
  - 顶部标题栏显示铺位信息与对比结论摘要。
  - 左右两栏分别展示方案 A 与方案 B 的**无重复页眉平面图 + 整店鸟瞰图**。
  - 底部/栏内直接列出关键指标对比：`座位数`、`餐厨比`、`最窄桌间净距`、`预估预算区间`（复用 [src/shopAnalytics.ts](../src/shopAnalytics.ts) 与 [src/spaceChecks.ts](../src/spaceChecks.ts)）。
- 同样支持「复制图片」与「下载 PNG」。
- **状态隔离**：拍摄方案 B 时不得污染当前激活项目的撤销栈、选区或 IndexedDB 保存状态；导出完成或失败后必须完整恢复方案 A。

**主要涉及文件**：
- `src/ImageExport.tsx`
- `src/App.tsx`
- `src/projectSession.ts`
- `src/shopAnalytics.ts`

**验收标准**：
- 生成两份同铺草稿后，在「导出图片 → A/B 对比图」可预览、复制并下载 `2400 × 1500` 真实 PNG。
- 关闭弹窗后，当前编辑项目、撤销历史和视图模式与打开前完全一致。
- 在 `tests/quick-export.mjs` 补充双方案对比出图与状态恢复测试。

---

### Step 4（P1）：房东户型截图“极速套框建铺”

**痛点**：实际选址中房东最常发来微信截图/PDF 照片；目前「从户型图描绘」完成两点校准后，仍需要用户手动逐段画墙，链路偏长。

**开发目标**：
- 在「从户型图描绘」完成两点校准后，提供快捷浮条：「**按净尺寸套矩形/L 形**」或「**沿底图点角闭合**」，让用户直接把矩形/L 形轮廓对准底图并一键进入基础布局生成。
- 保留底图半透明开关，方便出图前一键隐藏底图、只留干净平面图。

**主要涉及文件**：
- `src/ShopWizardDialog.tsx`
- `src/UnderlayLayer.tsx`
- `src/UnderlayFields.tsx`
- `src/PlanEditor.tsx`

**验收标准**：
- 上传测试户型图并两点校准后，3 次点击内即可生成闭合外墙并直接出第一稿。
- 隐藏底图后导出 PNG 不再包含底图像素，且无资产缺失报错。

---

### Step 5（P1）：2D 拖拽微调的实时通道净距反馈

**痛点**：老板手动挪桌子时，只有打开底部「体检与预算」弹窗才知道两桌之间净距是否够 900 mm，拖改反馈不够直观。

**开发目标**：
- 在 2D 拖动桌椅组合或单件家具时，复用 [src/spaceChecks.ts](../src/spaceChecks.ts) / [src/wallClearance.ts](../src/wallClearance.ts) 仅针对**当前拖动对象与邻近对象/墙体**计算最小净距，在画布上实时显示一条轻量标尺线与毫米数值；小于 `project.clearance` 时标红提醒。
- 严格控制计算范围（仅检测拖动对象的邻近包围框），确保 300 物件场景下拖动仍保持流畅不掉帧。

**主要涉及文件**：
- `src/PlanEditor.tsx`
- `src/WallClearanceOverlay.tsx`
- `src/spaceChecks.ts`

**验收标准**：
- 拖动桌组靠近另一桌组时，画布实时显示净距（mm）；低于参考净距时显示警示色，松手后标尺消失且撤销正常。
- 性能回归不劣于现有基线。

---

## 三、明确暂缓项（本阶段请勿主动实现）

以下能力在 [product-vision-and-roadmap.md](product-vision-and-roadmap.md) 中已有记录，但**在完成真实店主 3 分钟盲测及上述 Step 1–3 之前暂不开发**，以免增加界面复杂度和重构风险：

- 独立「框选生成桌阵」画布工具
- 可拖动「餐厨分界线」重排交互
- `PlanEditor.tsx` 大规模图层拆分重构
- 全量安装方式字段迁移（`in-wall` / `wall-floor` / `floor` / `ceiling`）

---

## 四、Codex 提交 PR 验收清单

每个 PR 提交前必须完成并如实记录在 PR 描述中：

1. **命令验证**：
   ```bash
   pnpm typecheck
   pnpm build
   pnpm test
   ```
2. **新增回归测试**：优先扩展 `tests/shop-geometry.mjs`、`tests/basic-layout.mjs`、`tests/quick-export.mjs` 或 `tests/editable-draft.mjs`，覆盖核心新增逻辑与关键边界条件（如拒绝剪贴板权限、窄屏 1100px、旧项目包回读）。
3. **无静默回归**：不得删减已有断言；如修改按钮文案或布局，需同步更新受影响的测试与 `README.md` / `docs/README.md`。
4. **PR 说明简洁具体**：写明用户可感知的变化、主要改动文件、实测通过的验证项与已知取舍。
