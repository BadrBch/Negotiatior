import React, { useEffect, useState } from 'react'
import styled from 'styled-components'
import {
  runMultipleSimulations,
  buildZipBlob,
  NegotiationParameters,
  runSingleNegotiation,
  BidRecord,
  BuyerProfile,
  SellerProfile,
} from '../simulator/negotiation'

const Panel = styled.div`
  position: fixed;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(53, 53, 53, 0.95);
  border: 1px solid rgba(0, 0, 0, 0.15);
  border-radius: 16px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
  padding: 16px;
  display: flex;
  gap: 12px;
  align-items: center;
  z-index: 2000;
`

const Input = styled.input`
  width: 110px;
  padding: 8px 10px;
  border: 1px solid rgba(0, 0, 0, 0.2);
  border-radius: 8px;
  font-size: 12px;
`

const Button = styled.button`
  padding: 10px 14px;
  border-radius: 10px;
  border: 0;
  background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
  color: #fff;
  cursor: pointer;
  font-size: 12px;
`

const Small = styled.div`
  font-size: 12px;
  color: #374151;
`

const Title = styled.div`
  font-size: 14px;
  font-weight: 700;
  color: #111827;
  margin-right: 8px;
`

function triggerDownload(url: string, filename: string) {
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
}

export default function SimulationPanel() {
  const [count, setCount] = useState<number>(100)
  const [running, setRunning] = useState<boolean>(false)
  const [dealRate, setDealRate] = useState<string>('')
  const [csvUrl, setCsvUrl] = useState<string>('')
  const [zipUrl, setZipUrl] = useState<string>('')
  const [stamp, setStamp] = useState<string>('')
  
  // Step-by-step simulation state
  const [stepMode, setStepMode] = useState<boolean>(false)
  const [currentRounds, setCurrentRounds] = useState<BidRecord[] | null>(null)
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0)
  const [currentParams, setCurrentParams] = useState<NegotiationParameters | null>(null)
  const [showSteps, setShowSteps] = useState<boolean>(false)

  useEffect(() => {
    return () => {
      if (csvUrl) URL.revokeObjectURL(csvUrl)
      if (zipUrl) URL.revokeObjectURL(zipUrl)
    }
  }, [csvUrl, zipUrl])

  const onRun = async () => {
    if (running) return
    setRunning(true)
    try {
      const res = runMultipleSimulations(count)
      setDealRate(`${(res.stats.deal_success_rate * 100).toFixed(1)}%`)

      // clean previous
      if (csvUrl) URL.revokeObjectURL(csvUrl)
      if (zipUrl) URL.revokeObjectURL(zipUrl)

      const csvBlob = new Blob([res.csv], { type: 'text/csv;charset=utf-8' })
      const newCsvUrl = URL.createObjectURL(csvBlob)
      setCsvUrl(newCsvUrl)

      const ts = new Date().toISOString().replace(/[:]/g, '-').slice(0, 19)
      setStamp(ts)

      // Trigger CSV download immediately (user gesture friendly)
      triggerDownload(newCsvUrl, `negotiations_${ts}_horizontal.csv`)

      // Build ZIP in background, then auto-download when ready
      buildZipBlob(res.sessions).then((zipBlob) => {
        const newZipUrl = URL.createObjectURL(zipBlob)
        setZipUrl(newZipUrl)
        triggerDownload(newZipUrl, `negotiations_${ts}_sessions.zip`)
      })
    } finally {
      setRunning(false)
    }
  }
  
  
  const onNext = () => {
    if (!currentRounds || currentStepIndex >= currentRounds.length) return
    setCurrentStepIndex(prev => prev + 1)
  }
  
  const onReset = () => {
    setStepMode(false)
    setCurrentRounds(null)
    setCurrentStepIndex(0)
    setCurrentParams(null)
    setShowSteps(false)
    setDealRate('')
  }

  // Removed Run 1 per request

  return (
    <Panel>
      <Title>Simulation</Title>
      {!stepMode ? (
        <>
          <Input
            type="number"
            min={1}
            value={count}
            onChange={(e) => setCount(Number(e.target.value))}
            placeholder="# sessions"
          />
          <Button onClick={onRun} disabled={running}>{running ? 'Running...' : 'Run & Download'}</Button>
          {dealRate && <Small>Deal rate: {dealRate}</Small>}
          {csvUrl && (
            <Button onClick={() => triggerDownload(csvUrl, `negotiations_${stamp}_horizontal.csv`)}>
              Download CSV
            </Button>
          )}
          {zipUrl && (
            <Button onClick={() => triggerDownload(zipUrl, `negotiations_${stamp}_sessions.zip`)}>
              Download ZIP
            </Button>
          )}
        </>
      ) : (
        <>
          <Button onClick={onNext} disabled={!currentRounds || currentStepIndex >= currentRounds.length}>
            {currentStepIndex >= (currentRounds?.length || 0) ? 'Finished' : 'Next'}
          </Button>
          <Button onClick={onReset}>Reset</Button>
          {currentParams && (
            <Small>
              Seller: {currentParams.seller_profile} | Buyer: {currentParams.buyer_profile}<br/>
              SP: {currentParams.starting_price} | SB: {currentParams.seller_batna.toFixed(1)} | BB: {currentParams.buyer_batna.toFixed(1)}
            </Small>
          )}
          {showSteps && currentRounds && (
            <Small>
              Step {Math.min(currentStepIndex + 1, currentRounds.length)}/{currentRounds.length}:
              {currentStepIndex < currentRounds.length && (
                <> {currentRounds[currentStepIndex].agent} bids {currentRounds[currentStepIndex].bid.toFixed(2)}</>
              )}
            </Small>
          )}
          {dealRate && <Small>{dealRate}</Small>}
        </>
      )}
    </Panel>
  )
}


