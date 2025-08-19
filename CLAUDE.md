# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

```bash
# Start development server with hot reload
npm run dev

# Build for production
npm run build

# Preview production build locally
npm run preview

# Install dependencies
npm install
```

## Core Architecture

### Negotiation Engine (`src/simulator/negotiation.ts`)

The heart of the application is a sophisticated negotiation simulation engine that implements:

- **BATNA-based Bid Calculations**: Uses mathematical formulas for bid generation
  - **SBID Formula**: `[max(BBID, BBID, SBATNA), min(EBBATNA*(1.02), SBID, starting_price)]`
  - **BBID Formula**: `[max(BBID, ESBATNA × (1-x)), min(BBATNA, SBID, starting_price)]`
- **Dual Verbiage System**: 
  - **V1 Verbiage**: Negotiation tactics (sentences 0-100 for seller, 101-199 for buyer)
  - **V2 Verbiage**: Acceptance-seeking language (sentences 100-200 for seller, 200-300 for buyer)
- **Personality Profiles**: Three negotiation styles (bulldozer, diplomat, chameleon) that affect bidding ranges
- **Step-by-Step Execution**: `StepByStepNegotiation` class for interactive negotiations
- **Batch Simulation**: `runMultipleSimulations()` for statistical analysis with CSV export

### Key Classes and Functions

- `StepByStepNegotiation`: Interactive negotiation controller
- `runSingleNegotiation()`: Single negotiation simulation
- `runMultipleSimulations()`: Batch simulation runner
- `generateV1Verbiage()` / `generateV2Verbiage()`: Seller language generators
- `generateBuyerVerbiage()` / `generateBuyerV2Verbiage()`: Buyer language generators

### UI Architecture (`src/App.tsx`)

The main application implements a dual-robot negotiation interface with:

- **Real-time State Management**: Tracks negotiation progress, BATNA values, and surplus calculations
- **Dynamic Tab System**: 
  - Seller tabs: `['Surplus', 'Progress', 'SBATNA', 'EBBATNA']`
  - Buyer tabs: `['Surplus', 'Progress', 'BBATNA', 'ESBATNA']`
- **Surplus Calculations**: 
  - Seller: `SBID - SBATNA`
  - Buyer: `BBATNA - BBID`
- **Modal-based Configuration**: Starting price slider and personality selection
- **Animated Transcripts**: Real-time chat bubbles with loading states

### Visualization Components

- **`DataGraph.tsx`**: D3.js-powered charts displaying bid progression, BATNA reference lines, and estimated BATNA tracking
- **`TranscriptBox.tsx`**: Animated chat interface with color-coded speakers (red=seller, blue=buyer)
- **`Robot.tsx`**: GSAP-animated robot avatars with personality-based styling

### Data Flow

1. User configures negotiation parameters via modal
2. `StepByStepNegotiation` generates initial seller bid with V1+V2 verbiage
3. User clicks "Next" → buyer generates counter-bid using BBID formula
4. Real-time updates: tabs show BATNA values, surplus calculations, graph plots bid points
5. Verbiage combines negotiation tactics (V1) with acceptance-seeking language (V2)
6. Process continues until deal/walkaway termination

## Key Business Logic

### BATNA System
- **SBATNA/BBATNA**: Actual walk-away values for seller/buyer
- **ESBATNA/EBBATNA**: Estimated opponent BATNA values (updated during negotiation)
- **Dynamic Updates**: Estimated values adjust based on opponent bids using reverse-engineering logic

### Verbiage Generation
- **Sentence Libraries**: 300+ numbered sentences across V1/V2 categories
- **Contextual Selection**: Soft vs harsh language based on mathematical conditions
- **Dual Display**: Both tactical and acceptance-seeking language shown simultaneously

### Formula Enforcement
All bid calculations strictly follow the SBID/BBID formulas with personality-based adjustments and range constraints.

## Styling Architecture

- **Styled Components**: CSS-in-JS with TypeScript support
- **Glassmorphism Design**: Backdrop blur effects and transparency layers
- **Framer Motion**: Declarative animations and transitions
- **Color Scheme**: Red theme (seller), blue theme (buyer), glassmorphism UI
- **Responsive Design**: Mobile-first with breakpoints at 1200px and 768px