# VarElement 功能说明

## 核心定位
- `VarElement` 是一种特殊的单行元素，内容绑定到一个对象（如 `Textbox` 或其他自定义对象）。
- 固定不可拆分（`splittable = false`），适合表示“某个对象/变量的引用”。
- 显示文案默认取对象的 `name` / `displayText` / `id`，自动根据对象内元素数量判断类型：
  - 仅一个元素 → 标记为“变量”
  - 多个元素 → 标记为“对象”

## 主要结构
- 文件：`src/components/Object/varElement.ts`
  - 维护 `targetObject`、`objectType`、`objectElements`
  - 提供 `addElementToObject` / `removeElementFromObject` / `updateObjectElements`
  - 文本、颜色依旧可通过原有 `setDisplayText` / `setTextColor` / `setBackgroundColor` 更新
- 组件：`src/components/Templates/VarElement.vue`
  - 与 `TextElement` 同样的单行布局
  - 鼠标悬浮时在上方显示类型提示（虚化、半透明）
  - 透出 `click` / `dblclick` 并广播至事件系统（`NotesChannels.ELEMENT_*`）

## 与 Textbox 的集成
- `Textbox` 内部元素类型扩展为 `TextboxElement = TextElement | VarElement`
- `Textbox.vue` 根据 `element.type` 选择渲染 `ElementComponent` 或 `VarElementComponent`
- 自动重排 / 分割逻辑跳过 `var-element`，保证不会被拆分
- 兼容事件系统（新增 / 点击 / 双击 / 合并等事件均携带 `TextboxElement`）

## 侧边栏交互
- `Sidebar.vue` 检测当前选中对象是否为 `varElement`
- 展示对象类型、对象元素列表，可直接在侧栏：
  - 添加文本子元素（默认“新文本元素”）
  - 移除指定子元素
- 所有颜色 / 展示文本等基础属性仍可编辑，分割开关对 `varElement` 隐藏

## 使用建议
1. 当需要在文本中引用“某个对象 / 变量”而非自由文本时，创建 `VarElement`
2. 通过侧栏维护对象的成员；若只需单一值，可保持仅一个元素，即被视为变量
3. 如需进一步扩展（例如拖拽绑定不同对象、显示更多元信息），可在 `VarElement` 类中扩展元数据并在 `VarElement.vue` 中渲染

> **Tips**：`VarElement` 仍属 `Textbox` 元素体系，可与 `TextElement` 共存，享受事件系统与布局系统的全部能力。



