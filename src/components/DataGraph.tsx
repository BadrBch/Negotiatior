import React, { useEffect, useRef } from 'react'
import styled from 'styled-components'
import { motion } from 'framer-motion'
import * as d3 from 'd3'

interface DataGraphProps {
  data: number[]
  color: string
  title: string
  batnaPoint?: { price: number; time: number } | null
  batnaColor?: string
  sellerBatnaPoint?: { price: number; time: number } | null
  buyerBatnaPoint?: { price: number; time: number } | null
}

const GraphContainer = styled(motion.div)`
  width: 500px;
  height: 420px;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(20px);
  border-radius: 20px;
  padding: 30px;
  border: 1px solid rgba(255, 255, 255, 0.3);
  box-shadow: 
    0 12px 32px rgba(0, 0, 0, 0.1),
    0 4px 8px rgba(0, 0, 0, 0.05),
    inset 0 1px 0 rgba(255, 255, 255, 0.8);
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  overflow: hidden;
  
  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 1px;
    background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.8), transparent);
  }
  
  &:hover {
    transform: translateY(-6px) scale(1.02);
    box-shadow: 
      0 20px 48px rgba(0, 0, 0, 0.15),
      0 8px 16px rgba(0, 0, 0, 0.1),
      inset 0 1px 0 rgba(255, 255, 255, 0.9);
  }
`

const GraphTitle = styled.h3`
  font-size: 1rem;
  font-weight: 500;
  color: #333;
  margin-bottom: 15px;
  text-align: center;
  display: ${props => props.children ? 'block' : 'none'};
`

const SvgContainer = styled.div`
  width: 100%;
  height: 360px;
  display: flex;
  align-items: center;
  justify-content: center;
`

