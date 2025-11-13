/**
 * 允许处理器返回同步或异步结果。
 * 事件系统的调用端始终接收 `MaybePromise`，因此在业务从同步实现演进为异步实现时，
 * 无须调整订阅流程即可兼容。
 */
type MaybePromise<T> = T | Promise<T>;

/**
 * 事件附带的元信息，用于追踪来源、标签等上下文。
 * 默认字段涵盖大多数调试需求，开发者也可以在此扩展自定义记录。
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
 * 事件传递的上下文对象。
 * 订阅者可通过它读取 payload / meta，也能利用 `stopPropagation`、`preventDefault`
 * 改变后续处理流程；同时可以查询 `stopped`、`defaultPrevented` 状态以决定后续逻辑。
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
 * 事件处理器签名。每个处理器都会收到事件上下文，可以同步执行，也可以返回 Promise。
 */
export type EventHandler<TPayload = unknown> = (
  context: EventContext<TPayload>
) => MaybePromise<void>;

/**
 * 订阅选项，支持调整执行顺序、生命周期以及额外筛选逻辑。
 * - `priority`：越大越先执行，默认值为 0。
 * - `once`：若为 true，处理器在首次触发后自动移除。
 * - `filter`：可选过滤器，仅当返回 true 时才执行处理器。
 * - `owner`：订阅归属对象，用于 `clearOwner` / `EventNode.dispose` 做批量清理。
 * - `tags`：为订阅打标签，可在调试中查看注册情况。
 */
export interface SubscriptionOptions<TPayload = unknown> {
  priority?: number;
  once?: boolean;
  filter?: (context: EventContext<TPayload>) => boolean;
  owner?: unknown;
  tags?: string[];
}

/**
 * Hub 内部保存的订阅记录。
 * handler/filter 使用 unknown 泛型，方便在不同通道类型间共享相同的数据结构。
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
 * 通道桥接配置，允许对事件做转换或过滤后再转发至目标通道。
 * - `transform`：接收原始上下文并返回新的上下文或 payload；返回 `null/undefined`
 *   表示终止转发，可用于动态筛选事件；返回 `EventContext` 时可覆盖 meta。
 * - `passthroughTags`：是否保留原上下文的 tags；默认不保留，避免不同通道互相污染。
 * - `forwardMeta`：是否继承原 meta；默认为 false，设置后会将上下文信息合并到目标事件。
 * - `owner`：为桥接操作指定 owner，方便统一释放。
 */
export interface BridgeOptions<TInput = unknown, TOutput = unknown> {
  transform?: (
    context: EventContext<TInput>
  ) => MaybePromise<EventContext<TOutput> | null | void | TOutput>;
  passthroughTags?: boolean;
  forwardMeta?: boolean;
  owner?: unknown;
}

export interface HubLinkOptions<TInput = unknown, TOutput = unknown>
  extends BridgeOptions<TInput, TOutput> {
  direction?: 'forward' | 'reverse' | 'bidirectional';
  reverseChannel?: string;
  reverseTransform?: (
    context: EventContext<TOutput>
  ) => MaybePromise<EventContext<TInput> | null | void | TInput>;
  reverseForwardMeta?: boolean;
  reversePassthroughTags?: boolean;
  guardLoop?: boolean;
  bridgeId?: string;
}

let subscriptionSeed = 0;
let hubLinkSeed = 0;

/**
 * 事件中心：负责管理通道、订阅以及事件分发。
 * 设计目标：
 *  - 解耦对象/组件之间的通信。
 *  - 支持 owner 维度的生命周期管理。
 *  - 为调试提供 meta/tags/path 等丰富信息。
 */
export class EventHub {
  private readonly channels = new Map<string, InternalSubscription[]>();
  private readonly ownerIndex = new WeakMap<object, Set<string>>();

  static #globalHub: EventHub | null = null;

  /**
   * 获取全局单例 Hub。
   * 在需要跨模块共享事件中心（例如应用级消息总线）时，可直接调用此方法。
   */
  static global(): EventHub {
    if (!EventHub.#globalHub) {
      EventHub.#globalHub = new EventHub();
    }
    return EventHub.#globalHub;
  }

  /**
   * 订阅指定通道事件，返回取消订阅的函数。
   * 返回的 dispose 函数等价于 `clearOwner` 中的局部删除，可按需调用。
   * `options` 支持设置优先级、一次性订阅、过滤器以及 owner。
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
   * 一次性订阅，事件触发一次后即自动移除，无需手动清理。
   */
  once<TPayload = unknown>(
    channel: string,
    handler: EventHandler<TPayload>,
    options: SubscriptionOptions<TPayload> = {}
  ): () => void {
    return this.subscribe(channel, handler, { ...options, once: true });
  }

