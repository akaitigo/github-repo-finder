import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { axe } from "vitest-axe";
import { RepositoryDetail } from "./repository-detail";
import { buildRepository } from "@/../tests/helpers/factories/repository";

describe("RepositoryDetail", () => {
  it("star / watcher / fork / issue の 4 count を全表示", () => {
    render(
      <RepositoryDetail
        repository={buildRepository({
          stargazersCount: 100,
          watchersCount: 50,
          forksCount: 30,
          openIssuesCount: 10,
        })}
      />,
    );
    expect(screen.getByText("Star")).toBeInTheDocument();
    expect(screen.getByText("Watcher")).toBeInTheDocument();
    expect(screen.getByText("Fork")).toBeInTheDocument();
    expect(screen.getByText("Open Issue")).toBeInTheDocument();
    expect(screen.getByText("100")).toBeInTheDocument();
    expect(screen.getByText("50")).toBeInTheDocument();
    expect(screen.getByText("30")).toBeInTheDocument();
    expect(screen.getByText("10")).toBeInTheDocument();
  });

  it("owner avatar が alt つきで表示される", () => {
    render(
      <RepositoryDetail
        repository={buildRepository({
          owner: {
            login: "facebook",
            avatarUrl: "https://avatars.githubusercontent.com/u/69631?v=4",
          },
        })}
      />,
    );
    const avatar = screen.getByAltText(/facebook のアバター/);
    expect(avatar).toBeInTheDocument();
  });

  it("language が null でも表示崩れしない", () => {
    render(
      <RepositoryDetail repository={buildRepository({ language: null })} />,
    );
    expect(screen.queryByText("JavaScript")).not.toBeInTheDocument();
  });

  it("description が null でも表示崩れしない", () => {
    const { container } = render(
      <RepositoryDetail
        repository={buildRepository({
          description: null,
          fullName: "test/repo",
        })}
      />,
    );
    expect(container).toBeInTheDocument();
  });

  it("GitHub URL は noopener noreferrer で外部リンク", () => {
    render(
      <RepositoryDetail
        repository={buildRepository({
          htmlUrl: "https://github.com/facebook/react",
        })}
      />,
    );
    const link = screen.getByRole("link", { name: "GitHub で開く" });
    expect(link).toHaveAttribute("href", "https://github.com/facebook/react");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("a11y: 違反 0", async () => {
    const { container } = render(
      <RepositoryDetail repository={buildRepository()} />,
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
