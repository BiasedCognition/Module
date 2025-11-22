/**
 * D3.js 辅助工具函数
 * 提供常用的 D3.js 功能封装
 */

import * as d3 from 'd3';

/**
 * 创建 SVG 容器
 * @param container 容器元素或选择器
 * @param width SVG 宽度
 * @param height SVG 高度
 * @returns D3 选择的 SVG 元素
 */
export function createSVG(
  container: string | HTMLElement,
  width: number,
  height: number
): d3.Selection<SVGSVGElement, unknown, null, undefined> {
  const selection = typeof container === 'string' 
    ? d3.select(container) 
    : d3.select(container);
  
  // 清除现有内容
  selection.selectAll('*').remove();
  
  // 创建 SVG
  const svg = selection
    .append('svg')
    .attr('width', width)
    .attr('height', height)
    .attr('viewBox', `0 0 ${width} ${height}`)
    .style('display', 'block');
  
  return svg;
}

/**
 * 创建缩放功能
 * @param width 容器宽度
 * @param height 容器高度
 * @param minZoom 最小缩放比例
 * @param maxZoom 最大缩放比例
 * @returns D3 缩放行为
 */
export function createZoom(
  width: number,
  height: number,
  minZoom: number = 0.5,
  maxZoom: number = 4
): d3.ZoomBehavior<SVGElement, unknown> {
  return d3
    .zoom<SVGElement, unknown>()
    .scaleExtent([minZoom, maxZoom])
    .extent([[0, 0], [width, height]])
    .on('zoom', (event) => {
      // 缩放事件处理
      const { transform } = event;
      d3.select(event.sourceEvent?.target as SVGElement)
        .select('g')
        .attr('transform', transform.toString());
    });
}

/**
 * 创建力导向图
 * @param nodes 节点数据
 * @param links 链接数据
 * @returns 力导向图模拟器
 */
export function createForceSimulation<T extends d3.SimulationNodeDatum>(
  nodes: T[],
  links?: Array<{ source: number | T; target: number | T }>
): d3.Simulation<T, d3.SimulationLinkDatum<T>> {
  const simulation = d3
    .forceSimulation<T>(nodes)
    .force('charge', d3.forceManyBody().strength(-300))
    .force('center', d3.forceCenter())
    .force('collision', d3.forceCollide().radius(30));

  if (links) {
    simulation.force(
      'link',
      d3
        .forceLink<T, d3.SimulationLinkDatum<T>>(links)
        .id((d: any) => d.id)
        .distance(100)
    );
  }

  return simulation;
}

/**
 * 创建颜色比例尺
 * @param domain 数据域
 * @param scheme 颜色方案（默认为 'category10'）
 * @returns 颜色比例尺函数
 */
export function createColorScale(
  domain: string[] | number[],
  scheme: string = 'category10'
): d3.ScaleOrdinal<string, string> | d3.ScaleSequential<string, never> {
  if (typeof domain[0] === 'number') {
    // 数值型数据，使用连续颜色比例尺
    return d3
      .scaleSequential(d3.interpolateViridis)
      .domain(domain as number[]);
  } else {
    // 分类型数据，使用序数颜色比例尺
    const colorSchemes: Record<string, readonly string[]> = {
      category10: d3.schemeCategory10,
      category20: d3.schemeCategory20,
      category20b: d3.schemeCategory20b,
      category20c: d3.schemeCategory20c,
      accent: d3.schemeAccent,
      dark2: d3.schemeDark2,
      paired: d3.schemePaired,
      pastel1: d3.schemePastel1,
      pastel2: d3.schemePastel2,
      set1: d3.schemeSet1,
      set2: d3.schemeSet2,
      set3: d3.schemeSet3,
    };

    const colors = colorSchemes[scheme] || d3.schemeCategory10;
    return d3.scaleOrdinal<string, string>(colors).domain(domain as string[]);
  }
}

/**
 * 创建坐标轴
 * @param scale 比例尺
 * @param orientation 方向（'bottom' | 'top' | 'left' | 'right'）
 * @returns D3 坐标轴生成器
 */
export function createAxis(
  scale: d3.AxisScale<d3.AxisDomain>,
  orientation: 'bottom' | 'top' | 'left' | 'right' = 'bottom'
): d3.Axis<d3.AxisDomain> {
  const axisGenerators = {
    bottom: d3.axisBottom,
    top: d3.axisTop,
    left: d3.axisLeft,
    right: d3.axisRight,
  };

  return axisGenerators[orientation](scale);
}

/**
 * 导出 D3 命名空间，方便直接使用
 */
export { d3 };


