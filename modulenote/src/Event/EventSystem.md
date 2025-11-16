# 事件传递系统完整总结

## 系统概述

本项目实现了一个基于通道（Channel）的事件传递系统，用于替代传统的 props/emit 通信方式，实现组件间、对象间以及跨层级的解耦通信。

### 核心设计理念

1. **解耦通信**：组件和对象通过事件通道通信，无需直接引用或传递 props
2. **类型安全**：通过 TypeScript 类型定义确保事件 payload 的类型正确性
3. **生命周期管理**：自动管理订阅的生命周期，防止内存泄漏
4. **灵活扩展**：支持事件桥接、Hub 互联、条件过滤等高级特性

## 核心概念解释

为了更好地理解事件系统，让我们用生活中的例子来解释这些核心概念：

### 📻 Hub（事件中心）

**类比：广播电台的总控制室**

Hub 就像是一个广播电台的总控制室，它负责：
- 管理所有的"频道"（通道）
- 记录谁在"收听"哪些频道（订阅关系）
- 将"节目"（事件）发送给所有"听众"（订阅者）

```typescript
// 创建一个 Hub，就像建立一个广播电台
const hub = new EventHub();

// 或者使用全局 Hub（整个应用共用一个电台）
const globalHub = EventHub.global();
```

**特点：**
- 一个 Hub 可以管理多个通道
- 可以有多个 Hub（就像有多个电台）
- Hub 之间可以互联（电台之间可以转播）

### 📡 通道（Channel）

**类比：广播电台的频道**

通道就像广播电台的不同频道（如 FM 88.5、FM 101.2），每个频道有特定的名称和用途。

```typescript
// 定义通道名称
const CHANNEL = 'notes:element:click';

// 就像调频到 88.5 收听音乐频道
hub.subscribe(CHANNEL, handler);

// 就像在 88.5 频道播放音乐
hub.emit(CHANNEL, { element: myElement });
```

**通道命名规范：**
- 使用命名空间，避免冲突：`模块:功能:动作`
- 例如：`notes:element:click`、`notes:sidebar:expanded`

**为什么需要通道？**
- 区分不同类型的事件（就像区分音乐频道和新闻频道）
- 只有订阅了特定通道的组件才会收到该通道的事件
- 避免所有组件收到所有事件（性能优化）

### 📬 事件（Event）

**类比：广播电台播放的节目内容**

事件就是通过通道传递的具体信息，包含：
- **payload（载荷）**：实际的数据内容
- **meta（元信息）**：关于事件的附加信息（时间、来源、路径等）

```typescript
// 发送一个事件，就像播放一个节目
hub.emit('notes:element:click', {
  element: myElement,        // payload：实际数据
  timestamp: Date.now()      // payload：额外信息
}, {
  source: 'button',          // meta：来源
  tags: ['user-action']      // meta：标签
});
```

**事件的特点：**
- 一旦发送，所有订阅了该通道的处理器都会收到
- 可以携带任意类型的数据（payload）
- 包含上下文信息（meta），便于追踪和调试

### 📋 订阅（Subscription）

**类比：调频到某个频道并收听**

订阅就是"告诉 Hub：当某个通道有事件时，请通知我"。

```typescript
// 订阅一个通道，就像调频到 88.5 并开始收听
const unsubscribe = hub.subscribe('notes:element:click', (context) => {
  // 当这个通道有事件时，这个函数会被调用
  console.log('收到事件:', context.payload);
});

// 取消订阅，就像关闭收音机
unsubscribe();
```

**订阅的组成：**
- **通道名称**：要监听哪个通道
- **处理器函数**：收到事件时执行什么操作
- **选项**：优先级、过滤条件、是否只执行一次等

**订阅的生命周期：**
- 创建订阅后，只要 Hub 存在，就会一直监听
- 可以手动取消订阅（调用返回的函数）
- 可以通过 owner 批量清理订阅

### 👤 Owner（所有者）

**类比：订阅的"主人"**

Owner 就像订阅的"主人"，用于管理订阅的生命周期。当"主人"不再需要时，可以一次性清理所有属于它的订阅。

```typescript
// 创建一个对象作为 owner
const myComponent = { id: 'component-1' };

// 订阅时指定 owner
hub.subscribe('notes:element:click', handler, {
  owner: myComponent
});

// 当组件销毁时，一次性清理所有订阅
hub.clearOwner(myComponent);
// 所有属于 myComponent 的订阅都会被自动移除
```

,**Owner 的作用：**
- **批量管理**：一个 owner 可以有多个订阅，清理时一次性移除
- **防止内存泄漏**：组件销毁时自动清理所有订阅
- **便于调试**：知道哪些订阅属于哪个组件/对象

