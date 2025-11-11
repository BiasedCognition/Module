<template>
  <div class="textbox-wrapper">
    <!-- 操作工具栏 -->
    <div class="textbox-toolbar">
      <!-- 右侧模式切换按钮 -->
      <div class="mode-controls">
        <template-button
          v-if="actionButtons.find(btn => btn.type === 'mode')"
          :label="''"
          type="mode"
          v-model="buttonStates['mode']"
          @click="handleToolbarButtonClick"
          class="icon-button mode-button"
        >
          <span class="button-icon" :class="currentMode === 'edit' ? 'icon-eye' : 'icon-edit'"></span>
        </template-button>
      </div>
    </div>
    
    <!-- 元素容器区域 -->
    <div class="textbox-content">
      <div class="elements-container">
        <template v-if="elements.length > 0">
          <element-component
            v-for="element in elements"
            :key="element.elementId"
            :element="element"
            :mode="currentMode"
            @click="handleElementClick"
            @dblclick="handleElementDoubleClick"
            @remove="handleElementRemove"
            @split="handleElementSplit"
          ></element-component>
        </template>
        <div v-else class="empty-state">
          {{ placeholder }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, reactive, inject } from 'vue';
import { Textbox } from '../Object/textbox';
import { ObjectBase } from '../Object/object';
import { Element } from '../Object/element';
import TemplateButton from './Button.vue';
import ElementComponent from './Element.vue';

// Props 定义
interface Props {
  mode?: 'view' | 'edit';
  placeholder?: string;
  disabled?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  mode: 'view',
  placeholder: '暂无元素，请添加元素...',
  disabled: false
});

// 注入注册元素双击事件的方法
const registerElement = inject<(element: HTMLElement, object: ObjectBase) => () => void>('registerElement');
let cleanupDoubleClick: (() => void) | null = null;

// Emits 定义
const emit = defineEmits<{
  (e: 'mode-change', mode: 'view' | 'edit'): void;
  (e: 'element-add', element: Element): void;
  (e: 'element-remove', elementId: string): void;
  (e: 'element-click', element: Element): void;
  (e: 'element-dblclick', element: Element): void;
  (e: 'elements-change', elements: Element[]): void;
}>();

// 内部状态
const textboxInstance = ref<Textbox>();
const currentMode = ref<'view' | 'edit'>(props.mode);
const buttonStates = reactive<Record<string, boolean>>({
  mode: false
});
const elements = ref<Element[]>([]);

// 计算属性
const actionButtons = computed(() => {
  if (!textboxInstance.value) return [];
  return textboxInstance.value.getActionButtons();
});

const mode = computed(() => currentMode.value);

// 获取按钮图标类名
function getButtonIcon(buttonType: string): string {
  return 'icon-default';
}

// 初始化Textbox实例
onMounted(() => {
  textboxInstance.value = new Textbox();
  textboxInstance.value.mode = props.mode;
  currentMode.value = props.mode;
  
  // 初始化按钮状态
  updateButtonStates();
  
  // 更新元素列表
  updateElementsList();
  
  // 注册双击事件 - 注释掉为textbox容器注册的双击事件，避免与元素的双击事件冲突
  // 这样双击元素时只会触发元素自身的dblclick事件，侧边栏将显示元素内容而不是textbox内容
});

// 组件卸载时清理事件监听
onUnmounted(() => {
  if (cleanupDoubleClick) {
    cleanupDoubleClick();
    cleanupDoubleClick = null;
  }
});

// 更新按钮状态
function updateButtonStates() {
  if (!textboxInstance.value) return;
  
  const buttons = textboxInstance.value.getActionButtons();
  buttons.forEach(button => {
    buttonStates[button.type] = button.isActive;
  });
}

// 更新元素列表
function updateElementsList() {
  if (!textboxInstance.value) return;
  elements.value = textboxInstance.value.getElements();
  emit('elements-change', elements.value);
}

watch(() => props.mode, (newMode) => {
  currentMode.value = newMode;
  if (textboxInstance.value) {
    textboxInstance.value.mode = newMode;
  }
});

// 监听按钮状态变化
watch(
  () => Object.values(buttonStates),
  () => {
    // 当按钮状态变化时，可以在这里添加额外的逻辑
  },
  { deep: true }
);

// 添加元素
function addElement(element: Element) {
  if (!textboxInstance.value || props.disabled) return;
  
  textboxInstance.value.addElement(element);
  updateElementsList();
  emit('element-add', element);
}

// 移除元素
function removeElement(elementId: string) {
  if (!textboxInstance.value || props.disabled) return;
  
  textboxInstance.value.removeElement(elementId);
  updateElementsList();
  emit('element-remove', elementId);
}

// 清空所有元素
function clearElements() {
  if (!textboxInstance.value || props.disabled) return;
  
  textboxInstance.value.clearElements();
  updateElementsList();
}

