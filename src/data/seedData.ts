import type { FamilyMember } from '../types';

export const DEFAULT_SEED_MEMBERS: FamilyMember[] = [
  {
    id: 'mem_dad',
    name: 'Rajesh Sharma',
    role: 'Dad',
    avatar: '👨',
    otherAssets: {
      postOffice: 350000,
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
        maturityDate: '2026-10-25', // ~22 days left -> Level 1 (Darkest Brick Crimson - Urgent)
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
        bankName: 'Post Office Time Deposit',
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
    ]
  },
  {
    id: 'mem_mom',
    name: 'Sunita Sharma',
    role: 'Mom',
    avatar: '👩',
    otherAssets: {
      postOffice: 500000,
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
        maturityDate: '2026-11-15', // ~43 days left -> Level 1 (Urgent)
        photoUrl: ''
      },
      {
        id: 'fd_m2',
        bankName: 'Post Office Mahila Samman',
        accountNumber: '•••• 8820',
        principal: 200000,
        interestRate: 7.50,
        startDate: '2024-09-01',
        maturityDate: '2027-09-01', // ~11 months left -> Level 3
        photoUrl: ''
      },
      {
        id: 'fd_m3',
        bankName: 'HDFC Bank',
        accountNumber: '•••• 6614',
        principal: 750000,
        interestRate: 7.25,
        startDate: '2025-06-15',
        maturityDate: '2028-06-15', // ~20 months left -> Level 4
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
      postOffice: 100000,
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
    ]
  }
];
