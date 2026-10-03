import type { FamilyMember } from '../types';

export const DEFAULT_SEED_MEMBERS: FamilyMember[] = [
  {
    id: 'mem_dad',
    name: 'Rajesh Sharma',
    role: 'Dad',
    avatar: '👨',
    otherAssets: {
      postOffice: 700000,
      stocksMf: 820000,
      realEstate: 3500000,
      bullions: 496000, // Synced with verified bullion total
      cashInHand: 85000
    },
    fds: [
      {
        id: 'fd_01',
        bankName: 'State Bank of India (SBI)',
        accountNumber: '•••• 8912',
        principal: 500000,
        interestRate: 7.10,
        startDate: '2025-04-15',
        maturityDate: '2026-10-25',
        photoUrl: ''
      },
      {
        id: 'fd_02',
        bankName: 'HDFC Bank',
        accountNumber: '•••• 4420',
        principal: 650000,
        interestRate: 7.25,
        startDate: '2025-02-10',
        maturityDate: '2027-02-10',
        photoUrl: ''
      },
      {
        id: 'fd_03',
        bankName: 'Bank of India',
        accountNumber: '•••• 1209',
        principal: 300000,
        interestRate: 7.50,
        startDate: '2024-08-01',
        maturityDate: '2027-08-01',
        photoUrl: ''
      },
      {
        id: 'fd_04',
        bankName: 'ICICI Bank',
        accountNumber: '•••• 7731',
        principal: 800000,
        interestRate: 7.20,
        startDate: '2025-01-15',
        maturityDate: '2028-01-15',
        photoUrl: ''
      },
      {
        id: 'fd_05',
        bankName: 'Punjab National Bank (PNB)',
        accountNumber: '•••• 9942',
        principal: 1000000,
        interestRate: 7.75,
        startDate: '2024-03-20',
        maturityDate: '2029-03-20',
        photoUrl: ''
      }
    ],
    postOfficeInvestments: [
      {
        id: 'po_01',
        schemeType: 'SCSS',
        schemeName: 'Senior Citizen Savings Scheme (SCSS)',
        accountNumber: 'PO-SCSS-88912',
        amount: 300000,
        openingDate: '2024-04-10',
        maturityDate: '2029-04-10',
        interestRate: 8.20,
        branch: 'General Post Office (GPO), Connaught Place',
        nominee: 'Sunita Sharma (Spouse)',
        quarterlyPayout: 6150,
        maturityAmount: 300000,
        photoUrl: ''
      },
      {
        id: 'po_02',
        schemeType: 'MIS',
        schemeName: 'Post Office Monthly Income Scheme (MIS)',
        accountNumber: 'PO-MIS-44310',
        amount: 250000,
        openingDate: '2024-11-01',
        maturityDate: '2029-11-01',
        interestRate: 7.40,
        branch: 'Civil Lines Head Post Office',
        nominee: 'Pranav Sharma (Son)',
        monthlyPayout: 1542,
        maturityAmount: 250000,
        photoUrl: ''
      },
      {
        id: 'po_03',
        schemeType: 'POTD',
        schemeName: 'Post Office Time Deposit (FD)',
        accountNumber: 'PO-TD-99120',
        amount: 150000,
        openingDate: '2024-11-15',
        maturityDate: '2026-11-15',
        interestRate: 7.00,
        tenureYears: 2,
        branch: 'General Post Office (GPO), Connaught Place',
        nominee: 'Sunita Sharma (Spouse)',
        maturityAmount: 172332,
        photoUrl: ''
      }
    ],
    bullionsInvestments: [
      {
        id: 'bul_01',
        type: 'GOLD',
        typeName: 'Gold (24K 999 Purity)',
        itemName: 'MMTC-PAMP 24K Minted Gold Bar',
        purchaseDate: '2024-02-15',
        purchaseRate: 6800,
        weightGrams: 50,
        weightDisplay: '50 grams',
        investedValue: 340000,
        notes: 'Serial #MMTC-88912 certified 999.9 pure gold bar',
        photoUrl: ''
      },
      {
        id: 'bul_02',
        type: 'SILVER',
        typeName: 'Silver (999 Fine)',
        itemName: 'BRPL 999 Fine Silver Bars',
        purchaseDate: '2024-08-20',
        purchaseRate: 78,
        weightGrams: 2000,
        weightDisplay: '2 kg (2 x 1kg)',
        investedValue: 156000,
        notes: 'Hallmarked bullion bars with assay certs',
        photoUrl: ''
      },
      {
        id: 'bul_03',
        type: 'GOLD',
        typeName: 'Gold (22K Sovereign)',
        itemName: 'George V Sovereign Gold Coins',
        purchaseDate: '2022-10-15',
        weightDisplay: '16 grams (2 coins)',
        // No price / rate entered -> Needs verification soon!
        notes: 'Family inheritance coins held in bank locker',
        photoUrl: ''
      }
    ]
  },
  {
    id: 'mem_mom',
    name: 'Sunita Sharma',
    role: 'Mom',
    avatar: '👩',
    otherAssets: {
      postOffice: 580000,
      stocksMf: 350000,
      realEstate: 0,
      bullions: 816500, // Synced with verified bullion total
      cashInHand: 150000
    },
    fds: [
      {
        id: 'fd_m1',
        bankName: 'Bank of Baroda',
        accountNumber: '•••• 3091',
        principal: 450000,
        interestRate: 7.40,
        startDate: '2025-05-10',
        maturityDate: '2026-11-15',
        photoUrl: ''
      },
      {
        id: 'fd_m2',
        bankName: 'HDFC Bank',
        accountNumber: '•••• 6614',
        principal: 750000,
        interestRate: 7.25,
        startDate: '2025-06-15',
        maturityDate: '2028-06-15',
        photoUrl: ''
      }
    ],
    postOfficeInvestments: [
      {
        id: 'po_m1',
        schemeType: 'MAHILA_SAMMAN',
        schemeName: 'Mahila Samman Savings Certificate',
        accountNumber: 'PO-MSSC-1092',
        amount: 200000,
        openingDate: '2024-05-15',
        maturityDate: '2027-05-15',
        interestRate: 7.50,
        branch: 'Civil Lines Sub Post Office',
        nominee: 'Rajesh Sharma (Spouse)',
        maturityAmount: 232044,
        photoUrl: ''
      },
      {
        id: 'po_m2',
        schemeType: 'RD',
        schemeName: 'National Savings Recurring Deposit (RD)',
        accountNumber: 'PO-RD-44321',
        amount: 180000,
        monthlyInstallment: 5000,
        openingDate: '2023-10-10',
        maturityDate: '2028-10-10',
        interestRate: 6.70,
        branch: 'Civil Lines Sub Post Office',
        nominee: 'Pranav Sharma (Son)',
        maturityAmount: 356830,
        photoUrl: ''
      },
      {
        id: 'po_m3',
        schemeType: 'MIS',
        schemeName: 'Post Office Monthly Income Scheme (MIS)',
        accountNumber: 'PO-MIS-77210',
        amount: 200000,
        openingDate: '2025-02-01',
        maturityDate: '2030-02-01',
        interestRate: 7.40,
        branch: 'Civil Lines Sub Post Office',
        nominee: 'Rajesh Sharma (Spouse)',
        monthlyPayout: 1233,
        maturityAmount: 200000,
        photoUrl: ''
      }
    ],
    bullionsInvestments: [
      {
        id: 'bul_m1',
        type: 'GOLD',
        typeName: 'Gold (22K Hallmarked)',
        itemName: 'Tanishq Hallmarked Gold Bangles & Ornaments',
        purchaseDate: '2023-11-10',
        purchaseRate: 6400,
        weightGrams: 110,
        weightDisplay: '110 grams',
        investedValue: 704000,
        notes: 'BIS 916 hallmarked bridal jewellery collection with invoice',
        photoUrl: ''
      },
      {
        id: 'bul_m2',
        type: 'SILVER',
        typeName: 'Silver (999 Purity)',
        itemName: 'Pure Silver Puja Thaali & Coin Set',
        purchaseDate: '2024-04-12',
        purchaseRate: 75,
        weightGrams: 1500,
        weightDisplay: '1.5 kg',
        investedValue: 112500,
        notes: 'Gifted during family anniversary',
        photoUrl: ''
      },
      {
        id: 'bul_m3',
        type: 'OTHER',
        typeName: 'Precious Gemstones',
        itemName: 'Certified Natural Burma Ruby & Gold Ring',
        purchaseDate: '2021-08-05',
        // Missing invested value -> Needs verification soon!
        notes: 'Needs current market valuation cert from jeweller',
        photoUrl: ''
      }
    ]
  },
  {
    id: 'mem_self',
    name: 'Pranav Sharma',
    role: 'Self',
    avatar: '🧑',
    otherAssets: {
      postOffice: 550000,
      stocksMf: 1450000,
      realEstate: 0,
      bullions: 116000, // Synced with verified bullion total
      cashInHand: 60000
    },
    fds: [
      {
        id: 'fd_s1',
        bankName: 'Axis Bank',
        accountNumber: '•••• 5021',
        principal: 300000,
        interestRate: 7.10,
        startDate: '2025-03-01',
        maturityDate: '2027-03-01',
        photoUrl: ''
      },
      {
        id: 'fd_s2',
        bankName: 'Kotak Mahindra Bank',
        accountNumber: '•••• 9934',
        principal: 400000,
        interestRate: 7.20,
        startDate: '2025-08-01',
        maturityDate: '2028-08-01',
        photoUrl: ''
      }
    ],
    postOfficeInvestments: [
      {
        id: 'po_s1',
        schemeType: 'PPF',
        schemeName: 'Public Provident Fund (PPF)',
        accountNumber: 'PO-PPF-881023',
        amount: 450000,
        currentBalance: 450000,
        financialYearContribution: 150000,
        openingDate: '2021-04-01',
        maturityDate: '2036-04-01',
        interestRate: 7.10,
        branch: 'Nehru Place Head Post Office',
        nominee: 'Sunita Sharma (Mother)',
        photoUrl: ''
      },
      {
        id: 'po_s2',
        schemeType: 'NSC',
        schemeName: 'National Savings Certificate (NSC)',
        accountNumber: 'PO-NSC-66712',
        amount: 100000,
        openingDate: '2023-08-01',
        maturityDate: '2028-08-01',
        interestRate: 7.70,
        branch: 'Nehru Place Head Post Office',
        nominee: 'Rajesh Sharma (Father)',
        maturityAmount: 144903,
        photoUrl: ''
      }
    ],
    bullionsInvestments: [
      {
        id: 'bul_s1',
        type: 'GOLD',
        typeName: 'Gold (24K 999.9)',
        itemName: 'Augmont 24K Gold Bar',
        purchaseDate: '2025-01-10',
        purchaseRate: 7800,
        weightGrams: 10,
        weightDisplay: '10 grams',
        investedValue: 78000,
        notes: 'Tamper-proof certicard bar',
        photoUrl: ''
      },
      {
        id: 'bul_s2',
        type: 'PLATINUM',
        typeName: 'Platinum (950 Purity)',
        itemName: 'Valcambi Suisse 950 Platinum Bar',
        purchaseDate: '2024-06-15',
        purchaseRate: 3800,
        weightGrams: 10,
        weightDisplay: '10 grams',
        investedValue: 38000,
        notes: 'Swiss assay certified investment bar',
        photoUrl: ''
      }
    ]
  }
];
