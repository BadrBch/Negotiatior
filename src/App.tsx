import styled from 'styled-components'
import { motion } from 'framer-motion'
import Robot from './components/Robot'
import TranscriptBox, { TranscriptMessage } from './components/TranscriptBox'
import { NegotiationParameters, BuyerProfile, SellerProfile, StepByStepNegotiation, runMultipleSimulations } from './simulator/negotiation'
import DataGraph from './components/DataGraph'
import React, { useState } from 'react'

const AppContainer = styled.div`
  display: flex;
  gap: 50px;
  width: 100vw;
  height: 100vh;
  padding: 50px;
  align-items: flex-start;
  justify-content: space-between;
  background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
  position: relative;
  box-sizing: border-box;
  
  @media (max-width: 1200px) {
    flex-direction: column;
    height: auto;
    gap: 40px;
    padding: 30px;
  }
`

const RobotSection = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  flex: 1;
  gap: 30px;
  
  @media (max-width: 1200px) {
    flex-direction: row;
    justify-content: space-around;
  }
  
  @media (max-width: 768px) {
    flex-direction: column;
  }
`

const RobotContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 30px;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(20px);
  border-radius: 24px;
  padding: 50px;
  border: 1px solid rgba(255, 255, 255, 0.3);
  box-shadow: 
    0 20px 40px rgba(0, 0, 0, 0.1),
    0 8px 16px rgba(0, 0, 0, 0.05),
    inset 0 1px 0 rgba(255, 255, 255, 0.8);
  margin-top: -40px;
  position: relative;
  overflow: visible;
  min-width: 400px;
  min-height: 700px;
  
  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 1px;
    background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.8), transparent);
  }
`



const TabContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  z-index: 10;
`

const LeftTabContainer = styled(TabContainer)`
  left: 20px;
`

const LeftRobotLeftTabs = styled(TabContainer)`
  left: 120px;
  top: 30%;
  transform: translateY(-50%);
  gap: 8px;
`

const LeftRobotRightTabs = styled(TabContainer)`
  right: 80px;
  top: 30%;
  transform: translateY(-50%);
  gap: px;
`

const RightRobotLeftTabs = styled(TabContainer)`
  left: 1320px;
  top: 30%;
  transform: translateY(-50%);
  gap: 8px;
`

const RightRobotRightTabs = styled(TabContainer)`
  right: 80px;
  top: 30%;
  transform: translateY(-50%);
  gap: 8px;
`

const Tab = styled(motion.div)<{ isActive?: boolean }>`
  padding: 12px 8px;
  width: 80px;
  min-width: 80px;
  box-sizing: border-box;
  background: ${props => props.isActive 
    ? 'linear-gradient(135deg, #4a90e2 0%, #357abd 100%)' 
    : 'linear-gradient(135deg, rgba(255, 255, 255, 0.98) 0%, rgba(248, 250, 252, 0.95) 100%)'};
  color: ${props => props.isActive ? 'white' : '#000000'};
  border: 2px solid ${props => props.isActive ? 'rgba(74, 144, 226, 0.8)' : 'rgba(255, 255, 255, 0.4)'};
  border-radius: 12px;
  font-size: 10px;
  font-weight: 700;
  backdrop-filter: blur(10px);
  box-shadow: ${props => props.isActive 
    ? '0 8px 20px rgba(74, 144, 226, 0.4), 0 4px 8px rgba(0, 0, 0, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.3)' 
    : '0 8px 20px rgba(0, 0, 0, 0.15), 0 4px 8px rgba(0, 0, 0, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.8)'};
  min-height: 80px;
  text-align: center;
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  align-items: center;
  position: relative;
  overflow: hidden;
  transition: all 0.3s ease;
  cursor: pointer;
  
  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 1px;
    background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.6), transparent);
  }
  
  &::after {
    content: '';
    position: absolute;
    top: 2px;
    left: 2px;
    right: 2px;
    bottom: 2px;
    background: ${props => props.isActive 
      ? 'linear-gradient(45deg, transparent, rgba(255, 255, 255, 0.1), transparent)' 
      : 'linear-gradient(135deg, rgba(255, 255, 255, 0.15) 0%, transparent 30%, transparent 70%, rgba(255, 255, 255, 0.08) 100%)'};
    border-radius: 10px;
    opacity: 0;
    transition: all 0.3s ease;
    pointer-events: none;
  }
  
  &:hover::after {
    opacity: 1;
    transform: scale(1.02);
  }
`

const TabTitle = styled.div`
  font-size: 8px;
  font-weight: normal;
  margin-bottom: 6px;
  text-transform: uppercase;
  letter-spacing: 0.3px;
`

const TabContent = styled.div<{ isActive?: boolean }>`
  font-size: 12px;
  font-weight: 700;
  color: ${props => props.isActive ? 'rgba(255, 255, 255, 0.9)' : 'rgba(0, 0, 0, 0.8)'};
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
`

const OfferTab = styled.div`
  position: absolute;
  bottom: -80px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(255, 255, 255, 0.98);
  border: 3px solid rgba(0, 0, 0, 0.5);
  border-radius: 12px;
  padding: 15px;
  min-width: 200px;
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.25);
  backdrop-filter: blur(10px);
  z-index: 30;
`

const OfferInput = styled.input`
  width: 100%;
  padding: 8px 12px;
  border: 2px solid rgba(0, 0, 0, 0.3);
  border-radius: 8px;
  font-size: 12px;
  font-weight: 600;
  background: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(10px);
  
  &:focus {
    outline: none;
    border-color: #4a90e2;
    box-shadow: 0 4px 12px rgba(74, 144, 226, 0.2);
  }
