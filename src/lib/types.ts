

export type UserRole = 'Admin' | 'User' | 'Site Manager' | 'Project Manager' | 'Foreman' | 'Engineer' | 'Safety Officer' | 'Accountant' | string;
export const userRoles: UserRole[] = ['Admin', 'User', 'Site Manager', 'Project Manager', 'Foreman', 'Engineer', 'Safety Officer', 'Accountant'];

export interface UserProfile {
    uid: string;
    email: string | null;
    name: string | null;
    role: UserRole;
    companyId?: string; // Associated company
    assignedSites?: string[]; // Array of site IDs
    hasCompletedOnboarding?: boolean;
    mobileNumber?: string;
    photoURL?: string;
}

export type Permission = 'read' | 'write' | 'delete';
export const permissions: Permission[] = ['read', 'write', 'delete'];

export interface CustomRole {
  id: string;
  name: string;
  permissions: Permission[];
}


export type SubscriptionStatus = 'Trial' | 'Active' | 'Past Due' | 'Canceled';
export const subscriptionStatuses: [SubscriptionStatus, ...SubscriptionStatus[]] = ['Trial', 'Active', 'Past Due', 'Canceled'];

export type BillingCycle = 'monthly' | 'annually';

export type PlanId = 'basic' | 'premium';
export const planIds: [PlanId, ...PlanId[]] = ['basic', 'premium'];
export type FullPlanId = `${PlanId}-${BillingCycle}`;

export interface Plan {
  id: string;
  name: PlanId;
  priceMonthly: number;
  priceAnnually: number;
  features: string[];
  isDeleted?: boolean;
  companyId?: string | null; // null for global plans
}


export interface Company {
    id: string;
    name: string;
    ownerId: string; // The UID of the user who owns this company
    createdAt: string; // ISO 8601 date string
    planId: FullPlanId;
    billingCycle: BillingCycle;
    subscriptionStatus: SubscriptionStatus;
    subscriptionEndDate?: string; // ISO 8601 date string
    enableOrderMaterials?: boolean;
    logoUrl?: string;
    logoPath?: string;
    isLocked?: boolean;
}

export interface Payment {
  id: string;
  companyId: string;
  planId: FullPlanId;
  amount: number;
  paymentDate: string;
  isDeleted?: boolean;
}


export type SiteStatus = 'Active' | 'Planning' | 'Completed' | 'On Hold' | 'Warranty Pending';
export const siteStatuses: [SiteStatus, ...SiteStatus[]] = ['Active', 'Planning', 'Completed', 'On Hold', 'Warranty Pending'];


export type SiteType = 'Construction' | 'Manufacturing';
export const siteTypes: [SiteType, ...SiteType[]] = ['Construction', 'Manufacturing'];


export interface Site {
  id: string;
  companyId: string;
  name: string;
  location: string;
  status: SiteStatus;
  type?: SiteType;
  budget?: number;
  isDeleted?: boolean;
}

export type InventoryItemType = 'Material' | 'Machine' | 'Tool';
export const inventoryItemTypes: [InventoryItemType, ...InventoryItemType[]] = ['Material', 'Machine', 'Tool'];


export type InventoryStatus = 'Bought' | 'Used' | 'Stored';
export const inventoryStatuses: [InventoryStatus, ...InventoryStatus[]] = ['Bought', 'Used', 'Stored'];

export type AcquisitionType = 'Company-Owned' | 'Rented';
export const acquisitionTypes: [AcquisitionType, ...AcquisitionType[]] = ['Company-Owned', 'Rented'];

export type PurchaseType = 'Cash' | 'Loan';
export const purchaseTypes: [PurchaseType, ...PurchaseType[]] = ['Cash', 'Loan'];

export interface InventoryItem {
  id: string;
  companyId: string;
  siteId: string;
  name: string;
  subType?: string;
  type: InventoryItemType;
  status: InventoryStatus;
  quantity: number;
  unit?: string;
  pricePerUnit?: number;
  vendor?: string;
  vendorNumber?: string;
  date: string;
  description?: string;
  lowStockThreshold?: number;
  isDeleted?: boolean;
  createdAt?: any;
}

export interface Machine {
  id: string;
  companyId: string;
  name: string;
  vehicleNumber: string;
  acquisition: AcquisitionType;
  date: string;
  assignedSiteId?: string | null;
  assignmentDate?: string;
  // Fields for company-owned machines
  purchaseType?: PurchaseType;
  purchasePrice?: number;
  interestRate?: number;
  loanTenureYears?: number;
  // Fields for rented machines
  dailyRentalPrice?: number;
  isDeleted?: boolean;
}