**实际应用：**
```typescript
// 在 Vue 组件中，EventNode 自动将组件作为 owner
const eventNode = useEventNode();
eventNode.on('notes:element:click', handler);
// 组件卸载时，所有订阅自动清理（因为 owner 是 eventNode）
```

### 🌉 桥接（Bridge）

**类比：电台之间的转播**

桥接就像两个电台之间的转播：当 A 电台播放某个节目时，B 电台自动转播。

```typescript
// 将通道 A 的事件桥接到通道 B
hub.link('notes:element:click', 'notes:sidebar:update', {
  transform: (context) => {
    // 可以转换事件内容
    return {
      ...context,
      payload: { selectedElement: context.payload.element }
    };
  }
});

// 现在，当 'notes:element:click' 有事件时
// 'notes:sidebar:update' 也会自动收到（经过转换）
```

**桥接的用途：**
- **事件转换**：将内部事件转换为外部事件
- **事件路由**：将事件从一个通道转发到另一个通道
- **事件过滤**：在桥接过程中可以过滤或修改事件

**Hub 互联（linkHub）：**
```typescript
// 两个不同的 Hub 之间也可以桥接
const hubA = new EventHub();
const hubB = new EventHub();

// Hub A 的某个通道桥接到 Hub B 的某个通道
hubA.linkHub(hubB, 'hubA:event', 'hubB:event');
// 就像两个电台之间建立转播关系
```

### 📊 概念关系图

```
Hub（广播电台）
  │
  ├── Channel 1（频道1：notes:element:click）
  │     ├── Subscription 1（订阅者1，owner: ComponentA）
  │     ├── Subscription 2（订阅者2，owner: ComponentB）
  │     └── Bridge → Channel 2（桥接到频道2）
  │
  ├── Channel 2（频道2：notes:sidebar:update）
  │     └── Subscription 3（订阅者3，owner: Sidebar）
  │
  └── Channel 3（频道3：notes:textbox:mode-change）
        └── Subscription 4（订阅者4，owner: Textbox）
```

### 🎯 实际应用示例

让我们用一个完整的例子来理解这些概念：

```typescript
// 1. 创建一个 Hub（建立广播电台）
const hub = EventHub.global();

// 2. 组件 A 订阅通道（调频到某个频道）
const componentA = { id: 'A' };
hub.subscribe('notes:element:click', (context) => {
  console.log('组件 A 收到点击事件:', context.payload);
}, { owner: componentA });

// 3. 组件 B 也订阅同一个通道（另一个听众也调频到同一频道）
const componentB = { id: 'B' };
hub.subscribe('notes:element:click', (context) => {
  console.log('组件 B 收到点击事件:', context.payload);
}, { owner: componentB });

// 4. 组件 C 发送事件（在频道上播放节目）
hub.emit('notes:element:click', {
  element: myElement,
  timestamp: Date.now()
});

// 结果：组件 A 和组件 B 都会收到这个事件

// 5. 建立桥接（建立转播关系）
hub.link('notes:element:click', 'notes:sidebar:update', {
  transform: (ctx) => ({
    ...ctx,
    payload: { selected: ctx.payload.element }
  })
});

// 现在，当 'notes:element:click' 有事件时
// 'notes:sidebar:update' 也会自动收到转换后的事件

// 6. 清理订阅（关闭收音机）
hub.clearOwner(componentA); // 组件 A 的所有订阅都被清理
```

### 💡 记忆口诀

- **Hub** = 广播电台（管理所有频道）
- **Channel** = 频道（区分不同类型的节目）
- **Event** = 节目内容（实际传递的信息）
- **Subscription** = 调频收听（告诉电台"我要听这个频道"）
- **Owner** = 订阅的主人（用于批量管理订阅）
- **Bridge** = 电台转播（将一个频道的内容转发到另一个频道）

## 系统架构

```
┌─────────────────────────────────────────────────────────┐
│                    EventHub (事件中心)                    │
│  - 管理所有通道和订阅者                                   │
│  - 提供 subscribe/emit/link/linkHub 等核心 API          │
│  - 支持全局 Hub 和子 Hub                                 │
└─────────────────────────────────────────────────────────┘
           ▲                    ▲
           │                    │
    ┌──────┴──────┐      ┌──────┴──────┐
    │  EventNode  │      │ useEventNode │
    │  (对象层)   │      │  (Vue组件)   │
    └─────────────┘      └──────────────┘
```

### 核心组件

#### 1. EventHub（事件中心）