`

const OfferLabel = styled.div`
  font-size: 11px;
  font-weight: normal;
  color: #000000;
  margin-bottom: 8px;
  text-align: center;
  text-transform: uppercase;
  letter-spacing: 0.5px;
`

const ButtonContainer = styled.div`
  display: flex;
  gap: 8px;
  margin-bottom: 15px;
  justify-content: center;
  position: absolute;
  z-index: 20;
`

const LeftButtonContainer = styled(ButtonContainer)`
  left: 80px;
  top: 20px;
`

const RightButtonContainer = styled(ButtonContainer)`
  right: 80px;
  top: 20px;
`

const PersonalityButton = styled.button<{ isActive: boolean }>`
  padding: 10px 16px;
  border: 3px solid ${props => props.isActive ? '#4a90e2' : 'rgba(0, 0, 0, 0.4)'};
  background: ${props => props.isActive 
    ? 'linear-gradient(135deg, #4a90e2 0%, #357abd 100%)' 
    : 'rgba(255, 255, 255, 0.98)'};
  color: ${props => props.isActive ? 'white' : '#000000'};
  border-radius: 24px;
  font-size: 12px;
  font-weight: normal;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  backdrop-filter: blur(10px);
  box-shadow: ${props => props.isActive 
    ? '0 8px 20px rgba(74, 144, 226, 0.4), 0 4px 8px rgba(0, 0, 0, 0.1)' 
    : '0 6px 16px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.95)'};
  
  &:hover {
    transform: translateY(-3px) scale(1.05);
    box-shadow: ${props => props.isActive 
      ? '0 12px 28px rgba(74, 144, 226, 0.5), 0 6px 12px rgba(0, 0, 0, 0.15)' 
      : '0 10px 24px rgba(0, 0, 0, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.98)'};
  }
  
  &:active {
    transform: translateY(-1px) scale(1.02);
  }
`

const BatnaInputContainer = styled.div`
  position: absolute;
  top: 60px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  z-index: 15;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(10px);
  border-radius: 12px;
  padding: 12px;
  border: 1px solid rgba(255, 255, 255, 0.3);
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.1);
`

const LeftBatnaContainer = styled(BatnaInputContainer)`
  left: 20px;
`

const RightBatnaContainer = styled(BatnaInputContainer)`
  right: 10px;
`

const BatnaInput = styled.input`
  width: 70px;
  padding: 6px 8px;
  border: 3px solid rgba(0, 0, 0, 0.3);
  border-radius: 8px;
  font-size: 11px;
  font-weight: normal;
  background: rgba(255, 255, 255, 0.98);
  backdrop-filter: blur(10px);
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.15);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  
  &:focus {
    outline: none;
    border-color: #4a90e2;
    box-shadow: 0 8px 20px rgba(74, 144, 226, 0.3);
  }
  
  &::placeholder {
    color: #666666;
  }
`

const BatnaLabel = styled.div`
  font-size: 9px;
  font-weight: normal;
  color: #000000;
  text-align: center;
  margin-bottom: 2px;
`

const BatnaMainLabel = styled.div`
  font-size: 12px;
  font-weight: normal;
  color: #e74c3c;
  text-align: center;
  margin-bottom: 8px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
`

const BatnaInputGroup = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
`

const NegotiateButton = styled.button`
  position: fixed;
  top: 20px;
  left: 50%;
  transform: translateX(-50%);
  background: linear-gradient(135deg,rgb(184, 184, 184) 0%,rgb(140, 136, 145) 100%);
  color: white;
  border: none;
  padding: 15px 30px;
  border-radius: 25px;
  font-size: 16px;
  font-weight: normal;
  cursor: pointer;
  box-shadow: 0 8px 20px rgba(102, 126, 234, 0.4);
  transition: all 0.3s ease;
  z-index: 1000;
  
  &:hover {
    transform: translateX(-50%) translateY(-2px);
    box-shadow: 0 12px 25px rgba(102, 126, 234, 0.5);
  }
  
  &:active {
    transform: translateX(-50%) translateY(0);
  }
`

const StartButton = styled.button`
  position: fixed;
  top: 80px;
  left: 50%;
  transform: translateX(-50%);
  background: linear-gradient(135deg,rgb(134, 239, 172) 0%,rgb(74, 222, 128) 100%);
  color: white;
  border: none;
  padding: 15px 30px;
  border-radius: 25px;
  font-size: 16px;
  font-weight: normal;
  cursor: pointer;
  box-shadow: 0 8px 20px rgba(134, 239, 172, 0.3);
  transition: all 0.3s ease;
  z-index: 2100;
  
  &:hover {
    transform: translateX(-50%) translateY(-2px);
    box-shadow: 0 12px 25px rgba(134, 239, 172, 0.4);
  }
  
  &:active {
    transform: translateX(-50%) translateY(0);
  }
`

const NextButton = styled(StartButton)`
  top: 130px;
  background: linear-gradient(135deg, #60a5fa 0%, #3b82f6 100%);
  box-shadow: 0 8px 20px rgba(59, 130, 246, 0.3);
`

const HorizontalButtonContainer = styled.div`
  position: fixed;
  top: 20px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  gap: 15px;
  z-index: 1000;
`

const DarkButton = styled.button`
  background: linear-gradient(135deg, #374151 0%, #1f2937 100%);
  color: white;
  border: none;
  padding: 15px 30px;
  border-radius: 25px;
  font-size: 16px;
  font-weight: normal;
  cursor: pointer;
  box-shadow: 0 8px 20px rgba(31, 41, 55, 0.4);
  transition: all 0.3s ease;
  
  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 12px 25px rgba(31, 41, 55, 0.5);
    background: linear-gradient(135deg, #4b5563 0%, #374151 100%);
  }
  
  &:active {
    transform: translateY(0);
  }
`

