<script setup lang="ts">
import { ref, provide, onMounted, onUnmounted } from 'vue';
import ObjectCommunicationDemo from './test/ObjectCommunicationDemo.vue';
import SimpleDemo from './test/SimpleDemo.vue';
import SplitLineFillDemo from './test/SplitLineFillDemo.vue';
import GridAlignDemo from './test/GridAlignDemo.vue';
import Sidebar from './components/Templates/Sidebar.vue';
import D3Example from './components/D3Example.vue';
import CanvasManager from './components/Canvas/CanvasManager.vue';
import { ObjectBase } from './components/Object/object';
import { logger } from './services/logger';
import {
  useEventNode,
  NotesChannels,
  type ElementSelectionPayload,
  type SelectionChangedPayload,
  type SidebarExpandedPayload,
  type SidebarContentUpdatedPayload,
  type TextboxAddElementRequestPayload,
} from './Event';

// 状态管理
const selectedObject = ref<ObjectBase | null>(null);
const sidebarExpanded = ref(false);
const activeTextboxId = ref<string | null>(null);

const eventNode = useEventNode({ tags: ['app-root'] });

const emitSelectionChanged = async (element: ObjectBase | null) => {
  await eventNode.emit(NotesChannels.SELECTION_CHANGED, { element });
};

eventNode.on(NotesChannels.ELEMENT_DOUBLE_CLICK, async ({ payload }) => {
  const { element } =
    (payload as ElementSelectionPayload) ?? { element: payload as ObjectBase };
  if (!element) return;
  logger.info('元素被双击', { type: element.type, id: element.id });
  await emitSelectionChanged(element as ObjectBase);
});

eventNode.on(NotesChannels.SELECTION_CHANGED, ({ payload }) => {
  const { element } =
    (payload as SelectionChangedPayload) ?? {
      element: (payload as ObjectBase | null) ?? null,
    };
  selectedObject.value = (element as ObjectBase) ?? null;
});

eventNode.on(NotesChannels.SIDEBAR_EXPANDED, ({ payload }) => {
  const { expanded } =
    (payload as SidebarExpandedPayload) ?? { expanded: Boolean(payload) };
  sidebarExpanded.value = expanded;
  logger.debug('侧边栏展开状态变化', { expanded });
});

eventNode.on(NotesChannels.SIDEBAR_CONTENT_UPDATED, ({ payload }) => {
  const { element, content } =
    (payload as SidebarContentUpdatedPayload) ?? {
      element: selectedObject.value,
      content: payload,
    };
  if (!element) return;
  logger.debug('对象内容已更新', {
    type: (element as ObjectBase).type,
    id: (element as ObjectBase).id,
    contentPreview:
      typeof content === 'string' ? content.slice(0, 120) : content,
  });
});

// 全局键盘事件处理：响应快捷键添加元素
function handleGlobalKeyDown(event: KeyboardEvent) {
  // 如果当前有元素正在编辑，不处理快捷键（避免冲突）
  const activeElement = document.activeElement;
  if (activeElement && activeElement.classList.contains('element-display-text--editing')) {
    return;
  }

  // Insert 键或 Ctrl+N：添加新元素
  if (event.key === 'Insert' || (event.ctrlKey && event.key.toLowerCase() === 'n')) {
    // 只在有激活的 textbox 时响应
    if (activeTextboxId.value) {
      event.preventDefault();
      event.stopPropagation();
      eventNode.emit(NotesChannels.TEXTBOX_ADD_ELEMENT_REQUEST, { textboxId: activeTextboxId.value });
    }
  }
}

// 全局点击事件处理：点击外部区域时取消激活
function handleGlobalClick(event: MouseEvent) {
  const target = event.target as HTMLElement;
  // 检查点击是否在 textbox 内部
  const textboxWrapper = target.closest('.textbox-wrapper');
  if (!textboxWrapper && activeTextboxId.value) {
    // 点击了外部区域，取消激活
    eventNode.emit(NotesChannels.TEXTBOX_DEACTIVATE, { textboxId: activeTextboxId.value });
    activeTextboxId.value = null;
  }
}

