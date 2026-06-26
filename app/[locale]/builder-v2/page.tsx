import BuilderV2 from '@/components/builder-v2/BuilderV2'

export default async function BuilderV2Page({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  await params
  return <BuilderV2 />
}
