import type { FamilyMember } from '../types';

export const DEFAULT_SEED_MEMBERS: FamilyMember[] = [
  {
    id: 'mem_dad',
    name: 'Rajesh Sharma',
    role: 'Dad',
    avatar: '👨',
    otherAssets: {
      postOffice: 700000, // Sync with postOfficeInvestments total
      stocksMf: 820000,
      realEstate: 3500000,
      bullions: 540000,
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
        maturityDate: '2026-10-25', // ~21 days left -> Level 1 (Darkest Brick Crimson - Urgent)
        photoUrl: ''
      },
      {
        id: 'fd_02',
        bankName: 'HDFC Bank',
        accountNumber: '•••• 4420',
        principal: 650000,
        interestRate: 7.25,
        startDate: '2025-02-10',
        maturityDate: '2027-02-10', // ~4 months left -> Level 2 (Deep Burnt Orange)
        photoUrl: ''
      },
      {
        id: 'fd_03',
        bankName: 'Bank of India',
        accountNumber: '•••• 1209',
        principal: 300000,
        interestRate: 7.50,
        startDate: '2024-08-01',
        maturityDate: '2027-08-01', // ~10 months left -> Level 3 (Rich Amber)
        photoUrl: ''
      },
      {
        id: 'fd_04',
        bankName: 'ICICI Bank',
        accountNumber: '•••• 7731',
        principal: 800000,
        interestRate: 7.20,
        startDate: '2025-01-15',
        maturityDate: '2028-01-15', // ~15 months left -> Level 4 (Soft Warm Gold)
        photoUrl: ''
      },
      {
        id: 'fd_05',
        bankName: 'Punjab National Bank (PNB)',
        accountNumber: '•••• 9942',
        principal: 1000000,
        interestRate: 7.75, // Senior Citizen Rate
        startDate: '2024-03-20',
        maturityDate: '2029-03-20', // ~2.5 years left -> Level 5 (Calm Sky Slate)
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
        maturityDate: '2026-11-15', // ~42 days left -> Level 1 (Urgent)
        interestRate: 7.00,
        tenureYears: 2,
        branch: 'General Post Office (GPO), Connaught Place',
        nominee: 'Sunita Sharma (Spouse)',
        maturityAmount: 172332,
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
      bullions: 950000,
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
        maturityDate: '2026-11-15', // ~42 days left -> Level 1 (Urgent)
        photoUrl: ''
      },
      {
        id: 'fd_m2',
        bankName: 'HDFC Bank',
        accountNumber: '•••• 6614',
        principal: 750000,
        interestRate: 7.25,
        startDate: '2025-06-15',
        maturityDate: '2028-06-15', // ~20 months left -> Level 4
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
        maturityDate: '2027-05-15', // ~7 months left -> Level 3
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
        amount: 180000, // Deposited so far (36 months x 5,000)
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
      bullions: 120000,
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
        maturityDate: '2027-03-01', // ~5 months left -> Level 2
        photoUrl: ''
      },
      {
        id: 'fd_s2',
        bankName: 'Kotak Mahindra Bank',
        accountNumber: '•••• 9934',
        principal: 400000,
        interestRate: 7.20,
        startDate: '2025-08-01',
        maturityDate: '2028-08-01', // ~22 months left -> Level 4
        photoUrl: ''
      }
    ],
    postOfficeInvestments: [
      {
        id: 'po_s1',
        schemeType: 'PPF',
        schemeName: 'Public Provident Fund (PPF)',
        accountNumber: 'PO-PPF-881023',
        amount: 450000, // Current balance
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
    ]
  }
];
