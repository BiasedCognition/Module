<template>
  <div 
    ref="canvasContainer"
    class="canvas-container"
    :class="{ 'edit-mode': mode === 'edit' }"
    :data-element-id="canvasElement?.elementId || ''"
    :style="{
      width: canvasWidth + 'px',
      height: canvasHeight + 'px',
      backgroundColor: backgroundColor,
    }"
    @click="handleClick"
    @dblclick="handleDoubleClick"
    @mousedown="handleMouseDown"
  >
    <!-- 调试信息 -->
    <div v-if="mode === 'edit'" style="position: absolute; top: -25px; left: 0; font-size: 12px; color: red; z-index: 2000; background: yellow; padding: 2px 5px;">
      编辑模式: {{ mode }}, ID: {{ canvasElement?.elementId?.substring(0, 8) }}
    </div>
    <!-- SVG 画布内容包装器 -->
    <div class="svg-wrapper" ref="svgWrapper"></div>
    <!-- 调整大小手柄 - 放在 SVG 之后，确保在最上层 -->
    <div 
      v-if="mode === 'edit'"
      class="resize-handle resize-handle-n"
      @mousedown.stop="startResize($event, 'n')"
    ></div>
    <div 
      v-if="mode === 'edit'"
      class="resize-handle resize-handle-s"
      @mousedown.stop="startResize($event, 's')"
    ></div>
    <div 
      v-if="mode === 'edit'"
      class="resize-handle resize-handle-w"
      @mousedown.stop="startResize($event, 'w')"
    ></div>
    <div 
      v-if="mode === 'edit'"
      class="resize-handle resize-handle-e"
      @mousedown.stop="startResize($event, 'e')"
    ></div>
    <div 
      v-if="mode === 'edit'"
      class="resize-handle resize-handle-nw"
      @mousedown.stop="startResize($event, 'nw')"
    ></div>
    <div 
      v-if="mode === 'edit'"
      class="resize-handle resize-handle-ne"
      @mousedown.stop="startResize($event, 'ne')"
    ></div>
    <div 
      v-if="mode === 'edit'"
      class="resize-handle resize-handle-sw"
      @mousedown.stop="startResize($event, 'sw')"
    ></div>
    <div 
      v-if="mode === 'edit'"
      class="resize-handle resize-handle-se"
      @mousedown.stop="startResize($event, 'se')"
    ></div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import * as d3 from 'd3';
import type { CanvasElement } from '../Object/canvasElement';
import { snapToGrid, snapRectToGrid, GRID_SIZE } from '@/utils/gridAlign';

// Props 定义
const props = defineProps<{
  canvasElement: CanvasElement;
  mode: 'view' | 'edit';
}>();

// 调试：监听模式变化
watch(() => props.mode, (newMode) => {
  console.log('[CanvasElement] Mode changed:', newMode, 'Element ID:', props.canvasElement?.elementId);
}, { immediate: true });

// Emits 定义
const emit = defineEmits<{
  (e: 'click', event: MouseEvent): void;
  (e: 'dblclick', event: MouseEvent): void;
}>();

// 事件处理
function handleClick(event: MouseEvent) {
  emit('click', event);
}

function handleDoubleClick(event: MouseEvent) {
  emit('dblclick', event);
}

const canvasContainer = ref<HTMLElement | null>(null);
const svgWrapper = ref<HTMLElement | null>(null);
let svg: d3.Selection<SVGSVGElement, unknown, null, undefined> | null = null;
let zoomBehavior: d3.ZoomBehavior<SVGElement, unknown> | null = null;

// 调整大小相关状态
const isResizing = ref(false);
const resizeDirection = ref<string>('');
const resizeStartX = ref(0);
const resizeStartY = ref(0);
const resizeStartWidth = ref(0);
const resizeStartHeight = ref(0);
const resizeStartLeft = ref(0);
const resizeStartTop = ref(0);

// 拖拽相关状态
const isDragging = ref(false);
const dragStartX = ref(0);
const dragStartY = ref(0);
const dragStartLeft = ref(0);
const dragStartTop = ref(0);

