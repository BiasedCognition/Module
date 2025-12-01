<template>
  <div 
    ref="wrapperRef"
    class="textbox-wrapper"
    :class="{ 'textbox-active': isActive, 'edit-mode': currentMode === 'edit' }"
    @click="handleWrapperClick"
    @mousedown="handleMouseDown"
  >
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

        <!-- 手动刷新重排 -->
        <template-button
          :label="''"
          type="reflow"
          class="icon-button"
          @click="handleManualReflow"
        >
          <span class="button-icon" title="刷新重排">↻</span>
        </template-button>

        <!-- 自动刷新开关 -->
        <template-button
          :label="''"
          type="auto-reflow"
          class="icon-button"
          @click="toggleAutoReflow"
          :class="{ active: autoReflowEnabled }"
        >
          <span class="button-icon" :title="autoReflowEnabled ? '关闭自动刷新' : '开启自动刷新'">⚙</span>
        </template-button>

        <!-- 添加 VarElement -->
        <template-button
          :label="''"
          type="add-var"
          class="icon-button"
          @click="handleAddVarElement"
        >
          <span class="button-icon" title="添加变量元素">𝑉</span>
        </template-button>
      </div>
    </div>
    
    <!-- 元素容器区域 -->
    <div class="textbox-content">
      <div class="elements-container" ref="containerRef">
        <template v-if="elements.length > 0">
          <template v-for="element in elements" :key="element.elementId">
            <!-- 根据元素类型渲染不同的组件 -->
            <element-component
              v-if="element.type === 'text-element'"
              :textElement="element"
              :mode="currentMode"
              @click="handleElementClick"
              @dblclick="handleElementDoubleClick"
              @remove="handleElementRemove"
              @split="handleElementSplit"
            ></element-component>
            <var-element-component
              v-else-if="element.type === 'var-element'"
              :varElement="element as VarElement"
              :mode="currentMode"
              @click="handleElementClick"
              @dblclick="handleElementDoubleClick"
            ></var-element-component>
          </template>
        </template>
        <div v-else class="empty-state">
          {{ placeholder }}
        </div>
      </div>
    </div>

    <!-- 调整大小手柄 - 仅在编辑模式下显示 -->
    <div 
      v-if="currentMode === 'edit'"
      class="resize-handle resize-handle-n"
      @mousedown.stop="startResize($event, 'n')"
    ></div>
    <div 
      v-if="currentMode === 'edit'"
      class="resize-handle resize-handle-s"
      @mousedown.stop="startResize($event, 's')"
    ></div>
    <div 
      v-if="currentMode === 'edit'"
      class="resize-handle resize-handle-w"
      @mousedown.stop="startResize($event, 'w')"
    ></div>
    <div 
      v-if="currentMode === 'edit'"
      class="resize-handle resize-handle-e"
      @mousedown.stop="startResize($event, 'e')"
    ></div>
    <div 
      v-if="currentMode === 'edit'"
      class="resize-handle resize-handle-nw"
      @mousedown.stop="startResize($event, 'nw')"
    ></div>
    <div 
      v-if="currentMode === 'edit'"
      class="resize-handle resize-handle-ne"
      @mousedown.stop="startResize($event, 'ne')"
    ></div>
    <div 
      v-if="currentMode === 'edit'"
      class="resize-handle resize-handle-sw"
      @mousedown.stop="startResize($event, 'sw')"
    ></div>
    <div 
      v-if="currentMode === 'edit'"
      class="resize-handle resize-handle-se"
      @mousedown.stop="startResize($event, 'se')"
    ></div>

  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, reactive, inject, nextTick } from 'vue';
import { Textbox, type TextboxElement } from '../Object/textbox';
import { ObjectBase } from '../Object/object';
import { TextElement as Element } from '../Object/textElement';
import { VarElement } from '../Object/varElement';
import TemplateButton from './Button.vue';
import ElementComponent from './Element.vue';
import VarElementComponent from './VarElement.vue';
import {
  useEventNode,
  NotesChannels,
} from '@/Event';
import { snapToGrid, snapRectToGrid, GRID_SIZE } from '@/utils/gridAlign';

// Props 定义
interface Props {
  mode?: 'view' | 'edit';
  placeholder?: string;
  disabled?: boolean;
  textboxInstance?: Textbox;
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
  (e: 'element-add', element: TextboxElement): void;
  (e: 'element-remove', elementId: string): void;
  (e: 'element-click', element: TextboxElement): void;
  (e: 'element-dblclick', element: TextboxElement): void;
  (e: 'elements-change', elements: TextboxElement[]): void;
}>();

