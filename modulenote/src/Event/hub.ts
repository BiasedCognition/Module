/**
 * 允许处理器返回同步或异步结果，无需在调用处区分。
 */
type MaybePromise<T> = T | Promise<T>;

/**
 * 事件附带的元信息，用于追踪来源、标签等上下文。
 */
export interface EventMeta {
  channel: string;
  timestamp: number;
  source?: unknown;
  tags?: string[];
  path?: string[];
  [key: string]: unknown;
}

/**
 * 事件传递时的上下文对象，提供 payload、元信息及控制方法。
 */
export interface EventContext<TPayload = unknown> {
  payload: TPayload;
  meta: EventMeta;
  stopPropagation(): void;
  preventDefault(): void;
  readonly stopped: boolean;
  readonly defaultPrevented: boolean;
}

/**
 * 事件处理器签名。
 */
export type EventHandler<TPayload = unknown> = (
  context: EventContext<TPayload>
) => MaybePromise<void>;

/**
 * 订阅选项，支持优先级、一次性执行、过滤等能力。
 */
export interface SubscriptionOptions<TPayload = unknown> {
  priority?: number;
  once?: boolean;
  filter?: (context: EventContext<TPayload>) => boolean;
  owner?: unknown;
  tags?: string[];
}

/**
 * Hub 内部保存的订阅记录，统一为 unknown 以便跨通道复用。
 */
interface InternalSubscription {
  handler: EventHandler<unknown>;
  priority?: number;
  once?: boolean;
  filter?: (context: EventContext<unknown>) => boolean;
  owner?: unknown;
  tags?: string[];
  id: string;
}

/**
 * 通道桥接配置，允许将一个通道的事件转换后转发到另一个通道。
 */
export interface BridgeOptions<TInput = unknown, TOutput = unknown> {
  transform?: (
    context: EventContext<TInput>
  ) => MaybePromise<EventContext<TOutput> | null | void | TOutput>;
  passthroughTags?: boolean;
  forwardMeta?: boolean;
  owner?: unknown;
}

let subscriptionSeed = 0;

/**
 * 事件中心：负责管理通道、订阅以及事件分发。
 */
export class EventHub {
  private readonly channels = new Map<string, InternalSubscription[]>();
  private readonly ownerIndex = new WeakMap<object, Set<string>>();

  static #globalHub: EventHub | null = null;

  /**
   * 获取全局单例 Hub，方便跨模块通信。
   */
  static global(): EventHub {
    if (!EventHub.#globalHub) {
      EventHub.#globalHub = new EventHub();
    }
    return EventHub.#globalHub;
  }

  /**
   * 订阅指定通道事件，返回取消订阅的函数。
   */
  subscribe<TPayload = unknown>(
    channel: string,
    handler: EventHandler<TPayload>,
    options: SubscriptionOptions<TPayload> = {}
  ): () => void {
    const registry = this.channels.get(channel) ?? [];
    const subscription: InternalSubscription = {
      handler: handler as EventHandler<unknown>,
      priority: options.priority ?? 0,
      once: options.once ?? false,
      filter: options.filter
        ? ((context) =>
            (options.filter as (ctx: EventContext<TPayload>) => boolean)(
              context as EventContext<TPayload>
            ))
        : undefined,
      owner: options.owner,
      tags: options.tags,
      id: `${channel}#${++subscriptionSeed}`
    };

    registry.push(subscription);
    registry.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
    this.channels.set(channel, registry);

    if (
      options.owner &&
      typeof options.owner === 'object' &&
      options.owner !== null
    ) {
      const key = options.owner as object;
      if (!this.ownerIndex.has(key)) {
        this.ownerIndex.set(key, new Set());
      }
      this.ownerIndex.get(key)!.add(subscription.id);
    }

    return () => this.unsubscribeById(channel, subscription.id);
  }

  /**
   * 一次性订阅，触发一次后自动移除。
   */
  once<TPayload = unknown>(
    channel: string,
    handler: EventHandler<TPayload>,
    options: SubscriptionOptions<TPayload> = {}
  ): () => void {
    return this.subscribe(channel, handler, { ...options, once: true });
  }

  /**
   * 向通道广播事件，按优先级依次触发订阅者。
   */
  async emit<TPayload = unknown>(
    channel: string,
    payload: TPayload,
    meta: Partial<EventMeta> = {}
  ): Promise<void> {
    const registry = [...(this.channels.get(channel) ?? [])];
    if (!registry.length) return;

    const contextMeta: EventMeta = {
      channel,
      timestamp: meta.timestamp ?? Date.now(),
      source: meta.source,
      tags: meta.tags,
      path: meta.path ?? [],
      ...meta
    };

    let stopped = false;
    let defaultPrevented = false;

    const stopPropagation = () => {
      stopped = true;
    };

    const preventDefault = () => {
      defaultPrevented = true;
    };

    const context: EventContext<TPayload> = {
      payload,
      meta: contextMeta,
      stopPropagation,
      preventDefault,
      get stopped() {
        return stopped;
      },
      get defaultPrevented() {
        return defaultPrevented;
      }
    };

    for (const subscription of registry) {
      if (stopped) break;

      if (subscription.filter && !subscription.filter(context)) {
        continue;
      }

      await subscription.handler(context);

      if (subscription.once) {
        this.unsubscribeById(channel, subscription.id);
      }
    }
  }

