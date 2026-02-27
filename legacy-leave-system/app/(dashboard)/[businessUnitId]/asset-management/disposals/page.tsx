import { redirect } from "next/navigation"

interface DisposalsRedirectPageProps {
  params: Promise<{
    businessUnitId: string
  }>
  searchParams: Promise<{
    [key: string]: string | string[] | undefined
  }>
}

export default async function DisposalsRedirectPage({ params, searchParams }: DisposalsRedirectPageProps) {
  const { businessUnitId } = await params
  const searchParamsObj = await searchParams
  
  // Create new search params with tab=disposals
  const newSearchParams = new URLSearchParams()
  newSearchParams.set('tab', 'disposals')
  
  // Preserve other search params
  Object.entries(searchParamsObj).forEach(([key, value]) => {
    if (typeof value === 'string') {
      newSearchParams.set(key, value)
    }
  })
  
  // Redirect to the consolidated retirements page with disposals tab
  redirect(`/${businessUnitId}/asset-management/retirements?${newSearchParams.toString()}`)
}