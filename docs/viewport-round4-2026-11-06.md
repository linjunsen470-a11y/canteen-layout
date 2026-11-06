# 第四轮：三维导航、工作区、墙体合并与性能

日期：2026-11-06。针对用户反馈的三维难以局部查看、工作区偏小、墙体不能合并和卡顿实施。保留前三轮及其他未提交成果；仅修改本仓库，没有重置、清理、提交、推送、部署或访问生产数据。不是“全部问题已解决”或正式商用验收。

## 使用方式

- **三维区域查看**：切到 **3D 预览**，点 **框选放大**，切入俯视后拖框圈定地面区域。框选完成后可继续左键旋转、右键平移、滚轮朝指针缩放，也可点 ＋／－。Esc 退出未完成的框选。区域只是相机取景，不创建或改动规划范围。
- **聚焦设备和范围**：选中一件或多件设备后点 **聚焦选中**，周围场景仍显示；有活动规划范围时可点 **聚焦规划范围**。**空间全景**返回完整场地；原来的隔离式 **物体特写**移到 **更多**，不与区域聚焦混用。
- **扩大工作区**：点 **最大化三维**，隐藏侧栏和编辑工具，保持三维视图。点 **还原三维**／**退出专注**或 Esc 恢复。普通 F 专注模式也保留当前视图，不再强制切到二维。范围名称、保护状态和切换入口保持可见。
- **次要三维控制**：**更多**里保留俯视、斜视、物体移动开关、网格、复位、画质和截图。默认流畅画质；需要时可切精细画质。截图导出当前取景及视口比例，不再把已经放大的区域重新拉回全景。
- **合并墙体**：二维或对象列表多选连续共线墙，在批量属性点 **合并选中墙体**。面板先显示合并长度和关联门窗数量；合并保留首段名称，门窗位置与开向保持不变，一次撤销恢复全部墙段及关联。

墙体合并允许连续／重叠的共线墙，不自动填补真实空隙。墙厚、高度、颜色、分区、备注和规格说明必须一致。锁定／隐藏／保护范围外的墙体或门窗、组合成员、关联净距标注会明确阻止合并。转角墙继续保留分段连接，不把 L 形墙强行改成一根直墙。

## 主要实现

1. `sceneFraming.ts` 根据旋转占地、设备高度、视口比例与透视视角计算取景距离；`SceneRegionPicker.tsx` 将实际指针矩形投影到地面。聚焦与项目数据隔离，不污染保存和撤销历史。
2. 三维采用指针缩放、可见的缩放按钮和独立导航行。次要控制折叠；三维单视图隐藏二维编辑工具，专注时去除重复标题并压缩页脚。`focusView` 仅决定当前最大化视图，读取工作区偏好时重置，不改变项目格式。
3. `mergeWalls.ts` 校验墙段共线、连续和保护状态，生成连续墙并迁移门窗引用。反向墙上的门重新换算 offset、开向及单门铰链，保留世界坐标几何；通过 `syncStructure` 重新验证开口，复用单次 commit／撤销。合并后保留首段 ID，其余 ID 移除，涉及会失效的净距标注时拒绝操作。
4. 设备库拆到 `EquipmentLibrary.tsx` 并记忆化；设备选择和拖动不会反复重绘整个库和全部规格表单。点击／拖放通过当前 store 读取数据，避免使用旧项目闭包。
5. 首次纯二维使用不创建隐藏三维 Canvas；打开过的三维视图在隐藏时停止跟随项目编辑重绘，恢复时读取最新项目。隐藏二维视图也暂停更新，返回时更新。相机在面板伸缩／窗口改变／视图切换后保留人为平移。
6. 墙体轮廓、三维实例分组按实际数据记忆化。只改变选择不重新上传整场实例矩阵，真实几何变更仍更新。阴影在场景／画质变化时重算，观察角度变化不重复计算静态阴影；流畅模式限制像素比为 1、阴影图为 1024，精细模式保留更高设置。
7. 缩略图按帧排队，每帧最多处理一个任务，避免一排卡片同时生成阻塞画面；缓存上限 160 项。没有增加依赖或更换渲染框架。

