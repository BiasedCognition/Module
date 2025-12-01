<template>
  <div class="grid-align-demo">
    <h2>网格对齐功能演示</h2>
    <p>背景显示 28px × 28px 的网格点，所有元素都会自动对齐到网格点。</p>
    <p><strong>操作说明：</strong>查看模式下可拖拽移动画布，编辑模式下只能拖拽边缘调整大小。</p>
    
    <!-- 控制面板 -->
    <div class="control-panel">
      <button @click="createCanvas" class="demo-button">创建新画布</button>
      <button @click="createTextbox" class="demo-button">创建新文本框</button>
      <button @click="clearAll" class="demo-button danger">清空所有元素</button>
    </div>
    
    <!-- 演示区域 -->
    <div class="demo-area" ref="demoArea">
      <!-- 动态创建的画布元素 -->
      <canvas-element
        v-for="canvas in canvases"
        :key="canvas.id"
        :canvas-element="canvas.element"
        :mode="canvas.mode"
        :style="{
          position: 'absolute',
          left: (canvas.element.containerX || canvas.x) + 'px',
          top: (canvas.element.containerY || canvas.y) + 'px',
          zIndex: 10
        }"
        @dblclick="selectCanvas(canvas)"
      />
      
      <!-- 动态创建的文本框元素 -->
      <textbox-component
        v-for="textbox in textboxes"
        :key="textbox.id"
        :mode="textbox.mode"
        :textbox-instance="textbox.instance"
        :style="{
          position: 'absolute',
          left: (textbox.instance.containerX || textbox.x) + 'px',
          top: (textbox.instance.containerY || textbox.y) + 'px',
          zIndex: 5
        }"
        @dblclick="selectTextbox(textbox)"
      />
    </div>
    
    <!-- 选中元素的控制面板 -->
    <div v-if="selectedElement" class="selected-element-panel">
      <h3>选中元素控制</h3>
      <p>类型: {{ selectedElement.type }}</p>
      <p>位置: ({{ selectedElement.x }}, {{ selectedElement.y }})</p>
      <div class="element-controls">
        <button @click="toggleElementMode" class="demo-button">
          切换模式 ({{ selectedElement.mode }})
        </button>
        <button @click="moveElement(-GRID_SIZE, 0)" class="demo-button">← 左移</button>
        <button @click="moveElement(GRID_SIZE, 0)" class="demo-button">右移 →</button>
        <button @click="moveElement(0, -GRID_SIZE)" class="demo-button">↑ 上移</button>
        <button @click="moveElement(0, GRID_SIZE)" class="demo-button">下移 ↓</button>
        <button @click="deleteElement" class="demo-button danger">删除</button>
      </div>
    </div>
    
    <!-- 网格信息 -->
    <div class="grid-info">
      <h3>网格信息</h3>
      <p>网格大小: {{ GRID_SIZE }}px × {{ GRID_SIZE }}px</p>
      <p>画布数量: {{ canvases.length }}</p>
      <p>文本框数量: {{ textboxes.length }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, nextTick } from 'vue';
import CanvasElement from '../components/Templates/CanvasElement.vue';
import TextboxComponent from '../components/Templates/Textbox.vue';
import { CanvasElement as CanvasElementClass } from '../components/Object/canvasElement';
import { Textbox as TextboxClass } from '../components/Object/textbox';
import { snapToGrid, GRID_SIZE } from '../utils/gridAlign';

// 状态管理
const demoArea = ref<HTMLElement>();
const canvases = ref<Array<{
  id: string;
  element: CanvasElementClass;
  mode: 'view' | 'edit';
  x: number;
  y: number;
}>>([]);

const textboxes = ref<Array<{
  id: string;
  instance: TextboxClass;
  mode: 'view' | 'edit';
  x: number;
  y: number;
  width: number;
}>>([]);

const selectedElement = ref<{
  type: 'canvas' | 'textbox';
  id: string;
  mode: 'view' | 'edit';
  x: number;
  y: number;
} | null>(null);

// 创建新画布
function createCanvas() {
  const canvas = new CanvasElementClass();
  canvas.setCanvasSize(GRID_SIZE * 8, GRID_SIZE * 6); // 8x6 网格单位
  
  // 随机位置，但对齐到网格
  const randomX = snapToGrid(Math.random() * 400);
  const randomY = snapToGrid(Math.random() * 300 + 100);
  
  const canvasItem = {
    id: `canvas_${Date.now()}`,
    element: canvas,
    mode: 'view' as const,
    x: randomX,
    y: randomY
  };
  
  canvases.value.push(canvasItem);
}

