import ReactEChartsCore from 'echarts-for-react/lib/core';
import * as echarts from 'echarts/core';
import { BarChart, LineChart } from 'echarts/charts';
import {
  GridComponent,
  LegendComponent,
  TooltipComponent,
} from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';

echarts.use([
  BarChart,
  LineChart,
  GridComponent,
  LegendComponent,
  TooltipComponent,
  CanvasRenderer,
]);

const ResolvedEChartsCore =
  typeof ReactEChartsCore === 'function'
    ? ReactEChartsCore
    : ReactEChartsCore?.default || ReactEChartsCore;

export default function EChartsRenderer({ height, option }) {
  return (
    <ResolvedEChartsCore
      echarts={echarts}
      lazyUpdate
      notMerge
      option={option}
      opts={{ renderer: 'canvas' }}
      style={{ height, width: '100%' }}
    />
  );
}