// 监听 textbox 激活/取消激活事件
eventNode.on(NotesChannels.TEXTBOX_ACTIVATE, ({ payload }) => {
  const { textboxId } = payload as any;
  activeTextboxId.value = textboxId;
  logger.debug('Textbox 已激活', { textboxId });
});

eventNode.on(NotesChannels.TEXTBOX_DEACTIVATE, ({ payload }) => {
  const { textboxId } = payload as any;
  if (activeTextboxId.value === textboxId) {
    activeTextboxId.value = null;
    logger.debug('Textbox 已取消激活', { textboxId });
  }
});

// 注册全局事件监听
onMounted(() => {
  document.addEventListener('keydown', handleGlobalKeyDown);
  document.addEventListener('click', handleGlobalClick, true); // 使用捕获阶段确保先执行
});

onUnmounted(() => {
  document.removeEventListener('keydown', handleGlobalKeyDown);
  document.removeEventListener('click', handleGlobalClick, true);
});

// 提供给子组件使用的方法
provide('registerElement', (element: HTMLElement, object: ObjectBase) => {
  // 这里可以添加额外的双击事件处理逻辑
  const handleDoubleClick = () => {
    logger.debug('注册元素双击事件', { type: object.type, id: object.id });
    eventNode.emit(NotesChannels.ELEMENT_DOUBLE_CLICK, { element: object });
  };
  
  element.addEventListener('dblclick', handleDoubleClick);
  
  return () => {
    element.removeEventListener('dblclick', handleDoubleClick);
  };
});
</script>

<template>
  <div class="app-container">
    <!-- 主内容区域 -->
    <div class="main-content" :class="{ 'sidebar-expanded': sidebarExpanded }">
      <h1 class="text-3xl font-bold mb-6 text-center">元素容器演示系统</h1>
      
      <div class="mb-10">
        <h2 class="text-2xl font-semibold mb-4">元素容器通信演示</h2>
        <ObjectCommunicationDemo />
      </div>
      
      <div>
        <h2 class="text-2xl font-semibold mb-4">Textbox元素容器功能演示</h2>
        <SimpleDemo />
      </div>

      <div class="mt-10">
        <h2 class="text-2xl font-semibold mb-4">单行填充并在回车提交后拆分 Demo</h2>
        <SplitLineFillDemo />
      </div>

      <div class="mt-10">
        <h2 class="text-2xl font-semibold mb-4">D3.js 数据可视化示例</h2>
        <D3Example />
      </div>

      <div class="mt-10">
        <CanvasManager />
      </div>

      <div class="mt-10">
        <h2 class="text-2xl font-semibold mb-4">网格对齐功能演示</h2>
        <GridAlignDemo />
      </div>
    </div>
    
    <!-- 边栏组件 - 始终存在 -->
    <Sidebar />
  </div>
</template>

<style scoped>
.app-container {
  display: flex;
  min-height: 100vh;
  width: 100%;
  position: relative;
}

.main-content {
  flex: 1;
  padding: 16px;
  padding-right: 66px; /* 为图标栏预留空间 */
  box-sizing: border-box;
  transition: padding-right 0.3s ease;
  min-height: 100vh;
}

/* 侧边栏展开时挤压主内容区域 */
.main-content.sidebar-expanded {
  padding-right: 326px; /* 图标栏 + 展开的内容区宽度 */
}

.main-content > div {
  max-width: 800px;
  margin: 0 auto;
}

:global(body) {
  margin: 0;
  background-color: #f8fafc;
  background-image: radial-gradient(rgba(59, 130, 246, 0.3) 1px, transparent 1px);
  background-size: 28px 28px;
  background-position: 0 0;
  font-family: 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif;
}
</style>
