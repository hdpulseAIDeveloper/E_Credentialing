import * as React from "react";
import { Button } from "@/components/ui/button";

export default { title: "Primitives/Button" };

export const Default = () => <Button>Click me</Button>;
export const Destructive = () => <Button variant="destructive">Delete</Button>;
export const Outline = () => <Button variant="outline">Cancel</Button>;
export const Secondary = () => <Button variant="secondary">Save Draft</Button>;
export const Ghost = () => <Button variant="ghost">Skip</Button>;
export const Link = () => <Button variant="link">Read more</Button>;
export const Small = () => <Button size="sm">Small</Button>;
export const Large = () => <Button size="lg">Large</Button>;
export const Disabled = () => <Button disabled>Unavailable</Button>;
