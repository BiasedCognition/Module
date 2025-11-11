<template>
  <button
    @click="handleClick"
    class="template-button"
    :class="{ active: isActive }"
    :disabled="disabled"
    v-bind:class="$attrs.class"
  >
    <slot v-if="$slots.default">{{ $slots.default() }}</slot>
    <span v-else>{{ label }}</span>
  </button>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted, inject } from 'vue';
import { tButton } from '../Object/Button';
import { ObjectBase } from '../Object/object';

// Props 定义
interface Props {
  label?: string;
  type?: string;
  disabled?: boolean;
  modelValue?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  label: '按钮',
  type: 'default',
  disabled: false,
  modelValue: false
});

// Emits 定义
const emit = defineEmits<{
  (e: 'click', event: MouseEvent, button: tButton): void;
  (e: 'update:modelValue', value: boolean): void;
  (e: 'signal', signal: string, data: any): void;
}>();

// 注入注册元素双击事件的方法
const registerElement = inject<(element: HTMLElement, object: ObjectBase) => () => void>('registerElement');
let cleanupDoubleClick: (() => void) | null = null;

// 内部状态
const buttonInstance = ref<tButton>();
const isActive = ref(props.modelValue);

// 初始化按钮实例
onMounted(() => {
  buttonInstance.value = new tButton(props.label, props.type);
  buttonInstance.value.isActive = props.modelValue;
  
  // 监听内部状态变化
  buttonInstance.value.on('button_click', (sender, data) => {
    emit('signal', `button_${props.type}_click`, data);
  });
  
  // 注册双击事件
  if (registerElement && buttonInstance.value) {
    // 使用setTimeout确保DOM已经渲染
    setTimeout(() => {
      const buttonElement = document.querySelector('.template-button');
      if (buttonElement && buttonElement instanceof HTMLElement) {
        cleanupDoubleClick = registerElement(buttonElement, buttonInstance.value!);
      }
    }, 0);
  }
});

// 组件卸载时清理事件监听
onUnmounted(() => {
  if (cleanupDoubleClick) {
    cleanupDoubleClick();
    cleanupDoubleClick = null;
  }
});

// 监听props变化
watch(() => props.label, (newLabel) => {
  if (buttonInstance.value) {
    buttonInstance.value.label = newLabel;
  }
});

watch(() => props.type, (newType) => {
  if (buttonInstance.value) {
    buttonInstance.value.type = newType;
  }
});

watch(() => props.modelValue, (newValue) => {
  isActive.value = newValue;
  if (buttonInstance.value) {
    buttonInstance.value.isActive = newValue;
  }
});

// 处理点击事件
function handleClick(event: MouseEvent) {
  if (props.disabled || !buttonInstance.value) return;
  
  buttonInstance.value.click();
  isActive.value = buttonInstance.value.isActive;
  
  emit('click', event, buttonInstance.value);
  emit('update:modelValue', isActive.value);
}

// 暴露方法给父组件
defineExpose({
  getInstance: (): tButton | undefined => buttonInstance.value,
  relate: (target: ObjectBase) => {
    if (buttonInstance.value) {
      buttonInstance.value.relate(target);
    }
  },
  unrelate: (target: ObjectBase) => {
    if (buttonInstance.value) {
      buttonInstance.value.unrelate(target);
    }
  },
  broadcastToRelatedActiveObjects: (activeObjects: ObjectBase[]) => {
    if (buttonInstance.value) {
      buttonInstance.value.broadcastToRelatedActiveObjects(activeObjects);
    }
  }
});
</script>

<style scoped>
.template-button {
  padding: 8px 16px;
  background: #4285f4;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  transition: all 0.2s ease;
  outline: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 64px;
  height: 36px;
  position: relative;
}

/* 允许被继承的样式 */
:slotted(*) {
  color: inherit;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.template-button:hover:not(:disabled) {
  background: #3367d6;
  transform: translateY(-1px);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

.template-button:active:not(:disabled) {
  transform: translateY(0);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
}

.template-button.active {
  background: #1a73e8;
  box-shadow: 0 2px 8px rgba(26, 115, 232, 0.3);
}

.template-button:disabled {
  background: #cccccc;
  color: #666666;
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}
</style>