// 内部状态
const textboxInstance = ref<Textbox>();
const currentMode = ref<'view' | 'edit'>(props.mode);
const buttonStates = reactive<Record<string, boolean>>({
  mode: false
});
const elements = ref<TextboxElement[]>([]);
const eventNode = useEventNode({ tags: ['textbox'] });
const containerRef = ref<HTMLElement | null>(null);
const wrapperRef = ref<HTMLElement | null>(null);
const autoReflowEnabled = ref(false);
const lastAddedElementId = ref<string | null>(null);
const textboxId = ref<string>(`textbox_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);
const isActive = ref(false);

// 拖拽和调整大小相关状态
const isDragging = ref(false);
const isResizing = ref(false);
const resizeDirection = ref('');
const dragStartX = ref(0);
const dragStartY = ref(0);
const dragStartLeft = ref(0);
const dragStartTop = ref(0);
const resizeStartX = ref(0);
const resizeStartY = ref(0);
const resizeStartWidth = ref(0);
const resizeStartHeight = ref(0);
const resizeStartLeft = ref(0);
const resizeStartTop = ref(0);

// 计算属性
const actionButtons = computed(() => {
  if (!textboxInstance.value) return [];
  return textboxInstance.value.getActionButtons();
});

const mode = computed(() => currentMode.value);
const containerWidth = computed(() => textboxInstance.value?.containerWidth || 400);
const containerHeight = computed(() => textboxInstance.value?.containerHeight || 200);

// 获取按钮图标类名
function getButtonIcon(buttonType: string): string {
  return 'icon-default';
}

// 初始化Textbox实例
onMounted(() => {
  // 优先使用传入的实例，否则创建新实例
  if (props.textboxInstance) {
    textboxInstance.value = props.textboxInstance;
  } else {
    textboxInstance.value = new Textbox();
  }
  textboxInstance.value.mode = props.mode;
  currentMode.value = props.mode;
  
  // 初始化按钮状态
  updateButtonStates();
  
  // 更新元素列表
  updateElementsList();
  
  // 应用保存的容器设置
  nextTick(() => {
    applyContainerSettings();
    alignTextboxToGrid();
  });
  
  // 添加全局鼠标事件监听
  document.addEventListener('mousemove', handleMouseMove);
  document.addEventListener('mouseup', handleMouseUp);
  
  // 添加键盘事件监听（快捷键）
  document.addEventListener('keydown', handleKeyDown);
  
  // 监听激活/取消激活事件
  eventNode.on(NotesChannels.TEXTBOX_ACTIVATE, ({ payload }) => {
    const { textboxId: id } = payload as any;
    isActive.value = id === textboxId.value;
  });
  
  eventNode.on(NotesChannels.TEXTBOX_DEACTIVATE, ({ payload }) => {
    const { textboxId: id } = payload as any;
    if (id === textboxId.value) {
      isActive.value = false;
    }
  });
  
  // 监听添加元素请求
  eventNode.on(NotesChannels.TEXTBOX_ADD_ELEMENT_REQUEST, ({ payload }) => {
    const { textboxId: id } = payload as any;
    if (id === textboxId.value) {
      addNewElement();
    }
  });
  
  // 监听元素合并事件
  eventNode.on(NotesChannels.ELEMENT_MERGE, ({ payload }) => {
    const { sourceElementId, targetElementId } = payload as any;
    if (!textboxInstance.value) return;
    
    // 检查两个元素是否都在当前 textbox 中
    const sourceExists = textboxInstance.value.getElements().some(el => el.elementId === sourceElementId);
    const targetExists = textboxInstance.value.getElements().some(el => el.elementId === targetElementId);
    
    if (sourceExists && targetExists) {
      const success = textboxInstance.value.mergeElements(sourceElementId, targetElementId);
      if (success) {
        updateElementsList();
        eventNode.emit(NotesChannels.ELEMENTS_CHANGE, { elements: elements.value });
      }
    }
  });
});

// 组件卸载时清理事件监听
onUnmounted(() => {
  if (cleanupDoubleClick) {
    cleanupDoubleClick();
    cleanupDoubleClick = null;
  }
  
  // 清理全局鼠标事件监听
  document.removeEventListener('mousemove', handleMouseMove);
  document.removeEventListener('mouseup', handleMouseUp);
  
  // 清理键盘事件监听
  document.removeEventListener('keydown', handleKeyDown);
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
  // @ts-ignore - TypeScript 无法正确推断联合类型
  elements.value = textboxInstance.value.getElements();
  // @ts-ignore
  emit('elements-change', elements.value);
  // @ts-ignore
  eventNode.emit(NotesChannels.ELEMENTS_CHANGE, { elements: elements.value });
  if (autoReflowEnabled.value) {
    // 在 DOM 更新后尝试重排，最多数次以避免死循环
    nextTick(() => reflowUntilStable(6));
  }
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
function addElement(element: TextboxElement) {
  if (!textboxInstance.value || props.disabled) return;
  
  textboxInstance.value.addElement(element);
  updateElementsList();
  emit('element-add', element);
  eventNode.emit(NotesChannels.ELEMENT_ADD, { element, textElement: element });
}

// 移除元素
function removeElement(elementId: string) {
  if (!textboxInstance.value || props.disabled) return;
  
  textboxInstance.value.removeElement(elementId);
  updateElementsList();
  emit('element-remove', elementId);
  eventNode.emit(NotesChannels.ELEMENT_REMOVE, { elementId });
}

// 清空所有元素
function clearElements() {
  if (!textboxInstance.value || props.disabled) return;
  
  textboxInstance.value.clearElements();
  updateElementsList();
}

// 处理元素点击
function handleElementClick(element: TextboxElement) {
  emit('element-click', element);
  eventNode.emit(NotesChannels.ELEMENT_CLICK, { element, textElement: element });
}

// 处理元素双击
function handleElementDoubleClick(element: TextboxElement) {
  emit('element-dblclick', element);
  eventNode.emit(NotesChannels.ELEMENT_DOUBLE_CLICK, { element, textElement: element });
}

// 处理元素移除
function handleElementRemove(elementId: string) {
  removeElement(elementId);
}

interface ElementSplitPayload {
  element: TextboxElement;
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
    eventNode.emit(NotesChannels.ELEMENT_ADD, { element: newElement, textElement: newElement });
  }
  eventNode.emit(NotesChannels.ELEMENT_SPLIT, { ...payload, textElement: payload.element });
}

// ====== 重排：从前往后尝试将下一行首元素的前缀塞回上一行 ======
function parsePx(v: string | null): number {
  if (!v) return 0;
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
}

function getEffectiveRight(container: HTMLElement): number {
  const rect = container.getBoundingClientRect();
  const cs = getComputedStyle(container);
  const colGap = Math.ceil(parsePx(cs.columnGap) || 0);
  const padRight = parsePx(cs.paddingRight) || 0;
  const borderRight = parsePx(cs.borderRightWidth) || 0;
  const epsilon = colGap + 1;
  return rect.right - padRight - borderRight - epsilon;
}

function groupLinesByTop(items: HTMLElement[]): HTMLElement[][] {
  const lines: HTMLElement[][] = [];
  const threshold = 4; // 容忍像素
  for (const el of items) {
    const rect = el.getBoundingClientRect();
    const top = rect.top;
    const line = lines.find(arr => {
      if (arr.length === 0) return false;
      const t = arr[0].getBoundingClientRect().top;
      return Math.abs(t - top) <= threshold;
    });
    if (line) line.push(el);
    else lines.push([el]);
  }
  return lines.map(l => l.sort((a, b) => a.getBoundingClientRect().left - b.getBoundingClientRect().left));
}

function measureLikeDisplay(text: string, sampleDisplay?: HTMLElement | null): number {
  const span = document.createElement('span');
  span.style.visibility = 'hidden';
  span.style.position = 'absolute';
  span.style.whiteSpace = 'nowrap';
  span.style.pointerEvents = 'none';
  span.textContent = text || '';
  document.body.appendChild(span);
  let w = span.offsetWidth;
  document.body.removeChild(span);
  // 尽量复用真实样式的水平内边距，弥补 scoped 样式导致的测量偏差
  if (sampleDisplay) {
    const cs = getComputedStyle(sampleDisplay);
    const pl = parsePx(cs.paddingLeft);
    const pr = parsePx(cs.paddingRight);
    w += pl + pr;
  } else {
    // 默认与 .element-display-text 一致的左右 padding 8px
    w += 16;
  }
  return w;
}

function getElementText(el: TextboxElement): string {
  // 尝试从对象读取 displayText
  // @ts-ignore
  return (typeof el.getDisplayText === 'function' ? el.getDisplayText() : (el as any).displayText) ?? '';
}

function setElementText(el: TextboxElement, text: string) {
  if (typeof (el as any).setDisplayText === 'function') {
    (el as any).setDisplayText(text);
  } else {
    // @ts-ignore
    (el as any).displayText = text;
    (el as any).setContent?.(text);
  }
}

function cloneForPrefixFrom(el: TextboxElement, prefix: string): Element {
  // 只支持 TextElement 的克隆
  if (el.type === 'var-element') {
    throw new Error('varElement 不可分割');
  }
  const textColor = typeof (el as any).getTextColor === 'function' ? (el as any).getTextColor() : (el as any).textColor;
  const newEl = new Element();
  setElementText(newEl, prefix);
  if (typeof (newEl as any).setTextColor === 'function') {
    (newEl as any).setTextColor(textColor);
  } else {
    // @ts-ignore
    (newEl as any).textColor = textColor;
  }
  return newEl;
}

function reflowFillPreviousLine() {
  const container = containerRef.value;
  if (!container || !textboxInstance.value) return;
  const nodes = Array.from(container.querySelectorAll<HTMLElement>('.element-component'));
  if (nodes.length === 0) return;

  const lines = groupLinesByTop(nodes);
  if (lines.length <= 1) return;

  const effectiveRight = getEffectiveRight(container);
  const instance = textboxInstance.value;
  let changed = false;

  for (let i = 1; i < lines.length; i++) {
    const prevLine = lines[i - 1];
    const currLine = lines[i];
    if (prevLine.length === 0 || currLine.length === 0) continue;
    const prevRight = Math.max(...prevLine.map(n => n.getBoundingClientRect().right));
    let remaining = Math.floor(effectiveRight - prevRight);
    if (remaining <= 6) continue;

    // 找到当前行第一个元素对应的数据对象
    const firstNode = currLine[0];
    const firstIndex = nodes.indexOf(firstNode);
    if (firstIndex < 0) continue;
    const elementObj = elements.value[firstIndex];
    if (!elementObj) continue;
    const sampleDisplay = firstNode.querySelector('.element-display-text') as HTMLElement | null;

    // 跳过 varElement（不可分割）
    if (elementObj.type === 'var-element') continue;
    
    // @ts-ignore - 已检查类型，确保是 TextElement
    const raw = getElementText(elementObj) ?? '';
    if (!raw) continue;
    // 二分查找最大可放入的前缀
    let lo = 1, hi = raw.length, ans = 0;
    remaining = Math.max(0, remaining - 2); // 安全边距
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      const w = measureLikeDisplay(raw.slice(0, mid), sampleDisplay);
      if (w <= remaining) { ans = mid; lo = mid + 1; } else { hi = mid - 1; }
    }
    if (ans <= 0) continue;
    if (ans >= raw.length) continue;

    const before = raw.slice(0, ans);
    const after = raw.slice(ans);

    // 在数据层插入一个新元素到 firstIndex 之前
    const newEl = cloneForPrefixFrom(elementObj as Element, before);
    instance.elements.splice(firstIndex, 0, newEl);
    // 当前元素文本改为剩余部分
    setElementText(elementObj as Element, after);

    changed = true;
    // 更新视图与事件
    updateElementsList();
    eventNode.emit(NotesChannels.ELEMENT_ADD, { element: newEl });
    eventNode.emit(NotesChannels.ELEMENT_SPLIT, { element: elementObj, beforeText: before, afterText: after });
    break; // 单次移动后退出本轮，避免索引失配；可多次点击继续“刷新”
  }

  if (!changed) {
    // 无可重排，忽略
  }
}

function reflowUntilStable(maxSteps = 6) {
  let steps = 0;
  const run = () => {
    if (steps >= maxSteps) return;
    const before = containerRef.value?.innerHTML.length ?? 0;
    reflowFillPreviousLine();
    nextTick(() => {
      const after = containerRef.value?.innerHTML.length ?? 0;
      steps += 1;
      // 粗略检测是否有结构变化；若有，继续下一轮
      if (before !== after) run();
    });
  };
  run();
}

function handleManualReflow() {
  reflowUntilStable(6);
}

function toggleAutoReflow() {
  autoReflowEnabled.value = !autoReflowEnabled.value;
}

// 处理 textbox 容器点击：激活当前 textbox
function handleWrapperClick(event: MouseEvent) {
  // 如果点击的是工具栏按钮，不激活（按钮有自己的点击处理）
  const target = event.target as HTMLElement;
  if (target.closest('.textbox-toolbar .icon-button')) {
    return;
  }
  
  // 点击 textbox 内部任何区域（包括元素、空白区域）都激活
  // 这样可以确保编辑完元素后，textbox 仍然保持激活状态
  if (!isActive.value) {
    isActive.value = true;
    eventNode.emit(NotesChannels.TEXTBOX_ACTIVATE, { textboxId: textboxId.value });
  }
}

// 创建并添加新元素
function addNewElement() {
  if (!textboxInstance.value || props.disabled || currentMode.value === 'view') {
    return;
  }

  // 创建新的文本元素
  const newElement = new Element({}, '新元素', elements.value.length);
  
  // 添加到 textbox
  addElement(newElement);
  
  // 记录最后添加的元素 ID，用于后续自动进入编辑状态
  lastAddedElementId.value = newElement.elementId;
  
  // 等待 DOM 更新后，通过事件系统触发新元素的编辑状态
  nextTick(() => {
    if (lastAddedElementId.value) {
      // 通过事件系统通知对应的 Element 组件进入编辑状态
      eventNode.emit(NotesChannels.ELEMENT_START_EDIT, { elementId: lastAddedElementId.value });
      lastAddedElementId.value = null;
    }
  });
}

// 创建并添加新的 VarElement（内容对象为空）
function handleAddVarElement() {
  if (!textboxInstance.value || props.disabled || currentMode.value === 'view') {
    return;
  }

  const varNameIndex = elements.value.filter(el => el.type === 'var-element').length + 1;
  
  // 创建空的 VarElement，targetObject 为 null
  const newVarElement = new VarElement(null, `变量${varNameIndex}`, elements.value.length);
  addElement(newVarElement);
}

// 处理键盘事件（快捷键）
function handleKeyDown(event: KeyboardEvent) {
  // 检查是否在编辑模式
  if (currentMode.value !== 'edit' || props.disabled || !textboxInstance.value) {
    return;
  }

  // 检查 textbox 是否处于激活状态或获得焦点
  const activeElement = document.activeElement;
  const isTextboxFocused = isActive.value || (wrapperRef.value && wrapperRef.value.contains(activeElement));
  
  if (!isTextboxFocused) {
    return;
  }

  // 检查是否按下了 Ctrl+V (Windows/Linux) 或 Cmd+V (Mac)
  const isCtrlV = (event.ctrlKey || event.metaKey) && event.key === 'v';
  
  if (isCtrlV) {
    // 检查当前焦点是否在输入框中（contenteditable 或 input/textarea）
    const isInInput = activeElement && (
      activeElement.tagName === 'INPUT' ||
      activeElement.tagName === 'TEXTAREA' ||
      activeElement.getAttribute('contenteditable') === 'true'
    );

    // 如果不在输入框中，则添加 VarElement（避免干扰正常的粘贴行为）
    if (!isInInput) {
      event.preventDefault();
      handleAddVarElement();
    }
    // 如果在输入框中，允许正常的粘贴行为，不处理
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
    eventNode.emit(NotesChannels.TEXTBOX_MODE_CHANGE, { mode: currentMode.value });
  }
}

// 将 Textbox 对齐到网格
function alignTextboxToGrid() {
  if (!wrapperRef.value || !textboxInstance.value) return;
  
  // 获取当前位置和尺寸
  const rect = wrapperRef.value.getBoundingClientRect();
  const parentRect = wrapperRef.value.parentElement?.getBoundingClientRect() || { left: 0, top: 0 };
  
  const currentLeft = rect.left - parentRect.left;
  const currentTop = rect.top - parentRect.top;
  const currentWidth = rect.width;
  const currentHeight = rect.height;
  
  // 对齐位置到网格
  const alignedLeft = snapToGrid(currentLeft);
  const alignedTop = snapToGrid(currentTop);
  
  // 对齐尺寸到网格
  const alignedWidth = snapToGrid(currentWidth);
  const alignedHeight = snapToGrid(currentHeight);
  
  // 应用对齐后的位置和尺寸
  const currentPosition = window.getComputedStyle(wrapperRef.value).position;
  if (currentPosition === 'static') {
    wrapperRef.value.style.position = 'relative';
  }
  
  // 更新位置
  if (alignedLeft !== currentLeft || alignedTop !== currentTop) {
    wrapperRef.value.style.left = alignedLeft + 'px';
    wrapperRef.value.style.top = alignedTop + 'px';
    textboxInstance.value.setContainerPosition(alignedLeft, alignedTop);
  }
  
  // 更新尺寸
  if (alignedWidth !== currentWidth || alignedHeight !== currentHeight) {
    wrapperRef.value.style.width = alignedWidth + 'px';
    wrapperRef.value.style.height = alignedHeight + 'px';
    textboxInstance.value.setContainerSize(alignedWidth, alignedHeight);
  }
}

// 应用保存的容器位置和尺寸
function applyContainerSettings() {
  if (!wrapperRef.value || !textboxInstance.value) return;
  
  const savedX = textboxInstance.value.containerX;
  const savedY = textboxInstance.value.containerY;
  const savedWidth = textboxInstance.value.containerWidth;
  const savedHeight = textboxInstance.value.containerHeight;
  
  // 设置 position 为 relative 以支持定位
  const currentPosition = window.getComputedStyle(wrapperRef.value).position;
  if (currentPosition === 'static') {
    wrapperRef.value.style.position = 'relative';
  }
  
  // 应用保存的位置
  if (savedX !== 0 || savedY !== 0) {
    wrapperRef.value.style.left = savedX + 'px';
    wrapperRef.value.style.top = savedY + 'px';
  }
  
  // 应用保存的尺寸（总是应用，因为默认值可能不是我们想要的）
  wrapperRef.value.style.width = savedWidth + 'px';
  wrapperRef.value.style.height = savedHeight + 'px';
}

// 拖拽和调整大小相关函数
function handleMouseDown(event: MouseEvent) {
  const target = event.target as HTMLElement;
  console.log('🟡 handleMouseDown called', {
    currentMode: currentMode.value,
    isResizing: isResizing.value,
    targetClass: target.classList.toString(),
    isResizeHandle: target.classList.contains('resize-handle')
  });
  
  // 如果正在调整大小，不处理拖拽
  if (isResizing.value) {
    console.log('⏸️ handleMouseDown: isResizing is true, returning');
    return;
  }
  
  // 检查是否点击在手柄上（手柄会阻止事件冒泡）
  if (target.classList.contains('resize-handle')) {
    console.log('⏸️ handleMouseDown: clicked on resize handle, returning');
    return;
  }
  
  // 在编辑模式下，禁止拖拽移动位置
  if (currentMode.value === 'edit') {
    console.log('⏸️ handleMouseDown: edit mode, returning');
    return;
  }
  
  // 在查看模式下可以拖拽移动
  if (!wrapperRef.value) return;
  
  isDragging.value = true;
  dragStartX.value = event.clientX;
  dragStartY.value = event.clientY;
  
  // 获取容器的当前位置
  const rect = wrapperRef.value.getBoundingClientRect();
  const parentRect = wrapperRef.value.parentElement?.getBoundingClientRect() || { left: 0, top: 0 };
  dragStartLeft.value = rect.left - parentRect.left;
  dragStartTop.value = rect.top - parentRect.top;
  
  // 禁用文本选择
  document.body.style.userSelect = 'none';
  document.body.style.cursor = 'grabbing';
  
  event.preventDefault();
}

function startResize(event: MouseEvent, direction: string) {
  console.log('🔵 startResize called', {
    direction,
    currentMode: currentMode.value,
    isResizing: isResizing.value,
    wrapperRef: !!wrapperRef.value,
    textboxInstance: !!textboxInstance.value
  });
  
  event.preventDefault();
  event.stopPropagation();
  
  if (!wrapperRef.value || !textboxInstance.value) {
    console.warn('❌ startResize: wrapperRef or textboxInstance is null');
    return;
  }
  
  isResizing.value = true;
  resizeDirection.value = direction;
  resizeStartX.value = event.clientX;
  resizeStartY.value = event.clientY;
  
  // 从 DOM 获取实际尺寸，而不是从计算属性
  const rect = wrapperRef.value.getBoundingClientRect();
  resizeStartWidth.value = rect.width;
  resizeStartHeight.value = rect.height;
  
  // 获取容器的当前位置
  const computedStyle = window.getComputedStyle(wrapperRef.value);
  const currentTop = computedStyle.top;
  const currentLeft = computedStyle.left;

  if (currentTop && currentTop !== 'auto') {
    resizeStartTop.value = parseFloat(currentTop);
  } else {
    const parentRect = wrapperRef.value.parentElement?.getBoundingClientRect() || { left: 0, top: 0 };
    resizeStartTop.value = rect.top - parentRect.top;
  }

  if (currentLeft && currentLeft !== 'auto') {
    resizeStartLeft.value = parseFloat(currentLeft);
  } else {
    const parentRect = wrapperRef.value.parentElement?.getBoundingClientRect() || { left: 0, top: 0 };
    resizeStartLeft.value = rect.left - parentRect.left;
  }
  
  // 禁用文本选择
  document.body.style.userSelect = 'none';
  document.body.style.cursor = getResizeCursor(direction);
}

function handleMouseMove(event: MouseEvent) {
  // 优先处理调整大小（因为调整大小和拖拽不会同时发生）
  if (isResizing.value && wrapperRef.value && textboxInstance.value) {
    console.log('🟢 resizing', {
      direction: resizeDirection.value,
      deltaX: event.clientX - resizeStartX.value,
      deltaY: event.clientY - resizeStartY.value,
      isResizing: isResizing.value
    });
    
    const deltaX = event.clientX - resizeStartX.value;
    const deltaY = event.clientY - resizeStartY.value;
    
    let newWidth = resizeStartWidth.value;
    let newHeight = resizeStartHeight.value;
    let newLeft = resizeStartLeft.value;
    let newTop = resizeStartTop.value;
    
    // 根据方向调整大小和位置
    if (resizeDirection.value.includes('e')) {
      newWidth = Math.max(GRID_SIZE, resizeStartWidth.value + deltaX);
    }
    if (resizeDirection.value.includes('w')) {
      newWidth = Math.max(GRID_SIZE, resizeStartWidth.value - deltaX);
      newLeft = resizeStartLeft.value + deltaX;
    }
    if (resizeDirection.value.includes('s')) {
      newHeight = Math.max(GRID_SIZE, resizeStartHeight.value + deltaY);
    }
    if (resizeDirection.value.includes('n')) {
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
    
    // 更新尺寸
    textboxInstance.value.setContainerSize(alignedRect.width, alignedRect.height);
    
    // 更新位置和尺寸的 DOM 样式
    const currentPosition = window.getComputedStyle(wrapperRef.value).position;
    if (currentPosition === 'static') {
      wrapperRef.value.style.position = 'relative';
    }
    wrapperRef.value.style.left = alignedRect.x + 'px';
    wrapperRef.value.style.top = alignedRect.y + 'px';
    wrapperRef.value.style.width = alignedRect.width + 'px';
    wrapperRef.value.style.height = alignedRect.height + 'px';
    
    return;
  }
  
  // 处理拖拽
  if (isDragging.value && wrapperRef.value) {
    const deltaX = event.clientX - dragStartX.value;
    const deltaY = event.clientY - dragStartY.value;
    
    const rawLeft = dragStartLeft.value + deltaX;
    const rawTop = dragStartTop.value + deltaY;
    
    // 对齐到网格
    const newLeft = snapToGrid(rawLeft);
    const newTop = snapToGrid(rawTop);
    
    // 更新位置
    const currentPosition = window.getComputedStyle(wrapperRef.value).position;
    if (currentPosition === 'static') {
      wrapperRef.value.style.position = 'relative';
    }
    wrapperRef.value.style.left = newLeft + 'px';
    wrapperRef.value.style.top = newTop + 'px';
    
    return;
  }
}

function handleMouseUp(event: MouseEvent) {
  // 处理拖拽结束
  if (isDragging.value) {
    isDragging.value = false;
    
    // 保存当前位置到 Textbox 对象
    if (wrapperRef.value && textboxInstance.value) {
      const rect = wrapperRef.value.getBoundingClientRect();
      const parentRect = wrapperRef.value.parentElement?.getBoundingClientRect() || { left: 0, top: 0 };
      const currentX = rect.left - parentRect.left;
      const currentY = rect.top - parentRect.top;
      
      // 对齐到网格并保存
      const alignedX = snapToGrid(currentX);
      const alignedY = snapToGrid(currentY);
      textboxInstance.value.setContainerPosition(alignedX, alignedY);
    }
    
    // 恢复文本选择
    document.body.style.userSelect = '';
    document.body.style.cursor = '';
  }
  
  // 处理调整大小结束
  if (isResizing.value) {
    isResizing.value = false;
    resizeDirection.value = '';
    
    // 保存当前位置到 Textbox 对象（调整大小可能改变位置）
    if (wrapperRef.value && textboxInstance.value) {
      const rect = wrapperRef.value.getBoundingClientRect();
      const parentRect = wrapperRef.value.parentElement?.getBoundingClientRect() || { left: 0, top: 0 };
      const currentX = rect.left - parentRect.left;
      const currentY = rect.top - parentRect.top;
      
      // 对齐到网格并保存
      const alignedX = snapToGrid(currentX);
      const alignedY = snapToGrid(currentY);
      textboxInstance.value.setContainerPosition(alignedX, alignedY);
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
  reflowFillPreviousLine,
  addElement: (element: Element) => {
    addElement(element);
  },
  removeElement: (elementId: string) => {
    removeElement(elementId);
  },
  clearElements: () => {
    clearElements();
  },
  getElements: (): TextboxElement[] => {
    return elements.value as TextboxElement[];
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
  outline: none;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
  cursor: default;
  /* 支持网格对齐的样式 */
  box-sizing: border-box;
  position: relative;
}

.textbox-wrapper.textbox-active {
  border-color: rgba(59, 130, 246, 0.5);
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.1);
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
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 6px;
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
  z-index: 1; /* 确保低于手柄 */
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

/* VarElement 创建对话框样式 */
.var-element-dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
}

.var-element-dialog {
  background-color: #fff;
  border-radius: 8px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
  width: 90%;
  max-width: 500px;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
}

.dialog-header {
  padding: 16px 20px;
  border-bottom: 1px solid #e0e0e0;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.dialog-header h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 500;
  color: #333;
}

.close-btn {
  background: none;
  border: none;
  font-size: 24px;
  color: #666;
  cursor: pointer;
  padding: 0;
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  transition: background-color 0.2s ease;
}

.close-btn:hover {
  background-color: #f0f0f0;
}

.dialog-body {
  padding: 20px;
  flex: 1;
  overflow-y: auto;
}

.form-item {
  margin-bottom: 16px;
}

.form-item label {
  display: block;
  margin-bottom: 6px;
  font-size: 14px;
  font-weight: 500;
  color: #333;
}

.form-input,
.form-select {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #d0d0d0;
  border-radius: 4px;
  font-size: 14px;
  font-family: inherit;
  transition: border-color 0.2s ease;
  box-sizing: border-box;
}

.form-input:focus,
.form-select:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.1);
}

.dialog-footer {
  padding: 16px 20px;
  border-top: 1px solid #e0e0e0;
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

.btn-cancel,
.btn-confirm {
  padding: 8px 16px;
  border-radius: 4px;
  font-size: 14px;
  cursor: pointer;
  transition: background-color 0.2s ease, color 0.2s ease;
  border: 1px solid;
}

.btn-cancel {
  background-color: #f5f5f5;
  border-color: #d0d0d0;
  color: #333;
}

.btn-cancel:hover {
  background-color: #e8e8e8;
}

.btn-confirm {
  background-color: #3b82f6;
  border-color: #3b82f6;
  color: #fff;
}

.btn-confirm:hover {
  background-color: #2563eb;
}

/* 编辑模式下的样式 */
.edit-mode .textbox-wrapper {
  cursor: default !important;
  overflow: visible !important; /* 显示调整大小手柄 */
}

.edit-mode .textbox-wrapper:hover {
  cursor: default !important;
}

.edit-mode .textbox-wrapper:active {
  cursor: default !important;
}

/* 确保 textbox-content 在编辑模式下不会拦截手柄事件 */
.edit-mode .textbox-content {
  pointer-events: auto; /* 保持内容可交互 */
  position: relative;
  z-index: 1; /* 确保低于手柄 */
}

/* 调整大小手柄 */
.resize-handle {
  position: absolute;
  background-color: rgba(59, 130, 246, 0.8) !important;
  border: 2px solid rgba(59, 130, 246, 1) !important;
  z-index: 99999 !important; /* 增加到更高的值，确保在最上层 */
  transition: background-color 0.2s;
  pointer-events: auto !important;
  box-shadow: 0 0 6px rgba(59, 130, 246, 1);
  min-width: 8px;
  min-height: 8px;
}

.resize-handle:hover {
  background-color: rgba(59, 130, 246, 1) !important;
}

/* 上边缘 */
.resize-handle-n {
  top: -4px;
  left: 50%;
  transform: translateX(-50%);
  width: 20px;
  height: 8px;
  cursor: ns-resize;
}

/* 下边缘 */
.resize-handle-s {
  bottom: -4px;
  left: 50%;
  transform: translateX(-50%);
  width: 20px;
  height: 8px;
  cursor: ns-resize;
}

/* 左边缘 */
.resize-handle-w {
  left: -4px;
  top: 50%;
  transform: translateY(-50%);
  width: 8px;
  height: 20px;
  cursor: ew-resize;
}

/* 右边缘 */
.resize-handle-e {
  right: -4px;
  top: 50%;
  transform: translateY(-50%);
  width: 8px;
  height: 20px;
  cursor: ew-resize;
}

/* 左上角 */
.resize-handle-nw {
  top: -4px;
  left: -4px;
  width: 8px;
  height: 8px;
  cursor: nwse-resize;
}

/* 右上角 */
.resize-handle-ne {
  top: -4px;
  right: -4px;
  width: 8px;
  height: 8px;
  cursor: nesw-resize;
}

/* 左下角 */
.resize-handle-sw {
  bottom: -4px;
  left: -4px;
  width: 8px;
  height: 8px;
  cursor: nesw-resize;
}

/* 右下角 */
.resize-handle-se {
  bottom: -4px;
  right: -4px;
  width: 8px;
  height: 8px;
  cursor: nwse-resize;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .var-element-dialog {
    width: 95%;
    max-height: 85vh;
  }
}
</style>