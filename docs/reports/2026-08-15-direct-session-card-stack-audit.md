# 会话实体卡直接堆叠设计审计

> 日期：2026-08-15
> 主验收视口：1440×900、1024×768

## 1. 成熟交互参考

- Apple Wallet HIG：折叠后的 pass 仍需露出可识别的头部信息，内容保持简洁。https://developer.apple.com/design/human-interface-guidelines/wallet/
- React Bits Stack：直接牌堆用稳定层序、弹簧参数与点击换层表达“把卡送到后面”，并提供 hover 暂停等可控状态。https://www.reactbits.dev/components/stack
- Framer Card Stack Hover：闭合态使用 absolute positioning 形成紧密堆叠，悬停后展开全部层，并为当前 hover 卡提供独立强调态。https://framer.university/resources/card-stack-hover-animation-in-framer
- Motion Card Stack：保持 DOM 顺序稳定，仅以 transform、opacity 与 z-index 进行视觉重排，降低复杂堆叠切换的渲染成本。https://motion.dev/examples/react-card-stack

本项目采用这些案例的共同结构，但不照搬整卡拖拽。聊天主卡内部包含消息滚动、Concept 触发器、文本选择和输入框，整卡手势会与这些高频操作冲突；因此改为悬停/聚焦卡沿展开牌堆，点击目标卡沿完成提升。

## 2. 最终结构

- 父会话、当前会话和子分支均为同尺寸完整卡体，不再使用祖先竖条、顶部索引页或右侧独立分支列。
- 父会话向左上退后，直接子分支向右下展开；当前会话始终处于最高层。
- 默认每层错位 27px，悬停或键盘聚焦任一卡沿时整叠按 34px 步长拉开；当前目标层再沿堆叠方向抬升并归零旋转。
- 露出的标题带为 28px 高，包含层级编号、关系、标题与方向提示；视觉卡体不抢占上层事件，标题带独立接收点击、键盘焦点与 hover。
- 前两层直接展示，第三层作为“更早路径/其余分支”入口打开 Popover，避免无限铺开。
- 上下各预留 96px 展开空间，父级、当前与分支卡仍保持完全同尺寸；进入分支从右下抽入，回到父级从左上抽入。
- 展开与切换动效只改变 transform、opacity、shadow 与 border，并服从减少动态设置；没有引入整卡拖拽和新的运行时动画依赖。
- 720px 以上保留直接卡堆，低于该容器宽度才使用单行路径，符合本项目桌面优先边界。

## 3. 截图审查

最终截图位于 `data/ui-captures/33-direct-stack-final/`，不进入 Git。

- `before-desktop-1440x900`：根会话下三层子卡紧密叠放，协商缓存、Service Worker 缓存和其余分支均可识别。
- `hover-stack-desktop-1440x900`：悬停第一层时三层整体拉开，目标卡沿抬升并显示“打开此层”，底部未越界。
- `after-desktop-1440x900`：进入子会话后，父会话作为完整背卡向左上露出，当前消息与输入区不受遮挡。
- `hover-ancestor-desktop-1440x900`：父卡悬停后向左上抬升，标题与“回到此层”保持完整可读。
- `sibling-desktop-1440x900`：返回根会话再点击另一个卡沿，可进入兄弟分支。
- `direct-stack-tablet-1024x768`：1024 宽度仍保留实体卡堆，输入区和顶栏操作完整可见。
- `multi-source-desktop-1440x900`：右侧 Concept 轨道打开后，主卡与子卡仍保持清楚的前后层级。

早期测试发现整张背卡接收点击时会被上层消息区拦截，因此将卡体与卡沿命中区拆分。第一轮 hover 版本又发现只有 11px 卡沿真正露在主卡外，自动化鼠标命中会被输入区截获；最终把主卡上下预留提升到 112px、背卡基线保持 96px，确保 28px 卡沿完整露出，并通过“展开子分支 → 进入子分支 → 展开父卡 → 回到父级 → 进入兄弟分支”的真实路径验证。

## 4. 验收门禁

- Vitest：16 个测试文件、82 个用例通过。
- TypeScript `--noEmit` 与 ESLint：通过。
- Playwright 直接影响面回归：`3 passed / 3 skipped`；覆盖紧叠、悬停展开、父卡展开、父子/兄弟切换、Concept 轨道和 1440/1024 目标视口。
- Next.js 16.3.0 production build：编译、类型检查和 28 个页面数据任务生成通过，可见 `/practice` 页面已移除。
- `git diff --check`：通过，仅输出 Windows 工作区既有的 LF/CRLF 转换提示。
- 重启后的 `http://127.0.0.1:3000/` 返回 HTTP 200。