本轮无新增项目持久化字段；项目格式仍为 6，资产包仍为 1。原有门窗、分组、承托、操作面、规格快照、范围保护和 900mm 参考净距规则继续保留。

## 实际验证

Chrome 156.0.8078.80，本机独立浏览器存储和合成场景。新脚本、截图与机器结果均在 [.local-checks/viewport-round4](../.local-checks/viewport-round4/)，未覆盖前几轮或 docs 历史证据；该目录受 Git 忽略，需随本地交付保留。

| 检查 | 本轮结果 |
| --- | --- |
| 修改前基线 | 类型检查与构建通过，原有主包大于 500kB 提示保留 |
| 最终静态检查 | `pnpm typecheck`、`pnpm build`、`git diff --check` 通过 |
| 墙体与区域导航专项 | [50 项通过](../.local-checks/viewport-round4/workflow/results.json)，页面异常 0 |
| 实际鼠标导航与渲染缓存 | [11 项通过](../.local-checks/viewport-round4/navigation/results.json)，页面异常 0 |
| 连续缩放与视口回归 | [11 项通过](../.local-checks/viewport-round4/zoom-final/results.json)，页面异常 0 |
| 门窗与工作区回归 | [66 项通过](../.local-checks/viewport-round4/ux/results.json)，页面异常 0 |
| 第二轮定位回归 | [64 项通过](../.local-checks/viewport-round4/positioning-regression/results.json)，页面异常 0 |
| 规格库与快照回归 | [51 项通过](../.local-checks/viewport-round4/specifications/results.json)，页面异常 0 |
| 无 WebGL 降级 | [3 项通过](../.local-checks/viewport-round4/fallback/results.json)，故意禁用 WebGL，预期错误单独记录 |
| 剪贴板与批量操作 | [25 项通过](../.local-checks/viewport-round4/clipboard/results.json)，页面异常 0 |

共 **281 项断言**，并非 276 个独立端到端场景。专项包括：

- 0、90、180、33° 墙体及正／反向单开门、双开门的合并，比较合并前后门扇世界坐标几何；重叠并集、间隙、转角、属性不同、保护／锁定／隐藏／组合／关联标注拒绝。真实按钮合并、撤销重做和保存刷新完整保留门窗。
- 真实指针拖框，聚焦多选及规划范围、显式缩放、真实左键旋转／右键平移／偏心滚轮缩放，不改设备或项目历史。取消、最大化、恢复、窗口改变、隐藏期间编辑后恢复三维。
- 读取实际实例矩阵版本：仅选择不重复上传，移动仍更新。截图时检查实际渲染相机与当前相机相同，PNG 比例与视口一致，不以“截图成功下载”替代取景验证。
- 连续缩近／缩远及方向切换、近远裁切、极矮分屏、特写平移后 resize、反复显示／隐藏和截图后的渲染状态恢复。

三维控制移到“更多”后，`tests/ux-refinement.cjs` 和 `tests/viewport-zoom.cjs` 已按真实入口展开菜单，未移除原有断言。其他历史全流程未全部重跑，历史固定 1600×1000 三维图片的假设已不适用于当前按视口比例导出。

### 工作区与视觉证据

带活动规划范围／保护入口时，三维最大化实际画布：

| 窗口 | Canvas 尺寸 | 截图 |
| --- | --- | --- |
| 1366×768 | 1330×516px | [区域聚焦](../.local-checks/viewport-round4/workflow/maximized-1366.png) |
| 1024×768 | 988×516px | [窄窗口](../.local-checks/viewport-round4/workflow/maximized-1024.png) |

已实际查看两种窗口截图和 [斜视聚焦截图](../.local-checks/viewport-round4/navigation/oblique-focus.png)：选中设备有轮廓，周围场景保留，范围保护入口未消失；操作行不压在设备上。[导出的区域图](../.local-checks/viewport-round4/navigation/oblique-framed.png) 保留当前取景。

