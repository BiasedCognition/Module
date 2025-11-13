/**
 * Vue 组合式 API 适配层。
 * 提供将 `EventHub` / `EventNode` 与组件生命周期绑定的便捷方法，
 * 让事件总线的使用方式贴近 Vue 生态（setup + onUnmounted）。
 */
import { getCurrentInstance, onUnmounted } from 'vue';
import type { EventMeta } from './hub';
import { EventHub, EventNode } from './hub';
import type {
  EventNodeOptions,
  EventHandler,
  SubscriptionOptions,
  BridgeOptions
} from './hub';

/**
 * `useEventNode` 的配置项，扩展了 `EventNodeOptions`：
 * - `autoDispose`：默认 true，组件卸载时自动调用 `node.dispose()`；
 *   如需跨组件复用同一节点，可设置为 false 并手动管理生命周期。
 */
export interface VueEventNodeOptions extends EventNodeOptions {
  autoDispose?: boolean;
}

/**
 * 在 Vue 组件中创建 EventNode。
 * - 若未显式指定 `id`，则基于组件名称与 uid 生成，便于排查事件链路。
 * - `autoDispose` 默认开启，可确保组件销毁时所有订阅被移除。
 */
export function useEventNode(options: VueEventNodeOptions = {}): EventNode {
  const instance = getCurrentInstance();
  const node = new EventNode({
    id:
      options.id ??
      (instance?.proxy
        ? `${instance.proxy.$options.name ?? 'component'}_${instance.uid}`
        : undefined),
    hub: options.hub,
    tags: options.tags
  });

  if (options.autoDispose !== false) {
    onUnmounted(() => node.dispose());
  }

  return node;
}

/**
 * 帮助方法：在不知道传入的是 Hub 还是 Node 时统一广播事件。
 * 方便在组合式函数或工具中复用相同的调用接口。
 */
export function emitEvent<TPayload = unknown>(
  node: EventNode | EventHub,
  channel: string,
  payload: TPayload,
  meta?: Partial<EventMeta>
): Promise<void> {
  // 兼容传入 Hub 或 Node：前者直接调用 hub.emit，后者会自动补全 meta.source。
  if (node instanceof EventNode) {
    return node.emit(channel, payload, meta);
  }
  return node.emit(channel, payload, meta);
}

/**
 * 帮助方法：统一订阅入口。
 * - 若传入 EventNode，会自动绑定 owner（默认为节点本身）。
 * - 若传入 EventHub，可在 options.owner 手动指定归属。
 */
export function onEvent<TPayload = unknown>(
  node: EventNode | EventHub,
  channel: string,
  handler: EventHandler<TPayload>,
  options: SubscriptionOptions<TPayload> = {}
): () => void {
  // Node 会自动绑定 owner；当传入 Hub 时，可自行在 options.owner 指定归属。
  if (node instanceof EventNode) {
    return node.on(channel, handler, options);
  }
  return node.subscribe(channel, handler, options);
}

/**
 * 帮助方法：统一通道桥接入口。
 * 兼容传入 EventNode 与 EventHub，并沿用同一套 BridgeOptions。
 */
export function bridgeEvent<TInput = unknown, TOutput = unknown>(
  node: EventNode | EventHub,
  fromChannel: string,
  toChannel: string,
  options: BridgeOptions<TInput, TOutput> = {}
): () => void {
  // 提供统一入口建立通道桥接，内部区分 Node/Hub 的桥接实现。
  if (node instanceof EventNode) {
    return node.bridge(fromChannel, toChannel, options);
  }
  return node.link(fromChannel, toChannel, options);
}

