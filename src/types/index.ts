export interface PasswordEntry {
  id: string;
  title: string;
  username?: string;
  encryptedPassword: string;
  website?: string;
  category?: string;
  notes?: string;
  tags?: string;
  expiryDate?: string;
  strength: number;
  lastUsed?: string;
  isGlobal: boolean;
  isTeam: boolean;
  teamId?: string;
  encryptionType: string;
  icon?: string;
  color?: string;
  label?: string;
  userId: string;
  serviceId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface User {
  id: string;
  name?: string;
  firstName?: string;
  lastName?: string;
  email: string;
  username: string;
  isActive: boolean;
  isVerified: boolean;
  department?: string;
  position?: string;
  jobTitle?: string;
  phone?: string;
  location?: string;
  image?: string;
  role?: string;
  accountType?: string;
  organizationId?: string;
  encryptionEnabled?: boolean;
  twoFactorEnabled?: boolean;
  createdAt: string;
}

export interface Team {
  id: string;
  name: string;
  description?: string;
  isActive: boolean;
  isPrivate: boolean;
  icon?: string;
  color?: string;
  label?: string;
  createdBy?: string;
  memberCount?: number;
  role?: string;
}

export interface Category {
  id: string;
  name: string;
  description?: string;
  color?: string;
  icon?: string;
  isActive: boolean;
}

export interface AuditLogEntry {
  id: string;
  userId?: string;
  action: string;
  resource?: string;
  details?: string;
  ipAddress?: string;
  userAgent?: string;
  createdAt: string;
}

export interface ScanResult {
  type: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  affectedCount: number;
  affectedPasswords: string[];
}

export interface Permission {
  id: string;
  name: string;
  description?: string;
  resource?: string;
  action?: string;
  scope?: string;
}

export interface Role {
  id: string;
  name: string;
  description?: string;
  permissions?: string;
  isSystem: boolean;
  isActive: boolean;
}