开发中通过截图发现首版最大化仍有重复标题占用空间，已进一步压缩并重新验收；主动聚焦前清除旧轨道阻尼，避免取景后继续漂移。补齐客户成果路径：先保存已经可见的三维取景，再激活暂停的二维视图生成最新平面，结束后恢复原最大化状态；已验证三维中修改的最新实例进入成果。同时修复最大化状态下的 WebGL 失败回退，确保“继续二维编辑”解除三维最大化，并实际验证禁用 WebGL 后仍可添加设备和导出平面。浏览器日志没有本轮未捕获异常。

### 性能测量的条件和结果

使用开发构建、无头 Chrome、1366×768，合成 100／300 个重复工作台与餐椅。每个场景执行 24 次选择，测量从状态更新到随后两个 animation frame 的耗时。**这是选择反馈延迟指标，不是 FPS，也不是拖动或所有 GPU 的保证。** 最终复测在本轮构建及其他测试进程结束后单独执行。

| 对象数 | 视图 | 中位耗时 | P95 |
| --- | --- | --- | --- |
| 100 | 二维 | 33.4ms | 86.5ms |
| 100 | 三维 | 33.6ms | 49.4ms |
| 300 | 二维 | 50.1ms | 106.0ms |
| 300 | 三维 | 33.4ms | 55.7ms |

完整结果见 [isolated-final/results.json](../.local-checks/viewport-round4/isolated-final/results.json)。初始二维 Canvas 数为 0；三维重复构件仍使用实例化，300 件样例记录 30 次绘制调用、约 68.6 万三角形，未通过删减设备凑流畅结果。

初始 [baseline](../.local-checks/viewport-round4/baseline/results.json) 和第一次 [optimized](../.local-checks/viewport-round4/optimized/results.json) 也保留。初始测量与构建有时间重叠，不能把两者差值当成严格、受控的性能提升百分比；因此不据此承诺“快几倍”。当前 300 对象二维 P95 仍超过 100ms，密集或复杂场景仍可能卡顿。

## 复跑方式

```powershell
$pw = 'C:/Users/lin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'
pnpm typecheck
pnpm build
node .local-checks/viewport-round4/workflow.cjs $pw
node .local-checks/viewport-round4/navigation.cjs $pw
node .local-checks/viewport-round4/fallback.cjs $pw
node .local-checks/viewport-round4/round2-regression.cjs $pw
node .local-checks/viewport-round4/specifications-regression.cjs $pw
$env:CANTEEN_EVIDENCE_DIR = '.local-checks/viewport-round4/zoom-final'
node tests/viewport-zoom.cjs $pw
$env:CANTEEN_EVIDENCE_DIR = '.local-checks/viewport-round4/ux'
node tests/ux-refinement.cjs $pw
$env:CANTEEN_EVIDENCE_DIR = '.local-checks/viewport-round4/clipboard'
node tests/clipboard-doors.cjs $pw
Remove-Item Env:CANTEEN_EVIDENCE_DIR
# 单独运行性能测量，避免并行构建／浏览器测试影响结果。
node .local-checks/viewport-round4/performance.cjs $pw isolated-final
```

专项端口为 5215／5216，降级为 5217，性能为 5214；回归各用原脚本端口。脚本关闭自行启动的浏览器和 Vite。

## 保留边界

- 合并限连续共线墙，不支持转角／弧墙实体布尔合并、跨组重写、关联尺寸自动迁移或自动填缝。
- 区域框选基于地面，进入时切俯视；不是三维体积裁剪或新建规划区。隔离式特写仍是独立入口。
- 模型仍为现有通用示意，本轮没有重做全部设备细部、照明材质、离地高度或 GLB。性能优化不等于所有型号、数量和设备上都不卡。
- 没有做全部历史脚本、全浏览器、低端实体设备／触屏、真实客户场景或生产环境验收。未自动推进后续轮次。