// 计算属性
const canvasWidth = computed(() => props.canvasElement?.canvasWidth || 800);
const canvasHeight = computed(() => props.canvasElement?.canvasHeight || 600);
const backgroundColor = computed(() => props.canvasElement?.backgroundColor || '#ffffff');
const zoomLevel = computed(() => props.canvasElement?.zoomLevel || 1);
const translateX = computed(() => props.canvasElement?.translateX || 0);
const translateY = computed(() => props.canvasElement?.translateY || 0);

// 初始化画布
onMounted(() => {
  if (canvasContainer.value) {
    initializeCanvas();
    // 应用保存的容器位置
    applyContainerPosition();
    // 初始化时对齐到网格
    alignCanvasToGrid();
  }
  // 添加全局鼠标事件监听
  document.addEventListener('mousemove', handleMouseMove);
  document.addEventListener('mouseup', handleMouseUp);
});

// 监听属性变化
watch([canvasWidth, canvasHeight], () => {
  if (svg) {
    svg
      .attr('width', canvasWidth.value)
      .attr('height', canvasHeight.value)
      .attr('viewBox', `0 0 ${canvasWidth.value} ${canvasHeight.value}`);
  }
});

// 监听模式变化，重新初始化画布（禁用/启用缩放行为）
watch(() => props.mode, (newMode) => {
  if (svg && props.canvasElement) {
    if (newMode === 'edit') {
      // 编辑模式下禁用缩放行为
      if (zoomBehavior) {
        svg.on('.zoom', null);
        zoomBehavior = null;
      }
    } else {
      // 查看模式下启用缩放行为
      if (!zoomBehavior && props.canvasElement.zoomable) {
        zoomBehavior = d3
          .zoom<SVGElement, unknown>()
          .scaleExtent([0.1, 5])
          .on('zoom', (event) => {
            const { transform } = event;
            const g = svg!.select('.canvas-content');
            g.attr('transform', transform.toString());
            
            if (props.canvasElement) {
              props.canvasElement.zoomLevel = transform.k;
              props.canvasElement.translateX = transform.x;
              props.canvasElement.translateY = transform.y;
            }
          });
        svg.call(zoomBehavior as any);
      }
    }
  }
});

watch(backgroundColor, () => {
  if (canvasContainer.value) {
    canvasContainer.value.style.backgroundColor = backgroundColor.value;
  }
});

// 清理
onUnmounted(() => {
  if (svg) {
    svg.selectAll('*').remove();
    svg = null;
  }
  zoomBehavior = null;
  // 移除全局鼠标事件监听
  document.removeEventListener('mousemove', handleMouseMove);
  document.removeEventListener('mouseup', handleMouseUp);
});

