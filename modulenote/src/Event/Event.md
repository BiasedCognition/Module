# Event 通信雏形

本文档概述 `modulenote/src/Event/` 目录下事件传递机制雏形的设计与用法，帮助后续在项目中扩展任意组件间的绑定与通信。

## 设计目标
- **跨层级通信**：摆脱父子链路限制，在对象模型、Vue 组件、Electron 主/渲染进程之间共用同一事件总线。
- **声明式绑定**：以通道（channel）为单位订阅与广播，可按优先级、条件过滤、一次性等方式管理。
- **生命周期安全**：统一通过 `owner` 或 `EventNode` 管理订阅，组件卸载或对象销毁时自动清理。
- **可扩展**：允许透传元信息、设置事件桥接/转换、派生子 Hub 实现局部隔离。

## 核心组成
- `EventHub`
  - 负责管理通道与订阅者列表，并提供 `subscribe / once / emit / link / clearOwner / createChild` 等 API。
  - `subscribe(channel, handler, options)`
    - `priority` 控制执行顺序（越大越早），同级保持注册顺序。
    - `once` 首次触发后自动移除，适合一次性事件（如初始化）。
    - `filter(context)` 仅在返回 `true` 时执行处理器，可实现条件订阅。
    - `owner` 绑定订阅归属，可通过 `clearOwner` 或 `EventNode.dispose` 统一清理。
    - `tags` 为订阅打标签，便于调试时筛查。
  - `emit(channel, payload, meta?)`
    - 顺序执行所有订阅者，过程中可调用 `context.stopPropagation()` 与 `context.preventDefault()`。
    - 自定义 `meta` 可覆盖 `timestamp / source / tags / path` 等，适合跨模块链路追踪。
  - `link(fromChannel, toChannel, options)`
    - 桥接两个通道，可通过 `transform` 改写 payload 或上下文，返回 `null/undefined` 时终止转发。
    - `forwardMeta` 控制是否继承原上下文的元信息；`passthroughTags` 控制是否透传 tags。
  - `clearOwner(owner)`：按 owner 一次性移除所有订阅。
  - `createChild()`：生成独立子 Hub，适合在局部作用域内搭建隔离的事件总线。
  - `linkHub(targetHub, fromChannel, toChannel, options)`
    - 将当前 Hub 与目标 Hub 建立单向或双向互联，默认使用 `BridgeOptions` 的 `transform / forwardMeta / passthroughTags`。
    - `direction` 控制传输方向（`forward`、`reverse`、`bidirectional`），`reverseChannel` 与 `reverseTransform` 支持反向映射。
    - 自动在 `meta.path` 追加桥接 id（可通过 `guardLoop` 关闭），以防双向转发时形成事件回环。

- `EventNode`
  - 用于对象或组件的轻量封装，默认关联一个 Hub（未指定时取全局 Hub），且拥有 `id` / `tags`。
  - `emit / on / once / bridge` 与 `EventHub` API 基本一致，但每个订阅自动以节点为 owner。
  - `connect(targetNode, channels)`
    - 在一组通道之间建立互联，内部使用 `bridge` 实现并在 meta.path 中追加当前节点 id，便于追踪事件流。
    - 返回断开连接的函数，执行后会依次调用内部桥接的卸载函数。
  - `linkHub(targetHub, fromChannel, toChannel, options)`：复用节点背后的 Hub 与其他 Hub 互联，便于在对象层做跨域通信。
  - `dispose()`：释放该节点所有订阅（等价于 `hub.clearOwner(this)`）。
  - `createEventNode(options)` 提供创建临时节点的工具方法。

- `useEventNode`
  - Vue 组合式 API，支持在组件内快速创建 `EventNode`。
  - 默认基于组件名称 + uid 生成节点 id，并在 `onUnmounted` 自动调用 `dispose`。
  - 可通过 `autoDispose: false` 禁用自动清理，以便跨组件共享节点。

- 辅助方法
  - `emitEvent / onEvent / bridgeEvent`：统一接受 `EventHub` 或 `EventNode`，方便在工具函数中复用相同调用方式。

## 基本用法示例
```ts
// src/components/Templates/Element.vue (伪代码)
import { useEventNode } from '@/Event';

const eventNode = useEventNode({ tags: ['element'] });

eventNode.on('textbox:focus', ({ payload }) => {
  // 响应来自 Textbox 的聚焦事件
});

eventNode.emit('element:update', { id: props.element.elementId });
```

```ts
// Object 层桥接
import { EventNode } from '@/Event';

class TextboxController {
  private node = new EventNode({ tags: ['textbox'] });

  constructor() {
    // 将内部事件映射到外部通道
    this.node.bridge('internal:updated', 'textbox:updated', {
      forwardMeta: true
    });
  }
}
```

## 事件桥接
- `hub.link` / `node.bridge`
  - 支持通过 `transform(context)` 对 payload / meta 做转换、拦截或补充。
  - 当返回值为 `EventContext<TOutput>` 时，目标事件将继承自定义 meta；返回 `null/undefined` 时终止转发。
  - `forwardMeta` 允许保留原上下文信息（例如来源、路径）；`passthroughTags` 控制是否保留原标签。
  - 配合 `owner` 可方便地在桥接结束时统一清理所有通道映射。
- `hub.linkHub`
  - 用于不同 `EventHub` 实例之间的互联，可设定单向或双向转发，并在 meta.path 中记录桥接链路。
  - 默认开启回环保护（`guardLoop`），可在需要时关闭以实现自定义路由。
- 常见场景
  - 将对象层 `internal:*` 信号桥接成 UI 层 `textbox:*` 事件。
  - Electron 主/渲染进程之间的消息中转。
  - 构建统一的日志/监控出口，在桥接过程中补充链路信息。

## 生命周期与清理
- `owner` 机制贯穿 Hub 和 Node：
  - 订阅时将 `owner` 设置为某个对象后，调用 `clearOwner(owner)` 即可批量移除其所有订阅。
  - `EventNode` 的 `on/once/bridge/connect` 默认为节点自身 owner，调用 `dispose()` 等同清空节点下所有订阅。
- `useEventNode`
  - 在 Vue 组件中使用时，默认于组件卸载时自动 `dispose`，避免手动释放。
  - 若需跨组件共享同一个节点，可关闭 `autoDispose` 并自行管理生命周期。

## 下一步拓展建议
- **对象模型对接**：将 `ObjectBase` 的 `sendSignal` / `receiveSignal` 包装成事件通道，实现统一通信机制。
- **类型增强**：扩展类型辅助（如 `createTypedChannel<'element:update', ElementPayload>()`），提升事件 payload 的类型推断与校验能力。
- **调试工具**：引入事件轨迹记录、链路可视化或 DevTools 插件，辅助排查复杂链路问题。
- **跨进程集成**：结合 Electron `ipcMain/ipcRenderer` 搭建双向桥接，实现桌面端全链路事件传递。
- **性能优化**：在大型项目中根据需要实现订阅统计、限流或批量处理等机制，防止热点通道成为瓶颈。

该雏形为项目内建立通用事件总线提供基础，可根据业务需求继续扩展。***

