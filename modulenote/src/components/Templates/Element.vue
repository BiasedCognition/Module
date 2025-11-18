<template>
  <div 
    ref="rootRef"
    class="element-component"
    :style="isEditing ? { maxWidth: editMaxWidthPx + 'px', flex: '0 0 auto' } : undefined"
    @click="handleClick"
    @dblclick="handleDoubleClick"
  >
    <div
      v-if="!isEditing"
      class="element-display-text"
      :style="{ color: textColor }"
      v-html="renderedHtml"
    ></div>
    <div
      v-else
      ref="editorRef"
      class="element-display-text element-display-text--editing"
      contenteditable="plaintext-only"
      @focus="handleFocus"
      @blur="commitEdit"
      @keydown="handleKeyDown"
      @keydown.enter.prevent="commitEdit"
      @keydown.esc.prevent="cancelEdit"
      @input="handleInput"
      :style="{ color: textColor }"
      v-text="editableText"
    ></div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted, inject, computed, nextTick } from 'vue';
import { marked } from 'marked';
import type { ObjectBase } from '../Object/object';
import { useEventNode, NotesChannels } from '@/Event';

// Props定义（兼容 element 与 textElement）
const props = defineProps<{
  element?: any;
  textElement?: any;
  mode: 'view' | 'edit';
}>();
const elementRef = computed(() => (props as any).textElement ?? (props as any).element);

const isReadOnly = computed(() => props.mode === 'view');
const displayTextValue = computed(() => {
  const current = elementRef.value as any;
  return current && typeof current.displayText === 'string'
    ? current.displayText
    : '';
});

const textColor = computed(() => {
  const current = elementRef.value as any;
  return current && typeof current.textColor === 'string'
    ? current.textColor
    : '#1f2937';
});

const isSplittable = computed(() => {
  const current = elementRef.value as any;
  if (!current) return true; // 默认可分割
  if (typeof current.getSplittable === 'function') {
    return current.getSplittable();
  }
  return current.splittable !== false; // 默认为 true，只有显式设为 false 才不可分割
});

const renderedHtml = computed(() => {
  const raw = displayTextValue.value ?? '';
  if (!raw.trim()) {
    return '<span class="element-placeholder">[元素]</span>';
  }
  return marked.parse(raw);
});

// Emits定义
const emit = defineEmits<{
  'click': [element: any];
  'dblclick': [element: any];
  'remove': [elementId: string];
  'split': [payload: { element: any; beforeText: string; afterText: string }];
}>();

const registerElement = inject<(element: HTMLElement, object: ObjectBase) => () => void>('registerElement');
const rootRef = ref<HTMLElement | null>(null);
const editorRef = ref<HTMLDivElement | null>(null);
let cleanupDoubleClick: (() => void) | null = null;
const isEditing = ref(false);
const editableText = ref('');
const originalText = ref('');
const eventNode = useEventNode({ tags: ['element'] });
const editMaxWidthPx = ref(0);

// 方法
const handleClick = () => {
  const el = elementRef.value;
  emit('click', el);
  eventNode.emit(NotesChannels.ELEMENT_CLICK, { element: el, textElement: el });
};

const startEditing = () => {
  if (isReadOnly.value) return;
  // 限制编辑期最大宽度为“本行剩余空间”，允许在该范围内自适应，不挤到下一行
  const remaining = computeRemainingWidthInLine();
  if (remaining && remaining > 0) {
    editMaxWidthPx.value = Math.round(remaining);
  } else {
    const rect = rootRef.value?.getBoundingClientRect();
    editMaxWidthPx.value = Math.max(1, Math.round(rect?.width || 0));
  }
  isEditing.value = true;
  originalText.value = displayTextValue.value ?? '';
  editableText.value = originalText.value;
  nextTick(() => {
    const editor = editorRef.value;
    if (!editor) return;
    setEditorText(editor, editableText.value);
    placeCaretAtEnd(editor);
    editor.focus();
  });
};