function initializeCanvas() {
  if (!canvasContainer.value) return;

  // 使用 ref 获取 SVG 包装器，如果不存在则创建
  let svgWrapperEl = svgWrapper.value;
  if (!svgWrapperEl) {
    svgWrapperEl = document.createElement('div');
    svgWrapperEl.className = 'svg-wrapper';
    // 插入到第一个位置，确保手柄在它之上
    if (canvasContainer.value.firstChild) {
      canvasContainer.value.insertBefore(svgWrapperEl, canvasContainer.value.firstChild);
    } else {
      canvasContainer.value.appendChild(svgWrapperEl);
    }
  }
  
  // 清除现有 SVG 内容（保留手柄）
  svgWrapperEl.innerHTML = '';

  // 创建 SVG（在包装器内）
  svg = d3
    .select(svgWrapperEl)
    .append('svg')
    .attr('width', canvasWidth.value)
    .attr('height', canvasHeight.value)
    .attr('viewBox', `0 0 ${canvasWidth.value} ${canvasHeight.value}`)
    .style('display', 'block')
    .style('cursor', 'grab')
    .style('width', '100%')
    .style('height', '100%');

  // 创建可缩放和可平移的组
  const g = svg.append('g').attr('class', 'canvas-content');

  // 设置初始变换
  g.attr('transform', `translate(${translateX.value}, ${translateY.value}) scale(${zoomLevel.value})`);

  // 创建缩放行为（仅在非编辑模式下启用，避免与调整大小手柄冲突）
  if (props.canvasElement?.zoomable && props.mode !== 'edit') {
    zoomBehavior = d3
      .zoom<SVGElement, unknown>()
      .scaleExtent([0.1, 5]) // 缩放范围：0.1 到 5 倍
      .on('zoom', (event) => {
        const { transform } = event;
        g.attr('transform', transform.toString());
        
        // 更新元素状态
        if (props.canvasElement) {
          props.canvasElement.zoomLevel = transform.k;
          props.canvasElement.translateX = transform.x;
          props.canvasElement.translateY = transform.y;
        }
      });

    svg.call(zoomBehavior as any);
  }

  // D3 的 zoom 行为已经包含了拖拽功能（通过鼠标拖拽）
  // 如果需要额外的拖拽控制，可以通过按住特定键（如空格键）来启用拖拽模式
  // 这里我们主要依赖 D3 的 zoom 行为，它已经支持拖拽和平移

  // 添加一些示例内容（可以后续扩展）
  addExampleContent(g);
}

function addExampleContent(g: d3.Selection<SVGGElement, unknown, null, undefined>) {
  // 添加一个示例矩形
  g.append('rect')
    .attr('x', 50)
    .attr('y', 50)
    .attr('width', 100)
    .attr('height', 100)
    .attr('fill', '#3b82f6')
    .attr('stroke', '#1e40af')
    .attr('stroke-width', 2)
    .attr('rx', 4);

  // 添加一个示例圆形
  g.append('circle')
    .attr('cx', 250)
    .attr('cy', 150)
    .attr('r', 50)
    .attr('fill', '#10b981')
    .attr('stroke', '#059669')
    .attr('stroke-width', 2);

  // 添加文本
  g.append('text')
    .attr('x', 150)
    .attr('y', 250)
    .attr('text-anchor', 'middle')
    .attr('font-size', '16px')
    .attr('fill', '#333')
    .text('可拖拽、可缩放的画布');
}

// 拖拽和调整大小相关函数
function handleMouseDown(event: MouseEvent) {
  // 如果正在调整大小，不处理拖拽
  if (isResizing.value) {
    return;
  }
  
  // 检查是否点击在手柄上（手柄会阻止事件冒泡）
  const target = event.target as HTMLElement;
  if (target.classList.contains('resize-handle')) {
    return;
  }
  
  // 检查是否点击在 SVG 内容上
  if (target.closest('.svg-wrapper') || target.closest('svg')) {
    // 如果点击在 SVG 内容上，不启动拖拽（让 D3 的缩放行为处理）
    return;
  }
  
  // 在编辑模式下，禁止拖拽移动画布位置
  if (props.mode === 'edit') {
    return;
  }
  
  // 在画布空白区域按下鼠标，启动拖拽（仅在查看模式下）
  if (!canvasContainer.value) return;
  
  isDragging.value = true;
  dragStartX.value = event.clientX;
  dragStartY.value = event.clientY;
  
  // 获取容器的当前位置
  const rect = canvasContainer.value.getBoundingClientRect();
  const parentRect = canvasContainer.value.parentElement?.getBoundingClientRect() || { left: 0, top: 0 };
  dragStartLeft.value = rect.left - parentRect.left;
  dragStartTop.value = rect.top - parentRect.top;
  
  // 禁用文本选择
  document.body.style.userSelect = 'none';
  document.body.style.cursor = 'grabbing';
  
  event.preventDefault();
}

