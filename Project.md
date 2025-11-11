## 项目文档草案

- **项目定位**：`ModuleNote` 是一个基于 Vue 3 + Vite 的桌面应用，通过 Electron 打包，结合 Tailwind CSS 4 实现快速 UI 样式，目标是搭建模块化“元素容器”及其通信演示环境。
- **核心特性**
  - 抽象对象系统：`ObjectBase` 定义基础位置/内容/注释/信号机制，`tButton`、`Textbox`、`Element` 等继承扩展，支持弱引用关联和信号发送。
  - 可视化演示：`SimpleDemo.vue`、`ObjectCommunicationDemo.vue` 展示容器内对象增删、模式切换、信号交互及通信日志。
  - 组件封装：`Templates/` 内的按钮、文本框、元素组件封装逻辑和交互，侧边栏 `Sidebar.vue` 利用 Vue `provide/inject` 实现双击选中与内容编辑。
  - Electron 集成：`main.js` 根据是否带 `--dev` 参数加载 Vite 或打包产物，可自动重试连接开发服务器，并禁用 Autofill。

- **技术栈与版本约束**
  - 运行时：Node.js `^20.19.0` 或 `>=22.12.0`
  - 框架/工具：Vue 3.5、Vite 7、TypeScript 5.8、Tailwind CSS 4、Electron 38、electron-builder 26
  - 依赖补充：`npm install` 已执行完毕；`npm audit` 显示 2 个中等风险（可选择 `npm audit fix`）。

- **目录速览**
  - `main.js` / `preload.js`：Electron 主进程、预加载。
  - `src/`：Vue 业务（`App.vue` 布局、`components/Object/` 抽象对象类、`components/Templates/` UI 组件、`test/` 演示页面）。
  - `assets/index.css`：Tailwind 入口与全局样式。
  - `tailwind.config.js`、`vite.config.ts`、`electron-builder.yml`、`tsconfig.*`：工程与打包配置。
  - `dist/`：Vite 构建产物（用于 Electron 生产模式加载）。

- **运行与构建**
  - 纯 Web 调试：`npm run dev`
  - 类型检查：`npm run type-check`
  - 生产构建（生成 `dist/`）：`npm run build`
  - Electron 前端联调：`npm run electron:dev`（并行启动 Vite 与 Electron，Electron 使用 `--dev` 自动连接 `http://localhost:5173`）
  - 桌面应用打包：`npm run electron:build`（输出在 `dist-electron/`）

- **重要交互流程**
  - **选择与侧边栏**：`App.vue` 通过 `provide('registerElement', ...)` 给模板组件注册双击事件；双击元素后 `selectedObject` 更新，侧边栏展开并显示内容可编辑，更新后触发 `contentUpdated` 事件。
  - **Textbox 模式控制**：`Textbox` 持有操作按钮集合，`TemplateButton` 双向绑定 `isActive` 并触发 `button_*` 信号，容器根据信号切换 `view/edit` 模式。
  - **元素管理**：`Textbox` 提供 `addElement/removeElement/clearElements` 与事件派发；`Element` 支持嵌入/移除/移动到指定位置并可通过信号更新显示文本与内容。
  - **演示脚本**：`contentDemo.ts`、`textboxDemo.ts` 直接执行，展示 `content` 属性和集合管理；注意 `Textbox` 构造函数当前无参，对应 demo 传参会在 TS 中标红，应保持默认构造。

- **元素 Markdown 展示与颜色机制**
  - 渲染：`Element.vue` 中的 `renderedHtml` 计算属性调用 `marked.parse(displayText)` 将存储的 Markdown 文本转换成 HTML，`v-html` 将结果注入 DOM；当展示文本为空时用 `[元素]` 占位。
  - 编辑：进入编辑态时切换到 `contenteditable="plaintext-only"` 容器，只保存原始 Markdown 字符串；输入与提交时调用元素实例的 `setDisplayText` 同步模型，触发监听让侧边栏/其他视图更新。
  - 颜色：元素对象维护 `textColor`，侧边栏调色板通过 `setTextColor` 更新值并广播 `colorUpdated`；组件把 `textColor` 绑定到展示与编辑容器的 `style.color`，Markdown 渲染生成的节点自然继承颜色，同时通过 `:deep` 定义代码块、链接等局部样式避免冲突。
  - 拆分：编辑态 `Ctrl+S` 触发拆分时，组件在发出 `split` 事件前调用 `setElementColor(textColor.value)`，确保拆分出的新元素沿用当前颜色，Markdown 展示与配色保持一致。

