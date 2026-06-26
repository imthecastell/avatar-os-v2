import SVGProcessor from '@/components/svg-processor/SVGProcessor'

export default async function SVGProcessorPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  await params
  return <SVGProcessor />
}