事件系统的核心，负责管理所有通道和订阅关系。

**主要方法：**

- `subscribe(channel, handler, options)` - 订阅事件
- `once(channel, handler, options)` - 一次性订阅
- `emit(channel, payload, meta?)` - 发送事件
- `link(fromChannel, toChannel, options)` - 通道桥接
- `linkHub(targetHub, fromChannel, toChannel, options)` - Hub 互联
- `clearOwner(owner)` - 清理指定 owner 的所有订阅
- `createChild()` - 创建子 Hub

**订阅选项（SubscriptionOptions）：**

```typescript
{
  priority?: number;        // 优先级，越大越先执行
  once?: boolean;          // 是否只执行一次
  filter?: (context) => boolean;  // 条件过滤
  owner?: unknown;         // 订阅归属，用于批量清理
  tags?: string[];         // 标签，用于调试
}
```

**事件上下文（EventContext）：**

```typescript
{
  payload: TPayload;       // 事件数据
  meta: EventMeta;         // 元信息（通道、时间戳、来源等）
  stopPropagation(): void; // 停止传播
  preventDefault(): void;  // 阻止默认行为
  stopped: boolean;        // 是否已停止
  defaultPrevented: boolean; // 是否已阻止默认
}
```

#### 2. EventNode（事件节点）

面向对象或组件的轻量封装，自动管理 owner 和生命周期。

**主要方法：**

- `emit(channel, payload, meta?)` - 发送事件（自动附加节点信息）
- `on(channel, handler, options?)` - 订阅（自动绑定 owner）
- `once(channel, handler, options?)` - 一次性订阅
- `bridge(fromChannel, toChannel, options?)` - 桥接通道
- `linkHub(targetHub, fromChannel, toChannel, options?)` - Hub 互联
- `connect(targetNode, channels)` - 节点互联
- `dispose()` - 清理所有订阅

#### 3. useEventNode（Vue 组合式 API）

在 Vue 组件中使用事件系统的便捷方式。

```typescript
const eventNode = useEventNode({
  id?: string;           // 自定义节点 ID
  hub?: EventHub;        // 指定 Hub（默认全局）
  tags?: string[];        // 标签
  autoDispose?: boolean;  // 是否自动清理（默认 true）
});
```

**特性：**
- 自动基于组件名称和 uid 生成节点 ID
- 组件卸载时自动清理所有订阅
- 支持跨组件共享节点（设置 `autoDispose: false`）

## Hub 互联机制

### 为什么需要 Hub 互联？

在大型应用中，可能需要多个独立的事件 Hub：
- 不同模块隔离（避免事件污染）
- 测试环境隔离
- 插件系统（每个插件独立 Hub）
- Electron 多窗口场景

### linkHub 方法

```typescript
hubA.linkHub(
  hubB,                    // 目标 Hub
  'channelA',              // 源通道
  'channelB',              // 目标通道
  {
    direction: 'bidirectional',  // 方向：forward/reverse/bidirectional
    transform: (context) => {    // 转换函数
      return { ...context, payload: modifiedPayload };
    },
    forwardMeta: true,      // 是否转发元信息
    passthroughTags: true, // 是否透传标签
    guardLoop: true,        // 是否防止循环（默认 true）
    bridgeId: 'custom-id'   // 自定义桥接 ID
  }
);
```

### 使用场景示例

```typescript
// 场景 1：模块隔离
const uiHub = new EventHub();
const dataHub = new EventHub();

// UI 层事件转发到数据层
uiHub.linkHub(dataHub, 'ui:action', 'data:action', {
  transform: (ctx) => ({
    ...ctx,
    payload: { ...ctx.payload, source: 'ui' }
  })
});

// 场景 2：双向通信
const mainHub = EventHub.global();
const childHub = mainHub.createChild();

// 建立双向桥接
mainHub.linkHub(childHub, 'main:event', 'child:event', {
  direction: 'bidirectional',
  reverseChannel: 'main:response'
});
```

## 在项目中的应用

### 已迁移的组件

#### 1. App.vue

**替换前（props/emit）：**
```vue
<Sidebar
  :selected-object="selectedObject"
  @content-updated="handleContentUpdated"
  @expanded-change="handleSidebarExpandedChange"
/>
```

**替换后（事件系统）：**
```typescript
const eventNode = useEventNode({ tags: ['app'] });

// 监听元素双击
eventNode.on(NotesChannels.ELEMENT_DOUBLE_CLICK, ({ payload }) => {
  selectedObject.value = payload.element;
});

// 监听侧边栏状态
eventNode.on(NotesChannels.SIDEBAR_EXPANDED, ({ payload }) => {
  sidebarExpanded.value = payload.expanded;
});
```

