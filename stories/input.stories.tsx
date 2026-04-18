import * as React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default { title: "Primitives/Input" };

export const Default = () => <Input placeholder="Type here" />;

export const Email = () => <Input type="email" placeholder="you@example.com" />;

export const Disabled = () => <Input value="Read-only" disabled readOnly />;

export const WithLabel = () => (
  <div className="space-y-1.5 w-72">
    <Label htmlFor="npi">NPI</Label>
    <Input id="npi" placeholder="10 digits" />
  </div>
);

export const FilePicker = () => <Input type="file" accept=".pdf,.png,.jpg" />;
