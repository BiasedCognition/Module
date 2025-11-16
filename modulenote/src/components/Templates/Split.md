### 单行填充与“回车后智能拆分”方案（实现说明）

本方案用于保证 Element 在“展示与编辑”两种状态下均为单行显示；输入过程中绝不换行；在用户按 Enter 提交后，若当前元素会被挤到下一行，则按“尽量填满当前行”的策略进行智能拆分（前缀留在当前行，剩余内容作为新元素进入下一行）。

---

## 一、目标与原则
- 保持 Element 单行展示与编辑：`white-space: nowrap; overflow: hidden;`
- 输入过程中不拆分、不换行（避免编辑体验抖动）。
- 仅在 Enter 提交后判断“是否会挤到下一行”，若会，则执行“尽量填满当前行”的二分拆分。
- 提供“刷新重排”按钮：自前向后遍历，尝试把下一行首元素的前缀回填上一行（用于修正少数临界布局遗留）。

---

## 二、关键实现点

### 1) 编辑期“单行不换”的保障
- Element 在编辑期不固定宽度，改为“限制最大宽度”为“本行剩余空间”的 `max-width`，并设置 `flex: 0 0 auto`，避免元素不是行首时出现大面积空白。
- 这样既不会被挤到下一行，又不会浪费剩余空间。

### 2) 提交后智能拆分（Enter）
- 仅在 `commitEdit` 后执行判断：若整段可放入当前行，直接提交；否则进入拆分。
- 采用二分查找“最大可容纳前缀”长度 `ans`，保证 `measure(prefix) ≤ remaining` 且 `ans` 最大。
- 若 `ans <= 0`，一个字符也放不下，允许该元素整体换行，不做拆分（避免无效单字前缀）。

### 3) “本行剩余空间”的计算（你的提醒后修正）
- 有效右边界＝容器 `.elements-container` 的右边界扣除以下项：
  - `padding-right`
  - `border-right`
  - `ceil(column-gap)`（向上取整以覆盖像素栅格）
  - `1px` 容差（epsilon）
- 本行剩余空间＝有效右边界 − “上一行最后一个元素的 `right`”。
- 在最终比较前，再额外减 `2px` 安全边距，避免亚像素导致的误判。

### 4) 文本宽度测量（你的提醒后修正）
- 问题：早期测量未考虑 `.element-display-text` 的左右 padding，导致宽度被低估，出现不必要的拆分（如“分/策略”被拆开）。
- 解决：使用 `measureLikeDisplay(text, sampleDisplay)`：
  - 创建隐藏 span 测量内容宽度；
  - 若能拿到当前元素真实 `.element-display-text`，则读取其 `padding-left/right` 并加在测量值上；
  - 若取不到，则回退默认左右 `8px + 8px`；
  - 保持 `white-space: nowrap`，确保与渲染一致。

### 5) 刷新重排（从前往后塞满上一行）
- 暴露 `reflowFillPreviousLine()`（位于 `Textbox.vue`）：
  - 通过测量 `.elements-container` 中所有 `.element-component` 的 `getBoundingClientRect().top` 将元素分组为多行（容忍阈值 4px）。
  - 从第二行起，定位“当前行首元素”和“上一行的最右位置”，计算剩余空间，二分求可回填前缀。
  - 生成新元素插入到该首元素之前，并将剩余部分留在原元素内；一次移动后停止，便于多次点击逐步收敛。
- Demo 中“刷新重排”按钮即调用该方法，便于在极端布局时手动修正。

### 6) 右边界可视化（你的提醒后新增）
- `SplitLineFillDemo.vue` 提供“显示右边界”按钮：画出红色虚线，表示我们认为的“内容有效右边界”。
- 该可视化与算法计算完全一致（扣除了 `padding-right`、`border-right`、`ceil(column-gap)` 与 `1px` 容差）。

---

## 三、事件与兼容
- 与项目事件系统无缝衔接：
  - 拆分时发出 `NotesChannels.ELEMENT_SPLIT`；
  - 新增元素发出 `NotesChannels.ELEMENT_ADD`；
  - 其它事件（点击、双击、元素列表变更、模式变更等）保持不变。
- 迁移期可“props/emit 与事件系统双发布并行”，Demo 已改为仅依赖事件系统。

---

## 四、常见边界与修复策略
- “编辑时被挤下去”：已通过“限制 `max-width` = 行剩余空间”解决；不再固定宽度，避免非行首留下大片空白。
- “多拆一个字”：通过“测量补齐左右 padding + 安全边距”修复；如仍有极少数字体造成的临界抖动，可将安全边距由 `2px` 调小至 `1px/0px`，或把 `letter-spacing` 等字体特性同步到测量节点。
- “输入期产生布局抖动”：输入阶段不拆分，提交后再判断，且可用“刷新重排”进一步回填上一行。

---

## 五、文件与位置
- `components/Templates/Element.vue`：编辑期 `max-width` 限制、提交后智能拆分（二分）、事件发出。
- `components/Templates/Textbox.vue`：`reflowFillPreviousLine()` 实现与暴露、元素行分组与回填逻辑、兼容事件。
- `test/SplitLineFillDemo.vue`：容器宽度调节、右边界可视化（红线）、刷新重排按钮、事件日志。

---

## 六、关键片段（伪码化）

1) 提交后拆分（Element）
```
if (totalWidth(text) <= remainingWidthOfCurrentLine) return commit();
const ans = binarySearchMaxPrefix(text, remainingWidthOfCurrentLine);
if (ans <= 0) return commitWithoutSplit(); // 整体换行
split(before = text.slice(0, ans), after = text.slice(ans));
```

2) 计算容器有效右边界（Textbox）
```
effectiveRight = rect.right
  - paddingRight(container)
  - borderRight(container)
  - ceil(columnGap(container))
  - 1px  // epsilon
```

3) 宽度测量（补齐 padding）
```
width(text) = measureHiddenSpan(text) + paddingLeft(display) + paddingRight(display)
// 若 display 不可得，则 +16 作为默认补偿
```

4) 刷新重排（从前往后、一轮一次）
```
for line in lines[1..]: // 从第二行开始
  prevRight = maxRight(lines[i-1])
  remaining = effectiveRight - prevRight - 2 // 安全边距
  if remaining <= 0: continue
  first = firstElement(lines[i])
  ans = binarySearchMaxPrefix(first.text, remaining)
  if ans > 0 && ans < first.text.length:
    insertBefore(first, newElement(prefix))
    first.text = suffix
    break
```

---

## 七、结论
该方案在保持“编辑体验稳定”的前提下，实现了“提交后尽量填满当前行”的智能拆分；辅以“刷新重排”与“右边界可视化”，能有效处理临界布局与视觉误差问题。以上细节包含了多次根据你的反馈进行的修正：
- 编辑期从“固定宽度”改为“限制最大宽度=行剩余空间”；
- 有效右边界扣除 `padding-right/border-right/ceil(column-gap)` 并加容差；
- 宽度测量补齐 `padding-left/right`，修复“多拆一个字”；
- 提交后才判断拆分，输入阶段不干扰；
- 提供“刷新重排”以从前往后回填上一行。*** End Patch

