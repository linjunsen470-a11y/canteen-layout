# 定向验收脚本

优先运行 `pnpm typecheck`、`pnpm build`，再按改动选择一个操作流程；不默认执行所有历史脚本或性能测试。本项目不额外安装应用测试依赖，浏览器流程复用已有 Playwright 与本机 Chrome。

```text
node tests/g4-workflow.cjs <已有 Playwright 包路径>
node tests/g4-workflow.cjs <已有 Playwright 包路径> linked
```

主流程覆盖组合/阵列、撤销、自由旋转、吸附、关联净距、空间检查、刷新与包导入；`linked` 只补查墙窗组合和旧自由旋转包。使用本地 5192 端口，分别建立隔离浏览器存储，结束时关闭自己启动的浏览器和服务。

| 脚本 | 用途 | 端口 |
| --- | --- | --- |
| `g2-workbench.cjs` | 工作台历史流程，包含 G1 存储与 G2 状态专项 | 5186 |
| `prd-workflow.cjs` | 原 PRD 布置、展示页与导出流程 | 5187 |
| `prd-performance.cjs` | 100/300 件合成性能测量，仅性能改动时按需运行 | 5188 |
| `g3-site-workflow.cjs` | 底图校准、资产迁移和独立范围 | 5189 |
| `g3-completion.cjs` | 多边形分区、点位、墙端点连接 | 5190 |
| `free-rotation.cjs` | 单件与空间构件任意角度旋转 | 5191 |
| `ux-refinement.cjs` | 门窗约束、双开门/门轴、尺寸反馈、工作区折叠/调宽/专注、保存导入 | 5196 |
| `g4-workflow.cjs` | 当前 G4 主流程或墙窗补查 | 5192 |

`g1-storage.browser.js` 和 `g2-invariants.browser.js` 由 G2 脚本导入，必须在一次性浏览器环境运行，不能在用户日常方案库中注入故障。历史脚本会随功能演进按需维护；修改版本断言或通过语法检查不代表本轮已重新跑完其全部流程。

所有 `.cjs` 的截图、样例和机器结果默认写入 `.local-checks/<阶段>-evidence/`。可用环境变量 `CANTEEN_EVIDENCE_DIR` 指定另一输出目录（相对仓库或绝对路径）。输入旧版本兼容性样例仍读取 `docs/`，不要覆盖这些归档样例来凑通过结果。

历史 Markdown 中“更新截图/JSON”指当时的输出流程；当前默认输出位置以本说明为准。脚本需要空闲端口；使用同一端口的主流程和 `linked` 分开运行。复跑结果不会自动成为新的阶段验收记录。

本轮体验修复专项：`node tests/ux-refinement.cjs <已有 Playwright 包路径>`。覆盖 800×600、1024×768、1366×768 与 1920×1080；结果与截图默认位于 `.local-checks/ux-evidence/`。自由旋转脚本已调整为先明确独立放置再旋转门窗。

开向与剪贴板专项：`node tests/clipboard-doors.cjs <已有 Playwright 包路径>`（5197 端口），输出 `.local-checks/clipboard-evidence/`。覆盖显式开向、复选框多选、批量开向撤销、C/V/D/A/G 快捷键、指针粘贴、取消/撤销/重做、跨项目墙窗引用和输入框隔离。原“复制”立即创建副本按钮现名为“副本”，历史脚本相应更新。

缩放专项：`node tests/viewport-zoom.cjs <已有 Playwright 包路径>`（5198 端口）；输出 `.local-checks/zoom-evidence/`，覆盖滚轮突发、极端缩放、矮视口定位、视图恢复及截图恢复。

第一轮体验升级：新脚本位于 `.local-checks/experience-round1/acceptance.cjs` 和 `supplement.cjs`，分别使用 5199 / 5200 端口。运行时传入现有 Playwright 包路径；覆盖操作面、旋转／墙面净距、预览状态、保存恢复、导出、窄窗口与自定义设备。结果与截图均在此新目录，不覆盖历史证据。完整命令、结果和限制见 [验收记录](../docs/experience-round1-2026-11-05.md)。复跑历史脚本请将 `CANTEEN_EVIDENCE_DIR` 设置为新的子目录；G4 下载路径现也明确位于输出目录。

第二轮定位与朝向：`.local-checks/experience-round2/workflow.cjs`（5210）覆盖画布点墙、推荐、旋转反馈、预览误操作保护、真实保存／刷新／导出及两种窗口；`history.cjs`（5211）补查已有撤销和重做记录的保护。`round1-regression.cjs`（5199）是第一轮主脚本的独立复跑副本，输出到本轮目录。运行时同样传入 Playwright 包路径。门窗、剪贴板、缩放复跑分别使用本轮新的输出子目录，详见 [第二轮验收](../docs/experience-round2-2026-11-06.md)。本地脚本和证据受 Git 忽略，需随本地交付单独保留；不覆盖归档。

第三轮设备规格：`.local-checks/equipment-round3/workflow.cjs`（5212）验证规格另存、实例隔离、写盘失败／重试、跨标签页冲突、项目字段往返与两种窗口；`compatibility.cjs`（5213）覆盖旧库、同名拖放、恢复快照与复制／取消。第一／二轮主流程使用本目录的独立副本复跑；门窗与剪贴板指定新的输出目录。完整结果和命令见 [第三轮验收](../docs/equipment-round3-2026-11-06.md)。所有脚本传入已有 Playwright 包路径，不覆盖历史记录。

第四轮三维／工作区／合墙／性能：`.local-checks/viewport-round4/workflow.cjs`（5215）、`navigation.cjs`（5216）验证区域框选、相机、最大化、实际输入、实例矩阵缓存、共线墙与门窗迁移；`performance.cjs`（5214）测量 100／300 个对象的选择反馈，须单独运行避免并行任务干扰。相关回归使用新目录；`ux-refinement.cjs` 和 `viewport-zoom.cjs` 已按新的“更多”菜单访问次要三维功能。详见 [第四轮交付](../docs/viewport-round4-2026-11-06.md)。历史三维截图固定 1600×1000 的假设不再适用，当前截图保持取景与视口比例；历史验收未自动视为本轮通过。

第五轮界面精简：`.local-checks/ui-round5/workflow.cjs`（5221）验证按需属性、菜单、三种窗口、画布面积、真实画墙／标注、键盘、范围入口及文件交付；定位与规格回归副本跟随新菜单，分别输出本轮子目录。`ux-refinement.cjs` 按新的无选择面板行为、精简工具条高度和文件菜单访问路径更新，原门窗数据检查保留。详见 [第五轮记录](../docs/ui-round5-2026-11-06.md)。

三维空格平移：`.local-checks/space-pan-2026-11-06/workflow.cjs`（5222）覆盖真实拖动、焦点／相机、移动设备隔离、输入、分屏、失焦和截图；缩放回归写入同目录 `zoom/`。见 [操作与验收](../docs/space-pan-2026-11-06.md)。