const DarkStartButton = styled(DarkButton)`
  background: linear-gradient(135deg, #047857 0%, #065f46 100%);
  box-shadow: 0 8px 20px rgba(6, 95, 70, 0.4);
  
  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 12px 25px rgba(6, 95, 70, 0.5);
    background: linear-gradient(135deg, #059669 0%, #047857 100%);
  }
`

const DarkNextButton = styled(DarkButton)`
  background: linear-gradient(135deg, #1e40af 0%, #1e3a8a 100%);
  box-shadow: 0 8px 20px rgba(30, 58, 138, 0.4);
  
  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 12px 25px rgba(30, 58, 138, 0.5);
    background: linear-gradient(135deg, #2563eb 0%, #1e40af 100%);
  }
`

const DarkSimulationButton = styled(DarkButton)`
  background: linear-gradient(135deg, #7c2d12 0%, #581c87 100%);
  box-shadow: 0 8px 20px rgba(124, 45, 18, 0.4);
  
  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 12px 25px rgba(124, 45, 18, 0.5);
    background: linear-gradient(135deg, #92400e 0%, #6b21a8 100%);
  }
`

const ModalOverlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 2000;
  backdrop-filter: blur(5px);
`

const ModalContent = styled.div`
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(20px);
  border-radius: 24px;
  padding: 50px;
  border: 1px solid rgba(255, 255, 255, 0.3);
  box-shadow: 
    0 20px 40px rgba(0, 0, 0, 0.1),
    0 8px 16px rgba(0, 0, 0, 0.05),
    inset 0 1px 0 rgba(255, 255, 255, 0.8);
  max-width: 500px;
  width: 90%;
  position: relative;
  
  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 1px;
    background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.8), transparent);
  }
