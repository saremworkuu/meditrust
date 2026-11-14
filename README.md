# 🏥 MediTrust — Patient-Safety Medicine Verification Platform

[![Solidity](https://img.shields.io/badge/Solidity-0.8.24-363636?logo=solidity)](https://soliditylang.org/)
[![React](https://img.shields.io/badge/React-19.0-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-8.x-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-v4-38B2AC?logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![Hardhat](https://img.shields.io/badge/Hardhat-2.22-FFF100?logo=ethereum&logoColor=black)](https://hardhat.org/)
[![OpenZeppelin](https://img.shields.io/badge/OpenZeppelin-Contracts_v5-4E5EE4?logo=openzeppelin)](https://openzeppelin.com/contracts/)
[![Privy](https://img.shields.io/badge/Auth-Privy_%2B_Wagmi-blueviolet)](https://privy.io/)
[![License: Apache-2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)

> **Decentralized track-and-trace, cryptographic clone detection, emergency recall orchestration, and pharmacy trust scoring.**  
> Built for the Ethiopian Food and Drug Authority (EFDA) ecosystem and low-connectivity supply chains across Africa and emerging markets.

---

## 🌟 Executive Overview

Counterfeit and substandard pharmaceuticals kill over 250,000 children annually worldwide, with developing regions facing counterfeit penetration rates exceeding 30%. **MediTrust** is an end-to-end, patient-safety Web3 verification platform that empowers consumers, licensed pharmacists, manufacturers, and regulatory authorities to verify pharmaceutical integrity in real-time.

### Key Pillars:
- **Zero Login Barrier for Patients**: Patients can verify any blister pack, bottle, or box directly via mobile camera or SMS with zero crypto wallet required.
- **Privacy by Design**: Cryptographic Merkle trees ensure individual serial numbers are verified on-chain without exposing manufacturer sales registries or patient identities.
- **Bilingual Parity**: 100% native support across **English** and **Amharic (አማርኛ)**, complete with offline text-to-speech audio for low-literacy accessibility.
- **Fail-Safe Offline Operation**: Automatic fallback mechanisms simulate deterministic verification even when remote RPCs or national regulatory registries experience temporary blackouts.

---

## 🚀 Key Features

```
                                    ┌───────────────────────┐
                                    │   PATIENT / CONSUMER  │
                                    └───────────┬───────────┘
                                                │
                          ┌─────────────────────┼─────────────────────┐
                          │ (Camera / Upload)   │ (SMS 2G / Bot)      │ (Audio Voice)
                          ▼                     ▼                     ▼
                  ┌───────────────┐     ┌───────────────┐     ┌───────────────┐
                  │ Live QR Scan  │     │ USSD/SMS Gate │     │ Amharic Voice │
                  └───────┬───────┘     └───────┬───────┘     └───────────────┘
                          │                     │
                          └──────────┬──────────┘
                                     ▼
                      ┌───────────────────────────┐
                      │    MediTrust Verifier     │
                      └──────────────┬────────────┘
                                     │
           ┌─────────────────────────┼─────────────────────────┐
           │                         │                         │
           ▼                         ▼                         ▼
┌────────────────────┐    ┌────────────────────┐    ┌────────────────────┐
│ EVM Smart Contract │    │  EFDA Registry     │    │ IPFS / Pinata      │
│  (MediTrust.sol)   │    │  (Simulated Sync)  │    │ (Batch Manifests)  │
└────────────────────┘    └────────────────────┘    └────────────────────┘
```

### 1. 🔍 Consumer Medicine Verification
* **Live Camera Viewfinder**: Point any smartphone camera or webcam at a QR code. Features automated corner brackets, laser scan-line animations, and Web Audio beep confirmation.
* **Photo Upload**: Drag and drop photos of medicine packages or blister packs for browser-based `jsQR` frame analysis.
* **Instant Safety Status**:
  * 🟢 **Genuine**: Verified authentic on-chain against manufacturer Merkle root.
  * 🔵 **Already Sold**: Dispensed by a licensed pharmacy; flags potential illicit secondary resale.
  * 🔴 **Recalled**: Quarantined by EFDA regulatory order; alerts patient immediately to cease use.
  * 🟠 **Expired**: Time-decay detection protecting patients against degraded compounds.
  * 🛑 **Clone Suspected**: Identifies duplicate scans in disparate locations signaling counterfeit packaging.
  * ⚠️ **Unknown / Fake**: Unregistered payload failing cryptographic verification.

### 2. 🔐 Role-Based Access Control (RBAC)
Enforced on-chain via OpenZeppelin's `AccessControl`:
* **Regulator (`REGULATOR_ROLE`)**: Issue emergency recalls, inspect distribution anomalies, audit compliance.
* **Manufacturer (`MANUFACTURER_ROLE`)**: Register medicine batches, bind Merkle roots, upload batch metadata.
* **Distributor (`DISTRIBUTOR_ROLE`)**: Acknowledge custodial transfers across regional wholesale hubs.
* **Pharmacy (`PHARMACY_ROLE`)**: Confirm stock arrival, quarantine recalled inventory, mark packs as sold.
* **Public / Patient**: Unrestricted read-only verification with zero gas fees.

### 3. 🚨 Regulatory Recall & Quarantine Manager
* **Severity Tiers**:
  * **Class I**: Critical health hazard (24-hour mandatory quarantine target).
  * **Class II**: Temporary/reversible risk (48-hour quarantine window).
  * **Class III**: Minor non-conformance (72-hour window).
* **Automated Accountability**: Real-time timer counts down pharmacy quarantine deadlines, flagging delinquent facilities for EFDA on-site inspections.
* **Multi-Channel Push Broadcasts**: Instantly alerts subscribed patients and pharmacies via Telegram and SMS upon batch recall issuance.

### 4. ⭐ Pharmacy Trust Scoring (PTS)
An objective, formulaic scoring index (0–100%) that measures pharmacy integrity:
$$\text{Trust Score} = w_1 \cdot \text{Quarantine Speed} + w_2 \cdot \text{Verification Ratio} - w_3 \cdot \text{Anomaly Penalties}$$
Provides regulators and health insurance programs with transparent supply chain risk metrics.

### 5. 🗺️ Early Warning Heatmap & Anomaly Tracker
* Interactive geographic clustering of suspicious scans and clone spikes across Ethiopian administrative regions.
* Detects geographical impossibilities (e.g., the same serial scanned in Addis Ababa and Dire Dawa within 15 minutes).

### 6. 🎙️ Inclusive Accessibility (Voice & SMS)
* **Amharic Audio Synthesis**: Voice clips synthesize verification findings in native Amharic for patients unable to read English or Ge'ez script.
* **Offline 2G SMS Spec**: Full operational support for `VERIFY <batch>.<serial>.<code>` syntax over low-cost SMS relays.

---

## 🛠️ Technology Stack

| Layer | Technologies |
|---|---|
| **Smart Contracts** | Solidity `^0.8.24`, OpenZeppelin Contracts v5, Hardhat, MerkleProof |
| **Frontend** | React 19, TypeScript, Vite, Tailwind CSS v4, Lucide Icons |
| **Web3 Client** | Viem v2, Wagmi v3, Privy React SDK (`@privy-io/react-auth`, `@privy-io/wagmi`) |
| **Full-Stack Server** | Express.js, TSX, Zod schema validation, dotenv |
| **Vision & Scanning** | Browser `MediaDevices` API, `jsQR`, Canvas 2D image processing |
| **Decentralized Storage** | Pinata IPFS (tamper-evident batch manifests) |
| **Database / Off-Chain** | Supabase JS client (secondary query indexing) |

---

## 📋 Directory Architecture

```
meditrust/
├── contracts/               # Solidity smart contracts
│   └── MediTrust.sol        # Core on-chain logic (RBAC, Merkle check, Recalls)
├── lib/                     # Shared cross-environment configurations
│   ├── auth/                # Privy & Wagmi providers with resilient fallback
│   ├── chains.ts            # Viem chain configurations (Hardhat, Sepolia, etc.)
│   ├── contract.ts          # Typed contract interfaces & read/write hooks
│   ├── env.ts               # Zod startup environment validation
│   └── ipfs.ts              # Pinata IPFS client
├── packages/
│   └── verify/              # Shared verification package (PWA, Bot, & SMS)
│       ├── parser.ts        # QR & serial payload parser
│       ├── verifier.ts      # Merkle verification & deterministic fallback
│       └── presentation.ts  # Bilingual status copy & UI theme tokens
├── src/
│   ├── components/          # Production React components
│   │   ├── ErrorBoundary.tsx          # Crash protection with guided fixes
│   │   ├── QRCameraScanner.tsx        # Camera & image upload scanner
│   │   ├── PrivyAuthButton.tsx        # Dynamic Web3 connect & role badge
│   │   ├── RegulatorRecallView.tsx    # EFDA recall dashboard
│   │   ├── PharmacyTrustScoreView.tsx # Trust scoring engine
│   │   ├── EarlyWarningMapView.tsx    # Spatiotemporal anomaly map
│   │   └── CuttableFeaturesView.tsx   # Voice & SMS gateway playground
│   ├── locales/             # Internationalization dictionaries (en.json, am.json)
│   ├── App.tsx              # Main application shell
│   └── main.tsx             # Root bootstrap
├── test/                    # Full test suite (smart contracts, consistency, bots)
├── server.ts                # Express backend + Vite dev server integration
└── hardhat.config.cjs       # Hardhat network & compiler configuration
```

---

## ⚡ Quick Start

### 1. Prerequisites
Ensure you have installed:
* [Node.js](https://nodejs.org/) (v18.x or v20.x recommended)
* `npm` or `yarn`

### 2. Installation
Clone the repository and install all dependencies:
```bash
cd meditrust
npm install
```

### 3. Configure Environment Variables
Copy the template configuration file:
```bash
cp .env.example .env.local
```

Open `.env.local` and configure your credentials:
```env
# Server Secrets (Backend only, never exposed to client)
PRIVATE_KEY="your_deployer_private_key_here"
RPC_URL="http://127.0.0.1:8545"
PINATA_JWT="your_pinata_jwt_token_here"
PRIVY_APP_SECRET="your_privy_app_secret_here"
SUPABASE_SERVICE_ROLE_KEY="your_supabase_service_role_key_here"

# Client Configuration (Exposed to browser via Vite)
NEXT_PUBLIC_CHAIN_ID="31337"
NEXT_PUBLIC_RPC_URL="http://127.0.0.1:8545"
NEXT_PUBLIC_EXPLORER_URL="https://sepolia.etherscan.io"
NEXT_PUBLIC_CONTRACT_ADDRESS="0x5FbDB2315678afecb367f032d93F642f64180aa3"
NEXT_PUBLIC_PRIVY_APP_ID="your_25_char_privy_app_id"
NEXT_PUBLIC_SUPABASE_URL="https://your-project.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="your_supabase_anon_key_here"
NEXT_PUBLIC_IPFS_GATEWAY="https://gateway.pinata.cloud/ipfs/"
```

> **Tip**: If you do not yet have a Privy App ID, leave `NEXT_PUBLIC_PRIVY_APP_ID="cl00000000000000000000000"`. The built-in resilient fallback allows full local testing without crashing!

### 4. Run Local Node & Deploy Contracts (Optional for On-Chain Mode)
To spin up a local Hardhat EVM node and deploy `MediTrust.sol`:
```bash
# Terminal 1: Start local node
npx hardhat node

# Terminal 2: Compile & deploy
npm run compile:contracts
npm run deploy:contracts
```

### 5. Launch Full-Stack Server
Start the Express API and Vite application:
```bash
npm run dev
```
Open **`http://localhost:3000`** in your browser.

---

## 🧪 Testing Suite

MediTrust includes comprehensive automated testing across smart contracts, verification invariants, offline fallback simulators, and alert dispatchers:

| Command | Description |
|---|---|
| `npm run test:contracts` | Executes Hardhat Solidity test suite covering RBAC and Merkle proofs |
| `npm run test:verify` | Asserts NFR-24 consumer verification consistency across all QR formats |
| `npm run test:compliance` | Tests EFDA recall compliance calculations, overdue timers, and quarantine |
| `npm run test:scores` | Verifies Pharmacy Trust Score algorithms and anomaly weightings |
| `npm run test:map` | Tests spatiotemporal anomaly detection and geo-clustering algorithms |
| `npm run test:bot` | Tests Telegram verification webhook handler and inline button responses |
| `npm run test:alerts` | Tests multi-channel broadcast engine across SMS and push channels |
| `npm run lint` | Runs TypeScript static type checking across the entire project |

---

## 📦 Demo Data Seeding

To quickly populate the local database with realistic Ethiopian pharmaceutical batches, pharmacy networks, and test alerts:

```bash
# Seed full demo scenario
npm run seed:demo

# Or seed individual domains
npm run seed:recall       # Seed EFDA recall cases & quarantine deadlines
npm run seed:warning      # Seed regional counterfeit hotspot heatmap data
```

You can also click the **"Reset"** button on the top right of the web UI to re-baseline sample data on the fly.

---

## 🔒 Security & Privacy Guarantees

1. **Zero Personal Identifiable Information (PII) On-Chain**:
   Only cryptographic hashes (`keccak256(serialNumber)`) and batch Merkle roots are committed to Ethereum. Patient scans, locations, and wallet addresses are never written to public blocks.
2. **Offline-Resilient Verification**:
   Even if the centralized national drug registry or external RPC nodes go offline, cryptographic verification continues uninterrupted.
3. **Reentrancy & Front-Running Immunity**:
   All state modifications strictly follow Checks-Effects-Interactions with OpenZeppelin's audited baseline security primitives.
4. **Environment Isolation**:
   Private keys, JWTs, and admin secrets are strictly validated by Zod at startup and permanently prevented from leaking into client bundles.

---

## 📄 License

Distributed under the **Apache-2.0 License**. See [LICENSE](LICENSE) for details.

---

<div align="center">
  <sub>Built with ❤️ for patient safety and supply chain integrity in Ethiopia and worldwide.</sub>
</div>
