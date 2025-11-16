<template>
  <div 
    ref="rootRef"
    class="element-component"
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

// Props定义
const props = defineProps<{
  element: any;
  mode: 'view' | 'edit';
}>();

const isReadOnly = computed(() => props.mode === 'view');
const displayTextValue = computed(() => {
  const current = props.element as any;
  return current && typeof current.displayText === 'string'
    ? current.displayText
    : '';
});

const textColor = computed(() => {
  const current = props.element as any;
  return current && typeof current.textColor === 'string'
    ? current.textColor
    : '#1f2937';
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

// 方法
const handleClick = () => {
  emit('click', props.element);
  eventNode.emit(NotesChannels.ELEMENT_CLICK, { element: props.element });
};

const startEditing = () => {
  if (isReadOnly.value) return;
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
};

const handleDoubleClick = () => {
  if (!isReadOnly.value) {
    startEditing();
  }
  emit('dblclick', props.element);
  eventNode.emit(NotesChannels.ELEMENT_DOUBLE_CLICK, { element: props.element });
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
  const target: any = props.element;
  if (target) {
    if (typeof target.setDisplayText === 'function') {
      target.setDisplayText(value);
    } else {
      target.displayText = value;
    }
  }
};

const setElementColor = (color: string) => {
  const target: any = props.element;
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

const performSplit = () => {
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
    element: props.element,
    beforeText,
    afterText,
  });
  eventNode.emit(NotesChannels.ELEMENT_SPLIT, {
    element: props.element,
    beforeText,
    afterText,
  });
};

// 监听属性变化
watch(() => props.element?.position, (newPos) => {
  console.log(`元素位置已更新: ${newPos}`);
});

watch(() => props.element?.value, (newVal) => {
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
    const target: any = props.element;
    if (!target) return;
    const currentColor = typeof target.getTextColor === 'function'
      ? target.getTextColor()
      : target.textColor;
    if (currentColor === newColor) return;
    setElementColor(newColor);
  }
);

watch(
  () => props.element,
  () => {
    if (!registerElement) return;
    cleanupDoubleClick?.();
    if (rootRef.value && props.element) {
      cleanupDoubleClick = registerElement(rootRef.value, props.element as ObjectBase);
    }
  }
);

onMounted(() => {
  if (registerElement && rootRef.value) {
    cleanupDoubleClick = registerElement(rootRef.value, props.element as ObjectBase);
  }
  editableText.value = displayTextValue.value ?? '';
});

onUnmounted(() => {
  cleanupDoubleClick?.();
  cleanupDoubleClick = null;
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
  word-break: break-word;
  max-width: 100%;
}

.element-display-text--editing {
  border: 1px solid rgba(59, 130, 246, 0.4);
  background-color: #ffffff;
  box-shadow: 0 0 0 1px rgba(59, 130, 246, 0.15);
  white-space: pre-wrap;
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