`

const ModalTitle = styled.h2`
  font-size: 20px;
  font-weight: normal;
  text-align: center;
  margin-bottom: 25px;
  text-transform: uppercase;
  letter-spacing: 2px;
  position: relative;
  background: linear-gradient(90deg, #3b82f6 0%, #1d4ed8 50%, #1e40af 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  
  &::before {
    content: '';
    position: absolute;
    top: 50%;
    left: -80px;
    right: -80px;
    height: 2px;
    background: linear-gradient(90deg, #3b82f6 0%, #1d4ed8 50%, #1e40af 100%);
    transform: translateY(-50%);
    opacity: 0.7;
    z-index: -1;
  }
  
  &::after {
    content: '';
    position: absolute;
    top: 50%;
    left: -60px;
    right: -60px;
    height: 1px;
    background: linear-gradient(90deg, #3b82f6 0%, #1d4ed8 50%, #1e40af 100%);
    transform: translateY(-50%);
    opacity: 0.6;
    z-index: -1;
  }
`

const SliderContainer = styled.div`
  margin-bottom: 25px;
`

const SliderLabel = styled.label`
  display: block;
  margin-bottom: 10px;
  font-weight: normal;
  color: #4a5568;
  font-size: 14px;
`

const Slider = styled.input`
  width: 100%;
  height: 8px;
  border-radius: 5px;
  background: #e2e8f0;
  outline: none;
  -webkit-appearance: none;
  
  &::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: linear-gradient(135deg, #e74c3c 0%, #c0392b 100%);
    cursor: pointer;
    box-shadow: 0 2px 6px rgba(231, 76, 60, 0.3);
  }
  
  &::-moz-range-thumb {
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: linear-gradient(135deg, #e74c3c 0%, #c0392b 100%);
    cursor: pointer;
    border: none;
    box-shadow: 0 2px 6px rgba(231, 76, 60, 0.3);
  }
`

const ValueDisplay = styled.div`
  text-align: center;
  margin-top: 10px;
  font-size: 18px;
  font-weight: normal;
  color: #2d3748;
  background: rgba(255, 255, 255, 0.98);
  padding: 8px 16px;
  border-radius: 10px;
  border: 3px solid rgba(0, 0, 0, 0.2);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
`

const ButtonGroup = styled.div`
  display: flex;
  gap: 15px;
  margin-top: 30px;
`

const ModalButton = styled.button<{ isPrimary?: boolean }>`
  flex: 1;
  padding: 15px 30px;
  border-radius: 16px;
  font-weight: normal;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.3s ease;
  backdrop-filter: blur(10px);
  
  ${props => props.isPrimary ? `
    background: rgba(255, 255, 255, 0.98);
    color: #000000;
    border: 4px solid rgba(0, 0, 0, 0.5);
    box-shadow: 0 8px 20px rgba(0, 0, 0, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.95);
    
    &:hover {
      transform: translateY(-2px);
      box-shadow: 0 12px 25px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.95);
    }
  ` : `
    background: rgba(255, 255, 255, 0.95);
    color: #2d3748;
    border: 3px solid rgba(0, 0, 0, 0.2);
    box-shadow: 0 8px 20px rgba(0, 0, 0, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.95);
    
    &:hover {
      background: rgba(255, 255, 255, 0.98);
      border-color: rgba(0, 0, 0, 0.3);
      box-shadow: 0 12px 25px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.95);
    }
  `}
`

const RandomButton = styled.button`
  background: linear-gradient(135deg,rgb(10, 8, 4) 0%,rgb(24, 14, 6) 100%);
  color: white;
  border: none;
  padding: 10px 20px;
  border-radius: 12px;
  font-weight: normal;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: 0 4px 12px rgba(243, 156, 18, 0.3);
  margin-bottom: 20px;
  
  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 16px rgba(243, 156, 18, 0.4);
  }
  
  &:active {
    transform: translateY(0);
  }
`

const SimulationModalContent = styled(ModalContent)`
  max-width: 400px;
  text-align: center;
`

const SimulationTitle = styled.h2`
  font-size: 24px;
  font-weight: 700;
  color: #e2e8f0;
  margin-bottom: 30px;
  text-transform: uppercase;
  letter-spacing: 1px;
`

const SimulationCountContainer = styled.div`
  margin-bottom: 30px;
`

const SimulationCountLabel = styled.label`
  display: block;
  margin-bottom: 15px;
  font-weight: 600;
  color: #e2e8f0;
  font-size: 16px;
`

const SimulationCountSelect = styled.select`
  width: 100%;
  padding: 12px 16px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-radius: 12px;
  font-size: 16px;
  font-weight: 600;
  background: rgba(255, 255, 255, 0.95);
  color: #1a202c;
  cursor: pointer;
  transition: all 0.3s ease;
  
  &:focus {
    outline: none;
    border-color: #60a5fa;
    box-shadow: 0 0 0 3px rgba(96, 165, 250, 0.2);
  }
`

const RunButton = styled.button`
  width: 100%;
  padding: 15px 30px;
  border: none;
  border-radius: 12px;
  font-size: 16px;
  font-weight: 700;
  color: white;
  background: linear-gradient(135deg, #059669 0%, #047857 100%);
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: 0 8px 20px rgba(5, 150, 105, 0.3);
  margin-bottom: 15px;
  
  &:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 12px 25px rgba(5, 150, 105, 0.4);
    background: linear-gradient(135deg, #0d9488 0%, #059669 100%);
  }
  
  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    transform: none;
  }
`


const LoadingSpinner = styled.div`
  display: inline-block;
  width: 24px;
  height: 24px;
  border: 3px solid rgba(255, 255, 255, 0.3);
  border-radius: 50%;
  border-top-color: white;
  animation: spin 1s ease-in-out infinite;
  margin: 0 auto;
  
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
`

const BatnaSection = styled.div`
  display: flex;
  gap: 20px;
  margin-bottom: 25px;
  justify-content: space-between;
`

const BatnaContainer = styled.div`
  flex: 1;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(10px);
  border-radius: 12px;
  padding: 15px;
  border: 1px solid rgba(255, 255, 255, 0.3);
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.1);
`

const BatnaTitle = styled.div`
  font-size: 14px;
  font-weight: normal;
  color: #3b82f6;
  text-align: center;
  margin-bottom: 12px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  text-shadow: 0 1px 2px rgba(59, 130, 246, 0.3);
`

const SellerBatnaTitle = styled.div`
  font-size: 14px;
  font-weight: normal;
  color: #e74c3c;
  text-align: center;
  margin-bottom: 12px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  text-shadow: 0 1px 2px rgba(231, 76, 60, 0.3);
`

const BatnaInputRow = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 10px;
`

const BatnaInputLabel = styled.div`
  font-size: 10px;
  font-weight: normal;
  color: #000000;
  text-align: center;
`

const BatnaInputField = styled.input`
  width: 100%;
  padding: 6px 8px;
  border: 2px solid rgba(0, 0, 0, 0.3);
  border-radius: 6px;
  font-size: 11px;
  font-weight: normal;
  background: rgba(255, 255, 255, 0.98);
  backdrop-filter: blur(10px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  
  &:focus {
    outline: none;
    border-color: #4a90e2;
    box-shadow: 0 6px 16px rgba(74, 144, 226, 0.3);
  }
  
  &::placeholder {
    color: #666666;
  }
`

function App() {
  const data1 = [10, 20, 30, 40, 25, 35]
  const data2 = [15, 25, 35, 20, 45, 30]

  const leftRobotTabs = ['Surplus', 'Progress', 'SBATNA', 'EBBATNA']
  const rightRobotTabs = ['Surplus', 'Progress', 'BBATNA', 'ESBATNA']

  // Negotiation modal state
  const [showNegotiateModal, setShowNegotiateModal] = useState<boolean>(false)
  const [negotiationPrice, setNegotiationPrice] = useState<number>(750)
  const [monthToKey, setMonthToKey] = useState<number>(12)
  const [selectedBuyerProfile, setSelectedBuyerProfile] = useState<BuyerProfile>('bulldozer')
  const [selectedSellerProfile, setSelectedSellerProfile] = useState<SellerProfile>('bulldozer')

  // Step-through negotiation state
  const [stepNegotiation, setStepNegotiation] = useState<StepByStepNegotiation | null>(null)
  const [transcriptMessages, setTranscriptMessages] = useState<TranscriptMessage[]>([])
  const [pendingOutcome, setPendingOutcome] = useState<{ message: string; type: 'robot1' | 'robot2'; speaker: string } | null>(null)
  const [finalOutcome, setFinalOutcome] = useState<string | null>(null)
  
  // Get current BATNA values for display
  const getCurrentBatnaValues = () => {
    if (!stepNegotiation) return null
    const params = stepNegotiation.getState().params
    return {
      sbatna: params.seller_batna,
      bbatna: params.buyer_batna,
      ebbatna: params.estimated_buyer_batna,
      esbatna: params.estimated_seller_batna
    }
  }

  // Get current month-to-key value
  const getCurrentMonthToKey = () => {
    if (!stepNegotiation) return monthToKey // Return initialization value if no negotiation
    const params = stepNegotiation.getState().params
    return params.month_to_key ?? 12 // Default to 12 if not set
  }

  // Get current surplus values for display
  const getCurrentSurplusValues = () => {
    if (!stepNegotiation) return null
    const state = stepNegotiation.getState()
    const params = state.params
    
    // Only show surplus after we have transcript messages (after chat appears)
    if (transcriptMessages.length === 0) return null
    
    // Get the latest bids
    const sellerSurplus = state.current_seller_bid !== null 
      ? state.current_seller_bid - params.seller_batna 
      : 0
    const buyerSurplus = state.current_buyer_bid !== null 
      ? params.buyer_batna - state.current_buyer_bid 
      : 0
    
    return {
      sellerSurplus,
      buyerSurplus
    }
  }

  // Get bid data for graphs with complete timeline visualization
  const getBidDataForGraphs = () => {
    if (!stepNegotiation) return { sellerBids: [], buyerBids: [], allRounds: [] }
    
    const rounds = stepNegotiation.getCurrentRounds()
    const sellerBids: { month: number; price: number; agent: 'seller' | 'buyer'; roundIndex: number }[] = []
    const buyerBids: { month: number; price: number; agent: 'seller' | 'buyer'; roundIndex: number }[] = []
    const allRounds: { month: number; price: number; agent: 'seller' | 'buyer'; roundIndex: number }[] = []
    
    rounds.forEach((round, index) => {
      const bidData = {
        month: round.month, // Use actual month value from bid record
        price: round.bid,
        agent: round.agent,
        roundIndex: index
      }
      
      allRounds.push(bidData)
      
      if (round.agent === 'seller') {
        sellerBids.push(bidData)
      } else {
        buyerBids.push(bidData)
      }
    })
    
    return { sellerBids, buyerBids, allRounds }
  }

  // Simulation modal state
  const [showSimulationModal, setShowSimulationModal] = useState<boolean>(false)
  const [simulationCount, setSimulationCount] = useState<number>(1000)
  const [isSimulationRunning, setIsSimulationRunning] = useState<boolean>(false)


  const handleNegotiateClick = () => {
    setShowNegotiateModal(true)
  }

  const handleSimulationClick = () => {
    setShowSimulationModal(true)
  }

  const handleRunSimulation = async () => {
    console.log('handleRunSimulation called')
    
    try {
      setIsSimulationRunning(true)
      console.log('Setting simulation running to true')
      
      // Calculate duration based on simulation count
      const duration = simulationCount === 1000 ? 5000 : 
                      simulationCount === 10000 ? 20000 : 40000
      
      console.log(`Starting simulation with ${simulationCount} simulations, duration: ${duration}ms`)
      
      // Wait for the specified duration, then run simulation
      setTimeout(() => {
        try {
          console.log('Running simulation with count:', simulationCount)
          const result = runMultipleSimulations(simulationCount)
          console.log('Simulation completed, result:', result)
          
          // Create and download CSV
          const csvBlob = new Blob([result.csv], { type: 'text/csv;charset=utf-8' })
          const csvUrl = URL.createObjectURL(csvBlob)
          const ts = new Date().toISOString().replace(/[:]/g, '-').slice(0, 19)
          
          // Trigger download
          const a = document.createElement('a')
          a.href = csvUrl
          a.download = `negotiations_${ts}_horizontal.csv`
          document.body.appendChild(a)
          a.click()
          a.remove()
          URL.revokeObjectURL(csvUrl)
          
          console.log('CSV download triggered')
          
          setIsSimulationRunning(false)
          setShowSimulationModal(false)
        } catch (error) {
          console.error('Error in simulation:', error)
          setIsSimulationRunning(false)
        }
      }, duration)
    } catch (error) {
      console.error('Error starting simulation:', error)
      setIsSimulationRunning(false)
    }
  }

  const handleStartClick = async () => {
    // Use step-by-step negotiation with same parameter generation as runMultipleSimulations
    setTranscriptMessages([])
    setPendingOutcome(null)
    setFinalOutcome(null)
    try {
      // Use starting price from initialization (or default if not set)
      const sp = negotiationPrice
      
      // Generate parameters using EXACT same logic as runMultipleSimulations
      // Seller's BATNA = SP * (1 - p), p in [0, 0.2]
      const p = Math.random() * 0.2
      const seller_batna = sp * (1 - p)
      // Buyer's BATNA = SP * (1 + q), q in [0, 0.2] 
      const q = Math.random() * 0.2
      const buyer_batna = sp * (1 + q)
      // EBBATNA = int(BBATNA * (1 + s)), s in [-0.1, 0.1]
      const s = (Math.random() * 0.2) - 0.1
      const est_buyer = Math.round(buyer_batna * (1 + s))
      // ESBATNA = int(SBATNA * (1 + r)), r in [-0.1, 0.1]
      const r = (Math.random() * 0.2) - 0.1
      const est_seller = Math.round(seller_batna * (1 + r))

      // Use selected personality profiles from modal

      const params: NegotiationParameters = {
        starting_price: Number(sp.toFixed(2)),
        buyer_batna: Number(buyer_batna.toFixed(2)),
        seller_batna: Number(seller_batna.toFixed(2)),
        estimated_buyer_batna: Number(est_buyer.toFixed(2)),
        estimated_seller_batna: Number(est_seller.toFixed(2)),
        max_counter_offers: 4,
        random_seed: null,
        buyer_profile: selectedBuyerProfile,
        seller_profile: selectedSellerProfile,
        month_to_key: monthToKey,
      }
      
      // Create new step-by-step negotiation
      const newNegotiation = new StepByStepNegotiation(params)
      setStepNegotiation(newNegotiation)
      
      // Show seller's initial bid immediately
      const currentRounds = newNegotiation.getCurrentRounds()
      if (currentRounds.length > 0) {
        const r0 = currentRounds[0]
        let initialMessage = ''
        
        // Add verbiage first, then bid amount with month-to-key for initial seller bid
        if (r0.verbiage) {
          // Remove number prefixes from both V1 and V2 sentences (e.g., "23: " -> "")
          const cleanVerbiage = r0.verbiage.replace(/^\d+:\s*/gm, '')
          initialMessage = `${cleanVerbiage}\n\n$${r0.bid.toFixed(2)}K (Month ${r0.month})`
        } else {
          initialMessage = `$${r0.bid.toFixed(2)}K (Month ${r0.month})`
        }
        
        const msgs: TranscriptMessage[] = [{
          id: 1,
          timestamp: r0.timestamp,
          type: 'robot1',
          speaker: 'Seller',
          message: initialMessage,
          title: 'Starting Price',
        }]
        setTranscriptMessages(msgs)
      }
      
      // Ensure any initialization modal is closed so buttons are visible
      setShowNegotiateModal(false)
    } catch (e) {
      console.error(e)
    }
  }

  const handleNextClick = () => {
    if (!stepNegotiation) return
    if (stepNegotiation.isFinished()) return
    
    // Execute next step in negotiation
    const nextBid = stepNegotiation.nextStep()
    console.log('nextBid:', nextBid)
    
    if (nextBid) {
      // First show loading animation
      const loadingMessage: TranscriptMessage = {
        id: Date.now() + Math.random(),
        timestamp: new Date().toISOString(),
        type: 'loading',
        speaker: nextBid.agent === 'seller' ? 'Seller' : 'Buyer',
        message: '',
      }
      
      setTranscriptMessages(prev => [...prev, loadingMessage])
      
      // After 1.5 seconds, replace loading with actual bid
      setTimeout(() => {
        // Check if negotiation finished after this step
        const isFinished = stepNegotiation.isFinished()
        const finalResult = isFinished ? stepNegotiation.getFinalResult() : null
        console.log('isFinished:', isFinished)
        console.log('finalResult:', finalResult)
        
        // Remove loading message and add actual bid
        setTranscriptMessages((prev) => {
          const withoutLoading = prev.filter(msg => msg.id !== loadingMessage.id)
          
          // Determine the title for this bid
          const currentState = stepNegotiation.getState()
          const currentRounds = currentState.rounds
          let title = ''
          
          if (isFinished && finalResult) {
            // This is the final bid, determine if it's a deal or walkaway
            if (finalResult.meta.final_price !== null) {
              title = 'Deal Accepted'
            } else if (finalResult.meta.termination_reason) {
              const reason = finalResult.meta.termination_reason
              if (reason.includes('seller_walkaway')) {
                title = 'Seller Walkaway'
              } else if (reason.includes('buyer_walkaway')) {
                title = 'Buyer Walkaway'
              } else if (reason.includes('max_rounds')) {
                title = 'Final Offer'
              } else {
                title = 'No Deal'
              }
            }
          } else {
            // Check if this is the buyer's first bid (round 2)
            if (currentRounds.length === 2 && nextBid.agent === 'buyer') {
              title = 'First Bid'
            } else if (currentRounds.length > 2) {
              // For subsequent bids, they are counter offers unless it's the final bid
              title = 'Counter Offer'
            }
          }
        
          // Add new bid to transcript
          const type = nextBid.agent === 'seller' ? 'robot1' : 'robot2'
          const speaker = nextBid.agent === 'seller' ? 'Seller' : 'Buyer'
          let msg = ''
          
          // Add verbiage first, then bid amount with month-to-key
          if (nextBid.verbiage) {
            // Remove number prefixes from both V1 and V2 sentences (e.g., "23: " -> "")
            const cleanVerbiage = nextBid.verbiage.replace(/^\d+:\s*/gm, '')
            msg = `${cleanVerbiage}\n\n$${nextBid.bid.toFixed(2)}K (Month ${nextBid.month})`
          } else {
            msg = `$${nextBid.bid.toFixed(2)}K (Month ${nextBid.month})`
          }
          
          return [...withoutLoading, {
            id: withoutLoading.length + 1,
            timestamp: nextBid.timestamp,
            type: type as TranscriptMessage['type'],
            speaker,
            message: msg,
            title: title,
          }]
        })
        
        // Force outcome to appear immediately when negotiation finished
        if (isFinished && finalResult) {
          console.log('Adding outcome to transcript')
          console.log('finalResult.meta.final_price:', finalResult.meta.final_price)
          setFinalOutcome(finalResult.meta.outcome)
          
          // Add outcome bubble with a separate setTimeout to ensure it comes after the final bid
          setTimeout(() => {
            console.log('Timeout triggered for outcome')
            if (finalResult.meta.final_price !== null) {
              console.log('Adding DEAL message')
              // Deal was accepted - show as green center bubble
              setTranscriptMessages((prev) => {
                console.log('Current transcript messages:', prev)
                const newMessages = [...prev, {
                  id: Date.now() + Math.random(),
                  timestamp: new Date().toISOString(),
                  type: 'outcome' as TranscriptMessage['type'],
                  speaker: 'System',
                  message: 'DEAL',
                }]
                console.log('New transcript messages:', newMessages)
                return newMessages
              })
            } else {
              console.log('Adding WALKAWAY message')
              // Negotiation ended without deal - show as green center bubble
              setTranscriptMessages((prev) => [...prev, {
                id: Date.now() + Math.random(),
                timestamp: new Date().toISOString(),
                type: 'outcome' as TranscriptMessage['type'],
                speaker: 'System',
                message: 'WALKAWAY',
              }])
            }
          }, 100) // Small delay to ensure it appears after the final bid
        }
      }, 3500) // 3.5 second delay for loading animation
    } else {
      // nextBid is null but negotiation might still be finished - check and show outcome
      const isFinished = stepNegotiation.isFinished()
      const finalResult = isFinished ? stepNegotiation.getFinalResult() : null
      console.log('nextBid is null - isFinished:', isFinished)
      console.log('finalResult:', finalResult)
      
      if (isFinished && finalResult) {
        console.log('Forcing outcome display for null nextBid')
        if (finalResult.meta.final_price !== null) {
          setTranscriptMessages((prev) => [...prev, {
            id: Date.now() + Math.random(),
            timestamp: new Date().toISOString(),
            type: 'outcome' as TranscriptMessage['type'],
            speaker: 'System',
            message: 'DEAL',
          }])
        } else {
          setTranscriptMessages((prev) => [...prev, {
            id: Date.now() + Math.random(),
            timestamp: new Date().toISOString(),
            type: 'outcome' as TranscriptMessage['type'],
            speaker: 'System',
            message: 'WALKAWAY',
          }])
        }
      }
    }
  }


  const handleStartNegotiation = () => {
    setShowNegotiateModal(false)
  }

  const handleCancelNegotiation = () => {
    setShowNegotiateModal(false)
  }

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(price)
  }


  return (
    <AppContainer>
      <HorizontalButtonContainer>
        <DarkButton onClick={handleNegotiateClick}>
          Initialization
        </DarkButton>
        <DarkStartButton onClick={handleStartClick}>
          Start
        </DarkStartButton>
        {stepNegotiation && !stepNegotiation.isFinished() && (
          <DarkNextButton onClick={handleNextClick}>Next</DarkNextButton>
        )}
        <DarkSimulationButton onClick={handleSimulationClick}>
          Simulation
        </DarkSimulationButton>
      </HorizontalButtonContainer>
      
      {showNegotiateModal && (
        <ModalOverlay>
          <ModalContent>
            <SliderContainer>
              <SliderLabel>Starting Price: $250,000 - $1,000,000</SliderLabel>
              <Slider
                type="range"
                min="250"
                max="1000"
                step="25"
                value={negotiationPrice}
                onChange={(e) => setNegotiationPrice(parseInt(e.target.value))}
              />
              <ValueDisplay>
                {formatPrice(negotiationPrice * 1000)}
              </ValueDisplay>
            </SliderContainer>
            
            <SliderContainer>
              <SliderLabel>Month-to-Key: 0 - 16 months</SliderLabel>
              <Slider
                type="range"
                min="0"
                max="16"
                step="1"
                value={monthToKey}
                onChange={(e) => setMonthToKey(parseInt(e.target.value))}
              />
              <ValueDisplay>
                {monthToKey} {monthToKey === 1 ? 'month' : 'months'}
              </ValueDisplay>
            </SliderContainer>
            
            <div style={{marginBottom: '25px'}}>
              <div style={{fontSize: '16px', fontWeight: 'bold', textAlign: 'center', marginBottom: '15px', color: '#e74c3c'}}>
                Seller Personality
              </div>
              <div style={{display: 'flex', gap: '10px', justifyContent: 'center', marginBottom: '20px'}}>
                {(['bulldozer', 'diplomat', 'chameleon'] as SellerProfile[]).map((profile) => (
                  <PersonalityButton
                    key={`seller-${profile}`}
                    isActive={selectedSellerProfile === profile}
                    onClick={() => setSelectedSellerProfile(profile)}
                  >
                    {profile}
                  </PersonalityButton>
                ))}
              </div>
              
              <div style={{fontSize: '16px', fontWeight: 'bold', textAlign: 'center', marginBottom: '15px', color: '#4a90e2'}}>
                Buyer Personality
              </div>
              <div style={{display: 'flex', gap: '10px', justifyContent: 'center'}}>
                {(['bulldozer', 'diplomat', 'chameleon'] as BuyerProfile[]).map((profile) => (
                  <PersonalityButton
                    key={`buyer-${profile}`}
                    isActive={selectedBuyerProfile === profile}
                    onClick={() => setSelectedBuyerProfile(profile)}
                  >
                    {profile}
                  </PersonalityButton>
                ))}
              </div>
            </div>
            
            <div style={{textAlign: 'center', margin: '20px 0', fontSize: '14px', color: '#666'}}>
              BATNAs will be randomly generated to match the simulation algorithm exactly.<br/>
              Month-to-Key represents the time horizon for the negotiation (available for graph plotting).
            </div>
            
            <ButtonGroup>
              <ModalButton onClick={handleCancelNegotiation}>
                Cancel
              </ModalButton>
              <ModalButton isPrimary onClick={handleStartNegotiation}>
                Start Negotiation
              </ModalButton>
              <RandomButton onClick={() => {
                setNegotiationPrice(Math.floor(Math.random() * (1000 - 250 + 1)) + 250)
                setMonthToKey(Math.floor(Math.random() * 17)) // 0-16 inclusive
                const buyerProfiles: BuyerProfile[] = ['bulldozer', 'diplomat', 'chameleon']
                const sellerProfiles: SellerProfile[] = ['bulldozer', 'diplomat', 'chameleon']
                setSelectedBuyerProfile(buyerProfiles[Math.floor(Math.random() * buyerProfiles.length)])
                setSelectedSellerProfile(sellerProfiles[Math.floor(Math.random() * sellerProfiles.length)])
              }}>
                Randomize All
              </RandomButton>
            </ButtonGroup>
          </ModalContent>
        </ModalOverlay>
      )}

      {showSimulationModal && (
        <ModalOverlay>
          <SimulationModalContent>
            <SimulationTitle>Run Simulation</SimulationTitle>
            
            <SimulationCountContainer>
              <SimulationCountLabel>Number of Simulations</SimulationCountLabel>
              <SimulationCountSelect
                value={simulationCount}
                onChange={(e) => setSimulationCount(parseInt(e.target.value))}
                disabled={isSimulationRunning}
              >
                <option value={1000}>1,000 simulations</option>
                <option value={10000}>10,000 simulations</option>
                <option value={100000}>100,000 simulations</option>
              </SimulationCountSelect>
            </SimulationCountContainer>


            <RunButton
              onClick={handleRunSimulation}
              disabled={isSimulationRunning}
            >
              {isSimulationRunning ? (
                <LoadingSpinner />
              ) : (
                'Run and Download'
              )}
            </RunButton>

            <ModalButton onClick={() => setShowSimulationModal(false)} disabled={isSimulationRunning}>
              Cancel
            </ModalButton>
          </SimulationModalContent>
        </ModalOverlay>
      )}
      

      <LeftRobotLeftTabs>
        {leftRobotTabs.slice(0, 2).map((tab, index) => {
          const surplusValues = getCurrentSurplusValues()
          let value = ''
          if (surplusValues && tab === 'Surplus') {
            value = `$${surplusValues.sellerSurplus.toFixed(0)}K`
          }
          return (
            <Tab
              key={`left-robot-left-tab-${index}`}
              isActive={index === 0}
              initial={{ opacity: 0, y: 10, scale: 0.9 }}
              animate={{ 
                opacity: 1, 
                y: 0, 
                scale: [1, 1.02, 1],
              }}
              transition={{ 
                duration: 0.6, 
                ease: "easeOut",
                delay: index * 0.1,
                scale: {
                  duration: 4,
                  repeat: Infinity,
                  ease: "easeInOut",
                  delay: index * 0.5
                }
              }}
              whileHover={{ 
                scale: 1.05,
                boxShadow: index === 0 
                  ? '0 12px 28px rgba(74, 144, 226, 0.5), 0 6px 12px rgba(0, 0, 0, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.4)' 
                  : '0 12px 28px rgba(0, 0, 0, 0.2), 0 6px 12px rgba(0, 0, 0, 0.12), inset 0 1px 0 rgba(255, 255, 255, 0.9)'
              }}
            >
              <TabTitle>{tab}</TabTitle>
              <TabContent isActive={index === 0}>
                {value}
              </TabContent>
            </Tab>
          )
        })}
      </LeftRobotLeftTabs>

      <RobotSection>
        <RobotContainer>
          <LeftRobotRightTabs>
            {leftRobotTabs.slice(2, 4).map((tab, index) => {
              const batnaValues = getCurrentBatnaValues()
              let value = ''
              if (batnaValues) {
                if (tab === 'SBATNA') {
                  value = `$${batnaValues.sbatna.toFixed(0)}K`
                } else if (tab === 'EBBATNA') {
                  value = `$${batnaValues.ebbatna.toFixed(0)}K`
                }
              }
              return (
                <Tab
                  key={`left-robot-right-tab-${index}`}
                  isActive={false}
                >
                  <TabTitle>{tab}</TabTitle>
                  <TabContent isActive={false}>
                    {value}
                  </TabContent>
                </Tab>
              )
            })}
          </LeftRobotRightTabs>
          
          <Robot 
            id="robot1" 
            headColor="#e74c3c" 
            bodyColor="#ec7063" 
            panelColor="#f1948a"
            label="Seller"
          />
          <DataGraph 
            data={data1} 
            color="#e74c3c" 
            title=""
            batnaPoint={null}
            batnaColor="#e74c3c"
            sellerBatnaPoint={null}
            buyerBatnaPoint={null}
            bidData={getBidDataForGraphs().sellerBids}
            allRounds={getBidDataForGraphs().allRounds}
            batnaValue={getCurrentBatnaValues()?.sbatna}
            estimatedBatnaValue={getCurrentBatnaValues()?.ebbatna}
          />
        </RobotContainer>
      </RobotSection>

      <TranscriptBox messages={transcriptMessages} />

      <RightRobotLeftTabs>
        {rightRobotTabs.slice(0, 2).map((tab, index) => {
          const surplusValues = getCurrentSurplusValues()
          let value = ''
          if (surplusValues && tab === 'Surplus') {
            value = `$${surplusValues.buyerSurplus.toFixed(0)}K`
          }
          return (
            <Tab
              key={`right-robot-left-tab-${index}`}
              isActive={index === 0}
            >
              <TabTitle>{tab}</TabTitle>
              <TabContent isActive={index === 0}>
                {value}
              </TabContent>
            </Tab>
          )
        })}
      </RightRobotLeftTabs>

      <RobotSection>
        <RobotContainer>
          <RightRobotRightTabs>
            {rightRobotTabs.slice(2, 4).map((tab, index) => {
              const batnaValues = getCurrentBatnaValues()
              let value = ''
              if (batnaValues) {
                if (tab === 'BBATNA') {
                  value = `$${batnaValues.bbatna.toFixed(0)}K`
                } else if (tab === 'ESBATNA') {
                  value = `$${batnaValues.esbatna.toFixed(0)}K`
                }
              }
              return (
                <Tab
                  key={`right-robot-right-tab-${index}`}
                  isActive={false}
                >
                  <TabTitle>{tab}</TabTitle>
                  <TabContent isActive={false}>
                    {value}
                  </TabContent>
                </Tab>
              )
            })}
          </RightRobotRightTabs>
          
          <Robot 
            id="robot2" 
            headColor="#4a90e2" 
            bodyColor="#5dade2" 
            panelColor="#85c1e9"
            label="Buyer"
          />
          <DataGraph 
            data={data2} 
            color="#4a90e2" 
            title=""
            batnaPoint={null}
            batnaColor="#4a90e2"
            sellerBatnaPoint={null}
            buyerBatnaPoint={null}
            bidData={getBidDataForGraphs().buyerBids}
            allRounds={getBidDataForGraphs().allRounds}
            batnaValue={getCurrentBatnaValues()?.bbatna}
            estimatedBatnaValue={getCurrentBatnaValues()?.esbatna}
          />
        </RobotContainer>
      </RobotSection>

    </AppContainer>
  )
}

export default App 