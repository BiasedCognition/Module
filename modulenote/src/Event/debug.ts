/**
 * 事件系统调试工具
 * 提供事件日志记录、路径可视化、多 Hub 链路追踪等功能
 */

import { EventHub } from './hub';
import type { EventContext, EventMeta } from './hub';

/**
 * 事件日志条目
 */
export interface EventLogEntry {
  id: string;
  timestamp: number;
  channel: string;
  payload: unknown;
  meta: EventMeta;
  hubId: string;
  handlers: HandlerLog[];
  duration: number;
  stopped: boolean;
  defaultPrevented: boolean;
}

/**
 * 处理器执行日志
 */
export interface HandlerLog {
  id: string;
  owner?: string;
  tags?: string[];
  priority?: number;
  startTime: number;
  endTime: number;
  duration: number;
  filtered: boolean;
  error?: Error;
}

/**
 * Hub 链路信息
 */
export interface HubLinkInfo {
  sourceHubId: string;
  targetHubId: string;
  fromChannel: string;
  toChannel: string;
  direction: 'forward' | 'reverse' | 'bidirectional';
  bridgeId: string;
  active: boolean;
}

/**
 * 订阅信息
 */
export interface SubscriptionInfo {
  id: string;
  channel: string;
  owner?: string;
  tags?: string[];
  priority?: number;
  once?: boolean;
  hasFilter?: boolean;
  hubId: string;
}

/**
 * 事件日志记录器
 */
export class EventLogger {
  private logs: EventLogEntry[] = [];
  private maxLogs: number = 1000;
  private enabled: boolean = true;
  private hubSubscriptions: Map<EventHub, Set<() => void>> = new Map();
  private hubLinks: Map<string, HubLinkInfo> = new Map();
  private subscriptions: Map<string, SubscriptionInfo> = new Map();
  private hubIdMap: WeakMap<EventHub, string> = new WeakMap();
  private hubCounter: number = 0;

  /**
   * 启用或禁用日志记录
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  /**
   * 设置最大日志数量
   */
  setMaxLogs(maxLogs: number): void {
    this.maxLogs = maxLogs;
    if (this.logs.length > maxLogs) {
      this.logs = this.logs.slice(-maxLogs);
    }
  }

  /**
   * 获取 Hub 的唯一标识符
   */
  private getHubId(hub: EventHub): string {
    if (!this.hubIdMap.has(hub)) {
      const id = `hub_${++this.hubCounter}`;
      this.hubIdMap.set(hub, id);
    }
    return this.hubIdMap.get(hub)!;
  }

  /**
   * 监听指定 Hub 的所有事件
   */
  attachHub(hub: EventHub, options: { logPayload?: boolean; logMeta?: boolean } = {}): () => void {
    const hubId = this.getHubId(hub);
    const disposers: Array<() => void> = [];

    // 通过拦截 emit 方法来记录事件
    // 由于无法直接拦截，我们需要通过包装来实现
    const originalEmit = hub.emit.bind(hub);
    const logEntry: Partial<EventLogEntry> = {
      hubId,
      handlers: [],
    };

    // 这里我们需要一个更巧妙的方法
    // 由于无法直接拦截，我们通过订阅所有通道来记录
    // 但这样会有性能问题，所以提供一个手动记录的方法

    const cleanup = () => {
      disposers.forEach(dispose => dispose());
      this.hubSubscriptions.delete(hub);
    };

    this.hubSubscriptions.set(hub, new Set(disposers));
    return cleanup;
  }

