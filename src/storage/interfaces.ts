import type {
  FamilyMemberRecord,
  AssetRecord,
  FdRecord,
  PostOfficeRecord,
  BullionRecord,
  PropertyRecord,
  RentRecord,
  AssetSaleRecord,
  PaymentRecord,
  DocumentRecord,
  ContributionRecord
} from '../types';

export type StorageBackendType = 'CSV' | 'ENCRYPTED_SQLITE' | 'NATIVE_ANDROID';

/**
 * High-level repository interface for FamilyVault.
 * Decouples the React UI and financial calculations from the underlying persistence layer.
 * Any storage backend (CSV for web development, SQLCipher on desktop, native Keystore/SQLCipher on Android)
 * implements this interface.
 */
export interface IVaultStorageAdapter {
  getStorageType(): StorageBackendType;
  isEncrypted(): boolean;
  loadAll(): Promise<void>;

  // Family Members
  getFamilyMembers(): FamilyMemberRecord[];
  addFamilyMember(member: FamilyMemberRecord): Promise<void>;
  updateFamilyMember(memberId: string, updates: Partial<FamilyMemberRecord>): Promise<void>;
  deleteFamilyMember(memberId: string): Promise<void>;

  // Assets
  getAssets(): AssetRecord[];
  addAsset(asset: AssetRecord): Promise<void>;
  updateAsset(assetId: string, updates: Partial<AssetRecord>): Promise<void>;
  deleteAsset(assetId: string): Promise<void>;

  // Fixed Deposits
  getFds(): FdRecord[];
  addFd(fd: FdRecord): Promise<void>;
  updateFd(fdId: string, updates: Partial<FdRecord>): Promise<void>;
  deleteFd(fdId: string): Promise<void>;

  // Post Office Investments
  getPostOffice(): PostOfficeRecord[];
  addPostOffice(item: PostOfficeRecord): Promise<void>;
  updatePostOffice(poId: string, updates: Partial<PostOfficeRecord>): Promise<void>;
  deletePostOffice(poId: string): Promise<void>;

  // Bullions
  getBullions(): BullionRecord[];
  addBullion(item: BullionRecord): Promise<void>;
  updateBullion(bId: string, updates: Partial<BullionRecord>): Promise<void>;
  deleteBullion(bId: string): Promise<void>;

  // Properties
  getProperties(): PropertyRecord[];
  addProperty(property: PropertyRecord): Promise<void>;
  updateProperty(pId: string, updates: Partial<PropertyRecord>): Promise<void>;
  deleteProperty(pId: string): Promise<void>;

  // Rents
  getRents(): RentRecord[];
  addRent(rent: RentRecord): Promise<void>;
  updateRent(rId: string, updates: Partial<RentRecord>): Promise<void>;
  deleteRent(rId: string): Promise<void>;

  // Asset Sales
  getAssetSales(): AssetSaleRecord[];
  addAssetSale(sale: AssetSaleRecord): Promise<void>;

  // Payments
  getPayments(): PaymentRecord[];
  addPayment(payment: PaymentRecord): Promise<void>;
  updatePayment(paymentId: string, updates: Partial<PaymentRecord>): Promise<void>;
  deletePayment(paymentId: string): Promise<void>;

  // Documents
  getDocuments(): DocumentRecord[];
  addDocument(doc: DocumentRecord): Promise<void>;
  deleteDocument(docId: string): Promise<void>;

  // Contributions
  getContributions(): ContributionRecord[];
  addContribution(item: ContributionRecord): Promise<void>;
  updateContribution(cId: string, updates: Partial<ContributionRecord>): Promise<void>;
  deleteContribution(cId: string): Promise<void>;
}
