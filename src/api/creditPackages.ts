import { http } from '@/api/client'
import type { CreditPackage } from '@/types/domain'

export interface CreditPackageWriteBody {
  code?: string
  name?: string
  amount_cents?: number
  credits?: number
  status?: string
}

export type CreditPackageCreateBody = CreditPackageWriteBody &
  Required<Pick<CreditPackageWriteBody, 'code' | 'name' | 'amount_cents' | 'credits'>>

export type CreditPackageUpdateBody = Omit<CreditPackageWriteBody, 'code'>

export const listCreditPackages = () =>
  http.get<CreditPackage[]>('/admin/credit-packages')

export const createCreditPackage = (body: CreditPackageCreateBody) =>
  http.post<CreditPackage>('/admin/credit-packages', body)

export const updateCreditPackage = (id: number, body: CreditPackageUpdateBody) =>
  http.patch<CreditPackage>(`/admin/credit-packages/${id}`, body)

export const enableCreditPackage = (id: number) =>
  http.post<CreditPackage>(`/admin/credit-packages/${id}/enable`)

export const disableCreditPackage = (id: number) =>
  http.post<CreditPackage>(`/admin/credit-packages/${id}/disable`)