- **潜在注意事项**
  - Tailwind CSS 4 处于预览阶段，`@tailwindcss/vite` 插件已配置，需确保使用 Node ≥20 符合 ES 模块要求。
  - `ObjectBase.broadcastSignal` 暂未实现遍历，`tButton.broadcastToRelatedActiveObjects` 需要调用方传入活动对象数组。
  - `TextboxComponent` 中元素双击只透传到父组件，不在本组件注册双击监听，避免与元素自身的双击冲突。
  - `ObjectCommunicationDemo.vue` 中的 `element.receiveSignal('updateContent', updateData)` 少传了 `sender` 与 `signal` 参数，实际调用应来自某个 `ObjectBase` 实例，否则会触发运行时错误。
  - `contentDemo.ts` 中 `new Textbox("...")` 与当前构造函数签名不符，如后续严格启用类型检查需修正。
  - Windows PowerShell 终端自动写入状态文件时报访问拒绝，这是执行环境所致，可忽略。

- **后续建议**
  - 若需消除 `npm audit` 警告，可运行 `npm audit fix` 并复核构建。
  - 结合演示页面梳理最终产品需求，明确哪些 demo 逻辑要转换为实际业务模块。
  - 根据实际数据结构完善 `Element`/`Textbox` 的 `content` schema 和广播机制。
  - 若要在 Electron 中使用上下文隔离，需同步调整 `preload.js` 与前端访问方式。

已完成依赖安装与项目梳理，后续讨论可直接基于本说明展开。

- **近期更新（2025-11-10）**
  - 调整 `Textbox.vue` 元素容器样式，统一边框和内边距并移除多余间距。（实现：重写 `.textbox-wrapper`、`.elements-container` 等样式，收紧 padding 与 gap）
  - 更新 `Element.vue` 展示样式，支持文本内容自动换行并随内容尺寸扩展。（实现：修改 `.element-display-text` 的布局、边框和背景，使其自适应宽高）
  - 为 `Element.vue` 注册双击事件与侧边栏联动，双击元素即可在侧栏查看并编辑其详情。（实现：通过 `registerElement` 注入双击监听，触发 `handleElementDoubleClick`）
  - `Sidebar.vue` 增加展示文本编辑区，可直接修改元素的 `displayText`；`Element` 类新增 `setDisplayText` 方法触发监听。（实现：侧栏新增 textarea，元素类提供 `setDisplayText` 并广播更新）
  - `Element.vue` 组件改用响应式 `displayText` 计算属性，侧边栏更新展示内容时元素视图可即时刷新。（实现：使用 `computed` 读取 `props.element.displayText` 作为显示源）
  - `Element.vue` 进一步启用 `word-break: break-all` 与 `overflow-wrap: anywhere`，Textbox 中的元素长文本会自动切割换行。（实现：在展示样式中追加断行 CSS）
  - 支持双击元素进入内联编辑模式，保持原有样式实时编辑展示文本并立即同步。（实现：启用 `contenteditable`，实时写回对象模型）
  - `Sidebar.vue` 新增“刷新”按钮，便于快速重载选中元素的展示文本与内容。（实现：标题栏添加刷新按钮，调用 `refreshSelectedObject` 重新读取内容）
  - 编辑状态下支持 `Ctrl+S` 拆分元素：`Textbox.splitElement` 将当前元素按光标位置一分为二并插入新的 `Element`。（实现：`Element.vue` 捕获 `Ctrl+S` 发出 `split` 事件，由 `Textbox.splitElement` 插入新元素）
  - `Element.vue` 支持 Markdown 展示，编辑时使用纯文本，展示时通过 `marked` 渲染为 HTML。（实现：根据 `displayText` 计算 Markdown 渲染结果，编辑态使用 `contenteditable` 容器写回原始文本）
  - 侧边栏提供颜色调色板，可一键改变元素文字颜色并保持拆分时继承。（实现：`Element` 类新增 `textColor` 属性及 `setTextColor` 方法，Sidebar 调用更新，拆分逻辑同步复制颜色）
