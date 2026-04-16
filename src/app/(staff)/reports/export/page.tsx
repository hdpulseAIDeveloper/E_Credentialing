import { ExportHandler } from "@/components/reports/ExportHandler";

interface SearchParams {
  type?: string;
}

export default async function ExportPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  return <ExportHandler type={params.type || "providers"} />;
}
