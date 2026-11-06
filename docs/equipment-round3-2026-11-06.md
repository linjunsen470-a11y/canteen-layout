# 第三轮：设备规格与自定义库

日期：2026-11-06。用户明确选择“设备规格与自定义库”。本轮承接已有新增／编辑／删除能力，补齐规格来源、另存复用、快照隔离和保存可靠性；是 G5 的第一步，**不是 G5 全阶段完成或商用发布**。仅修改本仓库，保留已有未提交成果，没有 reset、clean、提交、推送、部署或生产数据访问。

## 使用方法

1. 在内置普通设备卡片下点击 **另存规格**，或者单选场景设备，在属性下部点击 **另存为库规格**。前者读取目录默认规格，后者读取当前实例的实际尺寸、操作面、座位声明和说明。
2. 填写名称、长宽高、规格说明及备注，按已知情况设置座位数和操作面。尺寸支持毫米小数；未知座位数留空，不按名称推算。三维缩略图和二维图例使用当前表单规格预览。全部模型仍为通用示意，不代表厂家已核实产品。
3. 点 **加入我的物件**后自动显示“我的物件”，清除可能隐藏新条目的搜索筛选。点击卡片或拖入画布复用，添加时生成独立实例。支持按名称或规格说明搜索。
4. “我的物件”保留编辑、复制、删除。编辑只影响以后添加的设备；复制生成新库 ID；删除有确认且保留场景设备。项目撤销不撤销独立设备库的管理操作。
5. 场景属性中的 **设备规格与来源**显示已保存说明及来源标识。即使库被修改或删除，实例尺寸、说明、操作面和座位声明仍保持原样。另存不会携带原设备的位置、角度、锁定、隐藏、分区、组合或承托关系。
6. 保存失败时对话框保留草稿并显示错误，可在恢复存储后重试。另一页面更新库时同步读取；已打开的过期编辑表单不能覆盖新版本，需关闭后重新打开。

## 实现与数据归属

- 67 个内置条目增加写在源码中的固定 `builtin-001` 至 `builtin-067` ID。ID 不由用户可改名称或运行时数组下标推导；以后重排目录不得重编号。原条目数量、模型、尺寸与类别未改变。
- 抽出 `customCatalog.ts`，统一条目白名单、校验、实例快照提取、本地读取和保存。自定义库继续使用原 `canteen-custom-items` localStorage 数组；新条目使用 UUID，旧条目保留 ID，缺 ID 的历史条目获得确定的 `custom-legacy-N` 标识，主动保存时固化。读取不会立即重写原数据。
- 目录类型 `CatalogEntry` 增加可选的 `specification`、`notes`、`operationFace`，并明确复用既有 `seats`。这些是**以后添加设备的默认值**。新建自定义条目默认不声明操作面；从已确认内置模型／实例另存时保留明确设置；切换基础模型会清除旧操作面，避免沿用错误声明。
- 项目实例新增可选的 `catalogId` 和 `specification`；说明、座位数、操作面使用原实例字段。`catalogId` 只是历史来源标识，**不是实时引用或强制外键**，不会从库回填或覆盖实例。历史项目缺字段继续保持未知来源，不通过名称猜测。
- `catalogItemDefaults` 统一点击和拖放路径。拖放按稳定 ID 区分同名规格；`specificationFromItem` 只提取规格白名单。项目导入器逐字段保留新字段，`syncStructure` 校验标识与说明格式；剪贴板、历史和自动保存沿用完整实例快照。
- **项目格式仍为 6，资产包仍为 1**：新增的是可选描述／来源元数据，未改变几何、引用与资产结构。继续读取无版本及 1–5 文件。旧程序不理解新说明和来源字段，不保证用旧程序再次保存后仍能保留它们。
- 自定义库与项目库各自保存。项目包携带实例的完整规格快照，**不打包整个个人设备库**；换浏览器导入项目后仍可显示设备，并可从实例重新另存到新浏览器的库。
- 保存先核对当前存储原文，再写盘，成功后才更新内存。存储失败不伪装成保存成功；损坏 JSON、模型／类型不匹配或重复 ID 明确提示，并阻止覆盖原文。旧库已有的超大尺寸仍可读取，不因新增编辑上限静默丢弃。

本轮新增／编辑库条目的应用限制：名称 1–120 字符，长宽高大于 0 且不超过 100000mm，座位数 0–1000 整数或未声明，规格说明最多 500 字符，备注最多 2000 字符。这是表单与存储边界，不是厂家安装规则；历史超限实例仍可编辑，但另存为新规格前需满足库条目限制。

主要改动：`customCatalog.ts`、`CustomItemDialog.tsx`、`CustomCatalogActions.tsx`、`EquipmentSpecification.tsx`，以及 `model.ts`、`App.tsx`、`PropertiesPanel.tsx`、`projectIO.ts`、`structure.ts` 和样式。没有引入新依赖，也没有重做三维模型或框架。

## 实际验证与证据

使用本机 Chrome 156.0.8078.80、独立临时浏览器存储和合成规格，没有操作日常方案库。新脚本、下载与截图全部放入 [.local-checks/equipment-round3](../.local-checks/equipment-round3/)，不覆盖前两轮证据。该目录被 Git 忽略，需随本地交付单独保留。