// 创建新文本框
function createTextbox() {
  const textboxInstance = new TextboxClass();
  
  // 随机位置，但对齐到网格
  const randomX = snapToGrid(Math.random() * 400);
  const randomY = snapToGrid(Math.random() * 300 + 100);
  const width = GRID_SIZE * 10; // 10个网格单位宽
  const height = GRID_SIZE * 7; // 7个网格单位高
  
  // 设置 Textbox 的位置和尺寸
  textboxInstance.setContainerPosition(randomX, randomY);
  textboxInstance.setContainerSize(width, height);
  
  const textboxItem = {
    id: `textbox_${Date.now()}`,
    instance: textboxInstance,
    mode: 'view' as const,
    x: randomX,
    y: randomY,
    width: width
  };
  
  textboxes.value.push(textboxItem);
}

// 选择画布
function selectCanvas(canvas: any) {
  selectedElement.value = {
    type: 'canvas',
    id: canvas.id,
    mode: canvas.mode,
    x: canvas.element.containerX || canvas.x,
    y: canvas.element.containerY || canvas.y
  };
}

// 选择文本框
function selectTextbox(textbox: any) {
  selectedElement.value = {
    type: 'textbox',
    id: textbox.id,
    mode: textbox.instance.getEditMode(),
    x: textbox.instance.containerX || textbox.x,
    y: textbox.instance.containerY || textbox.y
  };
}

// 切换选中元素的模式
function toggleElementMode() {
  if (!selectedElement.value) return;
  
  const newMode = selectedElement.value.mode === 'view' ? 'edit' : 'view';
  
  if (selectedElement.value.type === 'canvas') {
    const canvas = canvases.value.find(c => c.id === selectedElement.value!.id);
    if (canvas) {
      canvas.mode = newMode;
      canvas.element.setEditMode(newMode);
      selectedElement.value.mode = newMode;
    }
  } else if (selectedElement.value.type === 'textbox') {
    const textbox = textboxes.value.find(t => t.id === selectedElement.value!.id);
    if (textbox) {
      textbox.mode = newMode;
      textbox.instance.setEditMode(newMode);
      selectedElement.value.mode = newMode;
    }
  }
}

// 移动选中元素
function moveElement(deltaX: number, deltaY: number) {
  if (!selectedElement.value) return;
  
  const newX = snapToGrid(selectedElement.value.x + deltaX);
  const newY = snapToGrid(selectedElement.value.y + deltaY);
  
  if (selectedElement.value.type === 'canvas') {
    const canvas = canvases.value.find(c => c.id === selectedElement.value!.id);
    if (canvas) {
      // 更新 CanvasElement 中的位置
      canvas.element.setContainerPosition(newX, newY);
      canvas.x = newX;
      canvas.y = newY;
      selectedElement.value.x = newX;
      selectedElement.value.y = newY;
    }
  } else if (selectedElement.value.type === 'textbox') {
    const textbox = textboxes.value.find(t => t.id === selectedElement.value!.id);
    if (textbox) {
      // 更新 Textbox 中的位置
      textbox.instance.setContainerPosition(newX, newY);
      textbox.x = newX;
      textbox.y = newY;
      selectedElement.value.x = newX;
      selectedElement.value.y = newY;
    }
  }
}

// 删除选中元素
function deleteElement() {
  if (!selectedElement.value) return;
  
  if (selectedElement.value.type === 'canvas') {
    const index = canvases.value.findIndex(c => c.id === selectedElement.value!.id);
    if (index >= 0) {
      canvases.value.splice(index, 1);
    }
  } else if (selectedElement.value.type === 'textbox') {
    const index = textboxes.value.findIndex(t => t.id === selectedElement.value!.id);
    if (index >= 0) {
      textboxes.value.splice(index, 1);
    }
  }
  
  selectedElement.value = null;
}

// 清空所有元素
function clearAll() {
  canvases.value = [];
  textboxes.value = [];
  selectedElement.value = null;
}
</script>

<style scoped>
.grid-align-demo {
  padding: 20px;
  max-width: 1200px;
  margin: 0 auto;
}

.control-panel {
  display: flex;
  gap: 10px;
  margin-bottom: 20px;
  padding: 15px;
  background: #f8fafc;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
}

.demo-area {
  position: relative;
  min-height: 600px;
  border: 2px solid #e2e8f0;
  border-radius: 8px;
  background: transparent; /* 让全局背景网格显示 */
  margin-bottom: 20px;
}

.selected-element-panel {
  padding: 15px;
  background: #f0f9ff;
  border: 1px solid #0ea5e9;
  border-radius: 8px;
  margin-bottom: 20px;
}

.element-controls {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-top: 10px;
}

.grid-info {
  padding: 15px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
}

.demo-button {
  padding: 8px 16px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  background: #ffffff;
  color: #374151;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.2s;
}

.demo-button:hover {
  background: #f3f4f6;
  border-color: #9ca3af;
}

.demo-button.danger {
  background: #fef2f2;
  border-color: #fecaca;
  color: #dc2626;
}

.demo-button.danger:hover {
  background: #fee2e2;
  border-color: #fca5a5;
}

h2 {
  color: #1f2937;
  margin-bottom: 10px;
}

h3 {
  color: #374151;
  margin-bottom: 10px;
  font-size: 18px;
}

p {
  color: #6b7280;
  margin-bottom: 8px;
}
</style>
