/** Shared (client-safe) directory sync field catalog - no Node/Prisma imports. */

export const DIRECTORY_MAPPABLE_FIELDS = [
  'firstName',
  'lastName',
  'name',
  'department',
  'jobTitle',
  'phone',
  'location',
] as const;

export type DirectoryMappableField = (typeof DIRECTORY_MAPPABLE_FIELDS)[number];

export type DirectoryFieldMapping = Partial<Record<DirectoryMappableField, boolean>>;

export const DEFAULT_FIELD_MAPPING: DirectoryFieldMapping = {
  firstName: true,
  lastName: true,
  name: true,
  department: true,
  jobTitle: true,
  phone: true,
  location: true,
};
