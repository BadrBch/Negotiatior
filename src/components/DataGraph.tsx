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
  bidData?: { month: number; price: number; agent: 'seller' | 'buyer'; roundIndex?: number }[]
  allRounds?: { month: number; price: number; agent: 'seller' | 'buyer'; roundIndex: number }[]
  batnaValue?: number
  estimatedBatnaValue?: number
  showAllBids?: boolean
  graphType?: 'seller' | 'buyer'
  startingPrice?: number
}

const GraphContainer = styled(motion.div)`
  width: 500px;
  height: 420px;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(20px);
  border-radius: 20px;
  padding: 20px;
  border: 1px solid rgba(255, 255, 255, 0.3);
  box-shadow: 
    0 12px 32px rgba(0, 0, 0, 0.1),
    0 4px 8px rgba(0, 0, 0, 0.05),
    inset 0 1px 0 rgba(255, 255, 255, 0.8);
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  overflow: visible;
  
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
  overflow: visible;
`

const DataGraph: React.FC<DataGraphProps> = ({ 
  data, 
  color, 
  title, 
  batnaPoint, 
  batnaColor = '#e74c3c',
  sellerBatnaPoint,
  buyerBatnaPoint,
  bidData = [],
  allRounds = [],
  batnaValue,
  estimatedBatnaValue,
  showAllBids = false,
  graphType,
  startingPrice
}) => {
  const svgRef = useRef<SVGSVGElement>(null)

  useEffect(() => {
    // Remove any existing tooltips when component updates
    d3.selectAll('.graph-tooltip').remove()
    if (!svgRef.current) return

    // Clear previous content
    d3.select(svgRef.current).selectAll('*').remove()

    const svg = d3.select(svgRef.current)
    const width = 500
    const height = 340
    const margin = { top: 80, right: 60, bottom: 60, left: 60 } // Increased top margin for legend and right margin for x-axis visibility

    const chartWidth = width - margin.left - margin.right
    const chartHeight = height - margin.top - margin.bottom

    // Create zoom behavior
    const zoom = d3.zoom()
      .scaleExtent([0.5, 5])
      .on('zoom', (event) => {
        const { transform } = event
        chart.attr('transform', `translate(${margin.left}, ${margin.top}) ${transform}`)
        
        // Update axes with zoom transform
        const newXScale = transform.rescaleX(xScale)
        const newYScale = transform.rescaleY(yScale)
        
        // Update axis ticks
        chart.selectAll('.x-axis-tick').remove()
        chart.selectAll('.y-axis-tick').remove()
        
        // Redraw x-axis ticks
        const xTicks = newXScale.ticks(8)
        xTicks.forEach(tick => {
          const tickX = newXScale(tick)
          if (tickX >= 0 && tickX <= chartWidth) {
            chart.append('line')
              .attr('class', 'x-axis-tick')
              .attr('x1', tickX)
              .attr('y1', chartHeight)
              .attr('x2', tickX)
              .attr('y2', chartHeight + 5)
              .attr('stroke', '#666')
              .attr('stroke-width', 1)
              .attr('opacity', 0.7)
            
            chart.append('text')
              .attr('class', 'x-axis-tick')
              .attr('x', tickX)
              .attr('y', chartHeight + 25)
              .attr('text-anchor', 'middle')
              .attr('fill', '#555')
              .attr('font-size', '11px')
              .attr('font-weight', '600')
              .text(`M${Math.round(tick)}`)
          }
        })
        
        // Redraw y-axis ticks
        const yTicks = newYScale.ticks(6)
        yTicks.forEach(tick => {
          const tickY = newYScale(tick)
          if (tickY >= 0 && tickY <= chartHeight) {
            chart.append('line')
              .attr('class', 'y-axis-tick')
              .attr('x1', -5)
              .attr('y1', tickY)
              .attr('x2', 0)
              .attr('y2', tickY)
              .attr('stroke', '#666')
              .attr('stroke-width', 1)
              .attr('opacity', 0.7)
            
            chart.append('text')
              .attr('class', 'y-axis-tick')
              .attr('x', -12)
              .attr('y', tickY + 4)
              .attr('text-anchor', 'end')
              .attr('fill', '#555')
              .attr('font-size', '12px')
              .attr('font-weight', '500')
              .text(`${Math.round(tick)}`)
          }
        })
      })

    // Apply zoom behavior to svg
    svg.call(zoom)

    const chart = svg
      .append('g')
      .attr('transform', `translate(${margin.left}, ${margin.top})`)
      .attr('class', 'chart-content')
    
    // Create tooltip div (initially hidden)
    const tooltip = d3.select('body').selectAll('.graph-tooltip').data([0])
      .enter().append('div')
      .attr('class', 'graph-tooltip')
      .style('position', 'absolute')
      .style('background', 'rgba(0, 0, 0, 0.9)')
      .style('color', 'white')
      .style('padding', '8px 12px')
      .style('border-radius', '6px')
      .style('font-size', '12px')
      .style('font-weight', '500')
      .style('pointer-events', 'none')
      .style('opacity', 0)
      .style('z-index', '10000')
      .style('box-shadow', '0 4px 12px rgba(0,0,0,0.3)')

    // Calculate dynamic axis ranges based on bid data and BATNA values
    const allBatnaPoints = [sellerBatnaPoint, buyerBatnaPoint, batnaPoint].filter(Boolean);
    const allValues = [];
    
    // Determine which data to use for calculations
    const dataToUse = showAllBids && allRounds.length > 0 ? allRounds : bidData;
    
    // Include bid data in range calculation
    if (dataToUse.length > 0) {
      allValues.push(...dataToUse.map(bid => bid.price));
    }
    
    // Include BATNA values and starting price in range calculation
    if (batnaValue) allValues.push(batnaValue);
    if (estimatedBatnaValue) allValues.push(estimatedBatnaValue);
    if (startingPrice) allValues.push(startingPrice);
    if (allBatnaPoints.length > 0) {
      allValues.push(...allBatnaPoints.map(point => point!.price));
    }
    
    let xMin = 0, xMax = 12, yMin = 0, yMax = 1000;

    // Center X domain around current month-to-key (M) from latest bid
    if (dataToUse.length > 0) {
      const currentM = dataToUse[dataToUse.length - 1].month;
      xMin = Math.max(0, currentM - 3);
      xMax = Math.min(12, currentM + 3);
    }

    // Simpler dynamic scaling for Y
    if (allValues.length > 0) {
      const dataMin = Math.min(...allValues);
      const dataMax = Math.max(...allValues);
      const range = Math.max(1, dataMax - dataMin);
      yMin = Math.max(0, dataMin - range * 0.10);
      yMax = dataMax + range * 0.10;
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

    // Add enhanced grid lines for month boundaries
    // Vertical grid lines (X-axis) with enhanced styling
    const xStep = 1; // Show grid line for each month
    for (let i = xMin; i <= xMax; i += xStep) {
      const isKeyMonth = i === 0 || i === 6 || i === 12
      chart.append('line')
        .attr('x1', xScale(i))
        .attr('y1', 0)
        .attr('x2', xScale(i))
        .attr('y2', chartHeight)
        .attr('stroke', isKeyMonth ? '#c1c7cd' : '#e1e5e9')
        .attr('stroke-width', isKeyMonth ? 1.5 : 1)
        .attr('opacity', isKeyMonth ? 0.7 : 0.4)
        .attr('stroke-dasharray', isKeyMonth ? 'none' : '2,2')
    }

    // Horizontal grid lines (Y-axis: dynamic range) - More granular grid
    const yStep = Math.max(25, Math.ceil((yMax - yMin) / 12));
    for (let i = Math.ceil(yMin / yStep) * yStep; i <= yMax; i += yStep) {
      chart.append('line')
        .attr('x1', 0)
        .attr('y1', yScale(i))
        .attr('x2', chartWidth)
        .attr('y2', yScale(i))
        .attr('stroke', '#e1e5e9')
        .attr('stroke-width', 1)
        .attr('opacity', 0.5)
    }

    // Add X-axis tick marks and labels for month-to-key
    for (let i = xMin; i <= xMax; i += 1) {
      const tickX = xScale(i)
      
      // Only draw ticks that are within the visible chart area with some padding
      if (tickX >= -10 && tickX <= chartWidth + 10) {
        // Add tick mark
        chart.append('line')
          .attr('x1', tickX)
          .attr('y1', chartHeight)
          .attr('x2', tickX)
          .attr('y2', chartHeight + 5)
          .attr('stroke', '#666')
          .attr('stroke-width', 1)
          .attr('opacity', 0.7)
        
        // Add tick label
        chart.append('text')
          .attr('x', tickX)
          .attr('y', chartHeight + 25)
          .attr('text-anchor', 'middle')
          .attr('fill', '#555')
          .attr('font-size', '11px')
          .attr('font-weight', '600')
          .text(`M${i}`)
      }
    }

    // Add axis labels
    chart.append('text')
      .attr('x', chartWidth / 2)
      .attr('y', chartHeight + margin.bottom - 15)
      .attr('text-anchor', 'middle')
      .attr('fill', '#555')
      .attr('font-size', '13px')
      .attr('font-weight', '600')
      .text('Month-to-Key (Time Horizon)')
      
    // Add month timeline visualization for context
    if (allRounds.length > 1) {
      // Draw faint connecting line showing the complete negotiation timeline
      const timelineLine = d3.line<{ month: number; price: number; agent: 'seller' | 'buyer'; roundIndex: number }>()
        .x(d => xScale(d.month))
        .y(d => yScale(d.price))
        .curve(d3.curveLinear)

      const timelinePath = chart.append('path')
        .datum(allRounds)
        .attr('fill', 'none')
        .attr('stroke', '#ccc')
        .attr('stroke-width', 1)
        .attr('stroke-dasharray', '2,4')
        .attr('opacity', 0.4)
        .attr('d', timelineLine)
    }
    
    // Add legend for month changes at the top if there are bid data points
    if (dataToUse.length > 0) {
      const legendGroup = svg.append('g')
        .attr('transform', `translate(${width / 2}, 20)`)
        .attr('class', 'legend-group')
      
      // Calculate legend width based on content
      const legendWidth = showAllBids ? 320 : 200
      
      // Legend background
      legendGroup.append('rect')
        .attr('x', -legendWidth / 2)
        .attr('y', -12)
        .attr('width', legendWidth)
        .attr('height', 35)
        .attr('fill', 'rgba(255, 255, 255, 0.95)')
        .attr('stroke', '#ddd')
        .attr('stroke-width', 1)
        .attr('rx', 6)
      
      if (showAllBids) {
        // Seller bid legend
        legendGroup.append('circle')
          .attr('cx', -120)
          .attr('cy', 0)
          .attr('r', 5)
          .attr('fill', '#e74c3c')
          .attr('stroke', '#fff')
          .attr('stroke-width', 2)
        
        legendGroup.append('text')
          .attr('x', -108)
          .attr('y', 4)
          .attr('font-size', '11px')
          .attr('font-weight', '600')
          .attr('fill', '#555')
          .text('Seller bid')
        
        // Buyer bid legend
        legendGroup.append('circle')
          .attr('cx', -40)
          .attr('cy', 0)
          .attr('r', 5)
          .attr('fill', '#4a90e2')
          .attr('stroke', '#fff')
          .attr('stroke-width', 2)
        
        legendGroup.append('text')
          .attr('x', -28)
          .attr('y', 4)
          .attr('font-size', '11px')
          .attr('font-weight', '600')
          .attr('fill', '#555')
          .text('Buyer bid')
        
        // Month decrease legend
        legendGroup.append('circle')
          .attr('cx', 40)
          .attr('cy', 0)
          .attr('r', 6)
          .attr('fill', '#f39c12')
          .attr('stroke', '#e67e22')
          .attr('stroke-width', 3)
        
        legendGroup.append('text')
          .attr('x', 52)
          .attr('y', 4)
          .attr('font-size', '11px')
          .attr('font-weight', '600')
          .attr('fill', '#555')
          .text('Month change')
      } else {
        // Normal bid legend
        legendGroup.append('circle')
          .attr('cx', -70)
          .attr('cy', 0)
          .attr('r', 5)
          .attr('fill', color)
          .attr('stroke', '#fff')
          .attr('stroke-width', 2)
        
        legendGroup.append('text')
          .attr('x', -58)
          .attr('y', 4)
          .attr('font-size', '11px')
          .attr('font-weight', '600')
          .attr('fill', '#555')
          .text('Normal bid')
        
        // Month decrease legend
        legendGroup.append('circle')
          .attr('cx', 20)
          .attr('cy', 0)
          .attr('r', 6)
          .attr('fill', '#f39c12')
          .attr('stroke', '#e67e22')
          .attr('stroke-width', 3)
        
        legendGroup.append('text')
          .attr('x', 32)
          .attr('y', 4)
          .attr('font-size', '11px')
          .attr('font-weight', '600')
          .attr('fill', '#555')
          .text('Month change')
      }
    }
    
    // Add zoom controls - positioned inside the visible area
    const controlsGroup = svg.append('g')
      .attr('transform', `translate(${width - 120}, 100)`)
      .attr('class', 'zoom-controls')
    
    // Zoom in button - smaller and more compact
    const zoomInBtn = controlsGroup.append('g')
      .attr('class', 'zoom-btn')
      .style('cursor', 'pointer')
      .on('click', () => {
        svg.transition().duration(300).call(
          zoom.scaleBy, 1.5
        )
      })
    
    zoomInBtn.append('rect')
      .attr('x', 0)
      .attr('y', 0)
      .attr('width', 24)
      .attr('height', 20)
      .attr('fill', 'rgba(255, 255, 255, 0.95)')
      .attr('stroke', '#666')
      .attr('stroke-width', 1)
      .attr('rx', 3)
    
    zoomInBtn.append('text')
      .attr('x', 12)
      .attr('y', 14)
      .attr('text-anchor', 'middle')
      .attr('font-size', '12px')
      .attr('font-weight', 'bold')
      .attr('fill', '#333')
      .text('+')
    
    // Zoom out button
    const zoomOutBtn = controlsGroup.append('g')
      .attr('transform', 'translate(26, 0)')
      .attr('class', 'zoom-btn')
      .style('cursor', 'pointer')
      .on('click', () => {
        svg.transition().duration(300).call(
          zoom.scaleBy, 1 / 1.5
        )
      })
    
    zoomOutBtn.append('rect')
      .attr('x', 0)
      .attr('y', 0)
      .attr('width', 24)
      .attr('height', 20)
      .attr('fill', 'rgba(255, 255, 255, 0.95)')
      .attr('stroke', '#666')
      .attr('stroke-width', 1)
      .attr('rx', 3)
    
    zoomOutBtn.append('text')
      .attr('x', 12)
      .attr('y', 14)
      .attr('text-anchor', 'middle')
      .attr('font-size', '12px')
      .attr('font-weight', 'bold')
      .attr('fill', '#333')
      .text('−')
    
    // Reset zoom button
    const resetBtn = controlsGroup.append('g')
      .attr('transform', 'translate(0, 24)')
      .attr('class', 'reset-btn')
      .style('cursor', 'pointer')
      .on('click', () => {
        svg.transition().duration(500).call(
          zoom.transform,
          d3.zoomIdentity
        )
      })
    
    resetBtn.append('rect')
      .attr('x', 0)
      .attr('y', 0)
      .attr('width', 50)
      .attr('height', 18)
      .attr('fill', 'rgba(255, 255, 255, 0.95)')
      .attr('stroke', '#666')
      .attr('stroke-width', 1)
      .attr('rx', 3)
    
    resetBtn.append('text')
      .attr('x', 25)
      .attr('y', 12)
      .attr('text-anchor', 'middle')
      .attr('font-size', '10px')
      .attr('font-weight', 'bold')
      .attr('fill', '#333')
      .text('Reset')
    
    // Add current month-to-key indicator if we have bid data
    if (dataToUse.length > 0) {
      const currentMonth = dataToUse[dataToUse.length - 1].month
      const currentMonthGroup = chart.append('g')
        .attr('transform', `translate(10, 10)`)
      
      // Current month background
      currentMonthGroup.append('rect')
        .attr('x', -8)
        .attr('y', -8)
        .attr('width', 85)
        .attr('height', 28)
        .attr('fill', 'rgba(0, 0, 0, 0.85)')
        .attr('rx', 6)
      
      // Current month text
      currentMonthGroup.append('text')
        .attr('x', 35)
        .attr('y', 12)
        .attr('text-anchor', 'middle')
        .attr('font-size', '13px')
        .attr('font-weight', '700')
        .attr('fill', 'white')
        .text(`Current: M${currentMonth}`)
    }

    chart.append('text')
      .attr('transform', 'rotate(-90)')
      .attr('x', -chartHeight / 2)
      .attr('y', -margin.left + 25)
      .attr('text-anchor', 'middle')
      .attr('fill', '#555')
      .attr('font-size', '13px')
      .attr('font-weight', '600')
      .text('Price ($1000)')
      
    // Add Y-axis tick labels
    const yTickStep = Math.max(50, Math.ceil((yMax - yMin) / 10));
    for (let i = Math.ceil(yMin / yTickStep) * yTickStep; i <= yMax; i += yTickStep) {
      const tickY = yScale(i);
      
      // Add tick mark
      chart.append('line')
        .attr('x1', -5)
        .attr('y1', tickY)
        .attr('x2', 0)
        .attr('y2', tickY)
        .attr('stroke', '#666')
        .attr('stroke-width', 1)
        .attr('opacity', 0.7);
      
      // Add tick label
      chart.append('text')
        .attr('x', -12)
        .attr('y', tickY + 4)
        .attr('text-anchor', 'end')
        .attr('fill', '#555')
        .attr('font-size', '12px')
        .attr('font-weight', '500')
        .text(`${i}`);
    }

    // Draw BATNA horizontal line if provided
    if (batnaValue) {
      const y = yScale(batnaValue)
      chart.append('line')
        .attr('x1', 0)
        .attr('y1', y)
        .attr('x2', chartWidth)
        .attr('y2', y)
        .attr('stroke', color)
        .attr('stroke-width', 3)
        .attr('stroke-dasharray', '8,4')
        .attr('opacity', 0.8)
      
      chart.append('text')
        .attr('x', chartWidth - 8)
        .attr('y', y - 10)
        .attr('text-anchor', 'end')
        .attr('fill', color)
        .attr('font-size', '14px')
        .attr('font-weight', '700')
        .text('BATNA')
    }

    // Draw Estimated BATNA horizontal line if provided
    if (estimatedBatnaValue) {
      // Use red for buyer graph (showing estimated seller BATNA), blue for seller graph (showing estimated buyer BATNA)
      const estBatnaColor = graphType === 'buyer' ? '#e74c3c' : '#4a90e2'
      
      const y = yScale(estimatedBatnaValue)
      chart.append('line')
        .attr('x1', 0)
        .attr('y1', y)
        .attr('x2', chartWidth)
        .attr('y2', y)
        .attr('stroke', estBatnaColor)
        .attr('stroke-width', 2)
        .attr('stroke-dasharray', '4,2')
        .attr('opacity', 0.6)
      
      chart.append('text')
        .attr('x', chartWidth - 8)
        .attr('y', y + 18)
        .attr('text-anchor', 'end')
        .attr('fill', estBatnaColor)
        .attr('font-size', '12px')
        .attr('font-weight', '600')
        .text('Est. BATNA')
    }

    // Draw starting price point if provided
    if (startingPrice) {
      const startingMonth = 12 // Assume starting price is at month 12
      const x = xScale(startingMonth)
      const y = yScale(startingPrice)
      
      // Add starting price point with distinct styling
      const startingCircle = chart.append('circle')
        .attr('cx', x)
        .attr('cy', y)
        .attr('r', 0)
        .attr('fill', '#666') // Gray color for starting price
        .attr('stroke', '#fff')
        .attr('stroke-width', 2)
        .attr('opacity', 0.9)
        .style('cursor', 'pointer')
        .on('mouseover', function(event) {
          const tooltipContent = `
            <div style="text-align: center;">
              <div style="font-weight: 700; margin-bottom: 4px;">Starting Price</div>
              <div>Price: $${startingPrice.toFixed(2)}K</div>
              <div>Month-to-Key: ${startingMonth}</div>
            </div>
          `
          
          d3.select('.graph-tooltip')
            .style('opacity', 1)
            .html(tooltipContent)
            .style('left', (event.pageX + 10) + 'px')
            .style('top', (event.pageY - 10) + 'px')
        })
        .on('mouseout', function() {
          d3.select('.graph-tooltip')
            .style('opacity', 0)
        })
      
      // Animate starting price point appearance
      startingCircle
        .transition()
        .duration(500)
        .attr('r', 8)
        .ease(d3.easeElasticOut)
    }

    // Add starting price label after all other elements (to ensure it appears on top)
    if (startingPrice) {
      const startingMonth = 12 // Assume starting price is at month 12
      const x = xScale(startingMonth)
      const y = yScale(startingPrice)
      
      // Add "S" label for starting price
      const startingLabel = chart.append('text')
        .attr('x', x)
        .attr('y', y + 5)
        .attr('text-anchor', 'middle')
        .attr('fill', '#000')
        .attr('font-size', '12px')
        .attr('font-weight', '900')
        .attr('opacity', 0)
        .attr('stroke', '#fff')
        .attr('stroke-width', '0.5px')
        .attr('paint-order', 'stroke')
        .style('pointer-events', 'none')
        .text('S')
      
      startingLabel
        .transition()
        .duration(400)
        .delay(300)
        .attr('opacity', 1)
    }

    // Draw bid data points with enhanced month visualization
    dataToUse.forEach((bid, index) => {
      const x = xScale(bid.month)
      const y = yScale(bid.price)
      
      // Determine if month changed from previous bid or starting price
      let monthChanged = false
      if (index > 0) {
        monthChanged = bid.month !== dataToUse[index - 1].month
      } else if (index === 0 && bid.agent === 'buyer') {
        // For first buyer bid, compare to starting price month (assume month 12 for starting price)
        const startingMonth = 12
        monthChanged = bid.month !== startingMonth
      }
      
      // Determine bid color based on agent and showAllBids setting
      let bidColor = color;
      if (showAllBids && bid.agent) {
        bidColor = bid.agent === 'seller' ? '#e74c3c' : '#4a90e2';
      }
      
      // Add bid point with different styling based on month change
      // Use bidder's color for month change points (red for seller, blue for buyer)
      let pointColor = bidColor
      let strokeColor = '#fff'
      let strokeWidth = 2
      
      if (monthChanged) {
        pointColor = bid.agent === 'seller' ? '#e74c3c' : '#4a90e2'
        strokeColor = '#f39c12' // Amber stroke for month changes
        strokeWidth = 3
      }
      
      const bidCircle = chart.append('circle')
        .attr('cx', x)
        .attr('cy', y)
        .attr('r', 0)
        .attr('fill', pointColor)
        .attr('stroke', strokeColor)
        .attr('stroke-width', strokeWidth)
        .attr('opacity', 0.9)
        .style('cursor', 'pointer')
        .on('click', function(event) {
          // Enhanced click interaction - zoom to point
          const clickX = xScale(bid.month)
          const clickY = yScale(bid.price)
          const transform = d3.zoomIdentity
            .translate(chartWidth / 2 - clickX * 2, chartHeight / 2 - clickY * 2)
            .scale(2)
          
          svg.transition().duration(750).call(
            zoom.transform,
            transform
          )
          
          // Highlight clicked point
          d3.select(this)
            .transition()
            .duration(300)
            .attr('r', monthChanged ? 12 : 10)
            .attr('stroke-width', monthChanged ? 5 : 4)
            .transition()
            .duration(300)
            .attr('r', monthChanged ? 7 : 6)
            .attr('stroke-width', monthChanged ? 3 : 2)
        })
        .on('mouseover', function(event) {
          // Show tooltip with bid and month information
          const tooltipContent = `
            <div style="text-align: center;">
              <div style="font-weight: 700; margin-bottom: 4px;">${showAllBids && bid.agent ? bid.agent.charAt(0).toUpperCase() + bid.agent.slice(1) : ''} Bid ${index + 1}</div>
              <div>Price: $${bid.price.toFixed(2)}K</div>
              <div>Month-to-Key: ${bid.month}</div>
              ${monthChanged ? '<div style="color: #f39c12; margin-top: 4px;">⚠ Month Changed</div>' : ''}
              ${index > 0 ? `<div style="margin-top: 4px; font-size: 10px; color: #ccc;">Previous: M${dataToUse[index - 1].month}</div>` : ''}
            </div>
          `
          
          d3.select('.graph-tooltip')
            .style('opacity', 1)
            .html(tooltipContent)
            .style('left', (event.pageX + 10) + 'px')
            .style('top', (event.pageY - 10) + 'px')
          
          // Highlight the point
          d3.select(this)
            .transition()
            .duration(200)
            .attr('r', monthChanged ? 8 : 7)
            .attr('stroke-width', monthChanged ? 4 : 3)
        })
        .on('mouseout', function() {
          // Hide tooltip
          d3.select('.graph-tooltip')
            .style('opacity', 0)
          
          // Return point to normal size
          d3.select(this)
            .transition()
            .duration(200)
            .attr('r', monthChanged ? 7 : 6)
            .attr('stroke-width', monthChanged ? 3 : 2)
        })
      
      // Animate bid point appearance with staggered delay
      bidCircle
        .transition()
        .duration(500)
        .delay(index * 200)
        .attr('r', monthChanged ? 7 : 6)
        .ease(d3.easeElasticOut)
    })

    // Add bid number labels after all circles are drawn (to ensure they appear on top)
    dataToUse.forEach((bid, index) => {
      const x = xScale(bid.month)
      const y = yScale(bid.price)
      
      // Determine if month changed from previous bid or starting price
      let monthChanged = false
      if (index > 0) {
        monthChanged = bid.month !== dataToUse[index - 1].month
      } else if (index === 0 && bid.agent === 'buyer') {
        // For first buyer bid, compare to starting price month (assume month 12 for starting price)
        const startingMonth = 12
        monthChanged = bid.month !== startingMonth
      }
      
      // Add bid number label inside the circle
      const bidLabel = chart.append('text')
        .attr('x', x)
        .attr('y', y + 5)
        .attr('text-anchor', 'middle')
        .attr('fill', '#000')
        .attr('font-size', '11px')
        .attr('font-weight', '900')
        .attr('opacity', 0)
        .attr('stroke', '#fff')
        .attr('stroke-width', '0.5px')
        .attr('paint-order', 'stroke')
        .style('pointer-events', 'none')
        .text(`${index + 1}`)
      
      bidLabel
        .transition()
        .duration(400)
        .delay(index * 200 + 400)
        .attr('opacity', 1)
    })

    // Connect bid points with enhanced trajectory visualization
    if (dataToUse.length > 1) {
      // Create line segments with different styles based on month changes
      for (let i = 0; i < dataToUse.length - 1; i++) {
        const currentBid = dataToUse[i]
        const nextBid = dataToUse[i + 1]
        const monthChanged = nextBid.month !== currentBid.month
        
        // Determine line color based on agent and showAllBids setting
        let lineColor = color;
        if (showAllBids && currentBid.agent) {
          lineColor = currentBid.agent === 'seller' ? '#e74c3c' : '#4a90e2';
        }
        
        const lineSegment = chart.append('line')
          .attr('x1', xScale(currentBid.month))
          .attr('y1', yScale(currentBid.price))
          .attr('x2', xScale(nextBid.month))
          .attr('y2', yScale(nextBid.price))
          .attr('stroke', monthChanged ? '#f39c12' : lineColor) // Amber for month changes
          .attr('stroke-width', monthChanged ? 3 : 2)
          .attr('stroke-dasharray', monthChanged ? '5,3' : 'none')
          .attr('opacity', 0)
        
        // Animate line segment appearance
        lineSegment
          .transition()
          .duration(400)
          .delay(dataToUse.length * 200 + i * 100)
          .attr('opacity', monthChanged ? 0.8 : 0.7)
          .ease(d3.easeLinear)
      }
      
      // Add trajectory direction indicators for month changes
      dataToUse.forEach((bid, index) => {
        let monthChanged = false
        if (index > 0) {
          const prevBid = dataToUse[index - 1]
          monthChanged = bid.month !== prevBid.month
        } else if (index === 0 && bid.agent === 'buyer') {
          // For first buyer bid, compare to starting price month
          const startingMonth = 12
          monthChanged = bid.month !== startingMonth
        }
        
        if (monthChanged && index > 0) {
          // Add small arrow or indicator showing month change
          const prevBid = dataToUse[index - 1]
          const midX = (xScale(prevBid.month) + xScale(bid.month)) / 2
          const midY = (yScale(prevBid.price) + yScale(bid.price)) / 2
          
          const indicator = chart.append('text')
            .attr('x', midX)
            .attr('y', midY - 5)
            .attr('text-anchor', 'middle')
            .attr('fill', '#f39c12') // Amber color for month change indicators
            .attr('font-size', '8px')
            .attr('font-weight', '700')
            .attr('opacity', 0)
            .text('⚠')
          
          indicator
            .transition()
            .duration(300)
            .delay(dataToUse.length * 200 + index * 100 + 200)
            .attr('opacity', 0.8)
        }
      })
    }

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

  }, [data, color, batnaPoint, batnaColor, sellerBatnaPoint, buyerBatnaPoint, bidData, allRounds, batnaValue, estimatedBatnaValue, showAllBids])

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
          width="500"
          height="340"
          style={{ maxWidth: '100%', height: 'auto' }}
        />
      </SvgContainer>
    </GraphContainer>
  )
}

export default DataGraph 