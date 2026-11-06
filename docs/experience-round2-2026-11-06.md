# 第二轮：定位与朝向操作打磨

日期：2026-11-06。按用户选定的“打磨定位与朝向操作”实施，承接第一轮与工作区已有门窗、剪贴板、面板和缩放成果。仅修改本仓库，未重置、清理、提交、推送或部署；未连接生产数据。此记录不代表 G5 全阶段或正式商用版本完成。

## 现在如何操作

1. 单选普通矩形设备，在属性顶部查看**当前角度的图例**和“操作侧朝画布……”提示。可以点 **右转 90°** 或 **反向 180°**；从原角度相加，每次操作可撤销。绿色操作边仍与二维、三维及导出保持第一轮约定。未声明操作面的设备明确显示“未声明”，不猜方向。
2. 点 **精确离墙定位**。画布用蓝色虚线标出可测墙面；点击墙面，或在属性中点击附近墙面推荐。推荐最多三项，按可测净距排序，展示墙名、朝画布的方向、A/B 面与当前距离，**不会自动选定参考**。锁定墙体也可以作为测量参考。
3. 选定后，橙色墙面、测量线与设备测量端明确显示参考。输入毫米净距 → **预览移动** → **确认落位**；0mm 贴墙仍检查穿透，斜墙移动仍沿法向且不改变角度。完整墙面列表保留，不适用项会说明原因。
4. 要换参考，点 **重新在画布选墙**。旧移动预览立即清除，必须重新明确选墙后才能预览。点空白不跳到另一墙；多个有效候选不能可靠区分时提示使用列表。
5. 定位期间可以滚轮缩放、空格／中键平移和收起面板。普通拖动、旋转、删除、复制等编辑暂不可用，避免意外改动原方案。画布附近始终显示定位状态与 **退出定位 · Esc**；属性收起或专注模式下有 **调整净距**入口。
6. 取消／Esc 不写模型或历史。预览中按撤销／重做只取消定位，不消耗之前的历史；再按一次才执行通常的撤销／重做。确认后仍是一条可撤销的移动记录。文本输入保留原生全选、删除等快捷键。

## 实现范围与兼容性

- `wallFaceChoices.ts` 复用第一轮真实墙面和旋转占地测量，只增加候选排序、方向标签和指针命中判定。推荐距离用于选参考，不是安装净空建议；未更改原有 900mm 参考检查，也未按设备放宽间距。
- `wallPlacementState.ts` 单独存放临时定位状态；命令模块、store、键盘、二维和三维交互共用保护。普通提交、移动和删除入口阻止预览中误改；明确切换项目／编辑上下文时取消旧预览。自动保存只更新时间不会打断定位。订阅提供热更新清理。
- `EquipmentFacingFields.tsx` 复用共享二维符号，按照实例角度旋转属性图例，提供方向文案和常用旋转按钮。附墙门窗继续使用原有开向、铰链与墙体从属功能。
- `WallPlacementBar.tsx` 仅在定位中出现，提供独立于侧栏的状态、调整入口和退出操作。未改变正常工作区的面板宽度、专注模式或范围保护语义。
- **没有新增持久化字段或依赖**。`picking`、候选、目标预览与错误只属于临时会话，刷新不恢复。项目格式仍为 **6**，资产包仍为 **1**；已确认位置和第一轮实例 `operationFace` 沿用原保存、导入、复制及恢复路径。目录不重新推断已有项目操作面。

## 实际验证

使用本机 Chrome 156.0.8078.80 和独立浏览器存储，合成场景。所有本轮脚本、截图、下载和机器结果位于新的 [.local-checks/experience-round2](../.local-checks/experience-round2/)，未覆盖第一轮及 docs 历史证据。此目录被 Git 忽略，交付时需单独保留。

| 检查 | 实际结果 |
| --- | --- |
| 最终静态检查 | `pnpm typecheck`、`pnpm build`、`git diff --check` 通过；保留既有 Three.js 主包大于 500kB 的构建提示 |
| 第二轮操作流程 | [64 项通过](../.local-checks/experience-round2/workflow/results.json)，页面异常 0 |
| 已有历史补查 | [7 项通过](../.local-checks/experience-round2/history/results.json)，预览取消不消耗既有撤销或重做记录，页面异常 0 |
| 第一轮主验收复跑 | [166 项通过](../.local-checks/experience-round2/acceptance/results.json)，页面异常 0 |
| 门窗与工作区回归 | [66 项通过](../.local-checks/experience-round2/ux-regression/results.json)，页面异常 0 |
| 剪贴板与批量操作 | [25 项通过](../.local-checks/experience-round2/clipboard-regression/results.json)，页面异常 0 |
| 连续缩放与视口回归 | [11 项通过](../.local-checks/experience-round2/zoom-regression/results.json)，页面异常 0 |

