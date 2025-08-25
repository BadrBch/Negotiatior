import React, { useState } from 'react'
import styled from 'styled-components'
import { runComparison, downloadComparisonResults, type ComparisonResult, type ComparisonMetrics } from '../simulator/comparison'

interface ComparisonPanelProps {
  embedded?: boolean
}

const Panel = styled.div<{ embedded?: boolean }>`
  position: ${props => props.embedded ? 'static' : 'fixed'};
  ${props => !props.embedded && `
    top: 20px;
    right: 20px;
  `}
  background: white;
  border: 1px solid rgba(0, 0, 0, 0.15);
  border-radius: 16px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
  padding: ${props => props.embedded ? '30px' : '20px'};
  width: ${props => props.embedded ? '100%' : '400px'};
  z-index: 2000;
  max-height: 80vh;
  overflow-y: auto;
`

const Input = styled.input`
  width: 100px;
  padding: 8px 10px;
  border: 1px solid rgba(0, 0, 0, 0.2);
  border-radius: 8px;
  font-size: 13px;
  margin-right: 12px;
  background: white;
  color: black;
  
  &::placeholder {
    color: rgba(0, 0, 0, 0.5);
  }
`

const Button = styled.button`
  padding: 10px 14px;
  border-radius: 10px;
  border: 0;
  background: linear-gradient(135deg, #10b981 0%, #047857 100%);
  color: #fff;
  cursor: pointer;
  font-size: 14px;
  margin-right: 8px;
  
  &:disabled {
    background: #6b7280;
    cursor: not-allowed;
  }
`

const Title = styled.h3`
  font-size: 20px;
  font-weight: 700;
  color: black;
  margin: 0 0 24px 0;
`

const ResultsTable = styled.table`
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
  background: #1f2937;
  border-radius: 8px;
  overflow: hidden;
  margin-top: 24px;
  color: white;
`

const TableHeader = styled.th`
  background: #374151;
  padding: 12px 10px;
  text-align: left;
  font-weight: 600;
  border-bottom: 1px solid #4b5563;
  color: white;
`

const TableCell = styled.td`
  padding: 12px 10px;
  border-bottom: 1px solid #4b5563;
  color: white;
  
  &:first-child {
    font-weight: 600;
    color: #fbbf24;
  }
  
  &:nth-child(even) {
    background-color: rgba(55, 65, 81, 0.5);
  }
  
  &:hover {
    background-color: rgba(75, 85, 99, 0.8);
  }
`

const ProgressBar = styled.div`
  width: 100%;
  height: 10px;
  background: #e5e7eb;
  border-radius: 6px;
  overflow: hidden;
  margin: 16px 0;
  box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.1);
`

const ProgressFill = styled.div<{ progress: number }>`
  height: 100%;
  background: linear-gradient(135deg, #10b981 0%, #047857 100%);
  width: ${props => props.progress}%;
  transition: width 0.3s ease;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
`

const StatusText = styled.div`
  font-size: 13px;
  color: black;
  margin: 12px 0;
`

const Summary = styled.div`
  font-size: 13px;
  color: black;
  margin-top: 24px;
  padding: 16px;
  background: rgba(0, 0, 0, 0.05);
  border-radius: 10px;
  border: 1px solid rgba(0, 0, 0, 0.1);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
`

const InfoBox = styled.div`
  font-size: 12px;
  color: black;
  background: rgba(59, 130, 246, 0.1);
  border: 1px solid rgba(59, 130, 246, 0.2);
  border-radius: 8px;
  padding: 12px;
  margin-bottom: 24px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
`

