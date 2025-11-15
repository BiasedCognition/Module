# 事件系统调试工具使用指南

## 概述

事件系统调试工具提供了完整的事件日志记录、路径可视化和多 Hub 链路追踪功能，帮助开发者快速定位和解决事件传递问题。

## 快速开始

### 1. 启用全局 Hub 调试

```typescript
import { enableGlobalHubDebug, eventLogger } from '@/Event';

// 启用调试（自动记录所有事件）
const disableDebug = enableGlobalHubDebug({
  logPayload: true,    // 记录事件 payload
  logMeta: true,        // 记录事件元信息
  autoLog: true,        // 自动记录
});

// 在控制台也可以直接调用
// window.enableEventDebug()
```

### 2. 查看调试信息

```typescript
// 打印最近的调试信息
eventLogger.printDebugInfo({
  recentLogs: 20,           // 显示最近 20 条事件
  showHubLinks: true,       // 显示 Hub 链路
  showSubscriptions: true,  // 显示订阅关系
});

// 或者查看特定通道的事件
eventLogger.printDebugInfo({
  channel: 'notes:element:click',
  recentLogs: 10,
});
```

### 3. 在浏览器控制台中使用

```javascript
// 启用调试
window.enableEventDebug();

// 查看日志
window.eventLogger.printDebugInfo();

// 查看最近的 50 条事件
window.eventLogger.getRecentLogs(50);

// 查看特定通道的事件
window.eventLogger.getLogsByChannel('notes:element:click');

// 查看 Hub 链路
window.eventLogger.visualizeHubLinks();

// 查看订阅关系
window.eventLogger.visualizeSubscriptions();
```

## 核心功能

### 事件日志记录

事件日志记录器会自动记录：
- 事件通道名称
- 事件 payload（可选）
- 事件元信息（时间戳、来源、路径、标签等）
- 处理器执行信息
- 执行耗时
- 是否被停止传播

```typescript
// 获取所有日志
const logs = eventLogger.getLogs();

// 获取指定通道的日志
const clickLogs = eventLogger.getLogsByChannel('notes:element:click');

// 获取最近的日志
const recentLogs = eventLogger.getRecentLogs(50);

// 导出日志为 JSON
const json = eventLogger.exportLogs();
console.log(json);
```

### 路径可视化

路径可视化功能可以清晰地展示事件在多个 Hub 和通道之间的传递路径。

```typescript
// 可视化单个事件的路径
const log = eventLogger.getRecentLogs(1)[0];
const pathVisualization = eventLogger.visualizePath(log);
console.log(pathVisualization);
// 输出: [hub_1] notes:element:click (path: node_1 → hub_link_1 → node_2)
```

### Hub 链路追踪

追踪多个 Hub 之间的连接关系，便于理解复杂的事件传递链路。

```typescript
// 获取所有 Hub 链路
const links = eventLogger.getHubLinks();

// 可视化 Hub 链路
const visualization = eventLogger.visualizeHubLinks();
console.log(visualization);
// 输出:
// Hub Links:
//   hub_1 → hub_2
//     notes:element:click → notes:sidebar:update [hub_link_1]
//   hub_2 ⇄ hub_3
//     notes:sidebar:update → notes:data:sync [hub_link_2]
```

### 订阅关系查看

查看所有订阅信息，包括订阅者、通道、优先级等。

```typescript
// 获取所有订阅
const subscriptions = eventLogger.getSubscriptions();

// 获取指定通道的订阅
const channelSubs = eventLogger.getSubscriptionsByChannel('notes:element:click');

// 可视化订阅关系
const visualization = eventLogger.visualizeSubscriptions();
console.log(visualization);
// 输出:
// Subscriptions:
//   notes:element:click:
//     - notes:element:click#123 (owner:ComponentA, tags:[ui], priority:10)
//     - notes:element:click#124 (owner:ComponentB, tags:[debug])
```

## 高级用法

### 创建调试 Hub

为特定的 Hub 创建调试包装器，而不是全局启用。

```typescript
import { EventHub, createDebugHub } from '@/Event';

const myHub = new EventHub();
const debugHub = createDebugHub(myHub, {
  logPayload: true,
  logMeta: true,
  autoLog: true,
});

// 使用 debugHub 代替 myHub
debugHub.emit('my:channel', { data: 'test' });

// 访问日志记录器
debugHub.logger.printDebugInfo();
```

### 过滤和搜索日志

```typescript
// 按时间范围过滤
const recentLogs = eventLogger.getRecentLogs(100);
const lastHour = recentLogs.filter(
  log => Date.now() - log.timestamp < 3600000
);

// 按 Hub 过滤
const hub = EventHub.global();
const hubLogs = eventLogger.getLogsByHub(hub);

// 按标签过滤
const taggedLogs = eventLogger.getLogs().filter(
  log => log.meta.tags?.includes('debug')
);
```

### 性能分析

```typescript
// 分析事件处理耗时
const logs = eventLogger.getLogs();
const slowEvents = logs.filter(log => log.duration > 100); // 超过 100ms 的事件

// 统计每个通道的平均耗时
const channelStats = new Map<string, { count: number; totalDuration: number }>();
logs.forEach(log => {
  const stats = channelStats.get(log.channel) || { count: 0, totalDuration: 0 };
  stats.count++;
  stats.totalDuration += log.duration;
  channelStats.set(log.channel, stats);
});

channelStats.forEach((stats, channel) => {
  console.log(`${channel}: ${(stats.totalDuration / stats.count).toFixed(2)}ms avg`);
});
```

