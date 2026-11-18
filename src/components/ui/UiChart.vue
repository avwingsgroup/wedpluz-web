<script lang="ts">
export const CHART_PALETTE = ['#9b119b', '#e7257f', '#470047', '#f5b544', '#3b6ff2', '#22a847', '#8f949c']
</script>

<script setup lang="ts">
import { computed } from 'vue'
import VChart from 'vue-echarts'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { BarChart, LineChart, PieChart } from 'echarts/charts'
import { GridComponent, LegendComponent, TooltipComponent, DataZoomComponent } from 'echarts/components'
import type { EChartsOption } from 'echarts'

use([CanvasRenderer, BarChart, LineChart, PieChart, GridComponent, LegendComponent, TooltipComponent, DataZoomComponent])

/** Brand-consistent ECharts wrapper. Only the pieces we use are registered to keep the chunk small. */
const props = withDefaults(defineProps<{ option: EChartsOption; height?: string; loading?: boolean }>(), { height: '280px', loading: false })

const merged = computed<EChartsOption>(() => ({
  color: CHART_PALETTE,
  textStyle: { fontFamily: 'Manrope, system-ui, sans-serif', color: '#3c4048' },
  grid: { left: 8, right: 12, top: 24, bottom: 8, containLabel: true },
  tooltip: { trigger: 'axis', backgroundColor: '#21242a', borderWidth: 0, textStyle: { color: '#fff', fontSize: 12 }, padding: [8, 12] },
  ...props.option,
}))
</script>

<template>
  <VChart :option="merged" :style="{ height, width: '100%' }" :loading="loading" autoresize :loading-options="{ color: '#9b119b', maskColor: 'rgba(255,255,255,0.6)' }" />
</template>