const commitEdit = () => {
  if (!isEditing.value) return;
  const editor = editorRef.value;
  const newValue = editor?.innerText ?? '';
  editableText.value = newValue;
  syncDisplayText(newValue);
  originalText.value = newValue;
  isEditing.value = false;
  editMaxWidthPx.value = 0;
  // 提交后再根据宽度检查并进行拆分（输入过程中不拆分）
  nextTick(() => {
    checkWrapAndSplitForCurrentLine();
  });
};

const cancelEdit = () => {
  if (!isEditing.value) return;
  const editor = editorRef.value;
  editableText.value = originalText.value;
  if (editor) {
    setEditorText(editor, originalText.value);
  }
  syncDisplayText(originalText.value);
  isEditing.value = false;
  editMaxWidthPx.value = 0;
};

const handleDoubleClick = () => {
  if (!isReadOnly.value) {
    startEditing();
  }
  const el = elementRef.value;
  emit('dblclick', el);
  eventNode.emit(NotesChannels.ELEMENT_DOUBLE_CLICK, { element: el, textElement: el });
};

const handleFocus = () => {
  const editor = editorRef.value;
  if (!editor) return;
  placeCaretAtEnd(editor);
};

const handleInput = () => {
  if (isReadOnly.value) return;
  const editor = editorRef.value;
  if (!editor) return;
  const value = editor.innerText ?? '';
  editableText.value = value;
  syncDisplayText(value);
};

const handleKeyDown = (event: KeyboardEvent) => {
  if (event.ctrlKey && event.key.toLowerCase() === 's') {
    event.preventDefault();
    event.stopPropagation();
    if (!isEditing.value) return;
    performSplit();
  }
};

const syncDisplayText = (value: string) => {
  const target: any = elementRef.value;
  if (target) {
    if (typeof target.setDisplayText === 'function') {
      target.setDisplayText(value);
    } else {
      target.displayText = value;
    }
  }
};

const setElementColor = (color: string) => {
  const target: any = elementRef.value;
  if (!target) return;
  if (typeof target.setTextColor === 'function') {
    target.setTextColor(color);
  } else {
    target.textColor = color;
  }
};

const setEditorText = (node: HTMLElement | null, value: string) => {
  if (!node) return;
  node.innerText = value || '';
};

const placeCaretAtEnd = (element: HTMLElement) => {
  const range = document.createRange();
  range.selectNodeContents(element);
  range.collapse(false);
  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
};

// 自动分割：根据宽度溢出自动切分为两段
const getDisplayClientWidth = (): number => {
  const el = rootRef.value;
  if (!el) return 0;
  // 目标是内部文本容器宽度
  const textEl = isEditing.value ? editorRef.value : el.querySelector('.element-display-text') as HTMLElement | null;
  return (textEl?.clientWidth ?? el.clientWidth) || 0;
};

const getDisplayScrollWidth = (): number => {
  const el = rootRef.value;
  if (!el) return 0;
  const textEl = isEditing.value ? editorRef.value : el.querySelector('.element-display-text') as HTMLElement | null;
  return (textEl?.scrollWidth ?? el.scrollWidth) || 0;
};

const measureTextWidth = (text: string): number => {
  const el = document.createElement('span');
  el.className = 'element-display-text';
  el.style.visibility = 'hidden';
  el.style.position = 'absolute';
  el.style.whiteSpace = 'nowrap';
  el.style.pointerEvents = 'none';
  el.textContent = text || '';
  document.body.appendChild(el);
  const width = el.offsetWidth;
  document.body.removeChild(el);
  return width;
};

const autoSplitAt = (splitIndex: number) => {
  const raw = (editableText.value || displayTextValue.value || '') as string;
  const beforeText = raw.slice(0, splitIndex);
  const afterText = raw.slice(splitIndex);
  editableText.value = beforeText;
  originalText.value = beforeText;
  syncDisplayText(beforeText);
  setElementColor(textColor.value);
  isEditing.value = false;
  emit('split', {
    element: elementRef.value,
    beforeText,
    afterText,
  });
  eventNode.emit(NotesChannels.ELEMENT_SPLIT, {
    element: elementRef.value,
    textElement: elementRef.value,
    beforeText,
    afterText,
  });
};