  /**
   * 向通道广播事件：
   * - 订阅者按照 `priority` 从高到低执行，默认同级按注册顺序。
   * - 若某个订阅者调用 `stopPropagation`，剩余订阅者将不会收到本次事件。
   * - `meta` 参数可覆盖默认元信息，例如自定义时间或附加 path。
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
   * 建立通道桥接，可选 `transform` 对上下文或 payload 进行转换。
   * `transform` 支持返回：
   * - `EventContext<TOutput>`：直接沿用新的上下文（可携带自定义 meta）；
   * - `TOutput`：将结果作为目标通道的 payload；
   * - `null/undefined`：终止转发；
   * - `void`：等价于 `undefined`，同样终止转发。
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
   * 将当前 Hub 与目标 Hub 通过指定通道建立互联。
   * 默认单向转发（本 Hub -> 目标 Hub），可通过 `direction` 设置为双向。
   */
  linkHub<TInput = unknown, TOutput = unknown>(
    targetHub: EventHub,
    fromChannel: string,
    toChannel: string,
    options: HubLinkOptions<TInput, TOutput> = {}
  ): () => void {
    const direction = options.direction ?? 'forward';
    const guardLoop = options.guardLoop !== false;
    const bridgeId = options.bridgeId ?? `hub_link_${++hubLinkSeed}`;
    const disposers: Array<() => void> = [];

    const stripChannel = (meta: EventMeta): Partial<EventMeta> => {
      const { channel: _channel, ...rest } = meta;
      return { ...rest };
    };

    const appendPath = (path: string[] | undefined, id: string): string[] => {
      const next = path ? [...path] : [];
      next.push(id);
      return next;
    };

    const buildMeta = (
      sourceMeta: EventMeta,
      bridgeOpts: { forwardMeta?: boolean; passthroughTags?: boolean },
      id: string,
      enableGuard: boolean
    ): Partial<EventMeta> => {
      const base: Partial<EventMeta> = bridgeOpts.forwardMeta
        ? stripChannel(sourceMeta)
        : {};

      const path = enableGuard
        ? appendPath(sourceMeta.path, id)
        : bridgeOpts.forwardMeta
          ? sourceMeta.path
          : undefined;

      if (path && path.length) {
        base.path = path;
      }

      if (bridgeOpts.passthroughTags && sourceMeta.tags) {
        base.tags = sourceMeta.tags;
      }

      if (!base.source) {
        base.source = sourceMeta.source ?? { hubLink: id };
      }

      if (!bridgeOpts.forwardMeta) {
        base.timestamp = sourceMeta.timestamp;
      }

      return base;
    };

    const mergeContextMeta = (
      meta: EventMeta,
      id: string,
      enableGuard: boolean
    ): Partial<EventMeta> => {
      if (!enableGuard) return stripChannel(meta);
      return {
        ...stripChannel(meta),
        path: appendPath(meta.path, id)
      };
    };

    const resolveTransform = async <TIn, TOut>(
      ctx: EventContext<TIn>,
      transform?:
        | ((context: EventContext<TIn>) => MaybePromise<
            EventContext<TOut> | null | void | TOut
          >)
        | undefined
    ) => {
      if (!transform) {
        return { kind: 'payload' as const, payload: ctx.payload as unknown as TOut };
      }

      const result = transform(ctx);
      const resolved =
        result instanceof Promise ? await result : result;

      if (resolved === null || resolved === undefined) {
        return null;
      }

      if (
        typeof resolved === 'object' &&
        resolved !== null &&
        'payload' in resolved &&
        'meta' in resolved
      ) {
        return {
          kind: 'context' as const,
          context: resolved as EventContext<TOut>
        };
      }

      return { kind: 'payload' as const, payload: resolved as TOut };
    };

    if (direction === 'forward' || direction === 'bidirectional') {
      const dispose = this.subscribe<TInput>(
        fromChannel,
        async (context) => {
          if (guardLoop && context.meta.path?.includes(bridgeId)) {
            return;
          }

          const transformed = await resolveTransform<TInput, TOutput>(
            context,
            options.transform
          );

          if (!transformed) return;

          if (transformed.kind === 'context') {
            const meta = mergeContextMeta(
              transformed.context.meta,
              bridgeId,
              guardLoop
            );
            await targetHub.emit(
              toChannel,
              transformed.context.payload,
              meta
            );
            return;
          }

          const meta = buildMeta(
            context.meta,
            {
              forwardMeta: options.forwardMeta,
              passthroughTags: options.passthroughTags
            },
            bridgeId,
            guardLoop
          );

          await targetHub.emit(toChannel, transformed.payload, meta);
        },
        {
          owner: options.owner,
          priority: options.transform ? 0 : -10
        }
      );

      disposers.push(dispose);
    }

    if (direction === 'reverse' || direction === 'bidirectional') {
      const reverseChannel = options.reverseChannel ?? toChannel;
      const reverseForwardMeta =
        options.reverseForwardMeta ?? options.forwardMeta;
      const reversePassthroughTags =
        options.reversePassthroughTags ?? options.passthroughTags;

      const disposeReverse = targetHub.subscribe<TOutput>(
        reverseChannel,
        async (context) => {
          if (guardLoop && context.meta.path?.includes(bridgeId)) {
            return;
          }

          const transformed = await resolveTransform<TOutput, TInput>(
            context,
            options.reverseTransform
          );

          if (!transformed) return;

          if (transformed.kind === 'context') {
            const meta = mergeContextMeta(
              transformed.context.meta,
              bridgeId,
              guardLoop
            );
            await this.emit(
              fromChannel,
              transformed.context.payload,
              meta
            );
            return;
          }

          const meta = buildMeta(
            context.meta,
            {
              forwardMeta: reverseForwardMeta,
              passthroughTags: reversePassthroughTags
            },
            bridgeId,
            guardLoop
          );

          await this.emit(fromChannel, transformed.payload, meta);
        },
        {
          owner: options.owner,
          priority: options.reverseTransform ? 0 : -10
        }
      );

      disposers.push(disposeReverse);
    }

    return () => {
      disposers.forEach((dispose) => dispose());
    };
  }