#### 2. Sidebar.vue

**替换前：**
```typescript
const emit = defineEmits<{
  contentUpdated: [object: ObjectBase, content: any];
  expandedChange: [expanded: boolean];
}>();

emit('expandedChange', expanded.value);
```

**替换后：**
```typescript
const eventNode = useEventNode({ tags: ['sidebar'] });

// 发送事件而不是 emit
eventNode.emit(NotesChannels.SIDEBAR_EXPANDED, { expanded: expanded.value });

// 监听选中对象变化
eventNode.on(NotesChannels.SELECTION_CHANGED, ({ payload }) => {
  selectedObject.value = payload.element;
});
```

### 事件通道定义

所有事件通道在 `src/Event/channels.ts` 中统一管理：

```typescript
export const NotesChannels = {
  // 元素相关
  ELEMENT_DOUBLE_CLICK: 'notes:element:dblclick',
  ELEMENT_CLICK: 'notes:element:click',
  ELEMENT_ADD: 'notes:element:add',
  ELEMENT_REMOVE: 'notes:element:remove',
  ELEMENT_SPLIT: 'notes:element:split',
  ELEMENTS_CHANGE: 'notes:elements:change',
  
  // 选择相关
  SELECTION_CHANGED: 'notes:selection:changed',
  
  // 侧边栏相关
  SIDEBAR_EXPANDED: 'notes:sidebar:expanded',
  SIDEBAR_CONTENT_UPDATED: 'notes:sidebar:content-updated',
  
  // Textbox 相关
  TEXTBOX_MODE_CHANGE: 'notes:textbox:mode-change',
} as const;
```

每个通道都有对应的 TypeScript 类型定义，确保类型安全。

## 最佳实践

### 1. 通道命名规范

使用命名空间前缀，格式：`模块:功能:动作`

```
notes:element:dblclick    ✅ 清晰明确
element:click            ❌ 缺少命名空间
click                    ❌ 过于简单，容易冲突
```

### 2. 事件 Payload 设计

```typescript
// ✅ 好的设计：包含必要的上下文信息
interface ElementClickPayload {
  element: Element;
  timestamp: number;
  source: string;
}

// ❌ 不好的设计：只传递 ID，需要接收方额外查找
interface BadPayload {
  elementId: string;
}
```

### 3. 生命周期管理

```typescript
// ✅ 在组件中使用 useEventNode（自动清理）
const eventNode = useEventNode();

// ✅ 在对象中使用 EventNode（手动管理）
class MyController {
  private node = new EventNode();
  
  destroy() {
    this.node.dispose(); // 清理所有订阅
  }
}

// ❌ 避免直接使用 Hub.subscribe（难以管理）
hub.subscribe('channel', handler); // 没有 owner，难以清理
```

### 4. 条件订阅

```typescript
// 只在特定条件下处理事件
eventNode.on('notes:element:click', handler, {
  filter: (ctx) => {
    return ctx.payload.element.type === 'button';
  }
});
```

### 5. 优先级控制

```typescript
// 高优先级处理器先执行
eventNode.on('notes:element:click', highPriorityHandler, {
  priority: 100
});

// 低优先级处理器后执行
eventNode.on('notes:element:click', lowPriorityHandler, {
  priority: 0
});
```

### 6. 事件桥接

```typescript
// 将内部事件转换为外部事件
eventNode.bridge('internal:update', 'notes:element:update', {
  transform: (ctx) => ({
    ...ctx,
    payload: {
      elementId: ctx.payload.id,
      timestamp: Date.now()
    }
  }),
  forwardMeta: true
});
```

## 调试技巧

### 1. 使用标签追踪

```typescript
const eventNode = useEventNode({ 
  tags: ['component', 'sidebar'] 
});

// 订阅时也可以添加标签
eventNode.on('notes:element:click', handler, {
  tags: ['debug', 'click-handler']
});
```

### 2. 事件路径追踪

每个事件都包含 `meta.path`，记录事件经过的节点：

```typescript
eventNode.on('notes:element:click', ({ meta }) => {
  console.log('事件路径:', meta.path);
  // 输出: ['node_1', 'node_2', 'hub_link_1']
});
```

### 3. 监听所有事件（开发环境）

```typescript
if (import.meta.env.DEV) {
  const hub = EventHub.global();
  
  // 监听所有通道（通过通配符或遍历）
  hub.subscribe('*', (ctx) => {
    console.log('事件:', ctx.meta.channel, ctx.payload);
  });
}
```

