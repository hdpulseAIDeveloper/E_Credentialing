import * as React from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default { title: "Primitives/Select" };

// We deliberately do NOT auto-open the select in stories — Radix portals
// trip up jsdom rendering. The render harness only needs the trigger.

export const Closed = () => (
  <Select>
    <SelectTrigger className="w-72">
      <SelectValue placeholder="Pick a status" />
    </SelectTrigger>
    <SelectContent>
      <SelectItem value="active">Active</SelectItem>
      <SelectItem value="inactive">Inactive</SelectItem>
    </SelectContent>
  </Select>
);

export const Disabled = () => (
  <Select disabled>
    <SelectTrigger className="w-72">
      <SelectValue placeholder="Disabled" />
    </SelectTrigger>
    <SelectContent>
      <SelectItem value="x">x</SelectItem>
    </SelectContent>
  </Select>
);