// 处理元素点击
function handleElementClick(element: Element) {
  emit('element-click', element);
}

// 处理元素双击
function handleElementDoubleClick(element: Element) {
  emit('element-dblclick', element);
}

// 处理元素移除
function handleElementRemove(elementId: string) {
  removeElement(elementId);
}

interface ElementSplitPayload {
  element: Element;
  beforeText: string;
  afterText: string;
}

function handleElementSplit(payload: ElementSplitPayload) {
  if (!textboxInstance.value || props.disabled) return;
  const { element, beforeText, afterText } = payload;
  const newElement = textboxInstance.value.splitElement(element, beforeText, afterText);
  updateElementsList();
  if (newElement) {
    emit('element-add', newElement);
  }
}

// 处理工具栏按钮点击
function handleToolbarButtonClick(event: MouseEvent, button: any) {
  if (!textboxInstance.value || props.disabled) return;
  
  const buttonType = button.type;
  textboxInstance.value.triggerButtonClick(buttonType);
  
  // 更新按钮状态
  updateButtonStates();
  
  // 发送模式变更事件
  if (buttonType === 'mode') {
    currentMode.value = textboxInstance.value.mode;
    emit('mode-change', currentMode.value);
  }
}

// 暴露方法给父组件
defineExpose({
  getInstance: (): Textbox | undefined => textboxInstance.value,
  toggleMode: () => {
    if (textboxInstance.value && !props.disabled) {
      textboxInstance.value.toggleMode();
      currentMode.value = textboxInstance.value.mode;
      emit('mode-change', currentMode.value);
    }
  },
  addElement: (element: Element) => {
    addElement(element);
  },
  removeElement: (elementId: string) => {
    removeElement(elementId);
  },
  clearElements: () => {
    clearElements();
  },
  getElements: (): Element[] => {
    return elements.value;
  },
  getMode: (): 'view' | 'edit' => currentMode.value
});
</script>

<style scoped>
.textbox-wrapper {
  border: 1px solid rgba(148, 163, 184, 0.35);
  border-radius: 10px;
  overflow: hidden;
  background: #ffffff;
  box-shadow: none;
}

/* 工具栏样式 */
.textbox-toolbar {
  display: flex;
  align-items: center;
  padding: 6px 10px;
  background: rgba(148, 163, 184, 0.08);
  border-bottom: 1px solid rgba(148, 163, 184, 0.2);
  gap: 6px;
  min-height: 34px;
}

/* 格式按钮区域 - 已移除 */
.format-buttons {
  display: none;
}

/* 模式控制区域 - 靠右 */
.mode-controls {
  margin-left: auto;
}

/* 图标按钮样式 */
.icon-button {
  width: 28px;
  height: 28px;
  padding: 4px;
  min-width: auto;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  transition: all 0.15s ease;
}

.icon-button:hover {
  background: #e3f2fd;
  transform: none;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
}

.icon-button.active {
  background: #bbdefb;
  color: #1976d2;
  box-shadow: 0 1px 3px rgba(25, 118, 210, 0.2);
}

/* 模式按钮特殊样式 */
.mode-button {
  border-left: 1px solid #e0e0e0;
  margin-left: 4px;
  padding-left: 8px;
}

/* 按钮图标样式 */
.button-icon {
  width: 16px;
  height: 16px;
  display: inline-block;
  position: relative;
  font-weight: bold;
  text-align: center;
}

/* 加粗图标 */
.icon-bold::before {
  content: 'B';
  font-weight: bold;
  font-size: 14px;
}

/* 斜体图标 */
.icon-italic::before {
  content: 'I';
  font-style: italic;
  font-size: 14px;
}

/* 下划线图标 */
.icon-underline::before {
  content: 'U';
  text-decoration: underline;
  font-size: 14px;
}

/* 编辑图标 */
.icon-edit::before {
  content: '✎';
  font-size: 12px;
}

/* 查看图标 */
.icon-eye::before {
  content: '👁';
  font-size: 12px;
}

/* 内容区域样式 */
.textbox-content {
  position: relative;
  min-height: 150px;
}

/* 元素容器样式 */
.elements-container {
  width: 100%;
  min-height: 150px;
  padding: 12px 10px;
  display: flex;
  flex-wrap: wrap;
  gap: 4px 6px;
  align-content: flex-start;
  align-items: flex-start;
}

/* 元素组件样式覆盖 */
.elements-container :deep(.element-component) {
  margin: 0;
}

/* 空状态样式 */
.empty-state {
  width: 100%;
  min-height: 120px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #a1a1aa;
  font-style: italic;
  border-radius: 6px;
  background-color: rgba(148, 163, 184, 0.08);
  transition: background-color 0.2s ease, color 0.2s ease;
}

.elements-container:hover .empty-state {
  background-color: rgba(59, 130, 246, 0.08);
  color: #64748b;
}
</style>