  /**
   * 按 owner 清理订阅，常用于对象或组件销毁时批量释放资源。
   * 例如：`hub.clearOwner(componentInstance)`。
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
   * 创建一个独立的子 Hub，可用于局部作用域通信或单元测试。
   */
  createChild(): EventHub {
    return new EventHub();
  }

  /**
   * 根据订阅 ID 从通道中移除订阅。
   * 该方法仅供内部使用，用于实现 `unsubscribe` 与 `once` 的移除逻辑。
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
 * - `id`：指定节点 id，用于在日志或 meta.path 中标识；
 * - `hub`：可注入自定义 Hub，未指定时默认使用全局 Hub；
 * - `tags`：节点默认标签，发出事件时会自动附带。
 */
export interface EventNodeOptions {
  id?: string;
  hub?: EventHub;
  tags?: string[];
}

let nodeSeed = 0;

/**
 * 面向对象/组件的轻量包装器，负责封装 owner 及常用操作。
 * 与 `EventHub` 提供一致 API，但自动以自身为 owner，以便生命周期管理。
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
   * 可通过 meta 参数覆盖默认字段，例如自定义时间戳或额外 path。
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
   * 订阅通道，owner 默认为当前节点。
   * 若需要共享 owner，可在 options.owner 中自行指定。
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
   * 适合在局部范围内将内部事件映射为外部通道，例如：
   * - 节点内部使用 `internal:*` 事件，桥接到外部公开的 `textbox:*` 通道；
   * - 在桥接中追加 meta，从而保留节点标签或路径信息。
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
   * 使用节点背后的 Hub 与另一个 Hub 建立通道互联。
   */
  linkHub<TInput = unknown, TOutput = unknown>(
    targetHub: EventHub,
    fromChannel: string,
    toChannel: string,
    options: HubLinkOptions<TInput, TOutput> = {}
  ): () => void {
    return this.hub.linkHub(targetHub, fromChannel, toChannel, options);
  }

  /**
   * 将当前节点与另一个节点在指定通道上互联。
   * 会自动在 meta.path 末尾追加当前节点 id，方便追踪事件路径。
   * 返回值为断开连接的函数，内部会依次执行 bridge 返回的所有卸载函数。
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
   * 清理该节点下的所有订阅，相当于对该节点调用 `hub.clearOwner`。
   */
  dispose(): void {
    this.hub.clearOwner(this);
  }
}

/**
 * 工具方法：快速创建 EventNode，适合在临时逻辑或函数式场景中使用。
 */
export function createEventNode(options?: EventNodeOptions): EventNode {
  return new EventNode(options);
}

