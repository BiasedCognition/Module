<template>
  <div 
    ref="canvasContainer"
    class="canvas-container"
    :data-element-id="canvasElement?.elementId || ''"
    :style="{
      width: canvasWidth + 'px',
      height: canvasHeight + 'px',
      backgroundColor: backgroundColor,
    }"
    @click="handleClick"
    @dblclick="handleDoubleClick"
  ></div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import * as d3 from 'd3';
import type { CanvasElement } from '../Object/canvasElement';

// Props 定义
const props = defineProps<{
  canvasElement: CanvasElement;
  mode: 'view' | 'edit';
}>();

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
let svg: d3.Selection<SVGSVGElement, unknown, null, undefined> | null = null;
let zoomBehavior: d3.ZoomBehavior<SVGElement, unknown> | null = null;

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
  }
});

// 监听属性变化
watch([canvasWidth, canvasHeight], () => {
  if (svg && canvasContainer.value) {
    svg
      .attr('width', canvasWidth.value)
      .attr('height', canvasHeight.value)
      .attr('viewBox', `0 0 ${canvasWidth.value} ${canvasHeight.value}`);
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
});

function initializeCanvas() {
  if (!canvasContainer.value) return;

  // 清除现有内容
  canvasContainer.value.innerHTML = '';

  // 创建 SVG
  svg = d3
    .select(canvasContainer.value)
    .append('svg')
    .attr('width', canvasWidth.value)
    .attr('height', canvasHeight.value)
    .attr('viewBox', `0 0 ${canvasWidth.value} ${canvasHeight.value}`)
    .style('display', 'block')
    .style('cursor', 'grab');

  // 创建可缩放和可平移的组
  const g = svg.append('g').attr('class', 'canvas-content');

  // 设置初始变换
  g.attr('transform', `translate(${translateX.value}, ${translateY.value}) scale(${zoomLevel.value})`);

  // 创建缩放行为
  if (props.canvasElement?.zoomable) {
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
</script>

<style scoped>
.canvas-container {
  display: inline-block;
  overflow: hidden;
  background-color: #ffffff;
}

.canvas-container svg {
  display: block;
  width: 100%;
  height: 100%;
}
</style>

