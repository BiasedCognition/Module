/**
 * Vue 组合式 API 适配层，便于在组件中使用事件 Hub。
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
 * useEventNode 额外支持自动清理等开关。
 */
export interface VueEventNodeOptions extends EventNodeOptions {
  autoDispose?: boolean;
}

/**
 * 在 Vue 组件中创建 EventNode，默认随组件卸载而释放订阅。
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

export function emitEvent<TPayload = unknown>(
  node: EventNode | EventHub,
  channel: string,
  payload: TPayload,
  meta?: Partial<EventMeta>
): Promise<void> {
  // 兼容传入 Hub 或 Node，两者接口一致。
  if (node instanceof EventNode) {
    return node.emit(channel, payload, meta);
  }
  return node.emit(channel, payload, meta);
}

export function onEvent<TPayload = unknown>(
  node: EventNode | EventHub,
  channel: string,
  handler: EventHandler<TPayload>,
  options: SubscriptionOptions<TPayload> = {}
): () => void {
  // Node 会自动绑定 owner，Hub 直接使用原生订阅能力。
  if (node instanceof EventNode) {
    return node.on(channel, handler, options);
  }
  return node.subscribe(channel, handler, options);
}

export function bridgeEvent<TInput = unknown, TOutput = unknown>(
  node: EventNode | EventHub,
  fromChannel: string,
  toChannel: string,
  options: BridgeOptions<TInput, TOutput> = {}
): () => void {
  // 提供统一入口建立通道桥接。
  if (node instanceof EventNode) {
    return node.bridge(fromChannel, toChannel, options);
  }
  return node.link(fromChannel, toChannel, options);
}