  /**
   * 建立通道桥接，可选 transform 对 payload 进行转换。
   */
  link<TInput = unknown, TOutput = unknown>(
    fromChannel: string,
    toChannel: string,
    options: BridgeOptions<TInput, TOutput> = {}
  ): () => void {
    const dispose = this.subscribe<TInput>(
      fromChannel,
      async (context) => {
        type BridgeResult = EventContext<TOutput> | TOutput | null | void;

        let resolved: BridgeResult;

        if (options.transform) {
          const result = options.transform(
            context as EventContext<TInput>
          );
          resolved =
            result instanceof Promise ? await result : result;
          if (resolved === null || resolved === undefined) {
            return;
          }
        } else {
          resolved = context.payload as unknown as TOutput;
        }

        if (typeof resolved === 'object' && resolved !== null) {
          if ('payload' in resolved && 'meta' in resolved) {
            const castContext = resolved as EventContext<TOutput>;
            await this.emit(
              toChannel,
              castContext.payload,
              options.forwardMeta
                ? { ...context.meta, ...castContext.meta }
                : castContext.meta
            );
            return;
          }
        }

        await this.emit(toChannel, resolved as TOutput, {
          ...(options.forwardMeta ? context.meta : {}),
          tags: options.passthroughTags ? context.meta.tags : undefined,
          source: options.forwardMeta ? context.meta.source : context.meta.source ?? context
        });
      },
      {
        owner: options.owner,
        priority: options.transform ? 0 : -10
      }
    );

    return dispose;
  }

  /**
   * 按 owner 清理订阅，常用于对象或组件销毁时。
   */
  clearOwner(owner: unknown): void {
    if (!owner || typeof owner !== 'object') return;
    const key = owner as object;
    const subscriptions = this.ownerIndex.get(key);
    if (!subscriptions) return;

    for (const channel of this.channels.keys()) {
      const registry = this.channels.get(channel);
      if (!registry) continue;

      const remaining = registry.filter((sub) => {
        const shouldKeep = sub.owner !== owner;
        if (!shouldKeep) {
          subscriptions.delete(sub.id);
        }
        return shouldKeep;
      });

      if (remaining.length) {
        this.channels.set(channel, remaining);
      } else {
        this.channels.delete(channel);
      }
    }

    if (subscriptions.size === 0) {
      this.ownerIndex.delete(key);
    }
  }

  /**
   * 创建一个独立的子 Hub，可用于局部作用域通信。
   */
  createChild(): EventHub {
    return new EventHub();
  }

  /**
   * 根据订阅 ID 从通道中移除订阅。
   */
  private unsubscribeById(channel: string, id: string): void {
    const registry = this.channels.get(channel);
    if (!registry) return;

    const index = registry.findIndex((subscription) => subscription.id === id);
    if (index === -1) return;

    const [removed] = registry.splice(index, 1);
    if (removed?.owner && typeof removed.owner === 'object') {
      const key = removed.owner as object;
      const set = this.ownerIndex.get(key);
      set?.delete(id);
      if (set && set.size === 0) {
        this.ownerIndex.delete(key);
      }
    }

    if (!registry.length) {
      this.channels.delete(channel);
    }
  }
}

/**
 * EventNode 初始化配置。
 */
export interface EventNodeOptions {
  id?: string;
  hub?: EventHub;
  tags?: string[];
}

let nodeSeed = 0;

/**
 * 面向对象/组件的轻量包装器，负责封装 owner 及常用操作。
 */
export class EventNode {
  readonly hub: EventHub;
  readonly id: string;
  readonly tags?: string[];

  constructor(options: EventNodeOptions = {}) {
    this.hub = options.hub ?? EventHub.global();
    this.tags = options.tags;
    this.id = options.id ?? `node_${++nodeSeed}`;
  }

  /**
   * 从当前节点发出事件，自动附带 source/tags 信息。
   */
  emit<TPayload = unknown>(
    channel: string,
    payload: TPayload,
    meta: Partial<EventMeta> = {}
  ): Promise<void> {
    return this.hub.emit(channel, payload, {
      source: meta.source ?? this,
      tags: meta.tags ?? this.tags,
      ...meta
    });
  }

  /**
   * 以当前节点为 owner 订阅通道。
   */
  on<TPayload = unknown>(
    channel: string,
    handler: EventHandler<TPayload>,
    options: SubscriptionOptions<TPayload> = {}
  ): () => void {
    return this.hub.subscribe(channel, handler, {
      owner: options.owner ?? this,
      ...options
    });
  }

  /**
   * 一次性订阅，触发一次后自动清理。
   */
  once<TPayload = unknown>(
    channel: string,
    handler: EventHandler<TPayload>,
    options: SubscriptionOptions<TPayload> = {}
  ): () => void {
    return this.hub.once(channel, handler, {
      owner: options.owner ?? this,
      ...options
    });
  }

  /**
   * 通过当前节点建立桥接，owner 默认绑定到节点自身。
   */
  bridge<TInput = unknown, TOutput = unknown>(
    fromChannel: string,
    toChannel: string,
    options: BridgeOptions<TInput, TOutput> = {}
  ): () => void {
    return this.hub.link(fromChannel, toChannel, {
      owner: options.owner ?? this,
      ...options
    });
  }

  /**
   * 将当前节点与另一个节点在指定通道上互联。
   */
  connect(node: EventNode, channels: string[]): () => void {
    const disposers = channels.map((channel) =>
      this.bridge(channel, channel, {
        transform: (context) => ({
          ...context,
          meta: {
            ...context.meta,
            path: [...(context.meta.path ?? []), this.id]
          }
        }),
        owner: node
      })
    );

    return () => {
      disposers.forEach((dispose) => dispose());
    };
  }

  /**
   * 清理该节点下的所有订阅。
   */
  dispose(): void {
    this.hub.clearOwner(this);
  }
}

/**
 * 工具方法：快速创建 EventNode。
 */
export function createEventNode(options?: EventNodeOptions): EventNode {
  return new EventNode(options);
}

