# D3.js 使用指南

## 安装状态

D3.js 已经成功安装到项目中：
- **D3.js**: `^7.9.0` (已安装)
- **TypeScript 类型定义**: `@types/d3@^7.4.3` (已安装)

## 快速开始

### 1. 在 Vue 组件中使用 D3.js

```vue
<script setup lang="ts">
import * as d3 from 'd3';
import { createSVG, createColorScale } from '../utils/d3Helper';

// 使用 D3.js 创建图表
</script>
```

### 2. 使用辅助工具函数

项目提供了 `src/utils/d3Helper.ts` 辅助工具，包含以下功能：

- `createSVG()` - 创建 SVG 容器
- `createZoom()` - 创建缩放功能
- `createForceSimulation()` - 创建力导向图
- `createColorScale()` - 创建颜色比例尺
- `createAxis()` - 创建坐标轴

### 3. 示例组件

查看 `src/components/D3Example.vue` 了解完整的柱状图示例。

## 常用导入方式

```typescript
// 导入整个 D3 库
import * as d3 from 'd3';

// 按需导入特定模块
import { select, scaleLinear, axisBottom } from 'd3';

// 使用辅助工具
import { createSVG, createColorScale } from '@/utils/d3Helper';
```

## 示例：创建简单的柱状图

```vue
<template>
  <div ref="chartContainer"></div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import * as d3 from 'd3';

const chartContainer = ref<HTMLElement | null>(null);

onMounted(() => {
  if (!chartContainer.value) return;

  const data = [10, 20, 30, 40, 50];
  const width = 400;
  const height = 300;

  const svg = d3
    .select(chartContainer.value)
    .append('svg')
    .attr('width', width)
    .attr('height', height);

  const xScale = d3
    .scaleBand()
    .domain(data.map((_, i) => i.toString()))
    .range([0, width])
    .padding(0.2);

  const yScale = d3
    .scaleLinear()
    .domain([0, d3.max(data) || 0])
    .range([height, 0]);

  svg
    .selectAll('rect')
    .data(data)
    .enter()
    .append('rect')
    .attr('x', (_, i) => xScale(i.toString()) || 0)
    .attr('y', (d) => yScale(d))
    .attr('width', xScale.bandwidth())
    .attr('height', (d) => height - yScale(d))
    .attr('fill', '#3b82f6');
});
</script>
```

## 更多资源

- [D3.js 官方文档](https://d3js.org/)
- [D3.js GitHub](https://github.com/d3/d3)
- [D3.js 教程](https://observablehq.com/@d3/learn-d3)