function startResize(event: MouseEvent, direction: string) {
  event.preventDefault();
  event.stopPropagation();
  
  if (!canvasContainer.value || !props.canvasElement) return;
  
  isResizing.value = true;
  resizeDirection.value = direction;
  resizeStartX.value = event.clientX;
  resizeStartY.value = event.clientY;
  resizeStartWidth.value = canvasWidth.value;
  resizeStartHeight.value = canvasHeight.value;
  
  // 获取容器的当前位置
  // 优先使用已设置的 style.top/left 值，确保速率一致
  const computedStyle = window.getComputedStyle(canvasContainer.value);
  const currentTop = computedStyle.top;
  const currentLeft = computedStyle.left;
  
  // 如果已经设置了 top，直接使用设置的值；否则使用 getBoundingClientRect 计算
  if (currentTop && currentTop !== 'auto') {
    resizeStartTop.value = parseFloat(currentTop);
  } else {
    const rect = canvasContainer.value.getBoundingClientRect();
    const parentRect = canvasContainer.value.parentElement?.getBoundingClientRect() || { left: 0, top: 0 };
    resizeStartTop.value = rect.top - parentRect.top;
  }
  
  // 如果已经设置了 left，直接使用设置的值；否则使用 getBoundingClientRect 计算
  if (currentLeft && currentLeft !== 'auto') {
    resizeStartLeft.value = parseFloat(currentLeft);
  } else {
    const rect = canvasContainer.value.getBoundingClientRect();
    const parentRect = canvasContainer.value.parentElement?.getBoundingClientRect() || { left: 0, top: 0 };
    resizeStartLeft.value = rect.left - parentRect.left;
  }
  
  // 禁用文本选择
  document.body.style.userSelect = 'none';
  document.body.style.cursor = getResizeCursor(direction);
}

function handleMouseMove(event: MouseEvent) {
  // 处理拖拽
  if (isDragging.value && canvasContainer.value) {
    const deltaX = event.clientX - dragStartX.value;
    const deltaY = event.clientY - dragStartY.value;
    
    const rawLeft = dragStartLeft.value + deltaX;
    const rawTop = dragStartTop.value + deltaY;
    
    // 对齐到网格
    const newLeft = snapToGrid(rawLeft);
    const newTop = snapToGrid(rawTop);
    
    // 更新画布位置
    const currentPosition = window.getComputedStyle(canvasContainer.value).position;
    if (currentPosition === 'static') {
      canvasContainer.value.style.position = 'relative';
    }
    canvasContainer.value.style.left = newLeft + 'px';
    canvasContainer.value.style.top = newTop + 'px';
    
    return;
  }
  
  // 处理调整大小
  if (!isResizing.value || !canvasContainer.value || !props.canvasElement) return;
  
  const deltaX = event.clientX - resizeStartX.value;
  const deltaY = event.clientY - resizeStartY.value;
  
  let newWidth = resizeStartWidth.value;
  let newHeight = resizeStartHeight.value;
  let newLeft = resizeStartLeft.value;
  let newTop = resizeStartTop.value;
  
  // 根据方向调整大小和位置
  // 逻辑说明：
  // - 上边缘（n）：向上拖拽时，高度增加，左上角向上移动
  // - 下边缘（s）：向下拖拽时，高度增加，左上角不变
  // - 左边缘（w）：向左拖拽时，宽度增加，左上角向左移动
  // - 右边缘（e）：向右拖拽时，宽度增加，左上角不变
  if (resizeDirection.value.includes('e')) {
    // 右侧：只改变宽度，位置不变（向右扩展）
    newWidth = Math.max(GRID_SIZE, resizeStartWidth.value + deltaX);
  }
  if (resizeDirection.value.includes('w')) {
    // 左侧：改变宽度和左边位置（向左扩展）
    newWidth = Math.max(GRID_SIZE, resizeStartWidth.value - deltaX);
    newLeft = resizeStartLeft.value + deltaX;
  }
  if (resizeDirection.value.includes('s')) {
    // 下方：只改变高度，位置不变（向下扩展）
    newHeight = Math.max(GRID_SIZE, resizeStartHeight.value + deltaY);
  }
  if (resizeDirection.value.includes('n')) {
    // 上方：改变高度和上边位置（向上扩展）
    newHeight = Math.max(GRID_SIZE, resizeStartHeight.value - deltaY);
    newTop = resizeStartTop.value + deltaY;
  }
  
  // 对齐到网格
  const alignedRect = snapRectToGrid({
    x: newLeft,
    y: newTop,
    width: newWidth,
    height: newHeight
  });
  
  // 更新画布大小
  props.canvasElement.setCanvasSize(alignedRect.width, alignedRect.height);
  
  // 更新画布位置（通过设置容器的 left 和 top，需要先设置 position）
  if (canvasContainer.value) {
    const currentPosition = window.getComputedStyle(canvasContainer.value).position;
    if (currentPosition === 'static') {
      canvasContainer.value.style.position = 'relative';
    }
    canvasContainer.value.style.left = alignedRect.x + 'px';
    canvasContainer.value.style.top = alignedRect.y + 'px';
  }
}

