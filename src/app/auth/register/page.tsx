import { allowsCompanyAccounts } from '@/lib/edition';
import RegisterClient from './RegisterClient';

export default function RegisterPage() {
  return <RegisterClient allowCompany={allowsCompanyAccounts()} />;
}
