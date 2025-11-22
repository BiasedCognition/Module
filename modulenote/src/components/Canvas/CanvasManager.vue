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
      <div
        v-for="canvas in canvasList"
        :key="canvas.elementId"
        class="canvas-item"
        :class="{ 'canvas-selected': selectedCanvasId === canvas.elementId }"
        @click="selectCanvas(canvas)"
        @dblclick="focusCanvas(canvas)"
      >
        <div class="canvas-item-header">
          <span class="canvas-item-title">画布 {{ canvas.elementId.substring(0, 8) }}</span>
          <button
            @click.stop="removeCanvas(canvas.elementId)"
            class="remove-canvas-btn"
            title="删除画布"
          >
            ×
          </button>
        </div>
        <div class="canvas-item-preview">
          <canvas-element-component
            :canvasElement="canvas"
            :mode="'edit'"
            @click="selectCanvas(canvas)"
            @dblclick="focusCanvas(canvas)"
          />
        </div>
      </div>
      
      <div v-if="canvasList.length === 0" class="no-canvas">
        暂无画布，点击"创建画布"按钮创建
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { CanvasElement } from '../Object/canvasElement';
import CanvasElementComponent from '../Templates/CanvasElement.vue';
import { useEventNode, NotesChannels } from '@/Event';
import type { ObjectBase } from '../Object/object';

const canvasList = ref<CanvasElement[]>([]);
const selectedCanvasId = ref<string | null>(null);
const eventNode = useEventNode({ tags: ['canvas-manager'] });

// 创建新画布
function createNewCanvas() {
  const canvas = new CanvasElement(800, 600, canvasList.value.length);
  canvasList.value.push(canvas);
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
  } else if (!element) {
    // 如果选择被清除，也清除画布选择
    selectedCanvasId.value = null;
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

.canvas-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.canvas-item {
  border: 2px solid #e5e7eb;
  border-radius: 8px;
  padding: 12px;
  background-color: #f9fafb;
  cursor: pointer;
  transition: border-color 0.2s ease, background-color 0.2s ease;
}

.canvas-item:hover {
  border-color: #3b82f6;
  background-color: #f0f9ff;
}

.canvas-item.canvas-selected {
  border-color: #3b82f6;
  background-color: #eff6ff;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.canvas-item-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.canvas-item-title {
  font-weight: 500;
  color: #333;
  font-size: 14px;
}

.remove-canvas-btn {
  width: 24px;
  height: 24px;
  padding: 0;
  border: none;
  border-radius: 4px;
  background-color: #ef4444;
  color: white;
  font-size: 18px;
  font-weight: bold;
  line-height: 1;
  cursor: pointer;
  transition: background-color 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
}

.remove-canvas-btn:hover {
  background-color: #dc2626;
}

.canvas-item-preview {
  display: flex;
  justify-content: center;
  align-items: center;
}

.no-canvas {
  text-align: center;
  padding: 40px 20px;
  color: #999;
  font-style: italic;
}
</style>


