import * as React from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default { title: "Primitives/Card" };

export const Basic = () => (
  <Card className="w-80">
    <CardHeader>
      <CardTitle>Provider</CardTitle>
      <CardDescription>Active credentialing record</CardDescription>
    </CardHeader>
    <CardContent>Dr. Carol Lee, MD — Internal Medicine</CardContent>
    <CardFooter>
      <Button>Open</Button>
    </CardFooter>
  </Card>
);

export const ContentOnly = () => (
  <Card className="w-80">
    <CardContent className="pt-6">No header, just content.</CardContent>
  </Card>
);