const checkOverflowAndMaybeSplit = () => {
  // 检查是否可分割
  if (!isSplittable.value) {
    return; // 不可分割，直接返回
  }

  // 单行模式下，当内容宽度超过容器最大宽度时触发分割
  const clientW = getDisplayClientWidth();
  const scrollW = getDisplayScrollWidth();
  if (!clientW || !scrollW) return;
  if (scrollW <= clientW) return;

  // 二分查找最大可容纳前缀
  const raw = (editableText.value || displayTextValue.value || '') as string;
  if (!raw) return;
  let lo = 1;
  let hi = raw.length;
  let ans = 1;
  // 预留4px安全边距，避免边框与padding影响
  const limit = Math.max(0, clientW - 4);
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const width = measureTextWidth(raw.slice(0, mid));
    if (width <= limit) {
      ans = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  if (ans < raw.length) {
    autoSplitAt(ans);
  }
};

// 计算当前行剩余空间，并尽可能填充当前行后再拆分
const parsePx = (v: string | null): number => {
  if (!v) return 0;
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
};

const computeRemainingWidthInLine = (): number => {
  const el = rootRef.value;
  if (!el) return 0;
  // 父容器（elements-container）
  const container = el.closest('.elements-container') as HTMLElement | null;
  if (!container) return 0;

  const containerRect = container.getBoundingClientRect();
  const selfRect = el.getBoundingClientRect();
  const cs = getComputedStyle(container);
  const colGap = parsePx(cs.columnGap) || 0;          // 与下一元素的水平间隔
  const padRight = parsePx(cs.paddingRight) || 0;      // 容器右内边距
  const borderRight = parsePx(cs.borderRightWidth) || 0; // 容器右边框

  // 预留安全边距：右侧列间距 + 1px 容错（避免亚像素换行）
  const epsilon = Math.ceil(colGap) + 1;
  const remaining = containerRect.right - selfRect.left - padRight - borderRight - epsilon;
  return Math.max(0, Math.floor(remaining));
};

const checkWrapAndSplitForCurrentLine = () => {
  // 检查是否可分割
  if (!isSplittable.value) {
    return; // 不可分割，直接返回
  }

  // 若整段文本宽度大于当前行剩余空间，则将前缀填满当前行后拆分
  const raw = (editableText.value || displayTextValue.value || '') as string;
  if (!raw) return;
  const totalWidth = measureTextWidth(raw);
  // 对剩余宽度再扣除当前显示块自身右侧的内边距与圆角误差，避免略超导致换行
  const remaining = Math.max(0, computeRemainingWidthInLine() - 2);
  if (!remaining) return;
  if (totalWidth <= remaining) return; // 全部可放入当前行，不拆分

  // 在 remaining 范围内二分查找最大可容纳前缀
  let lo = 1;
  let hi = raw.length;
  let ans = 0;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const width = measureTextWidth(raw.slice(0, mid));
    if (width <= remaining) {
      ans = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  // 若一个字符都放不下，允许该元素整体换到下一行，不进行拆分
  if (ans <= 0) return;
  if (ans < raw.length) {
    autoSplitAt(ans);
  }
};

let resizeObserver: ResizeObserver | null = null;

const performSplit = () => {
  // 检查是否可分割
  if (!isSplittable.value) {
    console.warn('该元素不可分割');
    return;
  }

  const editor = editorRef.value;
  if (!editor) return;
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return;
  const range = selection.getRangeAt(0);
  if (!editor.contains(range.startContainer)) return;

  const preRange = range.cloneRange();
  preRange.selectNodeContents(editor);
  preRange.setEnd(range.startContainer, range.startOffset);
  const caretIndex = preRange.toString().length;

  const text = editor.innerText ?? '';
  const beforeText = text.slice(0, caretIndex);
  const afterText = text.slice(caretIndex);

  editableText.value = beforeText;
  originalText.value = beforeText;
  setEditorText(editor, beforeText);
  syncDisplayText(beforeText);
  setElementColor(textColor.value);
  isEditing.value = false;

  emit('split', {
    element: elementRef.value,
    beforeText,
    afterText,
  });
  eventNode.emit(NotesChannels.ELEMENT_SPLIT, {
    element: elementRef.value,
    textElement: elementRef.value,
    beforeText,
    afterText,
  });
};

// 监听属性变化
watch(() => elementRef.value?.position, (newPos) => {
  console.log(`元素位置已更新: ${newPos}`);
});

watch(() => elementRef.value?.value, (newVal) => {
  console.log('元素值已更新:', newVal);
});

watch(
  () => displayTextValue.value,
  (newValue) => {
    if (!isEditing.value) {
      editableText.value = newValue ?? '';
    }
  }
);

watch(
  () => textColor.value,
  (newColor) => {
    const target: any = elementRef.value;
    if (!target) return;
    const currentColor = typeof target.getTextColor === 'function'
      ? target.getTextColor()
      : target.textColor;
    if (currentColor === newColor) return;
    setElementColor(newColor);
  }
);

watch(
  () => elementRef.value,
  () => {
    if (!registerElement) return;
    cleanupDoubleClick?.();
    if (rootRef.value && elementRef.value) {
      cleanupDoubleClick = registerElement(rootRef.value, elementRef.value as ObjectBase);
    }
  }
);

onMounted(() => {
  if (registerElement && rootRef.value) {
    cleanupDoubleClick = registerElement(rootRef.value, elementRef.value as ObjectBase);
  }
  editableText.value = displayTextValue.value ?? '';
  // 不在输入过程中自动拆分；移除尺寸变化时的自动拆分，仅在提交时处理
});

onUnmounted(() => {
  cleanupDoubleClick?.();
  cleanupDoubleClick = null;
  resizeObserver?.disconnect();
  resizeObserver = null;
});
</script>

<style scoped>
.element-component {
  display: inline-flex;
  cursor: pointer;
  user-select: none;
  max-width: 100%;
}

.element-display-text {
  display: inline-block;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  border-radius: 4px;
  font-family: inherit;
  font-size: 0.9em;
  line-height: 1.4;
  background-color: rgba(33, 150, 243, 0.08);
  color: #1f2937;
  transition: background-color 0.2s ease, color 0.2s ease;
  /* 单行显示，超出触发自动分割 */
  white-space: nowrap;
  overflow: hidden;
  max-width: 100%;
}

.element-display-text--editing {
  border: 1px solid rgba(59, 130, 246, 0.4);
  background-color: #ffffff;
  box-shadow: 0 0 0 1px rgba(59, 130, 246, 0.15);
  /* 编辑态也保持单行 */
  white-space: nowrap;
  overflow: hidden;
}

.element-display-text--editing:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2);
}

.element-placeholder {
  opacity: 0.6;
}

.element-display-text:hover {
  background-color: rgba(33, 150, 243, 0.15);
  color: #0f172a;
}

/* 双击时的视觉反馈 */
.element-component:active .element-display-text {
  background-color: rgba(33, 150, 243, 0.22);
}

.element-display-text :deep(p) {
  margin: 0;
}

.element-display-text :deep(pre) {
  margin: 0;
  background: rgba(15, 23, 42, 0.08);
  padding: 6px 8px;
  border-radius: 4px;
  font-family: 'Fira Code', Consolas, monospace;
}

.element-display-text :deep(code) {
  background: rgba(15, 23, 42, 0.08);
  padding: 0 4px;
  border-radius: 4px;
  font-family: 'Fira Code', Consolas, monospace;
}

.element-display-text :deep(a) {
  color: #2563eb;
  text-decoration: underline;
}
</style>