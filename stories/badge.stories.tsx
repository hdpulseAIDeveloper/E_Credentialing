import * as React from "react";
import { Badge } from "@/components/ui/badge";

export default { title: "Primitives/Badge" };

export const Default = () => <Badge>Default</Badge>;
export const Secondary = () => <Badge variant="secondary">Secondary</Badge>;
export const Destructive = () => <Badge variant="destructive">Destructive</Badge>;
export const Outline = () => <Badge variant="outline">Outline</Badge>;
export const Success = () => <Badge variant="success">Approved</Badge>;
export const Warning = () => <Badge variant="warning">Pending</Badge>;
export const Info = () => <Badge variant="info">Info</Badge>;