export type ExpenseCategory = 'Materials' | 'Labor' | 'Transport' | 'Fuel' | 'Other' | 'Rental' | 'EMI' | 'Maintenance' | 'Tools' | 'Food';
export const expenseCategories: [ExpenseCategory, ...ExpenseCategory[]] = ['Materials', 'Labor', 'Transport', 'Fuel', 'Other', 'Rental', 'EMI', 'Maintenance', 'Tools', 'Food'];

export interface Expense {
  id: string;
  companyId: string;
  siteId: string;
  description: string;
  category: ExpenseCategory;
  amount: number;
  date: string;
  machineId?: string;
  rentedMaterialId?: string;
  isDeleted?: boolean;
}

export type MaintenanceCostAllocation = 'Site Expenses' | 'General Expenses';
export const maintenanceCostAllocations: [MaintenanceCostAllocation, ...MaintenanceCostAllocation[]] = ['Site Expenses', 'General Expenses'];


export interface MaintenanceLog {
  id:string;
  companyId: string;
  machineId: string;
  task: string;
  details?: string;
  scheduledDate: string;
  kmDriven?: number;
  nextServiceKm?: number;
  cost?: number;
  costAllocation?: MaintenanceCostAllocation;
  isDeleted?: boolean;
}

export interface Document {
  id: string;
  companyId: string;
  siteId: string;
  name: string;
  url: string;
  filePath: string;
  uploadDate: string;
  expiryDate?: string;
  machineId?: string;
  isDeleted?: boolean;
  extractedText?: string;
  content?: string;
}

export type AttendanceStatus = 'Unmarked' | 'Present' | 'Absent' | 'Half-day';
export const attendanceStatuses: [AttendanceStatus, ...AttendanceStatus[]] = ['Unmarked', 'Present', 'Absent', 'Half-day'];

export type WageType = 'Daily' | 'Monthly' | 'Contract';
export const wageTypes: [WageType, ...WageType[]] = ['Daily', 'Monthly', 'Contract'];

export type EmploymentStatus = 'On Roll' | 'Off Roll';
export const employmentStatuses: [EmploymentStatus, ...EmploymentStatus[]] = ['On Roll', 'Off Roll'];

export interface Labor {
    id: string;
    companyId: string;
    siteId: string;
    name: string;
    role: string;
    wageType: WageType;
    wage?: number;
    idNumber?: string;
    dateOfJoining?: string;
    idProofUrl?: string;
    idProofFilePath?: string;
    contractType?: string;
    pricePerUnit?: number;
    unit?: string;
    isDeleted?: boolean;
    employmentStatus?: EmploymentStatus;
}

export interface Attendance {
    id: string;
    companyId: string;
    siteId: string;
    laborId: string;
    date: string; // YYYY-MM-DD
    status: AttendanceStatus;
    isDeleted?: boolean;
}

export type LaborTransactionType = 'Payment' | 'Work';
export const laborTransactionTypes: [LaborTransactionType, ...LaborTransactionType[]] = ['Payment', 'Work'];

export type PaymentMethod = 'UPI' | 'Cash' | 'Bank Transfer';
export const paymentMethods: [PaymentMethod, ...PaymentMethod[]] = ['UPI', 'Cash', 'Bank Transfer'];

export interface LaborTransaction {
  id: string;
  laborId: string;
  companyId: string;
  siteId: string;
  type: LaborTransactionType;
  amount: number;
  date: string;
  paymentMethod?: PaymentMethod;
  isDeleted?: boolean;
}

export interface WorkLog {
  id: string;
  laborerId: string;
  companyId: string;
  siteId: string;
  date: string;
  quantity: number;
  unit?: string;
  pricePerUnit: number;
  wageEarned: number;
  isDeleted?: boolean;
}


export type FuelType = 'Diesel' | 'Petrol (Gasoline)' | 'Compressed Natural Gas (CNG)' | 'Liquefied Petroleum Gas (LPG)' | 'Electric' | 'Other';
export const fuelTypes: [FuelType, ...FuelType[]] = ['Diesel', 'Petrol (Gasoline)', 'Compressed Natural Gas (CNG)', 'Liquefied Petroleum Gas (LPG)', 'Electric', 'Other'];

