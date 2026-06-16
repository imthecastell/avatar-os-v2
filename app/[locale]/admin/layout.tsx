import AdminNav from '@/components/admin/AdminNav'

export default async function AdminLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params

  return (
    <div className="flex flex-col h-screen overflow-hidden" style={{ background: '#07070e', color: 'white' }}>
      <AdminNav locale={locale} />
      <main className="flex-1 flex flex-col overflow-hidden">
        {children}
      </main>
    </div>
  )
}
