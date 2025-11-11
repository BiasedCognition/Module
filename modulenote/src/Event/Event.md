# Event 通信雏形

本文档概述 `modulenote/src/Event/` 目录下事件传递机制雏形的设计与用法，帮助后续在项目中扩展任意组件间的绑定与通信。

## 设计目标
- **跨层级通信**：摆脱父子链路限制，在对象模型、Vue 组件、Electron 主/渲染进程之间共用同一事件总线。
- **声明式绑定**：以通道（channel）为单位订阅与广播，可按优先级、条件过滤、一次性等方式管理。
- **生命周期安全**：统一通过 `owner` 或 `EventNode` 管理订阅，组件卸载或对象销毁时自动清理。
- **可扩展**：允许透传元信息、设置事件桥接/转换、派生子 Hub 实现局部隔离。

## 核心组成
- `EventHub`：事件中心，负责存储通道与订阅者列表，支持 `subscribe / once / emit / link / clearOwner` 等方法。
- `EventNode`：面向对象或组件的轻量包装，持有 Hub 引用并记录自身 `id`/`tags`，提供 `emit / on / once / bridge / connect / dispose`。
- `useEventNode`：Vue 组合式 API，自动在组件 `onUnmounted` 时释放订阅，可与 `getCurrentInstance` 结合生成易读 ID。
- 辅助方法：`emitEvent`、`onEvent`、`bridgeEvent` 提供对 Hub 与 Node 的统一调用接口。

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
- `hub.link` / `node.bridge`：在两个通道之间建立桥接，可通过 `transform` 修改 payload / meta，并控制是否继承 tags、source 等信息。
- 适合场景：对象层向 Vue 通知、Electron 主进程与渲染进程消息互转、日志或监控链路的统一出口。

## 生命周期与清理
- 所有订阅都可以指定 `owner`。当调用 `EventHub.clearOwner(owner)` 或 `EventNode.dispose()` 时，相关订阅会被整体移除。
- `useEventNode` 默认自动清理，不需要手动调用 `dispose`。

## 下一步拓展建议
- 与 `ObjectBase` 的信号机制对接，将现有 `sendSignal` / `receiveSignal` 包装到事件通道中。
- 增加类型辅助，例如 `createTypedChannel<'element:update', ElementPayload>()`，提升类型推断。
- 引入调试工具，如记录事件轨迹、可视化依赖图，便于调试复杂的通信链路。

该雏形为项目内建立通用事件总线提供基础，可根据业务需求继续扩展。***

