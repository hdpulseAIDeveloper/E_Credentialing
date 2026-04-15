import { api } from "@/trpc/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default async function AdminProviderTypesPage() {
  const providerTypes = await api.admin.listProviderTypes();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Provider Types</h1>
        <Button size="sm">Add Provider Type</Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Configured Types ({providerTypes.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Code</TableHead>
                <TableHead>Required Docs</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {providerTypes.map((pt) => (
                <TableRow key={pt.id}>
                  <TableCell className="font-medium">{pt.name}</TableCell>
                  <TableCell className="font-mono text-sm">{pt.abbreviation}</TableCell>
                  <TableCell>{pt.documentRequirements.length}</TableCell>
                  <TableCell>
                    <Badge variant={pt.isActive ? "default" : "secondary"}>
                      {pt.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
              {providerTypes.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                    No provider types configured.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