### 调试多 Hub 链路

```typescript
// 追踪事件在多个 Hub 之间的传递
const logs = eventLogger.getLogs();
const pathLogs = logs.filter(log => log.meta.path && log.meta.path.length > 0);

pathLogs.forEach(log => {
  console.log(`Event ${log.channel} passed through:`, log.meta.path);
});

// 查找循环路径
const links = eventLogger.getHubLinks();
const bidirectionalLinks = links.filter(link => link.direction === 'bidirectional');
console.log('Bidirectional links (potential loops):', bidirectionalLinks);
```

## 控制选项

### 启用/禁用日志记录

```typescript
// 禁用日志记录（保留已记录的日志）
eventLogger.setEnabled(false);

// 重新启用
eventLogger.setEnabled(true);
```

### 限制日志数量

```typescript
// 设置最大日志数量（默认 1000）
eventLogger.setMaxLogs(5000);

// 清空所有日志
eventLogger.clearLogs();

// 清空所有记录（包括链路和订阅）
eventLogger.clearAll();
```

### 控制日志内容

```typescript
// 创建不记录 payload 的调试 Hub（节省内存）
const debugHub = createDebugHub(hub, {
  logPayload: false,  // 不记录 payload
  logMeta: true,      // 仍然记录元信息
});
```

## 实际应用场景

### 场景 1：调试事件未触发

```typescript
// 1. 启用调试
enableGlobalHubDebug();

// 2. 查看订阅关系，确认是否有订阅者
eventLogger.printDebugInfo({ showSubscriptions: true });

// 3. 查看最近的事件，确认事件是否被发送
eventLogger.printDebugInfo({ recentLogs: 20 });

// 4. 检查特定通道
const subs = eventLogger.getSubscriptionsByChannel('notes:element:click');
console.log('Subscriptions:', subs);
```

### 场景 2：追踪事件传递路径

```typescript
// 1. 发送一个测试事件
hub.emit('test:event', { test: true }, { tags: ['debug'] });

// 2. 查看事件路径
const logs = eventLogger.getLogsByChannel('test:event');
logs.forEach(log => {
  console.log('Path:', eventLogger.visualizePath(log));
});
```

### 场景 3：性能优化

```typescript
// 1. 记录一段时间的事件
enableGlobalHubDebug();

// 2. 分析耗时
const logs = eventLogger.getLogs();
const slowChannels = new Map<string, number[]>();

logs.forEach(log => {
  if (!slowChannels.has(log.channel)) {
    slowChannels.set(log.channel, []);
  }
  slowChannels.get(log.channel)!.push(log.duration);
});

// 3. 找出最慢的通道
slowChannels.forEach((durations, channel) => {
  const avg = durations.reduce((a, b) => a + b, 0) / durations.length;
  const max = Math.max(...durations);
  console.log(`${channel}: avg ${avg.toFixed(2)}ms, max ${max}ms`);
});
```

### 场景 4：调试多 Hub 通信

```typescript
// 1. 启用调试
enableGlobalHubDebug();

// 2. 建立 Hub 链路
hubA.linkHub(hubB, 'channelA', 'channelB');

// 3. 查看链路关系
eventLogger.printDebugInfo({ showHubLinks: true });

// 4. 发送事件并追踪
hubA.emit('channelA', { data: 'test' });

// 5. 查看事件在两个 Hub 中的传递
const logsA = eventLogger.getLogsByHub(hubA);
const logsB = eventLogger.getLogsByHub(hubB);
console.log('Hub A events:', logsA);
console.log('Hub B events:', logsB);
```

## 最佳实践

1. **开发环境启用，生产环境禁用**
   ```typescript
   if (import.meta.env.DEV) {
     enableGlobalHubDebug();
   }
   ```

2. **定期清理日志**
   ```typescript
   // 定期清理旧日志
   setInterval(() => {
     if (eventLogger.getLogs().length > 1000) {
       eventLogger.clearLogs();
     }
   }, 60000);
   ```

3. **使用标签过滤**
   ```typescript
   // 发送事件时添加标签
   hub.emit('channel', payload, { tags: ['debug', 'user-action'] });
   
   // 查看特定标签的事件
   const debugLogs = eventLogger.getLogs().filter(
     log => log.meta.tags?.includes('debug')
   );
   ```

4. **导出日志用于分析**
   ```typescript
   // 在出现问题时导出日志
   const logs = eventLogger.exportLogs();
   // 保存到文件或发送到服务器
   ```

## 注意事项

1. **性能影响**：启用调试会增加一定的性能开销，建议仅在开发环境或调试时启用。

2. **内存占用**：日志会占用内存，注意设置合理的 `maxLogs` 值。

3. **敏感信息**：如果事件 payload 包含敏感信息，设置 `logPayload: false`。

4. **异步事件**：事件系统是异步的，日志记录也是异步的，注意时序问题。

## API 参考

详细 API 文档请参考 `modulenote/src/Event/debug.ts` 文件中的类型定义和注释。

