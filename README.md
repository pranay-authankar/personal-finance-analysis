# FamilyVault — Family Investment & Fixed Deposit Tracker (V1)

A modern, high-visibility desktop web application built with **React 19**, **TypeScript**, and **Vite** to organize and view family investments in one unified vault.

🔗 **GitHub Repository**: [https://github.com/pranay-authankar/personal-finance-analysis](https://github.com/pranay-authankar/personal-finance-analysis)

---

## 🌟 Key Features

### 1. Multi-Member Family Profile Hub
- Seamlessly view and manage investments for **Father (Rajesh)**, **Mother (Sunita)**, **Self (Pranav)**, or add custom family members with personalized avatars.
- View total family net worth and individual asset breakdowns at a glance.

### 2. Asset Allocation & Interactive SVG Donut Chart
- Visual distribution across **6 Core Asset Categories**:
  - 🏦 **Fixed Deposits (FDs)** — *Active & Functional*
  - 📮 **Post Office Savings Schemes** — *Active & Functional*
  - 📈 **Stocks & Mutual Funds** — *(V2 Planned)*
  - 🏡 **Real Estate** — *(V2 Planned)*
  - 🪙 **Bullions (Gold/Silver)** — *(V2 Planned)*
  - 💵 **Cash in Hand** — *(V2 Planned)*
- Interactive center statistics on slice hover and instant 1-click drill-down into FDs or Post Office.

### 3. Post Office Savings & Investment Vault
- **Multi-Scheme Support**:
  - **RD** (Recurring Deposit — monthly installment, 5-year quarterly compounding)
  - **MIS** (Monthly Income Scheme — guaranteed monthly pension-like payouts)
  - **POTD** (Post Office Time Deposit — 1, 2, 3, or 5-year fixed deposits)
  - **SCSS** (Senior Citizen Savings Scheme — high yield quarterly returns)
  - **PPF** (Public Provident Fund — 15-year sovereign savings with EEE tax exemption)
  - **NSC** (National Savings Certificate — 5-year compounded return)
  - **KVP** (Kisan Vikas Patra — doubles money at maturity)
  - **Sukanya Samriddhi Account** (Dedicated welfare scheme for girl children)
  - **Mahila Samman Savings Certificate** (2-year exclusive deposit for women)
- **Top Financial Summary**:
  - Total Post Office investment value
  - Total monthly guaranteed income (MIS)
  - Total quarterly senior returns (SCSS)
  - Scheme-wise interactive distribution Donut Chart
- **Dynamic Add Investment Form**:
  - Visual scheme selector with live government interest rates
  - Scheme-specific fields & live interest/payout calculations
  - Passbook / document photo upload with lightbox zoom modal


### 3. Dedicated Fixed Deposit Dashboard
- **Aggregate Financial Summary**:
  - Total principal invested
  - Total expected maturity payout
  - Total guaranteed interest gains
  - Weighted average annual yield (% p.a.)
- **Search & Filtering Engine**:
  - Search by bank name or account number
  - Filter by `< 3 Months (Urgent)`, `This Year (2026)`, `Long Term (> 1 Year)`, and `With Certificate`
  - Sort by maturity date (earliest/latest), amount, interest rate, bank name, or tenure
- **Flexible Desktop Views**: Instant toggle between **Card Grid View** and **Tabular Data View**.

### 4. 🎨 FD Maturity Urgency Colour Map
A consistent color spectrum indicates maturity urgency without compromising text contrast:
- **Level 1 (< 3 Months / Immediate)**: `#991B1B` *(Darkest Brick Crimson — Urgent)*
- **Level 2 (3 – 6 Months)**: `#C2410C` *(Deep Burnt Orange — Near Term)*
- **Level 3 (6 – 12 Months)**: `#D97706` *(Rich Amber — Medium Term)*
- **Level 4 (1 – 2 Years)**: `#CA8A04` *(Soft Warm Gold — Extended Term)*
- **Level 5 (> 2 Years)**: `#0284C7` *(Calm Sky Slate — Distant Future)*

### 5. Detailed FD Inspector & Add/Edit Management
- Complete attributes: Bank name, account number, principal, interest rate (% p.a.), start date, maturity date, tenure duration.
- Quarterly compounding interest calculation: $A = P \times \left(1 + \frac{r}{4}\right)^{4t}$
- Receipt/Certificate photo upload with instant local preview and lightbox zoom modal.
- Live calculation preview while adding or editing deposits.

---

## 🛠️ Technology Stack

- **Framework**: [React 19](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/)
- **Build Tool**: [Vite 8](https://vitejs.dev/)
- **Routing**: [React Router DOM v7](https://reactrouter.com/) (`HashRouter` for zero-404 static and client routing)
- **Icons**: [Lucide React](https://lucide.dev/)
- **Styling**: Vanilla CSS Design Tokens (Strict Light Theme, High-Contrast Typography)
- **Persistence**: LocalStorage Browser Sandbox (100% private, zero cloud tracking)

---

## 📁 Architecture & File Structure

```
├── index.html                           # Root entry HTML with Google Fonts
├── package.json                         # Dependencies & npm scripts
├── tsconfig.json / tsconfig.app.json    # TypeScript configurations
├── src/
│   ├── main.tsx                         # React root mount
│   ├── App.tsx                          # Route definitions, guards & toast hub
│   ├── index.css                        # CSS bundle entry
│   ├── types/index.ts                   # TypeScript interfaces (FD, Member, etc.)
│   ├── context/InvestmentContext.tsx    # State management with LocalStorage sync
│   ├── data/seedData.ts                 # Pre-loaded realistic family portfolios
│   ├── utils/
│   │   ├── calculations.ts              # Quarterly compounding interest math
│   │   └── maturityColorMap.ts          # 5-level urgency color mapping
│   ├── components/
│   │   ├── Navbar.tsx                   # Sticky nav, switcher, demo reset
│   │   ├── DonutChart.tsx               # SVG Donut chart & category tiles
│   │   ├── FdCard.tsx                   # Color-coded deposit card
│   │   ├── FdTable.tsx                  # Desktop data table view
│   │   ├── PhotoModal.tsx               # Certificate lightbox viewer
│   │   └── AddMemberModal.tsx           # Add family member dialog
│   ├── pages/
│   │   ├── LoginPage.tsx                # Security PIN & quick demo entry
│   │   ├── FamilySelectPage.tsx         # Family member selector grid
│   │   ├── HomePage.tsx                 # Net worth & portfolio allocation
│   │   ├── FdDashboardPage.tsx          # Summary, search, filter, sort
│   │   ├── FdDetailsPage.tsx            # Complete FD view, urgency banner
│   │   └── AddFdPage.tsx                # Add/edit FD with live math preview
│   └── styles/
│       ├── variables.css                # Color tokens & theme variables
│       ├── global.css                   # Base reset, typography, buttons
│       ├── components.css               # Card, navbar, table, modal styles
│       └── pages.css                    # Grid and view layouts
```

---

## 🚀 Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) (v18 or higher recommended)
- `npm`

### Installation & Run

1. **Clone the repository**:
   ```bash
   git clone https://github.com/pranay-authankar/personal-finance-analysis.git
   cd personal-finance-analysis
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Start the development server**:
   ```bash
   npm run dev
   ```
   Open [http://localhost:5173/](http://localhost:5173/) in your browser.

4. **Production Build**:
   ```bash
   npm run build
   ```

---

## 🔒 Privacy & Local Storage
All investment data is stored exclusively in your local browser sandbox (`localStorage`). No credentials, financial figures, or uploaded images are transmitted across the network in V1.
