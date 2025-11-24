<template>
  <div class="canvas-manager">
    <div class="canvas-manager-header">
      <h2 class="text-2xl font-semibold mb-4">画布管理</h2>
      <button 
        @click="createNewCanvas" 
        class="create-canvas-btn"
        title="创建新画布"
      >
        + 创建画布
      </button>
    </div>
    
    <div class="canvas-list">
      <canvas-element-component
        v-for="canvas in canvasList"
        :key="`canvas-${canvas.elementId}-${canvasModes[canvas.elementId] || 'view'}`"
        :canvasElement="canvas"
        :mode="getCanvasMode(canvas.elementId)"
        @click="selectCanvas(canvas)"
        @dblclick="focusCanvas(canvas)"
        class="canvas-item"
        :class="{ 'canvas-selected': selectedCanvasId === canvas.elementId }"
      />
      
      <div v-if="canvasList.length === 0" class="no-canvas">
        暂无画布，点击"创建画布"按钮创建
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { CanvasElement } from '../Object/canvasElement';
import CanvasElementComponent from '../Templates/CanvasElement.vue';
import { useEventNode, NotesChannels } from '@/Event';
import type { ObjectBase } from '../Object/object';

const canvasList = ref<CanvasElement[]>([]);
const selectedCanvasId = ref<string | null>(null);
const canvasModes = ref<Record<string, 'view' | 'edit'>>({});
const eventNode = useEventNode({ tags: ['canvas-manager'] });

// 获取画布模式（优先从 CanvasElement 读取，确保持久化）
const getCanvasMode = (canvasId: string): 'view' | 'edit' => {
  // 首先尝试从画布列表中找到对应的画布元素
  const canvas = canvasList.value.find(c => c.elementId === canvasId);
  if (canvas && canvas.editMode) {
    return canvas.editMode;
  }
  // 如果找不到或没有设置，从缓存中读取
  const mode = canvasModes.value[canvasId] || 'view';
  console.log('[CanvasManager] Getting mode for', canvasId, ':', mode);
  return mode;
};

// 创建新画布
function createNewCanvas() {
  const canvas = new CanvasElement(800, 600, canvasList.value.length);
  canvasList.value.push(canvas);
  // 默认设置为查看模式（使用对象属性确保响应式）
  canvasModes.value[canvas.elementId] = 'view';
  selectCanvas(canvas);
  
  // 触发选择事件，让侧边栏可以显示画布属性
  eventNode.emit(NotesChannels.SELECTION_CHANGED, { element: canvas });
}

// 选择画布
function selectCanvas(canvas: CanvasElement) {
  selectedCanvasId.value = canvas.elementId;
  eventNode.emit(NotesChannels.SELECTION_CHANGED, { element: canvas });
}

// 聚焦画布（双击时）
function focusCanvas(canvas: CanvasElement) {
  selectCanvas(canvas);
  // 可以添加额外的聚焦逻辑，比如滚动到画布位置等
}

// 删除选中的画布
function removeSelectedCanvas() {
  if (selectedCanvasId.value) {
    removeCanvas(selectedCanvasId.value);
  }
}

// 删除画布
function removeCanvas(canvasId: string) {
  const index = canvasList.value.findIndex(c => c.elementId === canvasId);
  if (index !== -1) {
    canvasList.value.splice(index, 1);
    
    // 如果删除的是当前选中的画布，清除选择
    if (selectedCanvasId.value === canvasId) {
      selectedCanvasId.value = null;
      eventNode.emit(NotesChannels.SELECTION_CHANGED, { element: null });
    }
  }
}

// 监听外部选择变化（比如从侧边栏选择）
eventNode.on(NotesChannels.SELECTION_CHANGED, ({ payload }) => {
  const { element } = payload as any;
  if (element && element.type === 'canvas-element') {
    selectedCanvasId.value = element.elementId;
    // 确保 CanvasManager 的缓存与 CanvasElement 对象同步
    if (element instanceof CanvasElement) {
      const mode = element.getEditMode();
      canvasModes.value[element.elementId] = mode;
      // 通知侧边栏当前画布的模式
      eventNode.emit('canvas:mode-sync', {
        canvasElement: element,
        mode: mode,
      });
    } else {
      // 如果元素不是 CanvasElement 实例，使用缓存
      const currentMode = getCanvasMode(element.elementId);
      eventNode.emit('canvas:mode-sync', {
        canvasElement: element,
        mode: currentMode,
      });
    }
  } else if (!element) {
    // 如果选择被清除，也清除画布选择
    selectedCanvasId.value = null;
  }
});

// 监听画布模式切换事件
eventNode.on('canvas:mode-changed', ({ payload }) => {
  const { canvasElement, mode } = payload as any;
  console.log('[CanvasManager] Received mode change:', mode, 'Canvas ID:', canvasElement?.elementId);
  if (canvasElement && canvasElement.elementId) {
    // 同时更新 CanvasElement 对象和缓存
    if (canvasElement instanceof CanvasElement) {
      canvasElement.setEditMode(mode);
    }
    // 使用对象属性确保响应式更新
    canvasModes.value[canvasElement.elementId] = mode;
    console.log('[CanvasManager] Updated modes:', canvasModes.value);
  }
});
</script>

<style scoped>
.canvas-manager {
  padding: 20px;
}

.canvas-manager-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.header-actions {
  display: flex;
  gap: 8px;
}

.canvas-manager-header h2 {
  margin: 0;
}

.create-canvas-btn {
  padding: 8px 16px;
  border: 1px solid #3b82f6;
  border-radius: 6px;
  background-color: #3b82f6;
  color: white;
  cursor: pointer;
  font-size: 14px;
  transition: background-color 0.2s ease;
}

.create-canvas-btn:hover {
  background-color: #2563eb;
}

.remove-canvas-btn {
  padding: 8px 16px;
  border: 1px solid #ef4444;
  border-radius: 6px;
  background-color: #ef4444;
  color: white;
  cursor: pointer;
  font-size: 14px;
  transition: background-color 0.2s ease;
}

.remove-canvas-btn:hover {
  background-color: #dc2626;
}

.canvas-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.canvas-item {
  margin-bottom: 16px;
  cursor: pointer;
}

.canvas-item.canvas-selected {
  outline: 2px solid #3b82f6;
  outline-offset: 2px;
}

.no-canvas {
  text-align: center;
  padding: 40px 20px;
  color: #999;
  font-style: italic;
}
</style>