export interface FuelLog {
  id: string;
  companyId: string;
  siteId?: string; // Optional siteId
  vehicleName: string;
  fuelType: FuelType;
  quantity: number;
  cost: number;
  date: string;
  isDeleted?: boolean;
}

export type EmiPaymentStatus = 'Upcoming' | 'Paid' | 'Overdue';

export interface EmiPayment {
  id: string;
  companyId: string;
  machineId: string;
  dueDate: string; // YYYY-MM-DD
  amount: number;
  status: EmiPaymentStatus;
  paymentDate?: string; // YYYY-MM-DD
  isDeleted?: boolean;
}

export interface RentalPayment {
  id: string;
  companyId: string;
  machineId: string;
  amount: number;
  date: string;
  notes?: string;
  paymentMethod?: PaymentMethod;
  isDeleted?: boolean;
}

export type MachineAttendanceStatus = 'Unmarked' | 'Present' | 'Absent' | 'Half-day';
export const machineAttendanceStatuses: [MachineAttendanceStatus, ...MachineAttendanceStatus[]] = ['Unmarked', 'Present', 'Absent', 'Half-day'];

export interface MachineAttendance {
    id: string;
    companyId: string;
    machineId: string;
    date: string; // YYYY-MM-DD
    status: MachineAttendanceStatus;
    isDeleted?: boolean;
}

export interface Purchase {
  id: string;
  companyId: string;
  siteId: string;
  item: string;
  supplier: string;
  cost: number;
  quantity: number;
  date: string;
  isDeleted?: boolean;
}

export type TicketStatus = 'Open' | 'In Progress' | 'Closed';
export const ticketStatuses: [TicketStatus, ...TicketStatus[]] = ['Open', 'In Progress', 'Closed'];

export interface Ticket {
  id: string;
  companyId: string;
  userId: string;
  userName: string;
  userEmail: string;
  subject: string;
  description: string;
  status: TicketStatus;
  createdAt: string; // ISO 8601 date string
  isDeleted?: boolean;
}

export interface Theft {
  id: string;
  companyId: string;
  siteId: string;
  item: string;
  value: number;
  date: string;
  details?: string;
  isDeleted?: boolean;
}

export type OrderStatus = 'Pending' | 'Delivered';

export interface Order {
  id: string;
  companyId: string;
  siteId: string;
  materialName: string;
  quantity: number;
  vendorName?: string;
  vendorNumber?: string;
  pricePerUnit?: number;
  status: OrderStatus;
  orderDate: string;
  deliveryDate?: string;
  estimatedDeliveryDate?: string;
  isDeleted?: boolean;
}

export interface BbsItem {
  description: string;
  diameter: number;
  barCount?: number;
  length?: number;
  shape?: string;
}

export interface BBS {
  id: string;
  companyId: string;
  siteId: string;
  projectName: string;
  drawingNumber: string;
  date: string;
  items: BbsItem[];
  isDeleted?: boolean;
}

export type RentedMaterialStatus = 'Active' | 'Returned';
export const rentedMaterialStatuses: [RentedMaterialStatus, ...RentedMaterialStatus[]] = ['Active', 'Returned'];

export interface RentedMaterialPayment {
    id: string;
    amount: number;
    date: string;
    method: PaymentMethod;
    notes: string;
}

export interface RentedMaterial {
  id: string;
  companyId: string;
  siteId: string;
  materialName: string;
  quantity: number;
  unit: string;
  rentPerDay: number;
  rentedFrom: string;
  contact?: string;
  startDate: string;
  status: RentedMaterialStatus;
  remarks?: string;
  documentUrl?: string;
  documentPath?: string;
  paymentHistory?: RentedMaterialPayment[];
  isDeleted?: boolean;
  returnDate?: string;
}

export type RentedMaterialAttendanceStatus = 'Used' | 'Not Used' | 'Unmarked';
export const rentedMaterialAttendanceStatuses: [RentedMaterialAttendanceStatus, ...RentedMaterialAttendanceStatus[]] = ['Used', 'Not Used', 'Unmarked'];

export interface RentedMaterialAttendance {
  id: string;
  rentedMaterialId: string;
  companyId: string;
  siteId: string;
  date: string; // YYYY-MM-DD
  status: RentedMaterialAttendanceStatus;
  isDeleted?: boolean;
}

export type TaskStatus = 'To Do' | 'In Progress' | 'Done' | 'Blocked';
export const taskStatuses: [TaskStatus, ...TaskStatus[]] = ['To Do', 'In Progress', 'Done', 'Blocked'];