## 性能考虑

### 1. 避免过度订阅

```typescript
// ❌ 不好：每个元素都订阅
elements.forEach(el => {
  eventNode.on('notes:update', () => update(el));
});

// ✅ 更好：统一订阅，在处理器中区分
eventNode.on('notes:update', ({ payload }) => {
  const element = findElement(payload.elementId);
  if (element) update(element);
});
```

### 2. 使用 once 替代重复订阅

```typescript
// ✅ 一次性订阅，自动清理
eventNode.once('notes:init', initHandler);
```

### 3. 条件过滤减少处理

```typescript
// 使用 filter 避免不必要的处理
eventNode.on('notes:element:update', handler, {
  filter: (ctx) => ctx.payload.elementId === this.elementId
});
```

## 迁移指南

### 从 props/emit 迁移到事件系统

**步骤 1：识别通信模式**
- 父子组件通信 → 事件通道
- 兄弟组件通信 → 事件通道
- 跨层级通信 → 事件通道

**步骤 2：定义事件通道**
在 `channels.ts` 中添加新通道和类型定义。

**步骤 3：替换 emit**
```typescript
// 替换前
emit('element-click', element);

// 替换后
eventNode.emit(NotesChannels.ELEMENT_CLICK, { element });
```

**步骤 4：替换 props/watch**
```typescript
// 替换前
watch(() => props.selectedObject, (obj) => {
  // 处理
});

// 替换后
eventNode.on(NotesChannels.SELECTION_CHANGED, ({ payload }) => {
  // 处理
});
```

### 渐进式迁移与关闭 emits

为降低改动风险，建议采用“双发布”与“按模块关闭”的策略：

1) 双发布阶段（已完成）
- 在核心组件（如 `Textbox.vue`、`Element.vue`）内同时保留原有 `emit(...)` 与新的 `eventNode.emit(...)`。
- 在使用方（如 `SimpleDemo.vue`、`ObjectCommunicationDemo.vue`）新增对 `NotesChannels` 的订阅以同步状态；随后删除模板中的 `@elements-change`、`@element-dblclick` 等监听，从此仅依赖事件系统。
- 本仓库已完成 Demo 的切换：Demo 组件完全依赖事件系统，模板中不再绑定 `@elements-change`/`@mode-change`/`@element-dblclick` 等。

2) 按模块关闭 emits
- 观察一段时间确认无功能回退后，逐模块移除核心组件中的 `defineEmits` 与所有 `emit(...)` 调用，仅保留 `eventNode.emit(...)`。
- 同时清理不再使用的 props/事件类型声明，维护更简洁的组件 API。

3) 验收清单
- 页面行为一致：元素点击/双击、添加/删除、列表变更、模式切换、侧栏同步等均正常。
- 调试可见：`EventLogger` 中可看到事件路径与 Hub 链路，过滤与标签可按需开启。
- 性能无回退：订阅数量与频次符合预期，无明显重复处理。

4) 参考落地示例
- Demo 已完全改用事件系统，供对照：`modulenote/src/test/SimpleDemo.vue`、`modulenote/src/test/ObjectCommunicationDemo.vue`。
- 应用层面已将 `App.vue`、`Sidebar.vue` 完成替换并联调通过。

## 未来扩展方向

1. **类型增强**：实现类型安全的事件通道定义
   ```typescript
   const typedChannel = createTypedChannel<
     'notes:element:click',
     ElementClickPayload
   >();
   ```

2. **调试工具**：开发事件可视化面板
   - 实时显示事件流
   - 订阅关系图
   - 性能分析

3. **对象模型对接**：将 `ObjectBase` 的信号机制包装为事件
   ```typescript
   class Element extends ObjectBase {
     sendEvent(channel: string, payload: any) {
       this.eventNode.emit(channel, payload);
     }
   }
   ```

4. **Electron 集成**：跨进程事件传递
   ```typescript
   // 主进程 Hub 与渲染进程 Hub 互联
   mainHub.linkHub(rendererHub, 'main:event', 'renderer:event');
   ```

## 总结

事件传递系统为项目提供了：

✅ **解耦通信**：组件和对象通过事件通道通信，降低耦合度  
✅ **类型安全**：TypeScript 类型定义确保事件数据正确性  
✅ **生命周期管理**：自动清理订阅，防止内存泄漏  
✅ **灵活扩展**：支持桥接、过滤、优先级等高级特性  
✅ **易于调试**：事件路径追踪、标签系统等调试工具  

通过逐步迁移，项目中的组件通信将更加清晰、可维护和可扩展。

