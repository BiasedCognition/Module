<template>
  <div 
    ref="rootRef"
    class="var-element-component"
    :data-element-id="varElementRef?.elementId || ''"
    @click="handleClick"
    @dblclick="handleDoubleClick"
    @mouseenter="handleMouseEnter"
    @mouseleave="handleMouseLeave"
  >
    <div
      class="var-element-display-text"
      :style="{ color: textColor, backgroundColor: backgroundColor }"
    >
      {{ displayText }}
    </div>
    
    <!-- 悬浮显示类型提示 -->
    <div
      v-if="showTypeTooltip"
      ref="tooltipRef"
      class="var-element-type-tooltip"
      :style="tooltipStyle"
    >
      {{ objectType }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, inject } from 'vue';
import type { ObjectBase } from '../Object/object';
import { useEventNode, NotesChannels } from '@/Event';
import { VarElement } from '../Object/varElement';

// Props定义
const props = defineProps<{
  varElement?: VarElement;
  mode: 'view' | 'edit';
}>();

const varElementRef = computed(() => props.varElement);

const isReadOnly = computed(() => props.mode === 'view');

const displayText = computed(() => {
  const current = varElementRef.value;
  return current?.displayText || '';
});

const textColor = computed(() => {
  const current = varElementRef.value;
  return current && typeof current.textColor === 'string'
    ? current.textColor
    : '#1f2937';
});

const backgroundColor = computed(() => {
  const current = varElementRef.value;
  if (current) {
    if (typeof current.getBackgroundColor === 'function') {
      return current.getBackgroundColor();
    }
    if (typeof current.backgroundColor === 'string') {
      return current.backgroundColor;
    }
  }
  return '#e5e7eb';
});

const objectType = computed(() => {
  const current = varElementRef.value;
  if (!current) return '';
  
  // 更新对象元素列表
  if (typeof current.updateObjectElements === 'function') {
    current.updateObjectElements();
  }
  
  return current.objectType || '对象';
});

// Emits定义
const emit = defineEmits<{
  'click': [element: VarElement];
  'dblclick': [element: VarElement];
}>();

const registerElement = inject<(element: HTMLElement, object: ObjectBase) => () => void>('registerElement');
const rootRef = ref<HTMLElement | null>(null);
const tooltipRef = ref<HTMLElement | null>(null);
let cleanupDoubleClick: (() => void) | null = null;
const eventNode = useEventNode({ tags: ['var-element'] });

// 悬浮提示相关
const showTypeTooltip = ref(false);
const tooltipStyle = ref<{ top: string; left: string }>({ top: '0px', left: '0px' });

// 方法
const handleClick = () => {
  const el = varElementRef.value;
  if (!el) return;
  emit('click', el);
  eventNode.emit(NotesChannels.ELEMENT_CLICK, { element: el, varElement: el });
};

const handleDoubleClick = () => {
  const el = varElementRef.value;
  if (!el) return;
  emit('dblclick', el);
  eventNode.emit(NotesChannels.ELEMENT_DOUBLE_CLICK, { element: el, varElement: el });
};

// 鼠标进入，显示类型提示
const handleMouseEnter = () => {
  showTypeTooltip.value = true;
  updateTooltipPosition();
};

// 鼠标离开，隐藏类型提示
const handleMouseLeave = () => {
  showTypeTooltip.value = false;
};

// 更新提示框位置
const updateTooltipPosition = () => {
  if (!rootRef.value || !tooltipRef.value) return;
  
  const rect = rootRef.value.getBoundingClientRect();
  const tooltipRect = tooltipRef.value.getBoundingClientRect();
  
  // 计算提示框位置（在元素上方居中）
  const left = rect.left + (rect.width - tooltipRect.width) / 2;
  const top = rect.top - tooltipRect.height - 8; // 8px 间距
  
  tooltipStyle.value = {
    left: `${left}px`,
    top: `${top}px`,
  };
};

// 监听属性变化
watch(() => varElementRef.value, () => {
  if (!registerElement) return;
  cleanupDoubleClick?.();
  if (rootRef.value && varElementRef.value) {
    cleanupDoubleClick = registerElement(rootRef.value, varElementRef.value as ObjectBase);
  }
});

watch(() => showTypeTooltip.value, (show) => {
  if (show) {
    // 使用 nextTick 确保 DOM 已更新
    setTimeout(() => {
      updateTooltipPosition();
    }, 0);
  }
});

onMounted(() => {
  if (registerElement && rootRef.value) {
    cleanupDoubleClick = registerElement(rootRef.value, varElementRef.value as ObjectBase);
  }
});

onUnmounted(() => {
  cleanupDoubleClick?.();
  cleanupDoubleClick = null;
});
</script>

<style scoped>
.var-element-component {
  display: inline-flex;
  cursor: pointer;
  user-select: none;
  max-width: 100%;
  position: relative;
}

.var-element-display-text {
  display: inline-block;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  border-radius: 4px;
  font-family: inherit;
  font-size: 0.9em;
  line-height: 1.4;
  background-color: #e5e7eb;
  color: #1f2937;
  transition: background-color 0.2s ease, color 0.2s ease;
  white-space: nowrap;
  overflow: hidden;
  max-width: 100%;
}

.var-element-display-text:hover {
  background-color: rgba(33, 150, 243, 0.15);
  color: #0f172a;
}

.var-element-type-tooltip {
  position: fixed;
  background-color: rgba(0, 0, 0, 0.75);
  color: white;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 0.75em;
  pointer-events: none;
  z-index: 10000;
  white-space: nowrap;
  opacity: 0.9;
  backdrop-filter: blur(4px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
}

.var-element-component:active .var-element-display-text {
  background-color: rgba(33, 150, 243, 0.22);
}
</style>



