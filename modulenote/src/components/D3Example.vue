<template>
  <div class="d3-example-container">
    <h2>D3.js 示例</h2>
    
    <!-- SVG 容器 -->
    <div ref="svgContainer" class="svg-container"></div>
    
    <!-- 控制按钮 -->
    <div class="controls">
      <button @click="generateRandomData">生成随机数据</button>
      <button @click="clearChart">清空图表</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import * as d3 from 'd3';
import { createSVG, createColorScale } from '../utils/d3Helper';

const svgContainer = ref<HTMLElement | null>(null);
let svg: d3.Selection<SVGSVGElement, unknown, null, undefined> | null = null;
let data: Array<{ name: string; value: number }> = [];

const width = 800;
const height = 400;
const margin = { top: 20, right: 20, bottom: 40, left: 60 };

onMounted(() => {
  if (svgContainer.value) {
    initializeChart();
    generateRandomData();
  }
});

onUnmounted(() => {
  clearChart();
});

function initializeChart() {
  if (!svgContainer.value) return;

  // 创建 SVG
  svg = d3
    .select(svgContainer.value)
    .append('svg')
    .attr('width', width)
    .attr('height', height)
    .style('background-color', '#f9fafb')
    .style('border', '1px solid #e5e7eb')
    .style('border-radius', '8px');
}

function generateRandomData() {
  if (!svg) return;

  // 生成随机数据
  const categories = ['A', 'B', 'C', 'D', 'E', 'F'];
  data = categories.map((name) => ({
    name,
    value: Math.floor(Math.random() * 100) + 10,
  }));

  drawBarChart();
}

function drawBarChart() {
  if (!svg) return;

  // 清除现有内容
  svg.selectAll('*').remove();

  // 创建比例尺
  const xScale = d3
    .scaleBand()
    .domain(data.map((d) => d.name))
    .range([margin.left, width - margin.right])
    .padding(0.2);

  const yScale = d3
    .scaleLinear()
    .domain([0, d3.max(data, (d) => d.value) || 100])
    .nice()
    .range([height - margin.bottom, margin.top]);

  // 创建颜色比例尺
  const colorScale = createColorScale(
    data.map((d) => d.name),
    'category10'
  ) as d3.ScaleOrdinal<string, string>;

  // 绘制坐标轴
  const xAxis = d3.axisBottom(xScale);
  const yAxis = d3.axisLeft(yScale);

  svg
    .append('g')
    .attr('transform', `translate(0, ${height - margin.bottom})`)
    .call(xAxis)
    .selectAll('text')
    .style('text-anchor', 'end')
    .attr('dx', '-.8em')
    .attr('dy', '.15em')
    .attr('transform', 'rotate(-45)');

  svg
    .append('g')
    .attr('transform', `translate(${margin.left}, 0)`)
    .call(yAxis);

  // 绘制柱状图
  svg
    .selectAll('.bar')
    .data(data)
    .enter()
    .append('rect')
    .attr('class', 'bar')
    .attr('x', (d) => xScale(d.name) || 0)
    .attr('y', (d) => yScale(d.value))
    .attr('width', xScale.bandwidth())
    .attr('height', (d) => height - margin.bottom - yScale(d.value))
    .attr('fill', (d) => colorScale(d.name) as string)
    .attr('rx', 4)
    .attr('ry', 4)
    .style('cursor', 'pointer')
    .on('mouseover', function (event, d) {
      d3.select(this).attr('opacity', 0.7);
      
      // 显示工具提示
      const tooltip = svg!
        .append('g')
        .attr('class', 'tooltip')
        .attr('transform', `translate(${xScale(d.name)! + xScale.bandwidth() / 2}, ${yScale(d.value) - 10})`);

      tooltip
        .append('rect')
        .attr('x', -30)
        .attr('y', -20)
        .attr('width', 60)
        .attr('height', 20)
        .attr('fill', '#333')
        .attr('rx', 4);

      tooltip
        .append('text')
        .attr('text-anchor', 'middle')
        .attr('fill', '#fff')
        .attr('font-size', '12px')
        .attr('dy', '-5')
        .text(d.value);
    })
    .on('mouseout', function () {
      d3.select(this).attr('opacity', 1);
      svg!.selectAll('.tooltip').remove();
    });

  // 添加标题
  svg
    .append('text')
    .attr('x', width / 2)
    .attr('y', margin.top)
    .attr('text-anchor', 'middle')
    .attr('font-size', '16px')
    .attr('font-weight', 'bold')
    .attr('fill', '#333')
    .text('D3.js 柱状图示例');
}

function clearChart() {
  if (svg) {
    svg.selectAll('*').remove();
  }
  data = [];
}
</script>

<style scoped>
.d3-example-container {
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.d3-example-container h2 {
  margin: 0;
  color: #333;
  font-size: 24px;
}

.svg-container {
  width: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
}

.controls {
  display: flex;
  gap: 10px;
}

.controls button {
  padding: 8px 16px;
  border: 1px solid #3b82f6;
  border-radius: 6px;
  background-color: #3b82f6;
  color: white;
  cursor: pointer;
  font-size: 14px;
  transition: background-color 0.2s ease;
}

.controls button:hover {
  background-color: #2563eb;
}

.controls button:active {
  background-color: #1d4ed8;
}
</style>