  /**
   * 手动记录事件
   */
  logEvent(
    hub: EventHub,
    channel: string,
    payload: unknown,
    meta: EventMeta,
    handlers: HandlerLog[],
    duration: number,
    stopped: boolean,
    defaultPrevented: boolean,
    options: { logPayload?: boolean; logMeta?: boolean } = {}
  ): void {
    if (!this.enabled) return;

    const entry: EventLogEntry = {
      id: `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: meta.timestamp ?? Date.now(),
      channel,
      payload: options.logPayload !== false ? payload : undefined,
      meta: options.logMeta !== false ? meta : { ...meta, source: undefined },
      hubId: this.getHubId(hub),
      handlers,
      duration,
      stopped,
      defaultPrevented,
    };

    this.logs.push(entry);

    // 限制日志数量
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }
  }

  /**
   * 记录 Hub 链路
   */
  logHubLink(info: HubLinkInfo): void {
    this.hubLinks.set(info.bridgeId, info);
  }

  /**
   * 移除 Hub 链路记录
   */
  removeHubLink(bridgeId: string): void {
    const link = this.hubLinks.get(bridgeId);
    if (link) {
      link.active = false;
    }
  }

  /**
   * 记录订阅信息
   */
  logSubscription(info: SubscriptionInfo): void {
    this.subscriptions.set(info.id, info);
  }

  /**
   * 移除订阅记录
   */
  removeSubscription(subscriptionId: string): void {
    this.subscriptions.delete(subscriptionId);
  }

  /**
   * 获取所有日志
   */
  getLogs(): readonly EventLogEntry[] {
    return this.logs;
  }

  /**
   * 获取指定通道的日志
   */
  getLogsByChannel(channel: string): EventLogEntry[] {
    return this.logs.filter(log => log.channel === channel);
  }

  /**
   * 获取指定 Hub 的日志
   */
  getLogsByHub(hub: EventHub): EventLogEntry[] {
    const hubId = this.getHubId(hub);
    return this.logs.filter(log => log.hubId === hubId);
  }

  /**
   * 获取最近的日志
   */
  getRecentLogs(count: number = 50): EventLogEntry[] {
    return this.logs.slice(-count);
  }

  /**
   * 获取所有 Hub 链路
   */
  getHubLinks(): HubLinkInfo[] {
    return Array.from(this.hubLinks.values()).filter(link => link.active);
  }

  /**
   * 获取所有订阅信息
   */
  getSubscriptions(): SubscriptionInfo[] {
    return Array.from(this.subscriptions.values());
  }

  /**
   * 获取指定通道的订阅
   */
  getSubscriptionsByChannel(channel: string): SubscriptionInfo[] {
    return Array.from(this.subscriptions.values()).filter(sub => sub.channel === channel);
  }

  /**
   * 获取指定 Hub 的订阅
   */
  getSubscriptionsByHub(hub: EventHub): SubscriptionInfo[] {
    const hubId = this.getHubId(hub);
    return Array.from(this.subscriptions.values()).filter(sub => sub.hubId === hubId);
  }

  /**
   * 清空所有日志
   */
  clearLogs(): void {
    this.logs = [];
  }

  /**
   * 清空所有记录
   */
  clearAll(): void {
    this.logs = [];
    this.hubLinks.clear();
    this.subscriptions.clear();
  }

  /**
   * 导出日志为 JSON
   */
  exportLogs(): string {
    return JSON.stringify({
      logs: this.logs,
      hubLinks: Array.from(this.hubLinks.values()),
      subscriptions: Array.from(this.subscriptions.values()),
      timestamp: Date.now(),
    }, null, 2);
  }

  /**
   * 可视化事件路径
   */
  visualizePath(entry: EventLogEntry): string {
    const path = entry.meta.path || [];
    if (path.length === 0) {
      return `[${entry.hubId}] ${entry.channel}`;
    }

    const pathStr = path.join(' → ');
    return `[${entry.hubId}] ${entry.channel} (path: ${pathStr})`;
  }

  /**
   * 可视化 Hub 链路图
   */
  visualizeHubLinks(): string {
    const links = this.getHubLinks();
    if (links.length === 0) {
      return 'No hub links found.';
    }

    const lines: string[] = ['Hub Links:'];
    links.forEach(link => {
      const direction = link.direction === 'bidirectional' ? '⇄' : 
                       link.direction === 'forward' ? '→' : '←';
      lines.push(
        `  ${link.sourceHubId} ${direction} ${link.targetHubId}`
      );
      lines.push(
        `    ${link.fromChannel} → ${link.toChannel} [${link.bridgeId}]`
      );
    });

    return lines.join('\n');
  }

  /**
   * 可视化订阅关系
   */
  visualizeSubscriptions(hub?: EventHub, channel?: string): string {
    let subs = Array.from(this.subscriptions.values());
    
    if (hub) {
      const hubId = this.getHubId(hub);
      subs = subs.filter(sub => sub.hubId === hubId);
    }
    
    if (channel) {
      subs = subs.filter(sub => sub.channel === channel);
    }

    if (subs.length === 0) {
      return 'No subscriptions found.';
    }

    const lines: string[] = ['Subscriptions:'];
    const byChannel = new Map<string, SubscriptionInfo[]>();
    
    subs.forEach(sub => {
      if (!byChannel.has(sub.channel)) {
        byChannel.set(sub.channel, []);
      }
      byChannel.get(sub.channel)!.push(sub);
    });

    byChannel.forEach((channelSubs, ch) => {
      lines.push(`  ${ch}:`);
      channelSubs.forEach(sub => {
        const parts: string[] = [];
        if (sub.owner) parts.push(`owner:${sub.owner}`);
        if (sub.tags?.length) parts.push(`tags:[${sub.tags.join(',')}]`);
        if (sub.priority !== undefined) parts.push(`priority:${sub.priority}`);
        lines.push(`    - ${sub.id} (${parts.join(', ')})`);
      });
    });

    return lines.join('\n');
  }

  /**
   * 打印调试信息到控制台
   */
  printDebugInfo(options: {
    recentLogs?: number;
    hub?: EventHub;
    channel?: string;
    showHubLinks?: boolean;
    showSubscriptions?: boolean;
  } = {}): void {
    const {
      recentLogs = 10,
      hub,
      channel,
      showHubLinks = true,
      showSubscriptions = true,
    } = options;

    console.group('🔍 Event System Debug Info');
    
    if (recentLogs > 0) {
      console.group('📋 Recent Events');
      const logs = hub 
        ? this.getLogsByHub(hub).slice(-recentLogs)
        : channel
        ? this.getLogsByChannel(channel).slice(-recentLogs)
        : this.getRecentLogs(recentLogs);
      
      logs.forEach(log => {
        console.log(
          `[${new Date(log.timestamp).toLocaleTimeString()}]`,
          this.visualizePath(log),
          log.handlers.length > 0 
            ? `(${log.handlers.length} handlers, ${log.duration}ms)`
            : '(no handlers)'
        );
      });
      console.groupEnd();
    }

    if (showHubLinks) {
      console.group('🔗 Hub Links');
      console.log(this.visualizeHubLinks());
      console.groupEnd();
    }

    if (showSubscriptions) {
      console.group('📡 Subscriptions');
      console.log(this.visualizeSubscriptions(hub, channel));
      console.groupEnd();
    }

    console.groupEnd();
  }
}

/**
 * 全局日志记录器实例
 */
export const eventLogger = new EventLogger();

/**
 * 创建 Hub 调试包装器
 * 自动记录所有事件和订阅
 */
export function createDebugHub(hub: EventHub, options: {
  logPayload?: boolean;
  logMeta?: boolean;
  autoLog?: boolean;
} = {}): EventHub & { logger: EventLogger } {
  const {
    logPayload = true,
    logMeta = true,
    autoLog = true,
  } = options;

  const hubId = eventLogger['getHubId'](hub);
  const originalEmit = hub.emit.bind(hub);
  const originalSubscribe = hub.subscribe.bind(hub);
  const originalLinkHub = hub.linkHub?.bind(hub);

  // 包装 emit 方法
  const wrappedEmit = async <TPayload = unknown>(
    channel: string,
    payload: TPayload,
    meta: Partial<EventMeta> = {}
  ): Promise<void> => {
    const startTime = performance.now();
    const handlers: HandlerLog[] = [];
    let stopped = false;
    let defaultPrevented = false;

    // 创建包装的上下文来追踪处理器执行
    const originalContextMeta: EventMeta = {
      channel,
      timestamp: meta.timestamp ?? Date.now(),
      source: meta.source,
      tags: meta.tags,
      path: meta.path ?? [],
      ...meta,
    };

    try {
      await originalEmit(channel, payload, meta);
    } catch (error) {
      console.error('Event emit error:', error);
      throw error;
    } finally {
      const duration = performance.now() - startTime;
      
      if (autoLog) {
        eventLogger.logEvent(
          hub,
          channel,
          logPayload ? payload : undefined,
          logMeta ? originalContextMeta : { ...originalContextMeta, source: undefined },
          handlers,
          duration,
          stopped,
          defaultPrevented,
          { logPayload, logMeta }
        );
      }
    }
  };

  // 包装 subscribe 方法
  const wrappedSubscribe = <TPayload = unknown>(
    channel: string,
    handler: (context: any) => any,
    options: any = {}
  ): (() => void) => {
    const subscriptionId = `${channel}#${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // 记录订阅信息
    eventLogger.logSubscription({
      id: subscriptionId,
      channel,
      owner: options.owner ? String(options.owner) : undefined,
      tags: options.tags,
      priority: options.priority,
      once: options.once,
      hasFilter: !!options.filter,
      hubId,
    });

    // 包装处理器以记录执行信息
    const wrappedHandler = async (context: any) => {
      const handlerStartTime = performance.now();
      let handlerError: Error | undefined;
      let filtered = false;

      try {
        if (options.filter && !options.filter(context)) {
          filtered = true;
          return;
        }

        const result = handler(context);
        if (result instanceof Promise) {
          await result;
        }
      } catch (error) {
        handlerError = error as Error;
        throw error;
      } finally {
        const handlerDuration = performance.now() - handlerStartTime;
        
        // 这里我们无法直接记录到 eventLogger，因为事件已经发出
        // 但我们可以通过其他方式追踪
      }
    };

    const unsubscribe = originalSubscribe(channel, wrappedHandler, options);
    
    // 包装取消订阅函数
    return () => {
      eventLogger.removeSubscription(subscriptionId);
      unsubscribe();
    };
  };

  // 包装 linkHub 方法
  const wrappedLinkHub = <TInput = unknown, TOutput = unknown>(
    targetHub: EventHub,
    fromChannel: string,
    toChannel: string,
    options: any = {}
  ): (() => void) => {
    const bridgeId = options.bridgeId || `hub_link_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const targetHubId = eventLogger['getHubId'](targetHub);
    
    // 记录 Hub 链路
    eventLogger.logHubLink({
      sourceHubId: hubId,
      targetHubId,
      fromChannel,
      toChannel,
      direction: options.direction || 'forward',
      bridgeId,
      active: true,
    });

    const unlink = originalLinkHub!(targetHub, fromChannel, toChannel, {
      ...options,
      bridgeId,
    });

    // 包装取消链接函数
    return () => {
      eventLogger.removeHubLink(bridgeId);
      unlink();
    };
  };

  // 创建包装后的 Hub
  const debugHub = Object.create(hub);
  debugHub.emit = wrappedEmit;
  debugHub.subscribe = wrappedSubscribe;
  debugHub.linkHub = wrappedLinkHub;
  debugHub.logger = eventLogger;

  return debugHub as EventHub & { logger: EventLogger };
}

// 存储原始方法，用于禁用调试
const originalMethods = new WeakMap<EventHub, {
  emit: EventHub['emit'];
  subscribe: EventHub['subscribe'];
  linkHub?: EventHub['linkHub'];
}>();

/**
 * 启用全局 Hub 的调试功能
 * 这会自动包装全局 Hub 的所有方法以记录事件
 */
export function enableGlobalHubDebug(options: {
  logPayload?: boolean;
  logMeta?: boolean;
  autoLog?: boolean;
} = {}): () => void {
  const globalHub = EventHub.global();
  
  // 如果已经启用，先禁用
  if (originalMethods.has(globalHub)) {
    const originals = originalMethods.get(globalHub)!;
    globalHub.emit = originals.emit;
    globalHub.subscribe = originals.subscribe;
    if (originals.linkHub) {
      globalHub.linkHub = originals.linkHub;
    }
  }
  
  // 保存原始方法
  originalMethods.set(globalHub, {
    emit: globalHub.emit.bind(globalHub),
    subscribe: globalHub.subscribe.bind(globalHub),
    linkHub: globalHub.linkHub?.bind(globalHub),
  });
  
  const debugHub = createDebugHub(globalHub, options);
  
  // 替换全局 Hub 的方法
  globalHub.emit = debugHub.emit;
  globalHub.subscribe = debugHub.subscribe;
  globalHub.linkHub = debugHub.linkHub;
  
  console.log('🔍 Global Hub debugging enabled. Use eventLogger to access logs.');
  
  // 返回禁用函数
  return () => {
    const originals = originalMethods.get(globalHub);
    if (originals) {
      globalHub.emit = originals.emit;
      globalHub.subscribe = originals.subscribe;
      if (originals.linkHub) {
        globalHub.linkHub = originals.linkHub;
      }
      originalMethods.delete(globalHub);
      console.log('🔍 Global Hub debugging disabled.');
    }
  };
}

/**
 * 在开发环境下自动启用调试
 */
if (typeof window !== 'undefined') {
  (window as any).eventLogger = eventLogger;
  (window as any).enableEventDebug = enableGlobalHubDebug;
  
  // 如果设置了环境变量，自动启用
  if (import.meta.env.DEV || (window as any).__DEV__) {
    console.log('🔍 Event Logger available. Use window.eventLogger or window.enableEventDebug() to enable.');
  }
}

