'use client';

import { useEffect, useState } from 'react';

interface RepoData {
  stargazers_count: number;
  license: { spdx_id: string } | null;
}

const GitHubIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
  </svg>
);

export default function GitHubLink() {
  const [repoData, setRepoData] = useState<RepoData | null>(null);
  const [isHovered, setIsHovered] = useState(false);

  const repoOwner = 'gxwtf';
  const repoName = 'gxphotos';
  const repoUrl = `https://github.com/${repoOwner}/${repoName}`;

  useEffect(() => {
    const fetchRepoData = async () => {
      try {
        const response = await fetch(`https://api.github.com/repos/${repoOwner}/${repoName}`);
        if (response.ok) {
          const data = await response.json();
          setRepoData(data);
        }
      } catch (error) {
        console.error('Failed to fetch repo data:', error);
      }
    };
    fetchRepoData();
  }, []);

  return (
    <a
      href={repoUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="fixed top-4 right-4 z-50"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="relative flex items-center gap-2 px-3 py-2 rounded-full bg-background/80 backdrop-blur-sm border border-border shadow-sm hover:bg-muted transition-colors">
        <GitHubIcon className="size-5 shrink-0" />

        {/* Desktop: 显示仓库名和 star 数量 */}
        <span className="hidden sm:inline text-sm font-medium">
          {repoOwner}/{repoName}
        </span>

        {repoData && (
          <span className="hidden sm:inline-flex items-center gap-1 text-sm text-muted-foreground">
            <svg className="size-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
            </svg>
            {repoData.stargazers_count}
          </span>
        )}

        {/* Hover tooltip */}
        {isHovered && (
          <div className="absolute top-full right-0 mt-2 py-2 px-3 bg-popover border border-border rounded-lg shadow-lg text-sm whitespace-nowrap">
            <div className="font-medium mb-1">{repoOwner}/{repoName}</div>
            {repoData && (
              <>
                <div className="flex items-center gap-1 text-muted-foreground">
                  <svg className="size-3" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                  </svg>
                  {repoData.stargazers_count} stars
                </div>
                {repoData.license && (
                  <div className="text-muted-foreground mt-1">
                    License: {repoData.license.spdx_id}
                  </div>
                )}
              </>
            )}
            {!repoData && (
              <div className="text-muted-foreground">加载中...</div>
            )}
          </div>
        )}
      </div>
    </a>
  );
}