function handleMouseUp(event: MouseEvent) {
  // 处理拖拽结束
  if (isDragging.value) {
    isDragging.value = false;
    
    // 保存当前位置到 CanvasElement 对象
    if (canvasContainer.value && props.canvasElement) {
      const rect = canvasContainer.value.getBoundingClientRect();
      const parentRect = canvasContainer.value.parentElement?.getBoundingClientRect() || { left: 0, top: 0 };
      const currentX = rect.left - parentRect.left;
      const currentY = rect.top - parentRect.top;
      
      // 对齐到网格并保存
      const alignedX = snapToGrid(currentX);
      const alignedY = snapToGrid(currentY);
      props.canvasElement.setContainerPosition(alignedX, alignedY);
    }
    
    // 恢复文本选择
    document.body.style.userSelect = '';
    document.body.style.cursor = '';
  }
  
  // 处理调整大小结束
  if (isResizing.value) {
    isResizing.value = false;
    resizeDirection.value = '';
    
    // 保存当前位置到 CanvasElement 对象（调整大小可能改变位置）
    if (canvasContainer.value && props.canvasElement) {
      const rect = canvasContainer.value.getBoundingClientRect();
      const parentRect = canvasContainer.value.parentElement?.getBoundingClientRect() || { left: 0, top: 0 };
      const currentX = rect.left - parentRect.left;
      const currentY = rect.top - parentRect.top;
      
      // 对齐到网格并保存
      const alignedX = snapToGrid(currentX);
      const alignedY = snapToGrid(currentY);
      props.canvasElement.setContainerPosition(alignedX, alignedY);
    }
    
    // 恢复文本选择
    document.body.style.userSelect = '';
    document.body.style.cursor = '';
  }
}

function getResizeCursor(direction: string): string {
  const cursors: Record<string, string> = {
    'n': 'ns-resize',
    's': 'ns-resize',
    'w': 'ew-resize',
    'e': 'ew-resize',
    'nw': 'nwse-resize',
    'ne': 'nesw-resize',
    'sw': 'nesw-resize',
    'se': 'nwse-resize',
  };
  return cursors[direction] || 'default';
}

// 应用保存的容器位置
function applyContainerPosition() {
  if (!canvasContainer.value || !props.canvasElement) return;
  
  const savedX = props.canvasElement.containerX;
  const savedY = props.canvasElement.containerY;
  
  // 如果有保存的位置，应用它
  if (savedX !== 0 || savedY !== 0) {
    const currentPosition = window.getComputedStyle(canvasContainer.value).position;
    if (currentPosition === 'static') {
      canvasContainer.value.style.position = 'relative';
    }
    canvasContainer.value.style.left = savedX + 'px';
    canvasContainer.value.style.top = savedY + 'px';
  }
}

