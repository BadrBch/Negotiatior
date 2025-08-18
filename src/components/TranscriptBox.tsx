import React from 'react'
import styled from 'styled-components'
import { motion } from 'framer-motion'

const TranscriptContainer = styled(motion.div)`
  flex: 1;
  max-width: 900px;
  height: 800px;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(20px);
  border-radius: 10px;
  padding: 20px;
  border: 1px solid rgba(255, 255, 255, 0.3);
  box-shadow: 
    0 20px 40px rgba(0, 0, 0, 0.1),
    0 8px 16px rgba(0, 0, 0, 0.05),
    inset 0 1px 0 rgba(255, 255, 255, 0.8);
  display: flex;
  flex-direction: column;
  align-self: center;
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
    transform: translateY(-8px) scale(1.02);
    box-shadow: 
      0 32px 64px rgba(0, 0, 0, 0.15),
      0 16px 32px rgba(0, 0, 0, 0.1),
      inset 0 1px 0 rgba(255, 255, 255, 0.9);
  }
  
  @media (max-width: 1200px) {
    max-width: 100%;
    height: 400px;
  }
`

const TranscriptTitle = styled.h2`
  font-size: 20px;
  font-weight: 800;
  text-align: center;
  margin-bottom: 25px;
  text-transform: uppercase;
  letter-spacing: 2px;
  position: relative;
  background: linear-gradient(90deg, #e74c3c 0%, #c0392b 25%, #3498db 75%, #2980b9 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  
  &::before {
    content: '';
    position: absolute;
    top: -5px;
    left: 50%;
    transform: translateX(-50%);
    width: 60px;
    height: 3px;
    background: linear-gradient(90deg, #e74c3c, #c0392b, #3498db, #2980b9);
    border-radius: 2px;
    opacity: 0.7;
  }
  
  &::after {
    content: '';
    position: absolute;
    bottom: -8px;
    left: 50%;
    transform: translateX(-50%);
    width: 40px;
    height: 2px;
    background: linear-gradient(90deg, #e74c3c, #3498db);
    border-radius: 1px;
    opacity: 0.6;
  }
`


const TranscriptContent = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  background: rgba(248, 250, 252, 0.8);
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.3);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05), inset 0 1px 0 rgba(255, 255, 255, 0.6);
`

const BubbleRow = styled.div<{ align: 'left' | 'right' }>`
  display: flex;
  justify-content: ${p => (p.align === 'left' ? 'flex-start' : 'flex-end')};
`

const Bubble = styled(motion.div)<{ who: 'seller' | 'buyer' | 'system' }>`
  max-width: 85%;
  padding: 18px 24px;
  border-radius: 20px;
  background: ${p => 
    p.who === 'seller' ? 'rgba(192, 57, 43, 0.85)' : 
    p.who === 'buyer' ? 'rgba(52, 152, 219, 0.85)' : 
    'rgba(39, 174, 96, 0.85)'
  };
  color: #ffffff;
  border: 2px solid ${p => 
    p.who === 'seller' ? 'rgba(231, 76, 60, 0.9)' : 
    p.who === 'buyer' ? 'rgba(74, 144, 226, 0.9)' : 
    'rgba(34, 197, 94, 0.9)'
  };
  box-shadow: 
    0 4px 16px rgba(0,0,0,0.2),
    0 2px 8px rgba(0,0,0,0.1);
  font-weight: 600;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  
  &:hover {
    transform: translateY(-2px) scale(1.02);
    box-shadow: 
      0 8px 24px rgba(0,0,0,0.25),
      0 4px 12px rgba(0,0,0,0.15);
    border-width: 3px;
    background: ${p => 
      p.who === 'seller' ? 'rgba(169, 50, 38, 0.95)' : 
      p.who === 'buyer' ? 'rgba(41, 128, 185, 0.95)' : 
      'rgba(34, 153, 84, 0.95)'
    };
  }
`

const SystemMessage = styled(motion.div)`
  text-align: center;
  padding: 12px 20px;
  margin: 12px auto;
  background: rgba(22, 101, 52, 0.9);
  border: 2px solid rgba(34, 197, 94, 0.8);
  border-radius: 16px;
  font-size: 14px;
  font-weight: 700;
  color: #ffffff;
  max-width: 80%;
  box-shadow: 0 4px 12px rgba(22, 101, 52, 0.4);
`

const OutcomeBubble = styled(motion.div)`
  text-align: center;
  padding: 20px 40px;
  margin: 20px auto;
  background: rgba(34, 197, 96, 0.95);
  border: 3px solid rgba(22, 163, 74, 0.9);
  border-radius: 25px;
  font-size: 24px;
  font-weight: 900;
  color: #ffffff;
  max-width: 300px;
  box-shadow: 
    0 8px 32px rgba(34, 197, 96, 0.5),
    0 4px 16px rgba(22, 163, 74, 0.3);
  text-transform: uppercase;
  letter-spacing: 2px;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
`

const BidTitle = styled(motion.div)<{ align: 'left' | 'right' }>`
  font-size: 11px;
  font-weight: 700;
  color: #374151;
  text-transform: uppercase;
  letter-spacing: 0.8px;
  margin-bottom: 8px;
  text-align: ${p => p.align};
`

const BidContainer = styled.div`
  display: flex;
  flex-direction: column;
`

const LoadingContainer = styled(motion.div)<{ align: 'left' | 'right' }>`
  display: flex;
  justify-content: ${p => (p.align === 'left' ? 'flex-start' : 'flex-end')};
  margin: 12px 0;
