import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { DiscussionRoleCard } from "../DiscussionRoleCard";

describe("DiscussionRoleCard", () => {
  it("shows only user permissions for users", () => {
    render(<DiscussionRoleCard role="user" />);

    expect(screen.getByText("あなたはユーザーです。"))
      .toBeInTheDocument();
    expect(screen.getByText("ユーザーとして、会話に参加できます。"))
      .toBeInTheDocument();
    expect(screen.queryByText("管理人として、モデレーターを指名できます。"))
      .not.toBeInTheDocument();
  });

  it("shows moderator permissions for moderators", () => {
    render(<DiscussionRoleCard role="moderator" />);

    expect(screen.getByText("あなたはモデレーターです。"))
      .toBeInTheDocument();
    expect(screen.getByText("モデレーターとして、会話の掲載申請を承認できます。"))
      .toBeInTheDocument();
    expect(screen.queryByText("管理人として、モデレーターを指名できます。"))
      .not.toBeInTheDocument();
  });

  it("shows all permissions for administrators", () => {
    render(<DiscussionRoleCard role="admin" />);

    expect(screen.getByText("あなたは管理人です。"))
      .toBeInTheDocument();
    expect(screen.getByText("管理人として、モデレーターを指名できます。"))
      .toBeInTheDocument();
  });
});
