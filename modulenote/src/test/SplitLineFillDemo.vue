<template>
  <div class="demo-wrap">
    <h2>单行填充并在回车提交后拆分 Demo</h2>
    <p class="tips">
      说明：元素单行显示；编辑时不拆分；按 Enter 提交后，如果该元素会被挤到下一行，则尽量填满当前行再拆分。
    </p>

    <div class="controls">
      <template-button class="btn" @click="addSplittableElement">添加可编辑元素</template-button>

      <div class="width-control">
        <label>容器宽度：{{ containerWidth }}px</label>
        <input type="range" min="320" max="960" step="10" v-model="containerWidth" />
      </div>

      <template-button class="btn secondary" @click="toggleBoundary">
        {{ showBoundary ? '隐藏右边界' : '显示右边界' }}
      </template-button>

      <template-button class="btn tertiary" @click="reflowOnce">
        刷新重排（从前往后塞满上一行）
      </template-button>
    </div>

    <div class="stage" :style="{ width: containerWidth + 'px' }" ref="stageRef">
      <textbox-component
        ref="textboxRef"
        :mode="'edit'"
        :placeholder="'双击元素进入编辑，输入长文本，按 Enter 提交触发拆分'"
      />
    </div>

    <!-- 右边界可视化（基于 viewport 的 fixed 线条） -->
    <div
      v-if="showBoundary"
      class="right-boundary-line"
      :style="boundaryStyle"
    />

    <div class="logs">
      <h3>事件日志</h3>
      <ul>
        <li v-for="(log, i) in logs" :key="i">
          <span class="ts">{{ log.time }}</span>
          <span class="type">{{ log.type }}</span>
          <span class="msg">{{ log.message }}</span>
        </li>
      </ul>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, reactive, watch, nextTick } from 'vue';
import TextboxComponent from '../components/Templates/Textbox.vue';
import TemplateButton from '../components/Templates/Button.vue';
import { Element } from '../components/Object/element';
import { useEventNode, NotesChannels } from '@/Event';

const textboxRef = ref();
const containerWidth = ref(640);
const stageRef = ref<HTMLElement | null>(null);

const logs = ref<Array<{ time: string; type: string; message: string }>>([]);
function addLog(type: string, message: string) {
  logs.value.unshift({
    time: new Date().toLocaleTimeString(),
    type,
    message
  });
  if (logs.value.length > 100) logs.value.pop();
}

const eventNode = useEventNode({ tags: ['split-demo'] });

// 右边界可视化
const showBoundary = ref(false);
const boundaryStyle = reactive<Record<string, string>>({
  left: '0px',
  top: '0px',
  height: '0px'
});

function parsePx(v: string | null): number {
  if (!v) return 0;
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
}

function updateBoundary() {
  const stage = stageRef.value;
  if (!stage) return;
  const container = stage.querySelector('.elements-container') as HTMLElement | null;
  if (!container) return;
  const rect = container.getBoundingClientRect();
  const cs = getComputedStyle(container);
  const colGap = parsePx(cs.columnGap) || 0;
  const padRight = parsePx(cs.paddingRight) || 0;
  const borderRight = parsePx(cs.borderRightWidth) || 0;
  const epsilon = Math.ceil(colGap) + 1; // 与计算逻辑一致
  const x = rect.right - padRight - borderRight - epsilon;
  boundaryStyle.left = `${Math.max(0, Math.floor(x))}px`;
  boundaryStyle.top = `${Math.max(0, Math.floor(rect.top))}px`;
  boundaryStyle.height = `${Math.max(0, Math.floor(rect.height))}px`;
}

function toggleBoundary() {
  showBoundary.value = !showBoundary.value;
  if (showBoundary.value) {
    nextTick(updateBoundary);
  }
}

let ro: ResizeObserver | null = null;
onMounted(() => {
  const stage = stageRef.value;
  if (stage && 'ResizeObserver' in window) {
    ro = new ResizeObserver(() => {
      if (showBoundary.value) updateBoundary();
    });
    ro.observe(stage);
  }
  window.addEventListener('scroll', updateBoundary, true);
  window.addEventListener('resize', updateBoundary);
});

onUnmounted(() => {
  ro?.disconnect();
  ro = null;
  window.removeEventListener('scroll', updateBoundary, true);
  window.removeEventListener('resize', updateBoundary);
});

watch(containerWidth, () => {
  if (showBoundary.value) nextTick(updateBoundary);
});

// 监听拆分事件
eventNode.on(NotesChannels.ELEMENT_SPLIT, ({ payload }) => {
  const { beforeText, afterText } = payload as any;
  addLog(
    'ELEMENT_SPLIT',
    `before='${String(beforeText).slice(0, 24)}'(${String(beforeText).length}) | after='${String(afterText).slice(0, 24)}'(${String(afterText).length})`
  );
});

// 监听元素新增
eventNode.on(NotesChannels.ELEMENT_ADD, ({ payload }) => {
  const { element } = payload as any;
  addLog('ELEMENT_ADD', `id=${element?.elementId || 'unknown'}`);
});

// 添加一个可编辑、可拆分的元素
function addSplittableElement() {
  if (!textboxRef.value) return;
  const el = new Element('demo-split-text');
  el.setContent({
    title: '可拆分元素',
    description: '双击进入编辑，尽量输入超出本行长度的文本，按 Enter 后触发拆分',
    type: 'text'
  } as any);
  // 初始 displayText
  // 用户双击进入编辑，输入长文本，然后按 Enter 提交
  (el as any).displayText = '在此输入较长文本以测试“尽量填满当前行”的拆分策略';
  textboxRef.value.addElement(el);
  addLog('ADD', '已添加元素，双击可编辑并测试拆分');
}

function reflowOnce() {
  textboxRef.value?.reflowFillPreviousLine?.();
  addLog('REFLOW', '执行一次重排：从前往后尝试塞满上一行');
  if (showBoundary.value) nextTick(updateBoundary);
}
</script>

<style scoped>
.demo-wrap {
  max-width: 960px;
  margin: 20px auto;
  padding: 16px;
}

.tips {
  color: #666;
  margin: 6px 0 12px 0;
}

.controls {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 12px;
}

.btn {
  padding: 6px 12px;
  background: #2563eb;
  color: #fff;
  border: none;
  border-radius: 4px;
}

.btn.secondary {
  background: #475569;
}

.width-control {
  display: flex;
  align-items: center;
  gap: 8px;
}

.stage {
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 10px;
  background: #fff;
  margin-bottom: 16px;
}

.logs {
  background: #fafafa;
  border: 1px solid #eee;
  border-radius: 8px;
  padding: 10px;
}

.logs ul {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 6px;
}

.logs li {
  display: grid;
  grid-template-columns: 84px 120px 1fr;
  gap: 8px;
  font-size: 12px;
  align-items: center;
}

.ts {
  color: #64748b;
}

.type {
  color: #0ea5e9;
  font-weight: 600;
}

.msg {
  color: #333;
}

.right-boundary-line {
  position: fixed;
  width: 0;
  border-left: 2px dashed #ef4444;
  pointer-events: none;
  z-index: 9999;
}
</style>