`

const LoadingBubble = styled(motion.div)<{ who: 'seller' | 'buyer' }>`
  background: ${p => 
    p.who === 'seller' ? 'rgba(192, 57, 43, 0.3)' : 'rgba(52, 152, 219, 0.3)'
  };
  border: 2px solid ${p => 
    p.who === 'seller' ? 'rgba(231, 76, 60, 0.4)' : 'rgba(74, 144, 226, 0.4)'
  };
  border-radius: 20px;
  padding: 18px 24px;
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 120px;
  justify-content: center;
`

const LoadingSpinner = styled(motion.div)<{ who: 'seller' | 'buyer' }>`
  width: 24px;
  height: 24px;
  border: 3px solid rgba(0, 0, 0, 0.1);
  border-radius: 50%;
  border-top: 3px solid ${p => 
    p.who === 'seller' ? '#e74c3c' : '#3498db'
  };
`

const LoadingText = styled.div<{ who: 'seller' | 'buyer' }>`
  font-size: 12px;
  font-weight: 600;
  color: ${p => 
    p.who === 'seller' ? '#c0392b' : '#2980b9'
  };
  margin-left: 12px;
`

export type TranscriptMessage = {
  id: number
  timestamp: string
  type: 'robot1' | 'robot2' | 'system' | 'loading' | 'outcome'
  speaker: string
  message: string
  title?: string
}

const LoadingAnimation: React.FC<{ type: 'robot1' | 'robot2' }> = ({ type }) => {
  return (
    <LoadingContainer align={type === 'robot1' ? 'left' : 'right'}>
      <LoadingBubble 
        who={type === 'robot1' ? 'seller' : 'buyer'}
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
      >
        <LoadingSpinner
          who={type === 'robot1' ? 'seller' : 'buyer'}
          animate={{ rotate: 360 }}
          transition={{
            duration: 1,
            repeat: Infinity,
            ease: "linear"
          }}
        />
        <LoadingText who={type === 'robot1' ? 'seller' : 'buyer'}>
          Thinking...
        </LoadingText>
      </LoadingBubble>
    </LoadingContainer>
  )
}

const TranscriptBox: React.FC<{ messages: TranscriptMessage[] }> = ({ messages }) => {
  const contentRef = React.useRef<HTMLDivElement>(null)
  
  // Auto-scroll to bottom when new messages are added
  React.useEffect(() => {
    if (contentRef.current) {
      contentRef.current.scrollTop = contentRef.current.scrollHeight
    }
  }, [messages])
  
  return (
    <TranscriptContainer
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
    >
      <TranscriptTitle>Negotiation Transcript</TranscriptTitle>
      <TranscriptContent ref={contentRef}>
        {messages.map((msg) => (
          msg.type === 'loading' ? (
            <LoadingAnimation key={msg.id} type={msg.speaker === 'Seller' ? 'robot1' : 'robot2'} />
          ) : msg.type === 'system' ? (
            <SystemMessage 
              key={msg.id}
              initial={{ opacity: 0, scale: 0.8, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ 
                type: "spring",
                stiffness: 250,
                damping: 20,
                duration: 0.25 
              }}
            >
              {msg.message}
            </SystemMessage>
          ) : msg.type === 'outcome' ? (
            <OutcomeBubble 
              key={msg.id}
              initial={{ opacity: 0, scale: 0.3, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ 
                type: "spring",
                stiffness: 200,
                damping: 15,
                duration: 0.6 
              }}
            >
              {msg.message}
            </OutcomeBubble>
          ) : (
            <BubbleRow key={msg.id} align={msg.type === 'robot1' ? 'left' : 'right'}>
              <BidContainer>
                {msg.title && (
                  <BidTitle 
                    align={msg.type === 'robot1' ? 'left' : 'right'}
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ 
                      duration: 0.2, 
                      ease: "easeOut",
                      delay: 0.05 
                    }}
                  >
                    {msg.title}
                  </BidTitle>
                )}
                <Bubble 
                  who={msg.type === 'robot1' ? 'seller' : 'buyer'}
                  initial={{ 
                    opacity: 0, 
                    scale: 0.7,
                    y: 20,
                    x: msg.type === 'robot1' ? -20 : 20
                  }}
                  animate={{ 
                    opacity: 1, 
                    scale: 1,
                    y: 0,
                    x: 0
                  }}
                  transition={{ 
                    type: "spring",
                    stiffness: 300,
                    damping: 25,
                    duration: 0.3,
                    delay: msg.title ? 0.15 : 0.05
                  }}
                  whileHover={{
                    scale: 1.05,
                    y: -3,
                    transition: { duration: 0.2 }
                  }}
                  whileTap={{
                    scale: 0.98,
                    transition: { duration: 0.1 }
                  }}
                >
                  {msg.message.split('\n').map((line, index) => (
                    <div key={index}>
                      {line.startsWith('$') && line.endsWith('K') ? (
                        <div style={{ fontSize: '16px', fontWeight: '700', marginTop: '8px' }}>{line}</div>
                      ) : (
                        line
                      )}
                      {index < msg.message.split('\n').length - 1 && <br />}
                    </div>
                  ))}
                </Bubble>
              </BidContainer>
            </BubbleRow>
          )
        ))}
      </TranscriptContent>
    </TranscriptContainer>
  )
}

export default TranscriptBox 