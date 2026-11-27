import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { HeroSection } from "../components/homepage/HeroSection";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to, ...props }: any) => (
    <a href={typeof to === "string" ? to : "#"} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("../hooks/use-session", () => ({
  useSession: () => ({
    session: null,
    user: null,
    loading: false,
  }),
}));

describe("Homepage Hero UI/UX", () => {
  it("renders balanced hero value proposition, workspace CTAs, and interactive geofence preview", () => {
    render(<HeroSection />);

    expect(screen.getByText(/Exact GPS Geofenced/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Sign In to Workspace/i })).toHaveAttribute(
      "href",
      "/auth",
    );
    expect(screen.getByRole("link", { name: /Explore Geofencing/i })).toHaveAttribute(
      "href",
      "#geofencing",
    );

    const insideBtn = screen.getByRole("button", { name: /Inside Boundary \(12m\)/i });
    const outsideBtn = screen.getByRole("button", { name: /Outside Fence \(240m\)/i });

    expect(insideBtn).toHaveAttribute("aria-pressed", "true");
    expect(outsideBtn).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByText("Perimeter Verified")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Check-In Ready/i })).toBeInTheDocument();

    fireEvent.click(outsideBtn);

    expect(insideBtn).toHaveAttribute("aria-pressed", "false");
    expect(outsideBtn).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("Outside Fence")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Check-In Locked/i })).toBeInTheDocument();
  });
});