共 339 项脚本断言通过，并非 339 个独立端到端场景。主流程实际点击墙体、推荐、旋转按钮、数值输入、预览／确认，执行撤销重做、保存刷新以及 PNG／项目包下载；也以直接状态调用检查绕过 UI 的普通编辑入口。覆盖内容：

- 当前图例与方向文案在 0、90、180、270、27° 一致；反向保持原有非直角偏移；无声明不猜方向。
- 锁定直墙及斜墙真实指针命中、低缩放下唯一可测面、空白点击、多个候选拒绝隐式选择、错误面提示、重新选墙清除目标。
- 预览期间拖动、双击、删除、方向键、复制粘贴／副本、全选和三维交互不会误改设备；缩放、平移、自动保存及面板收缩保留明确参考。
- 无历史也能从工具栏撤销取消；有历史时撤销／重做只取消定位并完整保留历史栈。确认只写一步，后续撤销重做恢复位置。
- 第一轮复跑继续覆盖旋转矩形与水平／垂直／斜墙、0mm 接触与穿透区分、端部投影、开口、修角、非法输入、锁定／范围保护／关联关系、新字段往返及旧项目导入。
- 单／双开门开向与铰链、附墙构件约束、批量选择、复制粘贴、组合与面板功能；二维和三维连续缩放、方向切换、分屏、窗口改变和视图恢复。

过程中实际发现并修复：定位没有历史时工具栏撤销被禁用；取消定位后工具栏额外清空设备选择；普通编辑防护提示放到全局错误后会在取消时残留。这些问题分别由操作流程和状态检查覆盖。测试场景的目录分类字段误带入实例、斜墙端部投影不完整等验收夹具问题已纠正，未为通过测试放宽产品校验。

## 视觉与空间证据

已实际查看截图：点墙阶段蓝色参考线与推荐可读，27° 属性图例与设备角度相符，预览状态及退出入口不被工具覆盖。两个代表窗口均无横向页面溢出，确认按钮在属性面板中可滚动到达。

| 窗口 | 定位中二维画布尺寸 | 截图 |
| --- | --- | --- |
| 1366×768 | 766×341px | [点墙推荐](../.local-checks/experience-round2/history/picking-1366.png)、[朝向](../.local-checks/experience-round2/workflow/facing-1366.png)、[预览](../.local-checks/experience-round2/workflow/preview-1366.png) |
| 1024×768 | 约 428×275px | [朝向](../.local-checks/experience-round2/workflow/facing-1024.png)、[预览](../.local-checks/experience-round2/workflow/preview-1024.png) |

正常非定位工作区回归仍保持第一轮画布尺寸：1366×768 为 766×423px，1024×768 为约 428×386px。窄窗口同时展开两侧栏时空间仍有限，可收起侧栏或进入专注模式；本轮没有宣称所有工具展开时都能无滚动显示。导出 [平面 PNG](../.local-checks/experience-round2/workflow/plan.png) 保留共享符号及实例方向，临时选墙／预览状态不写入 [项目包](../.local-checks/experience-round2/workflow/round2.canteen.json)。

复跑方式（端口 5197–5199、5210、5211 需空闲；脚本结束关闭自己启动的 Vite 和浏览器）：

```powershell
$pw = 'C:/Users/lin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'
pnpm typecheck
pnpm build
node .local-checks/experience-round2/workflow.cjs $pw
node .local-checks/experience-round2/history.cjs $pw
node .local-checks/experience-round2/round1-regression.cjs $pw
$env:CANTEEN_EVIDENCE_DIR = '.local-checks/experience-round2/clipboard-regression'
node tests/clipboard-doors.cjs $pw
$env:CANTEEN_EVIDENCE_DIR = '.local-checks/experience-round2/ux-regression'
node tests/ux-refinement.cjs $pw
$env:CANTEEN_EVIDENCE_DIR = '.local-checks/experience-round2/zoom-regression'
node tests/viewport-zoom.cjs $pw
Remove-Item Env:CANTEEN_EVIDENCE_DIR
```

## 保留的边界

仍只支持单个普通矩形占地设备与一个明确墙面；圆桌、组合／承托关联移动、投影超出墙端、穿过门窗开口、曲墙和复杂约束未扩展。不支持分设备安装净空规则，推荐的墙面也不保证所有目标距离可放置，目标仍须经过场地、保护和实体碰撞验证。

未新增水电排烟推算、动线检查、GLB、云保存、分享或商用发布。本轮没有重新跑整套 G1–G4、压力测试、其他浏览器／触屏和真实客户场景；当前证据只支持记录中的本机 Chrome 与合成样例。第一轮历史补查及 G4 专项结果仍是历史记录，没有计入本轮 339 项。