| 检查 | 结果与位置 |
| --- | --- |
| 修改前基线 | `pnpm typecheck`、`pnpm build` 通过；已有主包超过 500kB 提示 |
| 最终静态检查 | `pnpm typecheck`、`pnpm build`、`git diff --check` 通过；未删除或放宽既有检查 |
| 规格主流程 | [51 项通过](../.local-checks/equipment-round3/specifications/results.json)，页面异常 0 |
| 兼容、同名拖放与恢复补查 | [14 项通过](../.local-checks/equipment-round3/compatibility/results.json)，页面异常 0 |
| 第一轮朝向／净距回归 | [166 项通过](../.local-checks/equipment-round3/acceptance/results.json)，页面异常 0 |
| 第二轮定位流程回归 | [64 项通过](../.local-checks/equipment-round3/workflow/results.json)，页面异常 0 |
| 门窗与工作区回归 | [66 项通过](../.local-checks/equipment-round3/ux/results.json)，页面异常 0 |
| 剪贴板与批量操作回归 | [25 项通过](../.local-checks/equipment-round3/clipboard/results.json)，页面异常 0 |

本轮共 **386 项断言**通过，并非 386 个独立端到端场景。专项实际验证：

- 从内置炉灶另存 1300.5mm 规格并添加实例；库改为 1600mm 后，原设备保持 1300.5mm，新设备为 1600mm；从旧实例另存仍读取旧规格。
- 对话框编辑／复制／取消／删除确认，输入全选和删除不影响场景；基础模型切换清除不适用操作面，未知座位留空，明确座位声明保存。
- 注入 localStorage 写入失败，验证原库与内存不变、对话框草稿保留、恢复后可重试。实际两个标签页分别编辑，旧表单被拒绝；未收到 storage 事件时也通过写前原文检查阻止已发生的覆盖冲突。
- 旧库实际刷新、稳定 ID 固化、缺操作面默认不猜测；同名不同尺寸的库条目真实拖放正确；损坏库原文保留，非法尺寸／模型／元数据拒绝。
- 新实例字段经过导入器、应用剪贴板、撤销重做、自动保存刷新、上一份恢复快照以及实际项目包下载，均完整保留。没有个人库的独立浏览器也能读取项目包中的设备和规格。
- 第一／二轮回归仍覆盖单设备净距、直墙／斜墙、0mm、参考选择、预览防误改与历史隔离；门窗回归覆盖单／双开门开向、铰链、从属约束、批量选择和复制粘贴；工作区回归覆盖面板伸缩、专注、分屏与 800×600 至 1920×1080 布局。

实际查看 [1366×768 规格预览](../.local-checks/equipment-round3/specifications/spec-1366.png)、[1024×768 规格预览](../.local-checks/equipment-round3/specifications/spec-1024.png) 和 [从实例另存](../.local-checks/equipment-round3/compatibility/instance-dialog-1366.png)。长表单可滚动，底部操作保持可达；滚到预览处后二维／三维图不被保存区覆盖。平面下载见 [plan.png](../.local-checks/equipment-round3/specifications/plan.png)，项目包见 [specifications.canteen.json](../.local-checks/equipment-round3/specifications/specifications.canteen.json)。

开发过程中补齐了操作面选择器的明确无障碍名称；视觉检查后将卡片操作文字缩短为“另存规格”，并让从场景另存后主动显示新条目。未把历史失败当成本轮回归，也未以构建成功替代实际交互验证。

复跑命令：

```powershell
$pw = 'C:/Users/lin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'
pnpm typecheck
pnpm build
node .local-checks/equipment-round3/workflow.cjs $pw
node .local-checks/equipment-round3/compatibility.cjs $pw
node .local-checks/equipment-round3/round1-regression.cjs $pw
node .local-checks/equipment-round3/round2-regression.cjs $pw
$env:CANTEEN_EVIDENCE_DIR = '.local-checks/equipment-round3/ux'
node tests/ux-refinement.cjs $pw
$env:CANTEEN_EVIDENCE_DIR = '.local-checks/equipment-round3/clipboard'
node tests/clipboard-doors.cjs $pw
Remove-Item Env:CANTEEN_EVIDENCE_DIR
```

新专项使用 5212／5213 端口，第一／二轮复跑使用 5199／5210；脚本退出关闭自行启动的 Vite 与浏览器。此前证据保留。

## 未覆盖与后续边界

本轮没有完成 G5 的三维细部比例改造、独立离地高度、GLB 或个人库整库迁移；没有做实时库引用、自动同步已有实例、批量替换规格、厂家数据校验或云端协作。自定义库仍是本地存储，跨标签页为写前检查与事件同步，不宣称具备服务器事务级并发保证。库损坏时保护原文并提示，没有增加自动修复或云备份。

本轮未重跑独立缩放压力脚本、全部 G1–G4、其他浏览器／触屏或真实客户试点，未测试生产环境；没有把历史测试计入上述 386 项。原有 900mm 参考净距、规划范围保护、门窗关系和模型示意边界保持不变。路线图下一步可继续 G5 的常用模型细部与离地高度，但本轮不自动进入。