// 将画布对齐到网格
function alignCanvasToGrid() {
  if (!canvasContainer.value || !props.canvasElement) return;
  
  // 获取当前位置和尺寸
  const rect = canvasContainer.value.getBoundingClientRect();
  const parentRect = canvasContainer.value.parentElement?.getBoundingClientRect() || { left: 0, top: 0 };
  
  const currentRect = {
    x: rect.left - parentRect.left,
    y: rect.top - parentRect.top,
    width: canvasWidth.value,
    height: canvasHeight.value
  };
  
  // 对齐到网格
  const alignedRect = snapRectToGrid(currentRect);
  
  // 更新画布大小
  if (alignedRect.width !== currentRect.width || alignedRect.height !== currentRect.height) {
    props.canvasElement.setCanvasSize(alignedRect.width, alignedRect.height);
  }
  
  // 更新画布位置
  if (alignedRect.x !== currentRect.x || alignedRect.y !== currentRect.y) {
    const currentPosition = window.getComputedStyle(canvasContainer.value).position;
    if (currentPosition === 'static') {
      canvasContainer.value.style.position = 'relative';
    }
    canvasContainer.value.style.left = alignedRect.x + 'px';
    canvasContainer.value.style.top = alignedRect.y + 'px';
    
    // 保存对齐后的位置
    props.canvasElement.setContainerPosition(alignedRect.x, alignedRect.y);
  }
}
</script>

<style scoped>
.canvas-container {
  display: block;
  overflow: visible;
  background-color: #ffffff;
  position: relative;
  box-sizing: border-box;
}

.canvas-container.edit-mode {
  overflow: visible;
}

.canvas-container {
  cursor: grab;
}

.canvas-container:active {
  cursor: grabbing;
}

/* 编辑模式下禁止拖拽移动 */
.edit-mode .canvas-container {
  cursor: default !important;
}

.edit-mode .canvas-container:hover {
  cursor: default !important;
}

.edit-mode .canvas-container:active {
  cursor: default !important;
}

.svg-wrapper {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 1;
  pointer-events: none;
}

.canvas-container svg {
  display: block;
  width: 100%;
  height: 100%;
  position: absolute;
  top: 0;
  left: 0;
  z-index: 1;
  pointer-events: auto;
}

.edit-mode .svg-wrapper {
  pointer-events: none;
}

.edit-mode .svg-wrapper svg {
  pointer-events: none;
}

.edit-mode .svg-wrapper svg .canvas-content {
  pointer-events: auto;
}

/* 调整大小手柄 */
.resize-handle {
  position: absolute;
  background-color: rgba(59, 130, 246, 0.8) !important;
  border: 2px solid rgba(59, 130, 246, 1) !important;
  z-index: 9999 !important;
  transition: background-color 0.2s;
  pointer-events: auto !important;
  box-shadow: 0 0 6px rgba(59, 130, 246, 1);
  min-width: 8px;
  min-height: 8px;
}

.resize-handle:hover {
  background-color: rgba(59, 130, 246, 0.5);
}

/* 边缘手柄 */
.resize-handle-n,
.resize-handle-s {
  left: 0;
  right: 0;
  height: 8px;
  cursor: ns-resize;
}

.resize-handle-n {
  top: 0;
  border-bottom: none;
  border-radius: 4px 4px 0 0;
}

.resize-handle-s {
  bottom: 0;
  border-top: none;
  border-radius: 0 0 4px 4px;
}

.resize-handle-w,
.resize-handle-e {
  top: 0;
  bottom: 0;
  width: 8px;
  cursor: ew-resize;
}

.resize-handle-w {
  left: 0;
  border-right: none;
  border-radius: 4px 0 0 4px;
}

.resize-handle-e {
  right: 0;
  border-left: none;
  border-radius: 0 4px 4px 0;
}

/* 角落手柄 */
.resize-handle-nw,
.resize-handle-ne,
.resize-handle-sw,
.resize-handle-se {
  width: 12px;
  height: 12px;
  border-radius: 50%;
}

.resize-handle-nw {
  top: 0;
  left: 0;
  cursor: nwse-resize;
}

.resize-handle-ne {
  top: 0;
  right: 0;
  cursor: nesw-resize;
}

.resize-handle-sw {
  bottom: 0;
  left: 0;
  cursor: nesw-resize;
}

.resize-handle-se {
  bottom: 0;
  right: 0;
  cursor: nwse-resize;
}
</style>