export default function ComparisonPanel({ embedded }: ComparisonPanelProps) {
  const [count, setCount] = useState<number>(100)
  const [running, setRunning] = useState<boolean>(false)
  const [currentModel, setCurrentModel] = useState<string>('')
  const [progress, setProgress] = useState<number>(0)
  const [result, setResult] = useState<ComparisonResult | null>(null)

  const getExpectedLoadingTime = (simCount: number): string => {
    if (simCount <= 1000) return '5 seconds';
    if (simCount <= 10000) return '10 seconds';
    return '20 seconds';
  };

  const handleRunComparison = async () => {
    if (running) return
    
    setRunning(true)
    setProgress(0)
    setResult(null)
    setCurrentModel('baseline')
    
    try {
      // Calculate loading duration based on simulation count
      const getLoadingDuration = (simCount: number): number => {
        if (simCount <= 1000) return 5000; // 5 seconds for 1000 simulations
        if (simCount <= 10000) return 10000; // 10 seconds for 10000 simulations
        return 20000; // 20 seconds for more than 10000 simulations
      };
      
      const loadingDuration = getLoadingDuration(count);
      const startTime = Date.now();
      
      // Set up progress tracking with realistic timing
      const models = ['baseline', 'ddpg', 'td3', 'sac'];
      let completed = 0;
      
      // Progress updates based on actual loading duration
      const progressInterval = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const progressPercent = Math.min((elapsed / loadingDuration) * 100, 100);
        setProgress(progressPercent);
        
        // Update current model based on progress
        if (progressPercent < 25) {
          setCurrentModel('baseline');
        } else if (progressPercent < 50) {
          setCurrentModel('ddpg');
        } else if (progressPercent < 75) {
          setCurrentModel('td3');
        } else {
          setCurrentModel('sac');
        }
        
        if (elapsed >= loadingDuration) {
          clearInterval(progressInterval);
        }
      }, 100);
      
      // Wait for the calculated loading duration
      await new Promise(resolve => setTimeout(resolve, loadingDuration));
      
      clearInterval(progressInterval);
      setProgress(100);
      setResult(await runComparison(count));
      setCurrentModel('');
      
    } catch (error) {
      console.error('Comparison failed:', error);
      alert(`Comparison failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setRunning(false)
    }
  }

  const handleDownload = () => {
    if (result) {
      downloadComparisonResults(result);
    }
  }

  const getBestModel = (metrics: ComparisonMetrics[]): string => {
    if (metrics.length === 0) return 'N/A';
    
    // Find model with highest deal success rate
    const bestByDealRate = metrics.reduce((best, current) => 
      current.dealRate > best.dealRate ? current : best
    );
    
    return bestByDealRate.modelType;
  }

  const getWorstBATNAError = (metrics: ComparisonMetrics[]): string => {
    if (metrics.length === 0) return 'N/A';
    
    // Find model with lowest total BATNA error
    const bestByError = metrics.reduce((best, current) => {
      const currentTotalError = current.buyerBATNAMAE + current.sellerBATNAMAE;
      const bestTotalError = best.buyerBATNAMAE + best.sellerBATNAMAE;
      return currentTotalError < bestTotalError ? current : best;
    });
    
    return bestByError.modelType;
  }

  return (
    <Panel embedded={embedded}>
      <Title>Model Comparison</Title>
      
      <InfoBox>
        <strong>Comparison:</strong> All models will be tested on the exact same scenarios 
        (identical starting prices, and BATNAs) for accurate performance comparison.
      </InfoBox>
      
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '24px' }}>
        <Input
          type="number"
          min={1}
          max={1000}
          value={count}
          onChange={(e) => setCount(Number(e.target.value))}
          placeholder="# per model"
          disabled={running}
        />
        <Button onClick={handleRunComparison} disabled={running}>
          {running ? 'Running...' : 'Compare Models'}
        </Button>
      </div>

      {running && (
        <>
          <StatusText>
            {currentModel ? `Testing ${currentModel} model...` : 'Initializing comparison...'}
            <br />
            <small style={{ fontSize: '11px', opacity: 0.8 }}>
              Expected time: {getExpectedLoadingTime(count)}
            </small>
          </StatusText>
          <ProgressBar>
            <ProgressFill progress={progress} />
          </ProgressBar>
          <StatusText>
            {Math.round(progress)}% complete
          </StatusText>
        </>
      )}

      {result && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <StatusText>Comparison completed!</StatusText>
            <Button onClick={handleDownload}>
              Download CSV
            </Button>
          </div>

          <ResultsTable>
            <thead>
              <tr>
                <TableHeader>Model</TableHeader>
                <TableHeader>Deal Rate</TableHeader>
                <TableHeader>Closure Rate (ZOPA)</TableHeader>
                <TableHeader>Buyer MAE</TableHeader>
                <TableHeader>Seller MAE</TableHeader>
                <TableHeader>Avg Rounds</TableHeader>
              </tr>
            </thead>
            <tbody>
              {result.metrics.map((metric) => (
                <tr key={metric.modelType}>
                  <TableCell>{metric.modelType.toUpperCase()}</TableCell>
                  <TableCell>{metric.dealRate}%</TableCell>
                  <TableCell>{metric.closureRateInZOPA}%</TableCell>
                  <TableCell>{metric.buyerBATNAMAE}</TableCell>
                  <TableCell>{metric.sellerBATNAMAE}</TableCell>
                  <TableCell>{metric.averageRounds}</TableCell>
                </tr>
              ))}
            </tbody>
          </ResultsTable>

          <Summary>
            <strong>Summary:</strong><br/>
            Best Deal Success Rate: <strong>{getBestModel(result.metrics)}</strong><br/>
            Best BATNA Estimation: <strong>{getWorstBATNAError(result.metrics)}</strong><br/>
            Total Simulations: <strong>{result.metrics.reduce((sum, m) => sum + m.totalSimulations, 0)}</strong>
          </Summary>
        </>
      )}
    </Panel>
  )
}