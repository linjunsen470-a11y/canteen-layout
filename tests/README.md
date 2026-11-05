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
| `g4-workflow.cjs` | 当前 G4 主流程或墙窗补查 | 5192 |

`g1-storage.browser.js` 和 `g2-invariants.browser.js` 由 G2 脚本导入，必须在一次性浏览器环境运行，不能在用户日常方案库中注入故障。历史脚本会随功能演进按需维护；修改版本断言或通过语法检查不代表本轮已重新跑完其全部流程。

所有 `.cjs` 的截图、样例和机器结果默认写入 `.local-checks/<阶段>-evidence/`。可用环境变量 `CANTEEN_EVIDENCE_DIR` 指定另一输出目录（相对仓库或绝对路径）。输入旧版本兼容性样例仍读取 `docs/`，不要覆盖这些归档样例来凑通过结果。

历史 Markdown 中“更新截图/JSON”指当时的输出流程；当前默认输出位置以本说明为准。脚本需要空闲端口；使用同一端口的主流程和 `linked` 分开运行。复跑结果不会自动成为新的阶段验收记录。