const DataGraph: React.FC<DataGraphProps> = ({ 
  data, 
  color, 
  title, 
  batnaPoint, 
  batnaColor = '#e74c3c',
  sellerBatnaPoint,
  buyerBatnaPoint
}) => {
  const svgRef = useRef<SVGSVGElement>(null)

  useEffect(() => {
    if (!svgRef.current) return

    // Clear previous content
    d3.select(svgRef.current).selectAll('*').remove()

    const svg = d3.select(svgRef.current)
    const width = 420
    const height = 300
    const margin = { top: 30, right: 30, bottom: 60, left: 50 }

    const chartWidth = width - margin.left - margin.right
    const chartHeight = height - margin.top - margin.bottom

    const chart = svg
      .append('g')
      .attr('transform', `translate(${margin.left}, ${margin.top})`)

    // Calculate dynamic axis ranges based on BATNA values
    const allBatnaPoints = [sellerBatnaPoint, buyerBatnaPoint, batnaPoint].filter(Boolean);
    
    let xMin = 0, xMax = 12, yMin = 0, yMax = 1000;
    
    if (allBatnaPoints.length > 0) {
      const times = allBatnaPoints.map(point => point!.time);
      const prices = allBatnaPoints.map(point => point!.price);
      
      xMin = Math.max(0, Math.min(...times) - 2);
      xMax = Math.min(12, Math.max(...times) + 2);
      yMin = Math.max(0, Math.min(...prices) * 0.9); // -10%
      yMax = Math.min(1000, Math.max(...prices) * 1.1); // +10%
    }

    // Scales for orthonormal frame with dynamic domains
    const xScale = d3.scaleLinear()
      .domain([xMin, xMax])
      .range([0, chartWidth])

    const yScale = d3.scaleLinear()
      .domain([yMin, yMax])
      .range([chartHeight, 0])

    // Draw orthonormal frame with positive values only
    // X-axis (horizontal line at bottom)
    chart.append('line')
      .attr('x1', 0)
      .attr('y1', chartHeight)
      .attr('x2', chartWidth)
      .attr('y2', chartHeight)
      .attr('stroke', '#666')
      .attr('stroke-width', 2)
      .attr('opacity', 0.8)

    // Y-axis (vertical line at left)
    chart.append('line')
      .attr('x1', 0)
      .attr('y1', 0)
      .attr('x2', 0)
      .attr('y2', chartHeight)
      .attr('stroke', '#666')
      .attr('stroke-width', 2)
      .attr('opacity', 0.8)

    // Add grid lines for dynamic domains
    // Vertical grid lines (X-axis: dynamic range)
    const xStep = Math.max(1, Math.ceil((xMax - xMin) / 10));
    for (let i = xMin; i <= xMax; i += xStep) {
      chart.append('line')
        .attr('x1', xScale(i))
        .attr('y1', 0)
        .attr('x2', xScale(i))
        .attr('y2', chartHeight)
        .attr('stroke', '#e1e5e9')
        .attr('stroke-width', 1)
        .attr('opacity', 0.5)
    }

    // Horizontal grid lines (Y-axis: dynamic range)
    const yStep = Math.max(50, Math.ceil((yMax - yMin) / 10));
    for (let i = yMin; i <= yMax; i += yStep) {
      chart.append('line')
        .attr('x1', 0)
        .attr('y1', yScale(i))
        .attr('x2', chartWidth)
        .attr('y2', yScale(i))
        .attr('stroke', '#e1e5e9')
        .attr('stroke-width', 1)
        .attr('opacity', 0.5)
    }

    // Add axis labels with units
    chart.append('text')
      .attr('x', chartWidth / 2)
      .attr('y', chartHeight + margin.bottom - 10)
      .attr('text-anchor', 'middle')
      .attr('fill', '#666')
      .attr('font-size', '14px')
      .attr('font-weight', '600')
      .text('Time to Remit Key (months)')

    chart.append('text')
      .attr('transform', 'rotate(-90)')
      .attr('x', -chartHeight / 2)
      .attr('y', -margin.left + 20)
      .attr('text-anchor', 'middle')
      .attr('fill', '#666')
      .attr('font-size', '14px')
      .attr('font-weight', '600')
      .text('Price ($1000)')

    // Draw BATNA point if provided
    if (batnaPoint) {
      const x = xScale(batnaPoint.time)
      const y = yScale(batnaPoint.price)
      
      // Add BATNA point with the specified color and animation
      const batnaCircle = chart.append('circle')
        .attr('cx', x)
        .attr('cy', y)
        .attr('r', 0) // Start with radius 0
        .attr('fill', batnaColor)
        .attr('stroke', batnaColor)
        .attr('stroke-width', 2)
        .attr('opacity', 0.9)
      
      // Animate the BATNA point appearance
      batnaCircle
        .transition()
        .duration(800)
        .delay(400)
        .attr('r', 10)
        .ease(d3.easeElasticOut)
      
      // Add BATNA label with the same color
      const batnaLabel = chart.append('text')
        .attr('x', x + 18)
        .attr('y', y - 12)
        .attr('text-anchor', 'start')
        .attr('fill', batnaColor)
        .attr('font-size', '12px')
        .attr('font-weight', '700')
        .attr('opacity', 0)
        .text('BATNA')
      
      // Animate the BATNA label appearance
      batnaLabel
        .transition()
        .duration(600)
        .delay(600)
        .attr('opacity', 1)
        .ease(d3.easeCubicOut)
    }

  }, [data, color, batnaPoint, batnaColor, sellerBatnaPoint, buyerBatnaPoint])

  return (
    <GraphContainer
      initial={{ opacity: 0, y: 20, scale: 0.8 }}
      animate={{ 
        opacity: 1, 
        y: 0, 
        scale: (sellerBatnaPoint || buyerBatnaPoint) ? 1.1 : 1 
      }}
      transition={{ 
        duration: 0.8, 
        ease: "easeOut",
        scale: {
          duration: 0.8,
          delay: 0.2,
          ease: "easeOut"
        }
      }}
      whileHover={{ 
        scale: (sellerBatnaPoint || buyerBatnaPoint) ? 1.15 : 1.02,
        transition: { duration: 0.3 }
      }}
    >
      <GraphTitle>{title}</GraphTitle>
      <SvgContainer>
        <svg
          ref={svgRef}
          width="420"
          height="300"
          style={{ maxWidth: '100%', height: 'auto' }}
        />
      </SvgContainer>
    </GraphContainer>
  )
}

export default DataGraph 