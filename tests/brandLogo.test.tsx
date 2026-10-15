import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import BrandLogo, { getBrandArtworkUrl } from "../src/components/brand/BrandLogo";

const ARTWORK_URL = "https://brand.example.test/claude.svg";

afterEach(cleanup);

describe("Claude brand mark", () => {
  it("draws the default mark from local radial vectors without requesting artwork", () => {
    const { container } = render(<BrandLogo />);

    expect(screen.getByRole("img", { name: "Claude" })).toBeTruthy();
    expect(screen.getByText("Claude")).toBeTruthy();
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelectorAll('[data-mark="claude-spark"] line')).toHaveLength(12);
  });

  it("opts into hosted artwork only when a URL is supplied", () => {
    expect(getBrandArtworkUrl(undefined)).toBeUndefined();
    expect(getBrandArtworkUrl({ VITE_BRAND_LOGO_URL: "  " })).toBeUndefined();
    expect(getBrandArtworkUrl({ VITE_BRAND_LOGO_URL: ` ${ARTWORK_URL} ` })).toBe(ARTWORK_URL);
  });
});
