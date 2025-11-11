<script setup lang="ts">
import { ref, provide } from 'vue';
import ObjectCommunicationDemo from './test/ObjectCommunicationDemo.vue';
import SimpleDemo from './test/SimpleDemo.vue';
import Sidebar from './components/Templates/Sidebar.vue';
import { ObjectBase } from './components/Object/object';
import { logger } from './services/logger';

// 状态管理
const selectedObject = ref<ObjectBase | null>(null);
const sidebarExpanded = ref(false);

// 处理元素双击事件
const handleElementDoubleClick = (element: ObjectBase) => {
  logger.info('元素被双击', { type: element.type, id: element.id });
  selectedObject.value = element;
  // 侧边栏会在接收到selectedObject后自动展开
};

// 处理侧边栏展开状态变化
const handleSidebarExpandedChange = (expanded: boolean) => {
  sidebarExpanded.value = expanded;
  logger.debug('侧边栏展开状态变化', { expanded });
};

// 处理内容更新
const handleContentUpdated = (object: ObjectBase, content: any) => {
  logger.debug('对象内容已更新', {
    type: object.type,
    id: object.id,
    contentPreview: typeof content === 'string' ? content.slice(0, 120) : content,
  });
};

// 提供给子组件使用的方法
provide('registerElement', (element: HTMLElement, object: ObjectBase) => {
  // 这里可以添加额外的双击事件处理逻辑
  const handleDoubleClick = () => {
    logger.debug('注册元素双击事件', { type: object.type, id: object.id });
    handleElementDoubleClick(object);
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
    </div>
    
    <!-- 边栏组件 - 始终存在 -->
    <Sidebar
      :selected-object="selectedObject"
      @content-updated="handleContentUpdated"
      @expanded-change="handleSidebarExpandedChange"
    />
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
</style>
