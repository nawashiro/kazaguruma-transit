import { render, screen, act } from "@testing-library/react";
import KofiSupportCard from "../KofiSupportCard";

describe("KofiSupportCard", () => {
  beforeEach(() => {
    global.fetch = jest.fn().mockImplementation(() =>
      Promise.resolve({
        json: () =>
          Promise.resolve({ success: true, data: { isLoggedIn: false } }),
      })
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("renders support card when not logged in", async () => {
    await act(async () => {
      render(<KofiSupportCard />);
    });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(screen.getByText(/Ko-fiで支援する/)).toBeInTheDocument();
  });

  it("does not render when logged in", async () => {
    global.fetch = jest.fn().mockImplementation(() =>
      Promise.resolve({
        json: () =>
          Promise.resolve({ success: true, data: { isLoggedIn: true } }),
      })
    );

    await act(async () => {
      render(<KofiSupportCard />);
    });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(screen.queryByText(/Ko-fiで支援する/)).not.toBeInTheDocument();
  });
});
