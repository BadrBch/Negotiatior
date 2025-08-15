import React from 'react'
import styled from 'styled-components'
import { motion } from 'framer-motion'

interface RobotProps {
  id: string
  headColor: string
  bodyColor: string
  panelColor: string
  label?: string
}

const RobotContainer = styled(motion.div)`
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 20px;
`

const RobotHead = styled(motion.div)<{ color: string }>`
  width: 120px;
  height: 120px;
  background: linear-gradient(135deg, ${props => props.color} 0%, ${props => props.color}dd 100%);
  border-radius: 24px;
  position: relative;
  margin-bottom: 6px;
  box-shadow: 
    0 12px 32px rgba(0, 0, 0, 0.15),
    0 4px 8px rgba(0, 0, 0, 0.1),
    inset 0 1px 0 rgba(255, 255, 255, 0.3);
  border: 2px solid rgba(255, 255, 255, 0.4);
  overflow: hidden;
  transition: all 0.3s ease;
  
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
    top: -2px;
    left: -2px;
    right: -2px;
    bottom: -2px;
    background: linear-gradient(45deg, transparent, rgba(255, 255, 255, 0.1), transparent);
    border-radius: 26px;
    opacity: 0;
    transition: opacity 0.3s ease;
    pointer-events: none;
  }
  
  &:hover::after {
    opacity: 1;
  }
`

const RobotEye = styled(motion.div)<{ position: 'left' | 'right' }>`
  width: 35px;
  height: 35px;
  background: linear-gradient(135deg, #4a90e2 0%, #357abd 100%);
  border-radius: 50%;
  position: absolute;
  top: 35px;
  ${props => props.position === 'left' ? 'left: 15px;' : 'right: 15px;'}
  box-shadow: 
    0 4px 12px rgba(74, 144, 226, 0.4),
    0 2px 4px rgba(0, 0, 0, 0.2),
    inset 0 1px 0 rgba(255, 255, 255, 0.3);
  border: 1px solid rgba(255, 255, 255, 0.2);
  transition: all 0.2s ease;
`

const RobotBody = styled(motion.div)<{ color: string }>`
  width: 220px;
  height: 200px;
  background: linear-gradient(135deg, ${props => props.color} 0%, ${props => props.color}dd 100%);
  border-radius: 28px;
  position: relative;
  margin-bottom: 15px;
  box-shadow: 
    0 16px 40px rgba(0, 0, 0, 0.15),
    0 6px 12px rgba(0, 0, 0, 0.1),
    inset 0 1px 0 rgba(255, 255, 255, 0.3);
  border: 2px solid rgba(255, 255, 255, 0.4);
  overflow: hidden;
  transition: all 0.4s ease;
  
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
    top: 20px;
    left: 20px;
    right: 20px;
    bottom: 20px;
    background: linear-gradient(135deg, 
      rgba(255, 255, 255, 0.15) 0%, 
      transparent 30%, 
      transparent 70%, 
      rgba(255, 255, 255, 0.08) 100%);
    border-radius: 16px;
    opacity: 0;
    transition: all 0.4s ease;
    pointer-events: none;
  }
  
  &:hover::after {
    opacity: 1;
    transform: scale(1.02);
  }
`

const RobotPanel = styled.div<{ color: string }>`
  width: 140px;
  height: 120px;
  background: linear-gradient(135deg, ${props => props.color} 0%, ${props => props.color}dd 100%);
  border-radius: 18px;
  position: absolute;
  top: 40px;
  left: 50%;
  transform: translateX(-50%);
  border: 1px solid rgba(255, 255, 255, 0.5);
  box-shadow: 
    0 8px 20px rgba(0, 0, 0, 0.1),
    inset 0 1px 0 rgba(255, 255, 255, 0.4);
`

const RobotMouth = styled.div`
  width: 40px;
  height: 8px;
  background: #333;
  border-radius: 4px;
  position: absolute;
  bottom: 15px;
  left: 50%;
  transform: translateX(-50%);
`

const RobotLabel = styled.div<{ color: string }>`
  font-size: 14px;
  font-weight: 700;
  color: white;
  text-align: center;
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  padding: 6px 12px;
  background: ${props => props.color};
  border-radius: 8px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
  backdrop-filter: blur(10px);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  white-space: nowrap;
`

const Robot: React.FC<RobotProps> = ({ id, headColor, bodyColor, panelColor, label }) => {
  return (
    <RobotContainer
      className={id}
      initial={{ opacity: 0, y: 20 }}
      animate={{ 
        opacity: 1, 
        y: [0, -2, 0]
      }}
      transition={{ 
        duration: 0.8, 
        ease: "easeOut",
        y: {
          duration: 2,
          repeat: Infinity,
          ease: "easeInOut"
        }
      }}
    >
      <RobotHead 
        color={headColor}
        whileHover={{ scale: 1.05 }}
        transition={{ duration: 0.2 }}
      >
        <RobotEye 
          position="left"
          animate={{
            scale: [1, 1.1, 1],
          }}
          transition={{
            duration: 4,
            repeat: Infinity,
            ease: "easeInOut",
            delay: 0
          }}
        />
        <RobotEye 
          position="right"
          animate={{
            scale: [1, 1.1, 1],
          }}
          transition={{
            duration: 4,
            repeat: Infinity,
            ease: "easeInOut",
            delay: 0.2
          }}
        />
        <RobotMouth />
      </RobotHead>
      
      <RobotBody 
        color={bodyColor}
        className="robot-body"
        animate={{
          scale: [1, 1.02, 1],
          boxShadow: [
            "0 16px 40px rgba(0, 0, 0, 0.15), 0 6px 12px rgba(0, 0, 0, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.3)",
            "0 20px 50px rgba(0, 0, 0, 0.2), 0 8px 16px rgba(0, 0, 0, 0.12), inset 0 1px 0 rgba(255, 255, 255, 0.4), 0 0 20px rgba(255, 255, 255, 0.1)",
            "0 16px 40px rgba(0, 0, 0, 0.15), 0 6px 12px rgba(0, 0, 0, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.3)"
          ],
          transition: {
            duration: 3,
            repeat: Infinity,
            ease: "easeInOut"
          }
        }}
        whileHover={{ 
          scale: 1.02,
          boxShadow: "0 24px 60px rgba(0, 0, 0, 0.25), 0 12px 20px rgba(0, 0, 0, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.5), 0 0 30px rgba(255, 255, 255, 0.15)"
        }}
        transition={{ duration: 0.2 }}
      >
        <RobotPanel color={panelColor}>
          {label && <RobotLabel color={panelColor}>{label}</RobotLabel>}
        </RobotPanel>
      </RobotBody>
    </RobotContainer>
  )
}

export default Robot 