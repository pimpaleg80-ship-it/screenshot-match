import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { HeroPanel, SignInPanel } from "../components/auth/signin";

describe("Sign-in UI components", () => {
  it("renders HeroPanel headline, feature list, security note, and logo", () => {
    render(<HeroPanel />);
    expect(screen.getByText(/Complete HR software for/i)).toBeInTheDocument();
    expect(screen.getByText(/every business\./i)).toBeInTheDocument();
    expect(screen.getByText("Attendance")).toBeInTheDocument();
    expect(screen.getByText(/Protected by enterprise-grade encryption/i)).toBeInTheDocument();
    expect(screen.getByAltText("Flowpeople logo")).toBeInTheDocument();
  });

  it("submits credentials via onSubmit and displays thrown Error message under fields", async () => {
    const onSubmit = vi
      .fn()
      .mockRejectedValueOnce(new Error("Invalid login credentials"));

    render(<SignInPanel onSubmit={onSubmit} />);

    fireEvent.change(screen.getByLabelText("Work email"), {
      target: { value: "  Admin@Fluxora.com  " },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "secret123" },
    });

    // Toggle password visibility button
    const toggleBtn = screen.getByRole("button", { name: "Show password" });
    fireEvent.click(toggleBtn);
    expect(screen.getByLabelText("Password")).toHaveAttribute("type", "text");
    expect(screen.getByRole("button", { name: "Hide password" })).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({
        email: "Admin@Fluxora.com",
        password: "secret123",
      });
      expect(screen.getByRole("alert")).toHaveTextContent("Invalid login credentials");
    });

    expect(screen.getByRole("link", { name: "Privacy Policy" })).toHaveAttribute("href", "/privacy");
    expect(screen.getByRole("link", { name: "Terms & Conditions" })).toHaveAttribute("href", "/terms");
    expect(screen.getByRole("link", { name: "hqfluxora@gmail.com" })).toHaveAttribute("href", "mailto:hqfluxora@gmail.com");
  });
});