export interface Task {
  id: string;
  companyId: string;
  siteId: string;
  title: string;
  description?: string;
  assigneeId: string;
  assigneeName: string;
  dueDate: string;
  status: TaskStatus;
  reasonIfNotDone?: string;
  createdAt: string;
  isDeleted?: boolean;
}

export type ToolStatus = 'Good' | 'Needs Repair' | 'Broken';
export const toolStatuses: [ToolStatus, ...ToolStatus[]] = ['Good', 'Needs Repair', 'Broken'];

export type ShiftedMaterialStatus = 'Available' | 'Used' | 'Returned' | 'Damaged';
export const shiftedMaterialStatuses: [ShiftedMaterialStatus, ...ShiftedMaterialStatus[]] = ['Available', 'Used', 'Returned', 'Damaged'];

export interface DefectLiability {
  id: string;
  companyId: string;
  siteId: string;
  responsibleParty: string;
  completionDate: string;
  endDate: string;
  retentionAmount: number;
  retentionReleased: boolean;
  releasedAt?: string;
  notes?: string;
  isDeleted?: boolean;
  shiftedMaterials?: {
    destinations: { [destinationName: string]: { name: string; quantity: number; status: ShiftedMaterialStatus }[] };
    shiftingCost: number;
  };
  shiftedTools?: {
    destinations: { [destinationName: string]: { name: string; quantity: number; status: ToolStatus }[] };
  };
}


export interface SalePayment {
    amount: number;
    date: string;
    method: PaymentMethod;
    notes?: string;
}

export type SalePaymentStatus = 'Unpaid' | 'Partially Paid' | 'Paid';

export interface Sale {
    id: string;
    companyId: string;
    siteId: string;
    date: string;
    gradeName: string;
    quantity: number;
    salePrice: number;
    productionCost: number;
    transportCost?: number;
    buyerInfo?: string;
    destinationSiteId?: string; // for internal transfers
    materialsUsed: {
        [materialName: string]: {
            quantity: number;
            unit: string;
        }
    };
    amountPaid: number;
    paymentStatus: SalePaymentStatus;
    paymentHistory?: SalePayment[];
    totalQuantityUnit?: string;
    isDeleted?: boolean;
}

export type SitePaymentType = 'Departmental Payment' | 'Deposit';
export const sitePaymentTypes: [SitePaymentType, ...SitePaymentType[]] = ['Departmental Payment', 'Deposit'];

export type DepositStatus = 'Held' | 'Released';
export const depositStatuses: [DepositStatus, ...DepositStatus[]] = ['Held', 'Released'];


export interface SitePayment {
  id: string;
  companyId: string;
  siteId: string;
  date: string;
  amount: number;
  paymentType: SitePaymentType;
  description?: string;
  isDeleted?: boolean;
  status?: DepositStatus; // For 'Deposit' type
  releaseDate?: string;
  createdAt?: any;
}

export interface Warranty {
    id: string;
    companyId: string;
    siteId: string;
    productName: string;
    brand?: string;
    serialNumber?: string;
    purchaseDate: string;
    endDate: string;
    vendorInfo?: string;
    issueDescription?: string;
    isDeleted?: boolean;
    type: WarrantyType;
    responsibleParty: string;
}

export type WarrantyType = 'General' | 'Waterproofing' | 'Structural' | 'Electrical' | 'Plumbing' | 'Product';
export const warrantyTypes: [WarrantyType, ...WarrantyType[]] = ['General', 'Waterproofing', 'Structural', 'Electrical', 'Plumbing', 'Product'];


export interface Tool {
  id: string;
  companyId: string;
  siteId: string;
  name: string;
  quantity: number;
  status: ToolStatus;
  price?: number;
  isDeleted?: boolean;
}

export interface LandingPageContent {
  heroTitle: string;
  heroSubtitle: string;
  aboutTitle: string;
  aboutDescription: string;
  aboutImageUrl: string;
  features: { icon: string; title: string; text: string; }[];
  solutions: { title: string; desc: string; }[];
  team: { name: string; role: string; imageUrl: string; bio: string; linkedin?: string; twitter?: string; }[];
  ctaTitle: string;
  ctaSubtitle: string;
  contactTitle?: string;
  contactSubtitle?: string;
  privacyPolicyContent: string;
  termsOfServiceContent: string;
  refundPolicyContent: string;
}
